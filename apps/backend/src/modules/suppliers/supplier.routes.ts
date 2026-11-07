import { Router } from "express";
import { createSupplierSchema, updateSupplierSchema } from "@idm/shared-validation";
import { validateBody } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { supplierController } from "./supplier.controller";

export const supplierRouter = Router();

supplierRouter.use(authenticate);

supplierRouter.get("/", authorize(PERMISSIONS.VIEW_SUPPLIERS), asyncHandler(supplierController.list));
supplierRouter.get(
  "/:id",
  authorize(PERMISSIONS.VIEW_SUPPLIERS),
  asyncHandler(supplierController.getById),
);
supplierRouter.post(
  "/",
  authorize(PERMISSIONS.CREATE_SUPPLIER),
  validateBody(createSupplierSchema),
  asyncHandler(supplierController.create),
);
supplierRouter.put(
  "/:id",
  authorize(PERMISSIONS.EDIT_SUPPLIER),
  validateBody(updateSupplierSchema),
  asyncHandler(supplierController.update),
);
supplierRouter.delete(
  "/:id",
  authorize(PERMISSIONS.DELETE_SUPPLIER),
  asyncHandler(supplierController.remove),
);
