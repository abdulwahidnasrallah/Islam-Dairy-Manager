import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { getDatabaseFilePath } from "../../config/database-file";

/**
 * Backups are always named by us, never by user input, so this pattern
 * doubles as the whitelist that makes resolveSafePath() safe against
 * path traversal — any filename that doesn't match this is rejected.
 */
const BACKUP_FILENAME_PATTERN = /^backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.db$/;

function getBackupsDir(): string {
  return path.join(path.dirname(getDatabaseFilePath()), "backups");
}

async function ensureBackupsDir(): Promise<string> {
  const dir = getBackupsDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export const backupRepository = {
  getDatabaseFilePath,
  getBackupsDir,

  async list() {
    const dir = await ensureBackupsDir();
    const entries = await fs.readdir(dir);
    const filenames = entries.filter((f) => BACKUP_FILENAME_PATTERN.test(f));

    const files = await Promise.all(
      filenames.map(async (filename) => {
        const stat = await fs.stat(path.join(dir, filename));
        return { filename, sizeBytes: stat.size, createdAt: stat.birthtime.toISOString() };
      }),
    );

    return files.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async create() {
    const dir = await ensureBackupsDir();
    const dbPath = getDatabaseFilePath();

    // Colons aren't valid in Windows filenames, so they're stripped —
    // this has to work on the target OS, not just the dev machine.
    const timestamp = new Date().toISOString().replace(/:/g, "-").split(".")[0];
    const filename = `backup-${timestamp}.db`;
    const destPath = path.join(dir, filename);

    await fs.copyFile(dbPath, destPath);
    const stat = await fs.stat(destPath);
    return { filename, sizeBytes: stat.size, createdAt: stat.birthtime.toISOString() };
  },

  /** Resolves a filename to a path INSIDE the backups dir only — throws on anything else. */
  resolveSafePath(filename: string): string {
    if (!BACKUP_FILENAME_PATTERN.test(filename)) {
      throw new Error("اسم ملف النسخة الاحتياطية غير صالح");
    }
    const dir = getBackupsDir();
    const fullPath = path.join(dir, filename);
    if (path.dirname(fullPath) !== dir) {
      throw new Error("مسار ملف غير مسموح به");
    }
    return fullPath;
  },

  exists(filename: string): boolean {
    return fsSync.existsSync(this.resolveSafePath(filename));
  },

  async delete(filename: string): Promise<void> {
    await fs.unlink(this.resolveSafePath(filename));
  },

  async restoreFrom(filename: string): Promise<void> {
    await fs.copyFile(this.resolveSafePath(filename), getDatabaseFilePath());
  },
};
