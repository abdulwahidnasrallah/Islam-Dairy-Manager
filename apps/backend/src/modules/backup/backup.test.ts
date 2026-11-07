import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../services/audit.service", () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}));

const disconnectDatabaseMock = vi.fn().mockResolvedValue(undefined);
const connectMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../../config/prisma", () => ({
  prisma: { $connect: (...args: unknown[]) => connectMock(...args) },
  disconnectDatabase: (...args: unknown[]) => disconnectDatabaseMock(...args),
}));

const existsMock = vi.fn();
const createMock = vi.fn();
const restoreFromMock = vi.fn().mockResolvedValue(undefined);
const deleteMock = vi.fn().mockResolvedValue(undefined);

vi.mock("./backup.repository", () => ({
  backupRepository: {
    exists: (...args: unknown[]) => existsMock(...args),
    create: (...args: unknown[]) => createMock(...args),
    restoreFrom: (...args: unknown[]) => restoreFromMock(...args),
    delete: (...args: unknown[]) => deleteMock(...args),
    resolveSafePath: vi.fn((f: string) => `/data/backups/${f}`),
  },
}));

import { backupService } from "./backup.service";

describe("backupService.restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsMock.mockReturnValue(true);
    createMock.mockResolvedValue({
      filename: "backup-2026-08-08T12-00-00.db",
      sizeBytes: 1000,
      createdAt: new Date().toISOString(),
    });
  });

  it("rejects restoring a backup that doesn't exist", async () => {
    existsMock.mockReturnValue(false);

    await expect(backupService.restore("backup-nope.db", "user_1")).rejects.toMatchObject({
      errorCode: "BACKUP_NOT_FOUND",
    });

    expect(createMock).not.toHaveBeenCalled();
    expect(restoreFromMock).not.toHaveBeenCalled();
  });

  it("takes a safety backup, disconnects, restores, then reconnects — in that order", async () => {
    const calls: string[] = [];
    createMock.mockImplementation(async () => {
      calls.push("create-safety-backup");
      return { filename: "backup-safety.db", sizeBytes: 1, createdAt: new Date().toISOString() };
    });
    disconnectDatabaseMock.mockImplementation(async () => {
      calls.push("disconnect");
    });
    restoreFromMock.mockImplementation(async () => {
      calls.push("restore-file");
    });
    connectMock.mockImplementation(async () => {
      calls.push("reconnect");
    });

    const result = await backupService.restore("backup-2026-08-08T12-00-00.db", "user_1");

    expect(calls).toEqual(["create-safety-backup", "disconnect", "restore-file", "reconnect"]);
    expect(result.safetyBackupFilename).toBe("backup-safety.db");
  });

  it("still reconnects even if the file copy fails", async () => {
    restoreFromMock.mockRejectedValue(new Error("disk full"));

    await expect(backupService.restore("backup-2026-08-08T12-00-00.db", "user_1")).rejects.toThrow(
      "disk full",
    );

    expect(connectMock).toHaveBeenCalled();
  });
});

describe("backupService.remove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects deleting a backup that doesn't exist", async () => {
    existsMock.mockReturnValue(false);

    await expect(backupService.remove("backup-nope.db", "user_1")).rejects.toMatchObject({
      errorCode: "BACKUP_NOT_FOUND",
    });

    expect(deleteMock).not.toHaveBeenCalled();
  });
});
