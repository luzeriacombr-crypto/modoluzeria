import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Sparkles, Trash2, FileText, Layers, Image as ImageIcon, Search, Brain, Wand2, Star, BookMarked } from "lucide-react";
import { generateMonthlyPlanPreview, submitAiPlanningFeedback, type MonthlyPlanItem, type MonthlyPlanResult } from "@/lib/luzeria/ai-planning.functions";
import { useApi } from "@/lib/luzeria/queries";
import { formatMonth } from "@/lib/luzeria/utils";
import { Modal } from "./Modals";
import { MonthPickerList } from "./MonthPickerList";

const MONTH_LABEL = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

// Erro de validação (zod) chega como o array de issues em JSON puro no
// .message — nunca mostra isso pro usuário, cai num texto legível.
function friendlyError(e: any, fallback: string): string {
  const msg = e?.message;
  if (typeof msg === "string" && msg.trim().startsWith("[") && msg.includes('"code"')) return fallback;
  return msg ?? fallback;
}

// Uma chamada só e sem streaming — pode demorar (principalmente quando a IA
// pesquisa concorrentes na web). Em vez de um spinner mudo, mostra uma
// sequência de "etapas" fictícias mas plausíveis, pra pessoa entender que
// tem trabalho de verdade acontecendo em vez de achar que travou.
const LOADING_STEPS: { icon: typeof FileText; text: string }[] = [
  { icon: FileText, text: "Lendo o histórico de posts e reels desse cliente…" },
  { icon: Layers, text: "Conferindo roteiros e planejamentos anteriores…" },
  { icon: ImageIcon, text: "Analisando os arquivos de marca no Drive…" },
  { icon: Search, text: "Pesquisando o que os concorrentes andam postando…" },
  { icon: Brain, text: "Entendendo os padrões que funcionam com esse cliente…" },
  { icon: Wand2, text: "Construindo um planejamento incrível pra você…" },
];

