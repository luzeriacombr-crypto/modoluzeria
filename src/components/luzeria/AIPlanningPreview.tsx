import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles, Trash2, FileText, Layers, Image as ImageIcon, Search, Brain, Wand2, CalendarDays } from "lucide-react";
import { generateMonthlyPlanPreview, type MonthlyPlanItem, type MonthlyPlanResult } from "@/lib/luzeria/ai-planning.functions";
import { useApi, monthKeysQO } from "@/lib/luzeria/queries";
import { currentMonthKey, nextMonthKey, formatMonth } from "@/lib/luzeria/utils";
import { Modal } from "./Modals";

const MONTH_LABEL = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

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
  const parts: string[] = [`# Planejamento de ${MONTH_LABEL} (prévia gerada por IA)`];
  parts.push(`## Resumo da estratégia\n${result.summary}`);
  if (result.items.length) {
    const lines = result.items.map((it) => {
      const bits = [`**${it.title}** (${it.type === "reel" ? "Reel" : "Post"}${it.format ? ` — ${it.format}` : ""})`];
      if (it.pillar) bits.push(`Pilar: ${it.pillar}`);
      if (it.rationale) bits.push(it.rationale);
      const caption = it.captionDraft ? `\n  Legenda: ${it.captionDraft}` : "";
      return `- ${bits.join(" — ")}${caption}`;
    });
    parts.push(`## Publicações sugeridas\n${lines.join("\n")}`);
  }
  if (result.competitorNotes?.trim()) {
    parts.push(`## O que vimos dos concorrentes\n${result.competitorNotes.trim()}`);
  }
  return parts.join("\n\n");
}

export function AIPlanningPreview({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const generate = useServerFn(generateMonthlyPlanPreview);
  const api = useApi();
  const { data: existingMonthKeys = [] } = useQuery(monthKeysQO(clientId));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MonthlyPlanResult | null>(null);
  const [pickingMonth, setPickingMonth] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    generate({ data: { clientId } })
      .then((r) => { if (!cancelled) setResult(r); })
      .catch((e: any) => { if (!cancelled) setError(e?.message ?? "Não consegui gerar a prévia."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientId]);

  function updateItem(idx: number, patch: Partial<MonthlyPlanItem>) {
    setResult((r) => r ? { ...r, items: r.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) } : r);
  }

  function removeItem(idx: number) {
    setResult((r) => r ? { ...r, items: r.items.filter((_, i) => i !== idx) } : r);
  }

  function save() {
    if (!result) return;
    api.upsertClientDoc.mutate(
      { data: { clientId, type: "planejamento", title: `Planejamento (IA) — ${MONTH_LABEL}`, content: buildMarkdown(result) } },
      { onSuccess: () => { toast.success("Prévia salva como Planejamento."); onClose(); } },
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

  const monthOptions = (() => {
    const start = currentMonthKey();
    const upcoming: string[] = [start];
    let k = start;
    for (let i = 0; i < 5; i++) { k = nextMonthKey(k); upcoming.push(k); }
    return [...new Set([...existingMonthKeys, ...upcoming])].sort();
  })();

  const inp = "w-full bg-background border border-foreground/8 rounded-md px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";

  return (
    <Modal open onClose={onClose} title="Prévia de planejamento com IA" maxWidthClass="max-w-xl">
      {loading && <AILoadingState />}

      {!loading && error && (
        <div className="py-8 text-center">
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button onClick={onClose} className="text-xs text-foreground/50 hover:text-foreground">Fechar</button>
        </div>
      )}

      {!loading && !error && result && pickingMonth && (
        <div>
          <p className="text-sm text-foreground/60 mb-3">Pra qual mês são essas publicações?</p>
          <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto mb-3">
            {monthOptions.map((key) => (
              <button
                key={key}
                onClick={() => approveToRoteiros(key)}
                disabled={api.createRoteirosFromPlan.isPending}
                className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm text-left transition disabled:opacity-50"
                style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}
              >
                <span className="flex items-center gap-2 text-foreground"><CalendarDays size={14} className="text-foreground/40" /> {formatMonth(key)}</span>
                {!existingMonthKeys.includes(key) && (
                  <span className="text-[10px] uppercase font-bold text-foreground/30">Novo mês</span>
                )}
              </button>
            ))}
          </div>
          <button onClick={() => setPickingMonth(false)} className="text-xs text-foreground/50 hover:text-foreground px-1 py-1">
            {api.createRoteirosFromPlan.isPending ? "Gerando roteiros…" : "Voltar"}
          </button>
        </div>
      )}

      {!loading && !error && result && !pickingMonth && (
        <div className="space-y-4">
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
                <textarea
                  value={it.captionDraft}
                  onChange={(e) => updateItem(idx, { captionDraft: e.target.value })}
                  rows={2}
                  className={inp + " resize-none"}
                />
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
