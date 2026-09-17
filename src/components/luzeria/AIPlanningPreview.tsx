import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { generateMonthlyPlanPreview, type MonthlyPlanItem, type MonthlyPlanResult } from "@/lib/luzeria/ai-planning.functions";
import { useApi } from "@/lib/luzeria/queries";
import { Modal } from "./Modals";

const MONTH_LABEL = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MonthlyPlanResult | null>(null);

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

  const inp = "w-full bg-background border border-foreground/8 rounded-md px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";

  return (
    <Modal open onClose={onClose} title="Prévia de planejamento com IA" maxWidthClass="max-w-xl">
      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-foreground/50">
          <Loader2 size={22} className="animate-spin" />
          <p className="text-sm">Lendo histórico, arquivos de marca e concorrentes…</p>
        </div>
      )}

      {!loading && error && (
        <div className="py-8 text-center">
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <button onClick={onClose} className="text-xs text-foreground/50 hover:text-foreground">Fechar</button>
        </div>
      )}

      {!loading && !error && result && (
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
              className="lz-btn-primary text-xs px-5 py-2.5 rounded-md disabled:opacity-50"
            >
              {api.upsertClientDoc.isPending ? "Salvando…" : "Salvar como Planejamento"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