function AILoadingState() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 2200);
    return () => clearInterval(id);
  }, []);
  const Current = LOADING_STEPS[step].icon;
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16">
      <div className="relative w-14 h-14 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(var(--lz-brand-rgb),0.25)" }} />
        <div className="relative w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(var(--lz-brand-rgb),0.15)" }}>
          <Current size={22} style={{ color: "var(--lz-accent-ink)" }} />
        </div>
      </div>
      <p key={step} className="text-sm text-foreground/60 text-center max-w-[280px] leading-relaxed" style={{ animation: "lzKnowledgeFadeIn 0.4s ease" }}>
        {LOADING_STEPS[step].text}
      </p>
      <div className="flex items-center gap-1.5">
        {LOADING_STEPS.map((_, i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full transition-colors duration-500"
            style={{ backgroundColor: i <= step ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 15%, transparent)" }}
          />
        ))}
      </div>
      <style>{`@keyframes lzKnowledgeFadeIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

function buildMarkdown(result: MonthlyPlanResult): string {
  const parts: string[] = [`# Planejamento de ${MONTH_LABEL}`];
  parts.push(`## Resumo da estratégia\n${result.summary}`);
  if (result.items.length) {
    // Cada publicação vira sua própria subseção (### ), não um item de
    // bullet — assim o captionDraft começa numa linha limpa e, se for um
    // carrossel com "SLIDE N:", o parser reconhece e renderiza em caixinhas
    // em vez de virar um blocão emendado atrás de "Roteiro/texto: ".
    const sections = result.items.map((it, i) => {
      const heading = `### ${i + 1}. ${it.title} (${it.type === "reel" ? "Reel" : "Post"}${it.format ? `: ${it.format}` : ""})`;
      // Pilar e rationale são anotação estratégica INTERNA (referencia "a
      // reunião", "o briefing" etc) — nunca embutir no content, que é o
      // mesmo texto mostrado no link público pro cliente. Ficam só em
      // plan_items (estruturado), fora da vista do cliente.
      const bodyParts = [
        it.captionDraft || null,
        it.publishCaption ? `Legenda: ${it.publishCaption}` : null,
      ].filter(Boolean);
      return `${heading}\n${bodyParts.join("\n\n")}`;
    });
    parts.push(`## Publicações sugeridas\n${sections.join("\n\n")}`);
  }
  if (result.competitorNotes?.trim()) {
    parts.push(`## O que vimos dos concorrentes\n${result.competitorNotes.trim()}`);
  }
  return parts.join("\n\n");
}

export function AIPlanningPreview({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const generate = useServerFn(generateMonthlyPlanPreview);
  const submitFeedback = useServerFn(submitAiPlanningFeedback);
  const navigate = useNavigate();
  const api = useApi();
  const [started, setStarted] = useState(false);
  const [extraContext, setExtraContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MonthlyPlanResult | null>(null);
  const [pickingMonth, setPickingMonth] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  async function sendFeedback() {
    if (rating === null) return;
    setSendingFeedback(true);
    try {
      await submitFeedback({ data: { clientId, rating, reason: reasonDraft.trim() || undefined } });
      setFeedbackSent(true);
      toast.success("Valeu pela avaliação!");
    } catch (e: any) {
      toast.error(friendlyError(e, "Não consegui enviar a avaliação."));
    } finally {
      setSendingFeedback(false);
    }
  }

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const trimmedContext = extraContext.trim().slice(0, 60000);
    generate({ data: { clientId, extraContext: trimmedContext || undefined } })
      .then((r) => { if (!cancelled) setResult(r); })
      .catch((e: any) => { if (!cancelled) setError(friendlyError(e, "Não consegui gerar a prévia.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [started, clientId]);

  function updateItem(idx: number, patch: Partial<MonthlyPlanItem>) {
    setResult((r) => r ? { ...r, items: r.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) } : r);
  }

  function removeItem(idx: number) {
    setResult((r) => r ? { ...r, items: r.items.filter((_, i) => i !== idx) } : r);
  }

  function save() {
    if (!result) return;
    api.upsertClientDoc.mutate(
      {
        data: {
          clientId, type: "planejamento", title: `Planejamento (IA) — ${MONTH_LABEL}`,
          content: buildMarkdown(result), planItems: result.items,
        },
      },
      { onSuccess: () => { toast.success("Prévia salva como Planejamento — pode aprovar depois quando quiser."); onClose(); } },
    );
  }

  function approveToRoteiros(targetMonthKey: string) {
    if (!result) return;
    api.createRoteirosFromPlan.mutate(
      {
        data: {
          clientId, targetMonthKey,
          items: result.items.map((it) => ({
            title: it.title, type: it.type, captionDraft: it.captionDraft,
            publishCaption: it.publishCaption, postFormat: it.postFormat,
            pillar: it.pillar, rationale: it.rationale,
          })),
        },
      },
      {
        onSuccess: () => {
          toast.success(`Roteiros criados! Aprovar cada um já cria a publicação em ${formatMonth(targetMonthKey)}.`);
          onClose();
        },
      },
    );
  }

  const inp = "w-full bg-background border border-foreground/8 rounded-md px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";

  return (
    <Modal open onClose={onClose} title="Prévia de planejamento com IA (versão beta)" maxWidthClass="max-w-xl">
      {!started && (
        <div className="space-y-3">
          <p className="text-sm text-foreground/70">
            Pra esse próximo planejamento, teve alguma reunião com o cliente? Você tem algum briefing específico do mês ou transcrição? Cola aqui embaixo — isso conta mais do que o histórico antigo.
          </p>
          <textarea
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value.slice(0, 60000))}
            placeholder="Cole aqui o que foi combinado na reunião, transcrição ou briefing desse mês (opcional)…"
            rows={7}
            autoFocus
            className={inp + " resize-none"}
          />
          {extraContext.length > 50000 && (
            <p className="text-[11px] text-foreground/40 text-right -mt-1.5">{extraContext.length.toLocaleString("pt-BR")} / 60.000 caracteres</p>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onClose} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Cancelar</button>
            <button onClick={() => setStarted(true)} className="lz-btn-primary text-xs px-5 py-2.5 rounded-md">
              {extraContext.trim() ? "Gerar prévia com esse contexto" : "Gerar prévia sem contexto extra"}
            </button>
          </div>
        </div>
      )}

      {started && loading && <AILoadingState />}

      {!loading && error && (
        <div className="py-8 text-center">
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button onClick={onClose} className="text-xs text-foreground/50 hover:text-foreground">Fechar</button>
        </div>
      )}

      {!loading && !error && result && pickingMonth && (
        <div>
          <p className="text-sm text-foreground/60 mb-3">Pra qual mês são essas publicações?</p>
          <div className="mb-3">
            <MonthPickerList clientId={clientId} onSelect={approveToRoteiros} pending={api.createRoteirosFromPlan.isPending} />
          </div>
          <button onClick={() => setPickingMonth(false)} className="text-xs text-foreground/50 hover:text-foreground px-1 py-1">
            {api.createRoteirosFromPlan.isPending ? "Gerando roteiros…" : "Voltar"}
          </button>
        </div>
      )}

      {!loading && !error && result && !pickingMonth && (
        <div className="space-y-4">
          {result.knowledgeItemsCount === 0 && (
            <button
              onClick={() => { onClose(); navigate({ to: "/configuracoes", search: { tab: "knowledge" } }); }}
              className="w-full flex items-center gap-2.5 rounded-lg p-3 text-left transition hover:opacity-90"
              style={{ background: "rgba(var(--lz-brand-rgb),0.08)", border: "1px solid rgba(var(--lz-brand-rgb),0.2)" }}
            >
              <BookMarked size={15} className="shrink-0" style={{ color: "var(--lz-accent-ink)" }} />
              <div className="text-[12px] text-foreground/70 leading-relaxed">
                <span className="font-semibold text-foreground">Sua Base de Conhecimento está vazia.</span> A prévia fica melhor com contexto de como sua agência cria conteúdo — clique pra preencher.
              </div>
            </button>
          )}

          <div className="rounded-lg p-3.5 text-[13px] text-foreground/80 leading-relaxed" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
            {result.summary}
          </div>

          <div className="space-y-2.5">
            {result.items.map((it, idx) => (
              <div key={idx} className="rounded-lg p-3 space-y-2" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
                    {it.type === "reel" ? "Reel" : "Post"}
                  </span>
                  <input value={it.title} onChange={(e) => updateItem(idx, { title: e.target.value })} className={inp + " flex-1 font-medium"} />
                  <button onClick={() => removeItem(idx)} className="p-1.5 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5 transition shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
                {(it.pillar || it.format) && (
                  <p className="text-[11px] text-foreground/40">{[it.pillar, it.format].filter(Boolean).join(" · ")}</p>
                )}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-foreground/30 mb-1 block">Texto de produção (Briefing)</label>
                  <textarea
                    value={it.captionDraft}
                    onChange={(e) => updateItem(idx, { captionDraft: e.target.value })}
                    rows={3}
                    className={inp + " resize-none font-mono"}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-foreground/30 mb-1 block">Legenda a publicar</label>
                  <textarea
                    value={it.publishCaption ?? ""}
                    onChange={(e) => updateItem(idx, { publishCaption: e.target.value })}
                    rows={2}
                    className={inp + " resize-none"}
                  />
                </div>
                {it.rationale && <p className="text-[11px] text-foreground/35 italic">{it.rationale}</p>}
              </div>
            ))}
            {result.items.length === 0 && (
              <p className="text-sm text-foreground/40 text-center py-6">Nenhum item sugerido — descarte e tente de novo.</p>
            )}
          </div>

          {result.competitorNotes?.trim() && (
            <div className="rounded-lg p-3.5 text-[12px] text-foreground/60 leading-relaxed" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)" }}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground/35 mb-1.5">
                <Sparkles size={11} /> O que vimos dos concorrentes
              </div>
              {result.competitorNotes}
            </div>
          )}

          <div className="rounded-lg p-3.5" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)" }}>
            {feedbackSent ? (
              <p className="text-[12.5px] text-foreground/60">Valeu pela avaliação — isso ajuda a gente a melhorar essa feature em beta. 🙌</p>
            ) : (
              <>
                <p className="text-[12.5px] font-semibold text-foreground mb-2">Avise-nos sua satisfação com o resultado</p>
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setRating(n)} className="p-0.5">
                      <Star
                        size={20}
                        fill={rating !== null && n <= rating ? "rgb(var(--lz-brand-rgb))" : "none"}
                        color={rating !== null && n <= rating ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 30%, transparent)"}
                      />
                    </button>
                  ))}
                </div>
                {rating !== null && (
                  <div className="space-y-2">
                    <textarea
                      value={reasonDraft}
                      onChange={(e) => setReasonDraft(e.target.value)}
                      placeholder="Por quê? (opcional)"
                      rows={2}
                      className={inp + " resize-none"}
                    />
                    <button
                      onClick={sendFeedback}
                      disabled={sendingFeedback}
                      className="lz-btn-primary text-xs px-4 py-1.5 rounded-md disabled:opacity-50"
                    >
                      {sendingFeedback ? "Enviando…" : "Enviar avaliação"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onClose} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Descartar</button>
            <button
              onClick={save}
              disabled={api.upsertClientDoc.isPending || result.items.length === 0}
              className="text-xs px-4 py-2.5 rounded-md border border-foreground/10 text-foreground/70 hover:text-foreground hover:border-foreground/25 transition disabled:opacity-50"
            >
              {api.upsertClientDoc.isPending ? "Salvando…" : "Salvar como Planejamento"}
            </button>
            <button
              onClick={() => setPickingMonth(true)}
              disabled={result.items.length === 0}
              className="lz-btn-primary text-xs px-5 py-2.5 rounded-md disabled:opacity-50"
            >
              Aprovar e enviar pros Roteiros
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
