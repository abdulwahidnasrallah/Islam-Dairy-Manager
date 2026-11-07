import type { NextFunction, Request, Response } from "express";
import { sessionService } from "../services/session.service";
import { AppError } from "../utils/AppError";
import type { PermissionName } from "../config/permissions";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    fullName: string;
    roleName: string | null;
    permissions: Set<string>;
  };
}

const SESSION_COOKIE_NAME = "idm_session";

/**
 * Verifies the session cookie against the Session table and attaches
 * `req.user`. Every route that touches business data must be behind
 * this — never rely on the frontend hiding a button.
 */
export async function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sessionId = req.cookies?.[SESSION_COOKIE_NAME];

    if (!sessionId) {
      throw new AppError("الرجاء تسجيل الدخول", 401, "NOT_AUTHENTICATED");
    }

    const session = await sessionService.validate(sessionId);

    if (!session) {
      throw new AppError("انتهت صلاحية الجلسة، الرجاء تسجيل الدخول مجدداً", 401, "SESSION_EXPIRED");
    }

    req.user = {
      id: session.user.id,
      username: session.user.username,
      fullName: session.user.fullName,
      roleName: session.user.role?.name ?? null,
      permissions: new Set(session.user.role?.permissions.map((rp) => rp.permission.name) ?? []),
    };

    next();
  } catch (error) {
    next(error);
  }
}

/** Requires a specific permission on top of authenticate(). Backend-enforced, never frontend-only. */
export function authorize(permission: PermissionName) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError("الرجاء تسجيل الدخول", 401, "NOT_AUTHENTICATED");
    }
    if (!req.user.permissions.has(permission)) {
      throw new AppError("لا تملك صلاحية تنفيذ هذا الإجراء", 403, "FORBIDDEN");
    }
    next();
  };
}

export { SESSION_COOKIE_NAME };
