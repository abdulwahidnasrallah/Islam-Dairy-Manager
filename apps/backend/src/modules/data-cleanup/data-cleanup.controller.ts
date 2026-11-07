import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { dataCleanupService } from "./data-cleanup.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const dataCleanupController = {
  async cleanup(req: AuthenticatedRequest, res: Response) {
    const result = await dataCleanupService.cleanup(req.body, req.user!.id);
    sendSuccess(
      res,
      result,
      "تم تنظيف بيانات التشغيل بنجاح. التطبيق جاهز لإدخال البيانات الحقيقية.",
    );
  },
};
