import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { milkPurchaseService } from "./purchase.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const purchaseController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const supplierId = typeof req.query.supplierId === "string" ? req.query.supplierId : undefined;
    const purchases = await milkPurchaseService.list(supplierId);
    sendSuccess(res, purchases);
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const purchase = await milkPurchaseService.create(req.body, req.user!.id);
    sendSuccess(res, purchase, "تم تسجيل شراء الحليب بنجاح", 201);
  },
};
