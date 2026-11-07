import { Router } from "express";
import { createMilkPurchaseSchema } from "@idm/shared-validation";
import { validateBody } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { purchaseController } from "./purchase.controller";

export const milkPurchaseRouter = Router();

milkPurchaseRouter.use(authenticate);

milkPurchaseRouter.get(
  "/",
  authorize(PERMISSIONS.VIEW_SUPPLIERS),
  asyncHandler(purchaseController.list),
);
milkPurchaseRouter.post(
  "/",
  authorize(PERMISSIONS.RECORD_MILK_PURCHASE),
  validateBody(createMilkPurchaseSchema),
  asyncHandler(purchaseController.create),
);
