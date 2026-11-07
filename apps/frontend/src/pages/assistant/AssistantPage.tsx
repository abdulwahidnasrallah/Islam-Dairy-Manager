import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Plus, Trash2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { assistantService } from "@/services/assistantService";
import { ApiClientError } from "@/services/apiClient";

const SUGGESTED_QUESTIONS = [
  "ما هي المنتجات التي أوشك مخزونها على النفاد؟",
  "كم إجمالي المبيعات هذا الشهر؟",
  "من هم أعلى 5 زبائن ديناً؟",
  "كم رصيد الصندوق الحالي؟",
];

export default function AssistantPage() {
  const queryClient = useQueryClient();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [] } = useQuery({
    queryKey: ["assistant-conversations"],
    queryFn: () => assistantService.listConversations(),
  });

  const { data: conversation } = useQuery({
    queryKey: ["assistant-conversation", conversationId],
    queryFn: () => assistantService.getConversation(conversationId!),
    enabled: Boolean(conversationId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assistantService.deleteConversation(id),
    onSuccess: (_data, id) => {
      if (id === conversationId) setConversationId(null);
      void queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] });
    },
  });

  const chatMutation = useMutation({
    mutationFn: (message: string) => assistantService.chat({ conversationId, message }),
    onSuccess: (updated) => {
      setConversationId(updated.id);
      setDraft("");
      setError(null);
      queryClient.setQueryData(["assistant-conversation", updated.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["assistant-conversations"] });
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.errorCode === "ASSISTANT_NOT_CONFIGURED") {
        setError(
          "المساعد الذكي غير مُفعَّل بعد. أضف ANTHROPIC_API_KEY في إعدادات الخادم (ملف .env) لتفعيله.",
        );
      } else {
        setError(err instanceof ApiClientError ? err.message : "حدث خطأ غير متوقع");
      }
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [conversation?.messages.length, chatMutation.isPending]);

  function send(message: string) {
    if (!message.trim() || chatMutation.isPending) return;
    setError(null);
    chatMutation.mutate(message.trim());
  }

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4">
      <Card className="flex w-64 shrink-0 flex-col gap-2 overflow-hidden">
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => {
            setConversationId(null);
            setError(null);
          }}
        >
          <Plus size={16} /> محادثة جديدة
        </Button>
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`group flex items-center justify-between rounded-lg px-2 py-2 text-sm ${
                c.id === conversationId ? "bg-primary-50 text-primary-700" : "hover:bg-gray-100"
              }`}
            >
              <button
                type="button"
                className="flex-1 truncate text-right"
                onClick={() => setConversationId(c.id)}
              >
                {c.title ?? "محادثة بدون عنوان"}
              </button>
              <button
                type="button"
                className="hidden text-gray-400 hover:text-danger group-hover:block"
                onClick={() => deleteMutation.mutate(c.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-gray-400">لا توجد محادثات سابقة</p>
          )}
        </div>
      </Card>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-2">
          {!conversation && (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <Sparkles size={32} className="text-primary-400" />
              <p className="text-sm text-gray-500">
                اسأل المساعد الذكي عن مبيعاتك، مخزونك، ديونك، أو أرباحك — يعتمد فقط على بيانات محلك الفعلية.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                    onClick={() => send(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {conversation?.messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "USER" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
                  m.role === "USER" ? "bg-gray-100 text-gray-800" : "bg-primary-600 text-white"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {chatMutation.isPending && (
            <div className="flex justify-end">
              <div className="max-w-[75%] rounded-2xl bg-primary-600/70 px-4 py-2 text-sm text-white">
                جاري التفكير...
              </div>
            </div>
          )}
        </div>

        {error && <p className="border-t border-gray-100 px-3 py-2 text-sm text-danger">{error}</p>}

        <form
          className="flex items-center gap-2 border-t border-gray-100 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="اكتب سؤالك هنا..."
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-400"
          />
          <Button type="submit" isLoading={chatMutation.isPending}>
            <Send size={16} />
          </Button>
        </form>
      </Card>
    </div>
  );
}
