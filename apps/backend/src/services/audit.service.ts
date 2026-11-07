import { prisma } from "../config/prisma";

interface AuditEntry {
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Single write path for AuditLog. Rows here are never updated or deleted
 * by application code — only ever inserted. oldValue/newValue are
 * JSON-stringified so this stays a plain, dependency-free insert.
 */
export const auditService = {
  async log(entry: AuditEntry): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        oldValue: entry.oldValue !== undefined ? JSON.stringify(entry.oldValue) : null,
        newValue: entry.newValue !== undefined ? JSON.stringify(entry.newValue) : null,
      },
    });
  },
};
