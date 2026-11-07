import path from "node:path";
import { env } from "./env";

/**
 * Resolves the on-disk path of the SQLite database file from
 * DATABASE_URL (e.g. "file:./database/dev.db" or "file:/abs/path.db").
 * Every other module talks to the database exclusively through Prisma
 * — this is only used by the backup module, which genuinely needs the
 * raw file to copy it.
 */
export function getDatabaseFilePath(): string {
  const prefix = "file:";
  if (!env.DATABASE_URL.startsWith(prefix)) {
    throw new Error(
      `Unsupported DATABASE_URL for backups: "${env.DATABASE_URL}". Only sqlite "file:" URLs are supported.`,
    );
  }

  const rawPath = env.DATABASE_URL.slice(prefix.length);
  return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
}
