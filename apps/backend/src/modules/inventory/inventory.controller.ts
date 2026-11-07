import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { inventoryService } from "./inventory.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const inventoryController = {
  async listStock(_req: AuthenticatedRequest, res: Response) {
    const products = await inventoryService.listStock();
    sendSuccess(res, products);
  },

  async listMovements(req: AuthenticatedRequest, res: Response) {
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    const movements = await inventoryService.listMovements(productId);
    sendSuccess(res, movements);
  },

  async adjust(req: AuthenticatedRequest, res: Response) {
    const movement = await inventoryService.adjust(req.body, req.user!.id);
    sendSuccess(res, movement, "تم تسجيل حركة المخزون بنجاح", 201);
  },
};
