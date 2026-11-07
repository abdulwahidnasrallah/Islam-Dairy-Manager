import { Router } from "express";
import { createInvoiceSchema } from "@idm/shared-validation";
import { validateBody } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { salesController } from "./sales.controller";

export const salesRouter = Router();

salesRouter.use(authenticate);

salesRouter.get("/", authorize(PERMISSIONS.VIEW_SALES), asyncHandler(salesController.list));
salesRouter.get("/:id", authorize(PERMISSIONS.VIEW_SALES), asyncHandler(salesController.getDetail));
salesRouter.post(
  "/",
  authorize(PERMISSIONS.RECORD_SALE),
  validateBody(createInvoiceSchema),
  asyncHandler(salesController.create),
);
salesRouter.post(
  "/:id/cancel",
  authorize(PERMISSIONS.CANCEL_SALE),
  asyncHandler(salesController.cancel),
);
