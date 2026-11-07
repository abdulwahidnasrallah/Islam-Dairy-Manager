import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { backupController } from "./backup.controller";

export const backupRouter = Router();

backupRouter.use(authenticate);

backupRouter.get("/", authorize(PERMISSIONS.VIEW_BACKUPS), asyncHandler(backupController.list));
backupRouter.post("/", authorize(PERMISSIONS.CREATE_BACKUP), asyncHandler(backupController.create));
backupRouter.get(
  "/:filename/download",
  authorize(PERMISSIONS.VIEW_BACKUPS),
  asyncHandler(backupController.download),
);
backupRouter.post(
  "/:filename/restore",
  authorize(PERMISSIONS.RESTORE_BACKUP),
  asyncHandler(backupController.restore),
);
backupRouter.delete(
  "/:filename",
  authorize(PERMISSIONS.DELETE_BACKUP),
  asyncHandler(backupController.remove),
);
