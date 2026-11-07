import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { dashboardService } from "./dashboard.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const dashboardController = {
  async getSummary(_req: AuthenticatedRequest, res: Response) {
    const summary = await dashboardService.getSummary();
    sendSuccess(res, summary);
  },
};
