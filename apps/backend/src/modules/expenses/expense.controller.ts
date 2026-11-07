import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { expenseService } from "./expense.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const expenseController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const expenses = await expenseService.list(category);
    sendSuccess(res, expenses);
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const expense = await expenseService.create(req.body, req.user!.id);
    sendSuccess(res, expense, "تم تسجيل المصروف بنجاح", 201);
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const expense = await expenseService.update(req.params.id, req.body, req.user!.id);
    sendSuccess(res, expense, "تم تحديث المصروف");
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    await expenseService.remove(req.params.id, req.user!.id);
    sendSuccess(res, null, "تم حذف المصروف");
  },
};
