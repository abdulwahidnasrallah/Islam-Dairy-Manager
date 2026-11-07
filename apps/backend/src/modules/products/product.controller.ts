import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { productService } from "./product.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const productController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const products = await productService.list(search);
    sendSuccess(res, products);
  },

  async getById(req: AuthenticatedRequest, res: Response) {
    const product = await productService.getById(req.params.id);
    sendSuccess(res, product);
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const product = await productService.create(req.body, req.user!.id);
    sendSuccess(res, product, "تم إضافة المنتج بنجاح", 201);
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const product = await productService.update(req.params.id, req.body, req.user!.id);
    sendSuccess(res, product, "تم تحديث بيانات المنتج");
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    await productService.remove(req.params.id, req.user!.id);
    sendSuccess(res, null, "تم حذف المنتج");
  },
};
