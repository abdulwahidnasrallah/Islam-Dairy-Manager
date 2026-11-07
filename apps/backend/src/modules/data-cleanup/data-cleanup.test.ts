import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanupOperationalDataSchema } from "@idm/shared-validation";

const findUniqueMock = vi.fn();
vi.mock("../../config/prisma", () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => findUniqueMock(...args) } },
}));

const verifyPasswordMock = vi.fn();
vi.mock("../../services/password.service", () => ({
  passwordService: { verify: (...args: unknown[]) => verifyPasswordMock(...args) },
}));

const auditLogMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../../services/audit.service", () => ({
  auditService: { log: (...args: unknown[]) => auditLogMock(...args) },
}));

const deleteAllOperationalDataMock = vi.fn();
vi.mock("./data-cleanup.repository", () => ({
  dataCleanupRepository: {
    deleteAllOperationalData: () => deleteAllOperationalDataMock(),
  },
}));

import { dataCleanupService } from "./data-cleanup.service";

describe("cleanupOperationalDataSchema", () => {
  it("accepts confirmation exactly equal to 'DELETE' with a non-empty password", () => {
    const result = cleanupOperationalDataSchema.safeParse({ confirmation: "DELETE", password: "secret" });
    expect(result.success).toBe(true);
  });

  it("rejects any confirmation text other than the exact string 'DELETE'", () => {
    for (const bad of ["delete", "Delete", "DELETE ", " DELETE", "CONFIRM", ""]) {
      const result = cleanupOperationalDataSchema.safeParse({ confirmation: bad, password: "secret" });
      expect(result.success).toBe(false);
    }
  });

  it("rejects a missing or empty password even with correct confirmation", () => {
    const result = cleanupOperationalDataSchema.safeParse({ confirmation: "DELETE", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("dataCleanupService.cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findUniqueMock.mockResolvedValue({ id: "user_1", passwordHash: "hashed" });
  });

  it("rejects when the acting user's password is wrong, and never touches the database", async () => {
    verifyPasswordMock.mockResolvedValue(false);

    await expect(
      dataCleanupService.cleanup({ confirmation: "DELETE", password: "wrong" }, "user_1"),
    ).rejects.toMatchObject({ errorCode: "INVALID_PASSWORD" });

    expect(deleteAllOperationalDataMock).not.toHaveBeenCalled();
    expect(auditLogMock).not.toHaveBeenCalled();
  });

  it("rejects when the acting user record can't be found", async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(
      dataCleanupService.cleanup({ confirmation: "DELETE", password: "anything" }, "ghost_user"),
    ).rejects.toMatchObject({ errorCode: "USER_NOT_FOUND" });

    expect(deleteAllOperationalDataMock).not.toHaveBeenCalled();
  });

  it("runs the deletion and logs an audit entry when the password is correct", async () => {
    verifyPasswordMock.mockResolvedValue(true);
    deleteAllOperationalDataMock.mockResolvedValue({
      InvoiceItem: 3,
      Invoice: 2,
      Customer: 1,
      Product: 4,
    });

    const result = await dataCleanupService.cleanup(
      { confirmation: "DELETE", password: "correct" },
      "user_1",
    );

    expect(deleteAllOperationalDataMock).toHaveBeenCalledTimes(1);
    expect(result.deletedCounts.Product).toBe(4);

    expect(auditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        action: "CLEANUP_OPERATIONAL_DATA",
        entityType: "System",
      }),
    );
  });

  it("verifies the password against the acting user's own hash, not a hardcoded one", async () => {
    verifyPasswordMock.mockResolvedValue(true);
    deleteAllOperationalDataMock.mockResolvedValue({});

    await dataCleanupService.cleanup({ confirmation: "DELETE", password: "correct" }, "user_1");

    expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: "user_1" } });
    expect(verifyPasswordMock).toHaveBeenCalledWith("hashed", "correct");
  });
});
