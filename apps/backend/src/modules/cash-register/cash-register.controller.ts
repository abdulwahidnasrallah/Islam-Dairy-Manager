import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { cashRegisterService } from "./cash-register.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const cashRegisterController = {
  async getSummary(_req: AuthenticatedRequest, res: Response) {
    const summary = await cashRegisterService.getSummary();
    sendSuccess(res, summary);
  },

  async getProfitSummary(_req: AuthenticatedRequest, res: Response) {
    const summary = await cashRegisterService.getMonthlyProfitSummary();
    sendSuccess(res, summary);
  },

  async createAdjustment(req: AuthenticatedRequest, res: Response) {
    const adjustment = await cashRegisterService.createAdjustment(req.body, req.user!.id);
    sendSuccess(res, adjustment, "تم تسجيل حركة الصندوق بنجاح", 201);
  },
};
