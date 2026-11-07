import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { productionService } from "./production.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const productionController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    const batches = await productionService.list(productId);
    sendSuccess(res, batches);
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const batch = await productionService.create(req.body, req.user!.id);
    sendSuccess(res, batch, "تم تسجيل دفعة الإنتاج بنجاح", 201);
  },
};
