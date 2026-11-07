import { prisma } from "../../config/prisma";

export const assistantRepository = {
  listConversations(userId: string) {
    return prisma.assistantConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
  },

  findConversationWithMessages(id: string, userId: string) {
    return prisma.assistantConversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  },

  createConversation(userId: string, title: string | null) {
    return prisma.assistantConversation.create({ data: { userId, title } });
  },

  touchConversation(id: string) {
    return prisma.assistantConversation.update({ where: { id }, data: { updatedAt: new Date() } });
  },

  addMessage(conversationId: string, role: "USER" | "ASSISTANT", content: string) {
    return prisma.assistantMessage.create({ data: { conversationId, role, content } });
  },

  /** Scoped to userId so a user can never delete someone else's conversation by guessing an id. */
  async deleteConversation(id: string, userId: string) {
    const result = await prisma.assistantConversation.deleteMany({ where: { id, userId } });
    return result.count > 0;
  },
};
