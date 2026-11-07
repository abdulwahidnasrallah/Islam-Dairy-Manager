import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate, authorize } from "../../middleware/auth.middleware";
import { PERMISSIONS } from "../../config/permissions";
import { searchController } from "./search.controller";

export const searchRouter = Router();

searchRouter.use(authenticate);
searchRouter.get("/", authorize(PERMISSIONS.USE_SEARCH), asyncHandler(searchController.search));
