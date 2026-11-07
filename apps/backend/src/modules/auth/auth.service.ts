import { prisma } from "../../config/prisma";
import { passwordService } from "../../services/password.service";
import { sessionService } from "../../services/session.service";
import { auditService } from "../../services/audit.service";
import { AppError } from "../../utils/AppError";
import type { LoginInput } from "@idm/shared-validation";
import type { AuthenticatedUser } from "@idm/shared-types";

const MAX_FAILED_ATTEMPTS = 5;
const failedAttempts = new Map<string, number>();

export const authService = {
  async login(input: LoginInput, deviceInfo?: string) {
    const attempts = failedAttempts.get(input.username) ?? 0;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      throw new AppError(
        "الحساب مقفل مؤقتاً بسبب محاولات دخول فاشلة متكررة",
        423,
        "ACCOUNT_LOCKED",
      );
    }

    const user = await prisma.user.findUnique({
      where: { username: input.username },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });

    const isValid = user ? await passwordService.verify(user.passwordHash, input.password) : false;

    if (!user || !isValid || !user.isActive) {
      failedAttempts.set(input.username, attempts + 1);
      await auditService.log({
        userId: user?.id ?? null,
        action: "LOGIN_FAILED",
        entityType: "User",
        entityId: user?.id,
      });
      throw new AppError("اسم المستخدم أو كلمة المرور غير صحيحة", 401, "INVALID_CREDENTIALS");
    }

    failedAttempts.delete(input.username);

    const session = await sessionService.create(user.id, deviceInfo);
    await auditService.log({ userId: user.id, action: "LOGIN", entityType: "User", entityId: user.id });

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      roleName: user.role?.name ?? "",
    };

    return { sessionId: session.id, expiresAt: session.expiresAt, user: authenticatedUser };
  },

  async logout(sessionId: string, userId: string) {
    await sessionService.destroy(sessionId);
    await auditService.log({ userId, action: "LOGOUT", entityType: "User", entityId: userId });
  },
};
