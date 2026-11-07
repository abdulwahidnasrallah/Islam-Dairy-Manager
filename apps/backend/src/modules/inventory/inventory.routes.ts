import { Router } from "express";
import { createInventoryAdjustmentSchema } from "@idm/shared-validation";
import { validateBody } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { inventoryController } from "./inventory.controller";

export const inventoryRouter = Router();

inventoryRouter.use(authenticate);

inventoryRouter.get(
  "/",
  authorize(PERMISSIONS.VIEW_INVENTORY),
  asyncHandler(inventoryController.listStock),
);
inventoryRouter.get(
  "/movements",
  authorize(PERMISSIONS.VIEW_INVENTORY),
  asyncHandler(inventoryController.listMovements),
);
inventoryRouter.post(
  "/adjustments",
  authorize(PERMISSIONS.ADJUST_INVENTORY),
  validateBody(createInventoryAdjustmentSchema),
  asyncHandler(inventoryController.adjust),
);
