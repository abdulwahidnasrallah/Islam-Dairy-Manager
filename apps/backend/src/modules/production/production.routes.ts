import { Router } from "express";
import { createProductionBatchSchema } from "@idm/shared-validation";
import { validateBody } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { productionController } from "./production.controller";

export const productionRouter = Router();

productionRouter.use(authenticate);

productionRouter.get(
  "/",
  authorize(PERMISSIONS.VIEW_PRODUCTION),
  asyncHandler(productionController.list),
);
productionRouter.post(
  "/",
  authorize(PERMISSIONS.RECORD_PRODUCTION),
  validateBody(createProductionBatchSchema),
  asyncHandler(productionController.create),
);
