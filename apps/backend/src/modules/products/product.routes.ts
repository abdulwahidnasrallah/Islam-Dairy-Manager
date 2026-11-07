import { Router } from "express";
import { createProductSchema, updateProductSchema } from "@idm/shared-validation";
import { validateBody } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { productController } from "./product.controller";

export const productRouter = Router();

productRouter.use(authenticate);

productRouter.get("/", authorize(PERMISSIONS.VIEW_PRODUCTS), asyncHandler(productController.list));
productRouter.get(
  "/:id",
  authorize(PERMISSIONS.VIEW_PRODUCTS),
  asyncHandler(productController.getById),
);
productRouter.post(
  "/",
  authorize(PERMISSIONS.CREATE_PRODUCT),
  validateBody(createProductSchema),
  asyncHandler(productController.create),
);
productRouter.put(
  "/:id",
  authorize(PERMISSIONS.EDIT_PRODUCT),
  validateBody(updateProductSchema),
  asyncHandler(productController.update),
);
productRouter.delete(
  "/:id",
  authorize(PERMISSIONS.DELETE_PRODUCT),
  asyncHandler(productController.remove),
);
