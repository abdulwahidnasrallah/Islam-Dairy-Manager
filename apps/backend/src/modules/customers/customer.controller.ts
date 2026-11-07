import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { customerService } from "./customer.service";
import type { AuthenticatedRequest } from "../../middleware/auth.middleware";

export const customerController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const owingOnly = req.query.owingOnly === "true";
    const customers = owingOnly ? await customerService.listWithDebt() : await customerService.list(search);
    sendSuccess(res, customers);
  },

  async getProfile(req: AuthenticatedRequest, res: Response) {
    const profile = await customerService.getProfile(req.params.id);
    sendSuccess(res, profile);
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const customer = await customerService.create(req.body, req.user!.id);
    sendSuccess(res, customer, "تم إضافة الزبون بنجاح", 201);
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const customer = await customerService.update(req.params.id, req.body, req.user!.id);
    sendSuccess(res, customer, "تم تحديث بيانات الزبون");
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    await customerService.remove(req.params.id, req.user!.id);
    sendSuccess(res, null, "تم حذف الزبون");
  },
};
