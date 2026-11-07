import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { dailyClosingController } from "./daily-closing.controller";

export const dailyClosingRouter = Router();

dailyClosingRouter.use(authenticate);

dailyClosingRouter.get(
  "/status",
  authorize(PERMISSIONS.VIEW_DASHBOARD),
  asyncHandler(dailyClosingController.getStatus),
);
dailyClosingRouter.get(
  "/history",
  authorize(PERMISSIONS.CLOSE_DAY),
  asyncHandler(dailyClosingController.list),
);
dailyClosingRouter.post(
  "/close",
  authorize(PERMISSIONS.CLOSE_DAY),
  asyncHandler(dailyClosingController.close),
);
