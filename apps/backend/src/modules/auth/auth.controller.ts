import type { Response } from "express";
import { sendSuccess } from "../../utils/apiResponse";
import { authService } from "./auth.service";
import { SESSION_COOKIE_NAME, type AuthenticatedRequest } from "../../middleware/auth.middleware";
import { env } from "../../config/env";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
};

export const authController = {
  async login(req: AuthenticatedRequest, res: Response) {
    const { sessionId, expiresAt, user } = await authService.login(
      req.body,
      req.headers["user-agent"],
    );

    res.cookie(SESSION_COOKIE_NAME, sessionId, { ...COOKIE_OPTIONS, expires: expiresAt });
    sendSuccess(res, user, "تم تسجيل الدخول بنجاح");
  },

  async logout(req: AuthenticatedRequest, res: Response) {
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME];
    if (sessionId && req.user) {
      await authService.logout(sessionId, req.user.id);
    }
    res.clearCookie(SESSION_COOKIE_NAME, COOKIE_OPTIONS);
    sendSuccess(res, null, "تم تسجيل الخروج");
  },

  async me(req: AuthenticatedRequest, res: Response) {
    sendSuccess(res, {
      id: req.user!.id,
      username: req.user!.username,
      fullName: req.user!.fullName,
      roleName: req.user!.roleName ?? "",
    });
  },
};
