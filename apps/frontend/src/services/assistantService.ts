import type { AssistantConversation, AssistantConversationWithMessages } from "@idm/shared-types";
import type { AssistantChatInput } from "@idm/shared-validation";
import { apiClient } from "./apiClient";

export const assistantService = {
  listConversations: () => apiClient.get<AssistantConversation[]>("/assistant/conversations"),

  getConversation: (id: string) =>
    apiClient.get<AssistantConversationWithMessages>(`/assistant/conversations/${id}`),

  deleteConversation: (id: string) => apiClient.delete<null>(`/assistant/conversations/${id}`),

  chat: (input: AssistantChatInput) =>
    apiClient.post<AssistantConversationWithMessages>("/assistant/chat", input),
};
