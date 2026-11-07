import { Router } from "express";
import { loginSchema } from "@idm/shared-validation";
import { validateBody } from "../../middleware/validation.middleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middleware/auth.middleware";
import { authController } from "./auth.controller";

export const authRouter = Router();

authRouter.post("/login", validateBody(loginSchema), asyncHandler(authController.login));
authRouter.post("/logout", authenticate, asyncHandler(authController.logout));
authRouter.get("/me", authenticate, asyncHandler(authController.me));
