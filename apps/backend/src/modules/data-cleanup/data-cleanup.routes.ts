import { Router } from "express";
import { cleanupOperationalDataSchema } from "@idm/shared-validation";
import { validateBody } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { dataCleanupController } from "./data-cleanup.controller";

export const dataCleanupRouter = Router();

dataCleanupRouter.use(authenticate);

dataCleanupRouter.post(
  "/cleanup-operational-data",
  authorize(PERMISSIONS.MANAGE_DATA),
  validateBody(cleanupOperationalDataSchema),
  asyncHandler(dataCleanupController.cleanup),
);
