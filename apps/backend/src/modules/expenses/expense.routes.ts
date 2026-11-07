import { Router } from "express";
import { createExpenseSchema, updateExpenseSchema } from "@idm/shared-validation";
import { validateBody } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { expenseController } from "./expense.controller";

export const expenseRouter = Router();

expenseRouter.use(authenticate);

expenseRouter.get("/", authorize(PERMISSIONS.VIEW_EXPENSES), asyncHandler(expenseController.list));
expenseRouter.post(
  "/",
  authorize(PERMISSIONS.CREATE_EXPENSE),
  validateBody(createExpenseSchema),
  asyncHandler(expenseController.create),
);
expenseRouter.put(
  "/:id",
  authorize(PERMISSIONS.EDIT_EXPENSE),
  validateBody(updateExpenseSchema),
  asyncHandler(expenseController.update),
);
expenseRouter.delete(
  "/:id",
  authorize(PERMISSIONS.DELETE_EXPENSE),
  asyncHandler(expenseController.remove),
);
