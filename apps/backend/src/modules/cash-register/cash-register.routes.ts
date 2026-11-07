import { Router } from "express";
import { createCashAdjustmentSchema } from "@idm/shared-validation";
import { validateBody } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { cashRegisterController } from "./cash-register.controller";

export const cashRegisterRouter = Router();

cashRegisterRouter.use(authenticate);

cashRegisterRouter.get(
  "/",
  authorize(PERMISSIONS.VIEW_CASH_REGISTER),
  asyncHandler(cashRegisterController.getSummary),
);
cashRegisterRouter.get(
  "/profit-summary",
  authorize(PERMISSIONS.VIEW_CASH_REGISTER),
  asyncHandler(cashRegisterController.getProfitSummary),
);
cashRegisterRouter.post(
  "/adjustments",
  authorize(PERMISSIONS.RECORD_CASH_ADJUSTMENT),
  validateBody(createCashAdjustmentSchema),
  asyncHandler(cashRegisterController.createAdjustment),
);
