import { PrismaClient } from "@prisma/client";

/**
 * Single shared Prisma instance for the whole backend process.
 * Never instantiate `new PrismaClient()` anywhere else — repositories
 * and services must import `prisma` from here.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

/** Simple connectivity check used by the health endpoint. */
export async function isDatabaseConnected(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

/** Called on process shutdown so SQLite closes cleanly. */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
