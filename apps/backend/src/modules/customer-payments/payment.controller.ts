import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { customerPaymentService } from "./payment.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const paymentController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
    const payments = await customerPaymentService.list(customerId);
    sendSuccess(res, payments);
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const payment = await customerPaymentService.create(req.body, req.user!.id);
    sendSuccess(res, payment, "تم تسجيل الدفعة بنجاح", 201);
  },
};
