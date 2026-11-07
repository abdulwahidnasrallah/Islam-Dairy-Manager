import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { backupService } from "./backup.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const backupController = {
  async list(_req: AuthenticatedRequest, res: Response) {
    const backups = await backupService.list();
    sendSuccess(res, backups);
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const backup = await backupService.create(req.user!.id);
    sendSuccess(res, backup, "تم إنشاء نسخة احتياطية بنجاح", 201);
  },

  async download(req: AuthenticatedRequest, res: Response) {
    const filePath = backupService.getDownloadPath(req.params.filename);
    res.download(filePath, req.params.filename);
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    await backupService.remove(req.params.filename, req.user!.id);
    sendSuccess(res, null, "تم حذف النسخة الاحتياطية");
  },

  async restore(req: AuthenticatedRequest, res: Response) {
    const result = await backupService.restore(req.params.filename, req.user!.id);
    sendSuccess(
      res,
      result,
      "تمت الاستعادة بنجاح. يُنصح بإعادة تشغيل التطبيق الآن لضمان تحميل البيانات الجديدة بشكل كامل.",
    );
  },
};
