import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { supplierService } from "./supplier.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const supplierController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const suppliers = await supplierService.list(search);
    sendSuccess(res, suppliers);
  },

  async getById(req: AuthenticatedRequest, res: Response) {
    const profile = await supplierService.getProfile(req.params.id);
    sendSuccess(res, profile);
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const supplier = await supplierService.create(req.body, req.user!.id);
    sendSuccess(res, supplier, "تم إضافة المورد بنجاح", 201);
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const supplier = await supplierService.update(req.params.id, req.body, req.user!.id);
    sendSuccess(res, supplier, "تم تحديث بيانات المورد");
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    await supplierService.remove(req.params.id, req.user!.id);
    sendSuccess(res, null, "تم حذف المورد");
  },
};
