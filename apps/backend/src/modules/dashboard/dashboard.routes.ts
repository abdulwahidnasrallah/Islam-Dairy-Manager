import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { dashboardController } from "./dashboard.controller";

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.get(
  "/summary",
  authorize(PERMISSIONS.VIEW_DASHBOARD),
  asyncHandler(dashboardController.getSummary),
);
