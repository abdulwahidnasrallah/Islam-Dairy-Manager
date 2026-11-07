import { Router } from "express";
import { createCustomerSchema, updateCustomerSchema } from "@idm/shared-validation";
import { validateBody } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { customerController } from "./customer.controller";

export const customerRouter = Router();

customerRouter.use(authenticate);

customerRouter.get("/", authorize(PERMISSIONS.VIEW_CUSTOMERS), asyncHandler(customerController.list));
customerRouter.get(
  "/:id",
  authorize(PERMISSIONS.VIEW_CUSTOMERS),
  asyncHandler(customerController.getProfile),
);
customerRouter.post(
  "/",
  authorize(PERMISSIONS.CREATE_CUSTOMER),
  validateBody(createCustomerSchema),
  asyncHandler(customerController.create),
);
customerRouter.put(
  "/:id",
  authorize(PERMISSIONS.EDIT_CUSTOMER),
  validateBody(updateCustomerSchema),
  asyncHandler(customerController.update),
);
customerRouter.delete(
  "/:id",
  authorize(PERMISSIONS.DELETE_CUSTOMER),
  asyncHandler(customerController.remove),
);
