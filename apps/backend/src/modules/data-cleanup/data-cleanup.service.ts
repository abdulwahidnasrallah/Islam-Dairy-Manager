import { dataCleanupRepository } from "./data-cleanup.repository";
import { prisma } from "../../config/prisma";
import { passwordService } from "../../services/password.service";
import { auditService } from "../../services/audit.service";
import { AppError } from "../../utils/AppError";
import type { CleanupOperationalDataInput } from "@idm/shared-validation";
import type { DataCleanupResult } from "@idm/shared-types";

export const dataCleanupService = {
  /**
   * Wipes every operational/demo record (suppliers, customers,
   * products, inventory, sales, purchases, production, expenses, cash
   * adjustments, daily closings, AI conversations, and the invoice
   * number counter) so the app is ready for real data — while never
   * touching Users, Roles, Permissions, RolePermissions,
   * ApplicationSettings, the database schema, or migrations.
   *
   * Two independent confirmations are required before this runs:
   * the exact string "DELETE" (enforced by cleanupOperationalDataSchema
   * at the route level, before this function is even called) and the
   * acting user's own current password (verified here) — the same
   * bar as re-authenticating, appropriate for an irreversible,
   * whole-database action.
   */
  async cleanup(input: CleanupOperationalDataInput, actorUserId: string): Promise<DataCleanupResult> {
    const user = await prisma.user.findUnique({ where: { id: actorUserId } });
    if (!user) {
      throw new AppError("المستخدم غير موجود", 404, "USER_NOT_FOUND");
    }

    const passwordValid = await passwordService.verify(user.passwordHash, input.password);
    if (!passwordValid) {
      throw new AppError("كلمة المرور غير صحيحة", 401, "INVALID_PASSWORD");
    }

    const deletedCounts = await dataCleanupRepository.deleteAllOperationalData();

    await auditService.log({
      userId: actorUserId,
      action: "CLEANUP_OPERATIONAL_DATA",
      entityType: "System",
      newValue: deletedCounts,
    });

    return { deletedCounts };
  },
};
