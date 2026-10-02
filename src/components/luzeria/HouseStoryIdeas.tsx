// House — "Ideias de stories" no Meu dia: a IA sugere ideias pra hoje com
// tudo que o app sabe da marca. "Usei essa" marca a ideia e conta +1 story.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Loader2, Sparkles, X, ClipboardPen } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { listStoryIdeas, generateStoryIdeas, markStoryIdeaUsed, dismissStoryIdea, type StoryIdeaRow } from "@/lib/luzeria/house-ai.functions";
import { MOMENTO_LABEL, briefingCompleteness, type StoryIdea } from "@/lib/luzeria/house-brand";
import { useBrandBriefing } from "./HouseBrandBriefing";
import { HouseBrandSelect } from "./HouseBrandSwitcher";
import { useHouseBrand } from "@/lib/luzeria/house-brand-store";

const KEY = ["house-story-ideas"];

export function HouseStoryIdeas() {
  const qc = useQueryClient();
  const me = useMe().data;
  const openFicha = useUI((s) => s.openFicha);
  const listFn = useServerFn(listStoryIdeas);
  const genFn = useServerFn(generateStoryIdeas);
  const usedFn = useServerFn(markStoryIdeaUsed);
  const dismissFn = useServerFn(dismissStoryIdea);
  const { brandParam, writeBrandId, multi } = useHouseBrand();
  const [pick, setPick] = useState<string | undefined>(undefined);
  const genBrand = brandParam ?? pick ?? writeBrandId;
  const { data: rows = [] } = useQuery({ queryKey: [...KEY, brandParam ?? "all"], queryFn: () => listFn({ data: { brandId: brandParam } }) });
  const { data: brand } = useBrandBriefing(genBrand);
  const [focus, setFocus] = useState("");
  const [showFocus, setShowFocus] = useState(false);

  const generate = useMutation({
    mutationFn: () => genFn({ data: { focus: focus.trim() || undefined, brandId: genBrand } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: KEY }); setFocus(""); setShowFocus(false); toast.success(`${r.count} ideias novas.`); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui gerar as ideias"),
  });
  const used = useMutation({
    mutationFn: (v: { id: string; used: boolean }) => usedFn({ data: v }),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["house-my-day"] });
      if (v.used) toast.success("Boa! +1 story registrado pra você.");
    },
    onError: (e: any) => toastFriendlyError(e, "Não consegui salvar"),
  });
  const dismiss = useMutation({
    mutationFn: (id: string) => dismissFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  // Mostra só a leva mais recente (as anteriores ficam de memória pra IA não repetir).
  const latestBatch = rows[0]?.batchId;
  const batch = rows.filter((r) => r.batchId === latestBatch);
  const completeness = brand ? briefingCompleteness(brand.briefing, brand.description) : 1;
  const groups = (["manha", "tarde", "noite"] as StoryIdea["momento"][]).map((m) => ({ m, items: batch.filter((r) => r.idea.momento === m) }));

  return (
    <section className="bg-card rounded-2xl p-5 border border-foreground/[0.06]">
      {multi && !brandParam && <div className="mb-3"><HouseBrandSelect value={pick} onChange={setPick} /></div>}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="flex items-center gap-2 text-xs uppercase font-bold tracking-wider text-foreground/60">
          <span style={{ color: "var(--lz-accent-ink)" }}><Sparkles size={14} /></span>Ideias de stories
        </h2>
        <div className="flex items-center gap-2">
          {!showFocus && (
            <button onClick={() => setShowFocus(true)} className="text-[11px] text-foreground/50 hover:text-foreground">+ foco de hoje</button>
          )}
          <button onClick={() => generate.mutate()} disabled={generate.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold disabled:opacity-60"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
            {generate.isPending ? <><Loader2 size={13} className="animate-spin" /> Pensando…</> : <><Sparkles size={13} /> {batch.length ? "Gerar novas" : "Gerar ideias com IA"}</>}
          </button>
        </div>
      </div>

      {showFocus && (
        <input value={focus} onChange={(e) => setFocus(e.target.value)} maxLength={500} autoFocus
          placeholder="Ex: divulgar a campanha de clareamento, mostrar a equipe nova…"
          className="lz-input w-full mb-4" />
      )}

      {completeness < 0.5 && brand && (
        <button onClick={() => {
          openFicha(brand.clientId);
          setTimeout(() => document.getElementById("house-brand-briefing")?.scrollIntoView({ behavior: "smooth", block: "start" }), 700);
        }}
          className="w-full flex items-center gap-3 text-left rounded-xl px-3.5 py-3 mb-4 transition hover:opacity-90"
          style={{ background: "rgba(231,169,81,0.1)", border: "1px solid rgba(231,169,81,0.35)" }}>
          <ClipboardPen size={16} className="shrink-0" style={{ color: "#E7A951" }} />
          <span className="text-xs text-foreground/80">
            <strong className="text-foreground">Complete o briefing da marca</strong> (serviços, público, tom de voz…) pra IA acertar mais. Está {Math.round(completeness * 100)}% preenchido. Toque pra abrir.
          </span>
        </button>
      )}

      {batch.length === 0 ? (
        <p className="text-sm text-foreground/50">
          A IA sugere ideias pra gravar hoje, usando o briefing da marca, o playbook e o que tem gerado lead.
          {me?.role === "member" ? "" : " Disponível no plano House + IA."}
        </p>
      ) : (
        <div className="space-y-4">
          {groups.filter((g) => g.items.length).map(({ m, items }) => (
            <div key={m}>
              <div className="text-[10.5px] uppercase font-bold tracking-wider text-foreground/45 mb-2">{MOMENTO_LABEL[m]}</div>
              <ul className="space-y-2">
                {items.map((r) => <IdeaRow key={r.id} row={r}
                  onUse={() => used.mutate({ id: r.id, used: !r.usedAt })}
                  onDismiss={() => dismiss.mutate(r.id)} />)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function IdeaRow({ row, onUse, onDismiss }: { row: StoryIdeaRow; onUse: () => void; onDismiss: () => void }) {
  const [open, setOpen] = useState(false);
  const i = row.idea;
  const usedIt = !!row.usedAt;
  return (
    <li className="rounded-xl border border-foreground/[0.07] overflow-hidden" style={{ opacity: usedIt ? 0.6 : 1 }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-start gap-3 text-left px-3.5 py-3 hover:bg-foreground/[0.03]">
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md shrink-0 mt-0.5"
          style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.12)", color: "var(--lz-accent-ink)" }}>{i.formato}</span>
        <span className={`flex-1 text-sm font-semibold ${usedIt ? "line-through text-foreground/55" : "text-foreground"}`}>{i.titulo}</span>
        {usedIt && <Check size={15} className="shrink-0" style={{ color: "var(--lz-accent-ink)" }} />}
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 -mt-1 space-y-2">
          <p className="text-[13.5px] leading-relaxed text-foreground/80">{i.roteiro}</p>
          {i.textoNaTela && <p className="text-xs text-foreground/60"><strong className="text-foreground/75">Texto na tela:</strong> {i.textoNaTela}</p>}
          {i.cta && <p className="text-xs text-foreground/60"><strong className="text-foreground/75">Chamada:</strong> {i.cta}</p>}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={onUse} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold"
              style={usedIt ? { backgroundColor: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "var(--foreground)" } : { backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
              <Check size={13} /> {usedIt ? "Desfazer" : "Usei essa"}
            </button>
            {!usedIt && (
              <button onClick={onDismiss} className="inline-flex items-center gap-1 px-2.5 py-2 rounded-md text-xs text-foreground/50 hover:text-foreground">
                <X size={12} /> Não serve
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
