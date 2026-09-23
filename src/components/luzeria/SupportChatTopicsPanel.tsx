import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles, MessageSquareText } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { getSupportChatTopics, type SupportChatTopic } from "@/lib/luzeria/support-chat.functions";

/** Platform-admin only: pega as perguntas reais já feitas no chat de
 * suporte (inclusive conversas já fechadas, que somem da aba "Chats") e
 * pede pra IA agrupar em temas recorrentes — pra Junior ver de uma vez só
 * sobre o que as agências mais perguntam, sem ler conversa por conversa. */
export function SupportChatTopicsPanel() {
  const [result, setResult] = useState<{ totalQuestions: number; topics: SupportChatTopic[] } | null>(null);

  const analyze = useMutation({
    mutationFn: useServerFn(getSupportChatTopics),
    onSuccess: setResult,
    onError: (e: any) => toastFriendlyError(e, "Não consegui analisar os temas agora."),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--lz-accent-ink)]" />
          <h2 className="text-foreground font-semibold">Assuntos do chat de suporte</h2>
        </div>
        <button
          onClick={() => analyze.mutate(undefined as any)}
          disabled={analyze.isPending}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          {analyze.isPending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {analyze.isPending ? "Analisando…" : result ? "Analisar de novo" : "Analisar com IA"}
        </button>
      </div>

      {!result && !analyze.isPending && (
        <div className="text-center py-12 px-6 bg-foreground/[0.03] border border-foreground/10 rounded-2xl">
          <MessageSquareText size={32} className="mx-auto mb-3 text-foreground/20" />
          <p className="text-foreground/50 text-sm">
            Clica em "Analisar com IA" pra ver os assuntos mais perguntados no chat, juntando tudo que já foi perguntado até hoje.
          </p>
        </div>
      )}

      {result && (
        <>
          <p className="text-xs text-foreground/40">
            {result.totalQuestions} pergunta{result.totalQuestions === 1 ? "" : "s"} analisada{result.totalQuestions === 1 ? "" : "s"}
            {result.totalQuestions >= 300 && " (últimas 300)"}
          </p>
          {result.topics.length === 0 ? (
            <div className="text-center py-8 text-sm text-foreground/40">Ainda não tem pergunta suficiente pra achar um padrão.</div>
          ) : (
            <div className="space-y-2">
              {result.topics.map((t, i) => (
                <div key={i} className="bg-card border border-foreground/7 rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-foreground">{t.topic}</span>
                    <span className="text-[11px] font-bold text-foreground/40 shrink-0">{t.count}x</span>
                  </div>
                  {t.examples.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {t.examples.map((ex, j) => (
                        <p key={j} className="text-xs text-foreground/50 leading-relaxed italic">"{ex}"</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
