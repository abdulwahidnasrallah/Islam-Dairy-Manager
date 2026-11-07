import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { purchaseInvoiceService } from "./purchase-invoice.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const purchaseInvoiceController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const supplierId = typeof req.query.supplierId === "string" ? req.query.supplierId : undefined;
    const purchaseInvoices = await purchaseInvoiceService.list(supplierId);
    sendSuccess(res, purchaseInvoices);
  },

  async getDetail(req: AuthenticatedRequest, res: Response) {
    const purchaseInvoice = await purchaseInvoiceService.getDetail(req.params.id);
    sendSuccess(res, purchaseInvoice);
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const purchaseInvoice = await purchaseInvoiceService.create(req.body, req.user!.id);
    sendSuccess(res, purchaseInvoice, "تم تسجيل فاتورة الشراء بنجاح", 201);
  },

  async cancel(req: AuthenticatedRequest, res: Response) {
    const purchaseInvoice = await purchaseInvoiceService.cancel(req.params.id, req.user!.id);
    sendSuccess(res, purchaseInvoice, "تم إلغاء فاتورة الشراء وإرجاع الكمية من المخزون");
  },
};
