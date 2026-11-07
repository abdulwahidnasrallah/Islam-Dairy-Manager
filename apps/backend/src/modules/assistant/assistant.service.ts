import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env";
import { assistantRepository } from "./assistant.repository";
import { assistantTools, executeAssistantTool } from "./assistant.tools";
import { AppError } from "../../utils/AppError";
import type { AssistantChatInput } from "@idm/shared-validation";
import type { AssistantConversationWithMessages, AssistantMessage } from "@idm/shared-types";

const MAX_TOOL_ROUNDS = 6;

const SYSTEM_PROMPT = `أنت المساعد الذكي لنظام إدارة "${process.env.STORE_NAME_AR ?? "إسلام للألبان والأجبان"}".
مهمتك الإجابة عن أسئلة صاحب المحل حول بيانات محله الفعلية (المبيعات، المخزون، الموردين، الزبائن، الأرباح، الصندوق) باستخدام الأدوات المتاحة فقط — لا تخترع أرقاماً أبداً.
كل الأدوات المتاحة لك للقراءة فقط؛ أنت لا تستطيع تسجيل أي عملية (بيع، دفعة، مصروف...) — لو طلب المستخدم تسجيل شيء، وجّهه إلى الشاشة المناسبة في التطبيق بدل تنفيذه.
أجب دائماً بالعربية، بإيجاز ووضوح، واذكر الأرقام كما أرجعتها الأدوات دون تقريب مخل.`;

function toDto(message: { id: string; conversationId: string; role: string; content: string; createdAt: Date }): AssistantMessage {
  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role as AssistantMessage["role"],
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AppError(
      "المساعد الذكي غير مُفعَّل — أضف ANTHROPIC_API_KEY في إعدادات الخادم لتفعيله",
      503,
      "ASSISTANT_NOT_CONFIGURED",
    );
  }
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

/**
 * Translates a failure calling the Anthropic API into a clear, specific
 * AppError instead of letting it bubble up as an opaque 500 — this is
 * the difference between the user seeing "حدث خطأ غير متوقع" (which
 * looks identical to a real bug) and seeing exactly what went wrong
 * (bad key, no quota, network, unknown model...) and what to do about
 * it. `Anthropic.APIError` and its subclasses (AuthenticationError,
 * PermissionDeniedError, NotFoundError, RateLimitError,
 * InternalServerError) all carry a `status`; APIConnectionError
 * (network-level failures, including timeouts) does not.
 */
function mapAnthropicError(err: unknown): AppError {
  if (err instanceof Anthropic.APIConnectionError) {
    return new AppError(
      "تعذّر الاتصال بخدمة الذكاء الاصطناعي — تحقّق من اتصال الإنترنت في الخادم وحاول مجدداً",
      503,
      "ASSISTANT_CONNECTION_FAILED",
    );
  }

  if (err instanceof Anthropic.AuthenticationError) {
    return new AppError(
      "مفتاح ANTHROPIC_API_KEY غير صحيح أو منتهي الصلاحية — تحقّق منه في إعدادات الخادم",
      503,
      "ASSISTANT_INVALID_API_KEY",
    );
  }

  if (err instanceof Anthropic.RateLimitError) {
    return new AppError(
      "تم تجاوز الحد المسموح لطلبات خدمة الذكاء الاصطناعي حالياً — حاول مرة أخرى بعد قليل",
      503,
      "ASSISTANT_RATE_LIMITED",
    );
  }

  if (err instanceof Anthropic.NotFoundError) {
    return new AppError(
      "نموذج الذكاء الاصطناعي المحدَّد (ASSISTANT_MODEL) غير موجود أو غير متاح — تحقّق من القيمة في إعدادات الخادم",
      503,
      "ASSISTANT_MODEL_NOT_FOUND",
    );
  }

  if (err instanceof Anthropic.APIError) {
    return new AppError(
      "تعذّرت خدمة الذكاء الاصطناعي مؤقتاً — حاول مرة أخرى بعد قليل",
      503,
      "ASSISTANT_API_ERROR",
    );
  }

  return new AppError(
    "حدث خطأ غير متوقع أثناء الاتصال بالمساعد الذكي",
    503,
    "ASSISTANT_UNKNOWN_ERROR",
  );
}

export const assistantService = {
  async listConversations(userId: string) {
    const conversations = await assistantRepository.listConversations(userId);
    return conversations.map((c) => ({
      id: c.id,
      userId: c.userId,
      title: c.title,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }));
  },

  async getConversation(id: string, userId: string): Promise<AssistantConversationWithMessages> {
    const conversation = await assistantRepository.findConversationWithMessages(id, userId);
    if (!conversation) {
      throw new AppError("المحادثة غير موجودة", 404, "CONVERSATION_NOT_FOUND");
    }
    return {
      id: conversation.id,
      userId: conversation.userId,
      title: conversation.title,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: conversation.messages.map(toDto),
    };
  },

  async deleteConversation(id: string, userId: string): Promise<void> {
    const deleted = await assistantRepository.deleteConversation(id, userId);
    if (!deleted) {
      throw new AppError("المحادثة غير موجودة", 404, "CONVERSATION_NOT_FOUND");
    }
  },

  async chat(input: AssistantChatInput, userId: string): Promise<AssistantConversationWithMessages> {
    const client = getClient();

    const conversation = input.conversationId
      ? await assistantRepository.findConversationWithMessages(input.conversationId, userId)
      : null;

    if (input.conversationId && !conversation) {
      throw new AppError("المحادثة غير موجودة", 404, "CONVERSATION_NOT_FOUND");
    }

    const conversationRecord =
      conversation ?? {
        ...(await assistantRepository.createConversation(userId, input.message.slice(0, 60))),
        messages: [],
      };

    await assistantRepository.addMessage(conversationRecord.id, "USER", input.message);

    const history: Anthropic.MessageParam[] = conversationRecord.messages.map((m) => ({
      role: m.role === "USER" ? "user" : "assistant",
      content: m.content,
    }));
    history.push({ role: "user", content: input.message });

    let finalText = "";

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.messages
        .create({
          model: env.ASSISTANT_MODEL,
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          tools: assistantTools,
          messages: history,
        })
        .catch((err: unknown) => {
          // The Anthropic API/SDK failing (bad key, rate limit, network,
          // unknown model...) must never surface to the user as a bare
          // "unexpected error" — that's indistinguishable from a real
          // bug and gives them nothing to act on. Map the common cases
          // to a clear Arabic message; anything else still gets a
          // message that names the real cause instead of hiding it.
          throw mapAnthropicError(err);
        });

      const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
      finalText = textBlocks.map((b) => b.text).join("\n").trim();

      if (response.stop_reason !== "tool_use") {
        break;
      }

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );

      history.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        try {
          const result = await executeAssistantTool(block.name, block.input as Record<string, unknown>);
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: `تعذّر تنفيذ الأداة: ${err instanceof Error ? err.message : "خطأ غير معروف"}`,
            is_error: true,
          });
        }
      }

      history.push({ role: "user", content: toolResults });
    }

    if (!finalText) {
      finalText = "عذراً، لم أتمكن من إيجاد إجابة واضحة. حاول إعادة صياغة سؤالك.";
    }

    await assistantRepository.addMessage(conversationRecord.id, "ASSISTANT", finalText);
    await assistantRepository.touchConversation(conversationRecord.id);

    return this.getConversation(conversationRecord.id, userId);
  },
};
