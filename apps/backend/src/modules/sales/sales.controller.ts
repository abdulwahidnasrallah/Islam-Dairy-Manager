import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { salesService } from "./sales.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const salesController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
    const invoices = await salesService.list(customerId);
    sendSuccess(res, invoices);
  },

  async getDetail(req: AuthenticatedRequest, res: Response) {
    const invoice = await salesService.getDetail(req.params.id);
    sendSuccess(res, invoice);
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const invoice = await salesService.create(req.body, req.user!.id);
    sendSuccess(res, invoice, "تم تسجيل الفاتورة بنجاح", 201);
  },

  async cancel(req: AuthenticatedRequest, res: Response) {
    const invoice = await salesService.cancel(req.params.id, req.user!.id);
    sendSuccess(res, invoice, "تم إلغاء الفاتورة واستعادة الكمية إلى المخزون");
  },
};
