import { Router } from "express";
import { createPurchaseInvoiceSchema } from "@idm/shared-validation";
import { validateBody } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { purchaseInvoiceController } from "./purchase-invoice.controller";

export const purchaseInvoiceRouter = Router();

purchaseInvoiceRouter.use(authenticate);

purchaseInvoiceRouter.get(
  "/",
  authorize(PERMISSIONS.VIEW_PURCHASE_INVOICES),
  asyncHandler(purchaseInvoiceController.list),
);
purchaseInvoiceRouter.get(
  "/:id",
  authorize(PERMISSIONS.VIEW_PURCHASE_INVOICES),
  asyncHandler(purchaseInvoiceController.getDetail),
);
purchaseInvoiceRouter.post(
  "/",
  authorize(PERMISSIONS.CREATE_PURCHASE_INVOICE),
  validateBody(createPurchaseInvoiceSchema),
  asyncHandler(purchaseInvoiceController.create),
);
purchaseInvoiceRouter.post(
  "/:id/cancel",
  authorize(PERMISSIONS.CANCEL_PURCHASE_INVOICE),
  asyncHandler(purchaseInvoiceController.cancel),
);
