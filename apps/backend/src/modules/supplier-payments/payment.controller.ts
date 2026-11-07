import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { supplierPaymentService } from "./payment.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const paymentController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const supplierId = typeof req.query.supplierId === "string" ? req.query.supplierId : undefined;
    const payments = await supplierPaymentService.list(supplierId);
    sendSuccess(res, payments);
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const payment = await supplierPaymentService.create(req.body, req.user!.id);
    sendSuccess(res, payment, "تم تسجيل الدفعة بنجاح", 201);
  },
};
