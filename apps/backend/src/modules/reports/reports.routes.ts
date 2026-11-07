import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { reportsController } from "./reports.controller";

export const reportsRouter = Router();

reportsRouter.use(authenticate);
reportsRouter.use(authorize(PERMISSIONS.VIEW_REPORTS));

reportsRouter.get("/summary", asyncHandler(reportsController.getSummary));
reportsRouter.get("/export/sales.csv", asyncHandler(reportsController.exportSalesCsv));
reportsRouter.get("/export/purchases.csv", asyncHandler(reportsController.exportPurchasesCsv));
reportsRouter.get("/export/top-debts.csv", asyncHandler(reportsController.exportTopDebtsCsv));
