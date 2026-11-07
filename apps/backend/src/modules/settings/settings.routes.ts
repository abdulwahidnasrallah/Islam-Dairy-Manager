import { Router } from "express";
import { updateSettingsSchema } from "@idm/shared-validation";
import { validateBody } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { settingsController } from "./settings.controller";

export const settingsRouter = Router();

settingsRouter.use(authenticate);

settingsRouter.get("/", authorize(PERMISSIONS.VIEW_SETTINGS), asyncHandler(settingsController.getAll));
settingsRouter.put(
  "/",
  authorize(PERMISSIONS.MANAGE_SETTINGS),
  validateBody(updateSettingsSchema),
  asyncHandler(settingsController.update),
);
