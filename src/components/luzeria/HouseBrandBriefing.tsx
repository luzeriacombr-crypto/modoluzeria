// House — "Briefing da marca (a IA usa isso)": perguntas guiadas no topo da
// ficha da marca principal. Alimenta as ideias de stories e a prévia de
// planejamento com IA (vira o texto de clients.content_briefing).
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { getBrandBriefing, saveBrandBriefing, organizeBriefingWithAI } from "@/lib/luzeria/house-ai.functions";
import { BRAND_BRIEFING_FIELDS, briefingCompleteness, type BrandBriefing } from "@/lib/luzeria/house-brand";

export const brandBriefingKey = ["house-brand-briefing"];

export function useBrandBriefing() {
  const fn = useServerFn(getBrandBriefing);
  return useQuery({ queryKey: brandBriefingKey, queryFn: () => fn(), staleTime: 5 * 60_000 });
}

export function HouseBrandBriefing() {
  const qc = useQueryClient();
  const { data } = useBrandBriefing();
  const saveFn = useServerFn(saveBrandBriefing);
  const [niche, setNiche] = useState("");
  const [description, setDescription] = useState("");
  const [competitors, setCompetitors] = useState("");
  const [briefing, setBriefing] = useState<BrandBriefing>({});
  const [dirty, setDirty] = useState(false);
  // "Colar tudo de uma vez" (texto corrido) ou "Parte por parte" (campos).
  const [mode, setMode] = useState<"colar" | "partes">("colar");
  const organizeFn = useServerFn(organizeBriefingWithAI);

  useEffect(() => {
    if (!data) return;
    setNiche(data.niche); setDescription(data.description); setCompetitors(data.competitors); setBriefing(data.briefing ?? {});
    setDirty(false);
    const hasFields = BRAND_BRIEFING_FIELDS.some((f) => data.briefing?.[f.key]?.trim());
    setMode(hasFields && !data.briefing?.full?.trim() ? "partes" : "colar");
  }, [data]);

  const organize = useMutation({
    mutationFn: () => organizeFn({ data: { text: briefing.full ?? "" } }),
    onSuccess: (r) => {
      // Preenche só o que a IA achou — não apaga o que já estava escrito.
      if (r.niche && !niche.trim()) setNiche(r.niche);
      if (r.description && !description.trim()) setDescription(r.description);
      if (r.competitors && !competitors.trim()) setCompetitors(r.competitors);
      setBriefing((b) => {
        const next = { ...b };
        for (const f of BRAND_BRIEFING_FIELDS) if (r.briefing[f.key] && !b[f.key]?.trim()) next[f.key] = r.briefing[f.key];
        return next;
      });
      setDirty(true);
      setMode("partes");
      toast.success("Organizado! Confira os campos e salve.");
    },
    onError: (e: any) => toastFriendlyError(e, "Não consegui organizar"),
  });

  const save = useMutation({
    mutationFn: () => saveFn({ data: { niche, description, competitors, briefing } }),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: brandBriefingKey });
      qc.invalidateQueries({ queryKey: ["client-ficha"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Briefing salvo. A IA já usa essas informações.");
    },
    onError: (e: any) => toastFriendlyError(e, "Não consegui salvar o briefing"),
  });

  if (!data) return null;
  const pct = Math.round(briefingCompleteness(briefing, description) * 100);
  const inp = "w-full bg-background border border-foreground/10 rounded-xl px-3.5 py-2.5 text-[14px] text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-y";
  const field = (label: string, hint: string, value: string, onChange: (v: string) => void, rows = 2, maxLength = 4000) => (
    <label className="block">
      <span className="block text-sm font-semibold text-foreground">{label}</span>
      <span className="block text-[11.5px] text-foreground/45 mb-1.5">{hint}</span>
      {rows <= 1 ? (
        <input value={value} onChange={(e) => { onChange(e.target.value); setDirty(true); }} maxLength={maxLength} className={inp} />
      ) : (
        <textarea value={value} onChange={(e) => { onChange(e.target.value); setDirty(true); }} rows={rows} maxLength={maxLength} className={inp} />
      )}
    </label>
  );

  return (
    <section id="house-brand-briefing" className="rounded-2xl p-5 sm:p-6 border scroll-mt-4" style={{ borderColor: "rgba(var(--lz-brand-rgb),0.3)", background: "linear-gradient(135deg, rgba(var(--lz-brand-rgb),0.07), var(--card) 60%)" }}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-foreground"><Sparkles size={16} style={{ color: "var(--lz-accent-ink)" }} /> Briefing da marca</h3>
          <p className="text-xs text-foreground/55 mt-1">A IA usa isso pra criar ideias de stories e o planejamento do mês. Quanto mais completo, mais a cara da {data.name}.</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-foreground/50">{pct}% preenchido</div>
          <div className="w-32 h-1.5 rounded-full bg-foreground/[0.08] overflow-hidden mt-1">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "rgb(var(--lz-brand-rgb))" }} />
          </div>
        </div>
      </div>
      <div className="inline-flex items-center gap-1 bg-background rounded-full p-1 border border-foreground/[0.08] mb-5">
        {([["colar", "Colar tudo de uma vez"], ["partes", "Parte por parte"]] as const).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${mode === m ? "bg-[rgb(var(--lz-brand-rgb))] text-black" : "text-foreground/55 hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {mode === "colar" ? (
        <div>
          <p className="text-[12px] text-foreground/55 mb-2">
            Cole aqui o que você já tem: apresentação da empresa, briefing antigo, texto do site, anotações de reunião, conversa de WhatsApp… do jeito que estiver.
          </p>
          <textarea value={briefing.full ?? ""} onChange={(e) => { setBriefing((b) => ({ ...b, full: e.target.value })); setDirty(true); }}
            rows={12} maxLength={20000} className={inp}
            placeholder={"Ex: A Clínica é especializada em... Atendemos principalmente... Nosso diferencial é... Não gostamos de..."} />
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button onClick={() => organize.mutate()} disabled={(briefing.full?.trim().length ?? 0) < 40 || organize.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-bold border border-foreground/15 text-foreground/85 hover:bg-foreground/5 disabled:opacity-40">
              {organize.isPending ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Organizar nos campos com IA
            </button>
            <span className="text-[11px] text-foreground/45">opcional: a IA separa o texto nos campos pra você conferir</span>
          </div>
        </div>
      ) : (
      <div className="grid gap-4 md:grid-cols-2">
        {field("Segmento", "Ex: clínica de estética, odontologia, academia.", niche, setNiche, 1, 200)}
        {field("Concorrentes", "Um por linha: @perfil ou nome.", competitors, setCompetitors, 2, 2000)}
        <div className="md:col-span-2">{field("Sobre a empresa", "O que a empresa faz, há quanto tempo, onde fica, a história em poucas linhas.", description, setDescription, 3, 4000)}</div>
        {BRAND_BRIEFING_FIELDS.map((f) => (
          <div key={f.key} className={f.rows >= 3 ? "md:col-span-2" : ""}>
            {field(f.label, f.hint, briefing[f.key] ?? "", (v) => setBriefing((b) => ({ ...b, [f.key]: v })), f.rows)}
          </div>
        ))}
      </div>
      )}
      <div className="flex items-center gap-3 mt-5">
        <button onClick={() => save.mutate()} disabled={!dirty || save.isPending}
          className="px-5 py-2.5 rounded-md text-sm font-bold disabled:opacity-40"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          {save.isPending ? "Salvando…" : "Salvar briefing"}
        </button>
        {dirty && <span className="text-xs text-foreground/45">Alterações não salvas</span>}
      </div>
    </section>
  );
}
