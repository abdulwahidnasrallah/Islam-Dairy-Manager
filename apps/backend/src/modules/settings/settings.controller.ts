import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { settingsService } from "./settings.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const settingsController = {
  async getAll(_req: AuthenticatedRequest, res: Response) {
    const settings = await settingsService.getAll();
    sendSuccess(res, settings);
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const settings = await settingsService.update(req.body, req.user!.id);
    sendSuccess(res, settings, "تم حفظ الإعدادات بنجاح");
  },
};
