import { Router } from "express";
import { createCustomerPaymentSchema } from "@idm/shared-validation";
import { validateBody } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { paymentController } from "./payment.controller";

export const customerPaymentRouter = Router();

customerPaymentRouter.use(authenticate);

customerPaymentRouter.get(
  "/",
  authorize(PERMISSIONS.VIEW_CUSTOMERS),
  asyncHandler(paymentController.list),
);
customerPaymentRouter.post(
  "/",
  authorize(PERMISSIONS.RECORD_CUSTOMER_PAYMENT),
  validateBody(createCustomerPaymentSchema),
  asyncHandler(paymentController.create),
);
