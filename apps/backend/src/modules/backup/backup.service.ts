import { backupRepository } from "./backup.repository";
import { prisma, disconnectDatabase } from "../../config/prisma";
import { AppError } from "../../utils/AppError";
import { auditService } from "../../services/audit.service";
import type { BackupFile } from "@idm/shared-types";

export const backupService = {
  async list(): Promise<BackupFile[]> {
    return backupRepository.list();
  },

  async create(actorUserId: string): Promise<BackupFile> {
    const backup = await backupRepository.create();

    await auditService.log({
      userId: actorUserId,
      action: "CREATE_BACKUP",
      entityType: "Backup",
      entityId: backup.filename,
      newValue: backup,
    });

    return backup;
  },

  getDownloadPath(filename: string): string {
    if (!backupRepository.exists(filename)) {
      throw new AppError("النسخة الاحتياطية غير موجودة", 404, "BACKUP_NOT_FOUND");
    }
    return backupRepository.resolveSafePath(filename);
  },

  async remove(filename: string, actorUserId: string): Promise<void> {
    if (!backupRepository.exists(filename)) {
      throw new AppError("النسخة الاحتياطية غير موجودة", 404, "BACKUP_NOT_FOUND");
    }

    await backupRepository.delete(filename);

    await auditService.log({
      userId: actorUserId,
      action: "DELETE_BACKUP",
      entityType: "Backup",
      entityId: filename,
    });
  },

  /**
   * Restoring overwrites the live database file, so this is the one
   * genuinely destructive action in the whole app. Three safeguards:
   *   1. A fresh safety backup is taken FIRST, so a bad restore is
   *      itself recoverable — the operator never loses the pre-restore
   *      state, even if they didn't think to back up manually.
   *   2. Prisma disconnects before the file swap and reconnects after,
   *      so no query runs against a half-copied file.
   *   3. The API response tells the frontend to prompt a full app
   *      restart — reconnecting is enough for SQLite to read fresh
   *      data, but a restart is the only guarantee against any cached
   *      connection state left over from before the swap.
   */
  async restore(filename: string, actorUserId: string): Promise<{ safetyBackupFilename: string }> {
    if (!backupRepository.exists(filename)) {
      throw new AppError("النسخة الاحتياطية غير موجودة", 404, "BACKUP_NOT_FOUND");
    }

    const safetyBackup = await backupRepository.create();

    await disconnectDatabase();
    try {
      await backupRepository.restoreFrom(filename);
    } finally {
      await prisma.$connect();
    }

    await auditService.log({
      userId: actorUserId,
      action: "RESTORE_BACKUP",
      entityType: "Backup",
      entityId: filename,
      newValue: { restoredFrom: filename, safetyBackupFilename: safetyBackup.filename },
    });

    return { safetyBackupFilename: safetyBackup.filename };
  },
};
