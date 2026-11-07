import { prisma } from "../config/prisma";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

export const sessionService = {
  async create(userId: string, deviceInfo?: string) {
    return prisma.session.create({
      data: {
        userId,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
        deviceInfo: deviceInfo ?? null,
      },
    });
  },

  /** Returns the session with its user if valid and not expired, else null. */
  async validate(sessionId: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    });

    if (!session) return null;
    if (session.expiresAt < new Date()) {
      // Expired — clean it up and treat as invalid.
      await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
      return null;
    }
    if (!session.user.isActive) return null;

    return session;
  },

  async destroy(sessionId: string) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
  },
};
