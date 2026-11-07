import { Router } from "express";
import { createSupplierPaymentSchema } from "@idm/shared-validation";
import { validateBody } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { paymentController } from "./payment.controller";

export const supplierPaymentRouter = Router();

supplierPaymentRouter.use(authenticate);

supplierPaymentRouter.get(
  "/",
  authorize(PERMISSIONS.VIEW_SUPPLIERS),
  asyncHandler(paymentController.list),
);
supplierPaymentRouter.post(
  "/",
  authorize(PERMISSIONS.RECORD_SUPPLIER_PAYMENT),
  validateBody(createSupplierPaymentSchema),
  asyncHandler(paymentController.create),
);
