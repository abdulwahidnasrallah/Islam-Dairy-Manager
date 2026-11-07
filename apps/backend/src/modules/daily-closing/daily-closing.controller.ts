import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { dailyClosingService } from "./daily-closing.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const dailyClosingController = {
  async getStatus(_req: AuthenticatedRequest, res: Response) {
    const status = await dailyClosingService.getStatus();
    sendSuccess(res, status);
  },

  async list(_req: AuthenticatedRequest, res: Response) {
    const history = await dailyClosingService.list();
    sendSuccess(res, history);
  },

  async close(req: AuthenticatedRequest, res: Response) {
    const closing = await dailyClosingService.closeDay(req.user!.id);
    sendSuccess(res, closing, "تم إغلاق اليوم بنجاح — مؤشرات اليوم الجديد تبدأ الآن");
  },
};
