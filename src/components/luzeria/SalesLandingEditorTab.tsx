import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { ChevronDown, ChevronUp, Eye, EyeOff, ExternalLink, ImagePlus, Loader2, Plus, Radar, Rocket, Trash2, Undo2, X } from "lucide-react";
import { salesLandingAdminQO, siteTrackingSettingsQO, useApi } from "@/lib/luzeria/queries";
import { saveSalesLandingDraft, publishSalesLanding, discardSalesLandingDraft } from "@/lib/luzeria/sales-landing.functions";
import { LANDING_SECTIONS, DEFAULT_LANDING, type LandingContent } from "@/lib/luzeria/sales-landing-content";
import { useMarketingAssetUpload } from "@/lib/luzeria/use-marketing-asset-upload";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { SalesHero, SalesNumbers, SalesBeforeAfter, SalesFeatures, SalesAiSpotlight, SalesAiConnectorSpotlight, LANDING_ICONS } from "./SalesLanding";

/* ---------- campos ---------- */

const inputCls = "w-full bg-card border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";

function Field({ label, value, onChange, max, single, hint }: {
  label: string; value: string; onChange: (v: string) => void; max?: number; single?: boolean; multiline?: boolean; hint?: string;
}) {
  const multiline = !single;
  return (
    <label className="block">
      <span className="block text-[11.5px] font-semibold text-foreground/60 mb-1">{label}</span>
      {multiline
        ? <textarea value={value} maxLength={max} rows={Math.min(6, Math.max(2, value.split("\n").length + 1))} onChange={(e) => onChange(e.target.value)} className={`${inputCls} resize-y`} />
        : <input value={value} maxLength={max} onChange={(e) => onChange(e.target.value)} className={inputCls} />}
      {hint && <span className="block text-[10.5px] text-foreground/40 mt-1">{hint}</span>}
    </label>
  );
}

function ImageField({ label, value, onChange, hint }: { label: string; value: string | null; onChange: (v: string | null) => void; hint?: string }) {
  const { upload, uploading } = useMarketingAssetUpload();
  const ref = useRef<HTMLInputElement>(null);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    const url = await upload(f);
    if (url) onChange(url); else toast.error("Não consegui enviar a imagem (use JPG, PNG ou WEBP até 8MB).");
  }
  return (
    <div>
      <span className="block text-[11.5px] font-semibold text-foreground/60 mb-1">{label}</span>
      <div className="flex items-center gap-3">
        <div className="w-20 h-14 rounded-md border border-foreground/10 bg-card overflow-hidden flex items-center justify-center shrink-0">
          {value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <span className="text-[10px] text-foreground/35 px-1 text-center">Imagem padrão</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
            className="text-xs font-bold px-3 py-2 rounded-md inline-flex items-center gap-1.5 border border-foreground/15 hover:border-foreground/30">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />} {value ? "Trocar" : "Enviar imagem"}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)} className="text-xs font-bold px-3 py-2 rounded-md inline-flex items-center gap-1.5 text-foreground/55 hover:text-foreground">
              <Undo2 size={13} /> Voltar ao padrão
            </button>
          )}
        </div>
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
      </div>
      {hint && <span className="block text-[10.5px] text-foreground/40 mt-1">{hint}</span>}
    </div>
  );
}

function IconSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} w-auto`} aria-label="Ícone">
      {Object.entries(LANDING_ICONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
    </select>
  );
}

function RowShell({ children, onUp, onDown, onRemove, first, last }: { children: ReactNode; onUp: () => void; onDown: () => void; onRemove: () => void; first: boolean; last: boolean }) {
  return (
    <div className="rounded-lg border border-foreground/10 p-3 bg-foreground/[0.02]">
      <div className="flex items-center justify-end gap-1 mb-2">
        <button type="button" onClick={onUp} disabled={first} aria-label="Subir" className="p-1 text-foreground/50 hover:text-foreground disabled:opacity-25"><ChevronUp size={15} /></button>
        <button type="button" onClick={onDown} disabled={last} aria-label="Descer" className="p-1 text-foreground/50 hover:text-foreground disabled:opacity-25"><ChevronDown size={15} /></button>
        <button type="button" onClick={onRemove} aria-label="Remover" className="p-1 text-foreground/50 hover:text-red-400"><Trash2 size={14} /></button>
      </div>
      <div className="grid gap-2.5">{children}</div>
    </div>
  );
}

function moveItem<T>(arr: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr]; [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function Accordion({ id, title, open, onToggle, children }: { id: string; title: string; open: boolean; onToggle: (id: string) => void; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-foreground/10 bg-card overflow-hidden">
      <button type="button" onClick={() => onToggle(id)} aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-[13px] font-bold text-foreground">{title}</span>
        <ChevronDown size={16} className={`text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-1 grid gap-3.5 border-t border-foreground/8">{children}</div>}
    </section>
  );
}

/* ---------- prévia ao vivo (desktop 1280px reduzido) ---------- */

function LivePreview({ content }: { content: LandingContent }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [h, setH] = useState(800);
  useLayoutEffect(() => {
    const el = outer.current, inn = inner.current;
    if (!el || !inn) return;
    const measure = () => { const k = el.clientWidth / 1280; setScale(k); setH(inn.scrollHeight * k); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el); ro.observe(inn);
    return () => ro.disconnect();
  }, []);
  const noop = () => {};
  return (
    <div ref={outer} className="rounded-xl border border-foreground/10 overflow-hidden bg-[#0A0E23]" style={{ height: h }}>
      <div ref={inner} style={{ width: 1280, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }} className="text-white">
        <SalesHero onCta={noop} content={content} />
        {content.sections.order.filter((id) => !content.sections.hidden.includes(id)).map((id) => {
          switch (id) {
            case "numbers": return <SalesNumbers key={id} content={content} />;
            case "beforeAfter": return <SalesBeforeAfter key={id} content={content} />;
            case "features": return <SalesFeatures key={id} content={content} />;
            case "ai": return <SalesAiSpotlight key={id} onCta={noop} content={content} />;
            case "aiConnector": return <SalesAiConnectorSpotlight key={id} onCta={noop} content={content} />;
            case "demo": return <div key={id} className="py-16 text-center text-white/40 text-sm border-y border-white/10">Demonstração interativa do dashboard (não editável)</div>;
            default: return null;
          }
        })}
      </div>
    </div>
  );
}

/* ---------- editor ---------- */

export function SalesLandingEditorTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(salesLandingAdminQO());
  const save = useServerFn(saveSalesLandingDraft);
  const publish = useServerFn(publishSalesLanding);
  const discard = useServerFn(discardSalesLandingDraft);
  const api = useApi();
  const { data: tracking } = useQuery(siteTrackingSettingsQO());

  const [draft, setDraft] = useState<LandingContent | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [open, setOpen] = useState<string | null>("hero");
  const [tabIdx, setTabIdx] = useState(0);
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [pixelDraft, setPixelDraft] = useState<string | null>(null);
  const loaded = useRef(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (data && !loaded.current) { loaded.current = true; setDraft(data.draft ?? data.published); }
  }, [data]);

  const publishedJson = useMemo(() => (data ? JSON.stringify(data.published) : ""), [data]);
  const hasPending = !!draft && !!data && JSON.stringify(draft) !== publishedJson;

  // Autosalva o rascunho (1s depois da última edição).
  useEffect(() => {
    if (!draft || !dirty.current) return;
    setStatus("saving");
    const t = setTimeout(async () => {
      try { await save({ data: { content: draft } }); setStatus("saved"); dirty.current = false; }
      catch (e: any) { setStatus("error"); toastFriendlyError(e, "Não consegui salvar o rascunho."); }
    }, 1000);
    return () => clearTimeout(t);
  }, [draft, save]);

  const edit = useCallback((fn: (d: LandingContent) => LandingContent) => {
    setDraft((prev) => { if (!prev) return prev; dirty.current = true; return fn(structuredClone(prev)); });
  }, []);

  async function doPublish() {
    if (!draft) return;
    try {
      if (dirty.current) { await save({ data: { content: draft } }); dirty.current = false; }
      await publish();
      await qc.invalidateQueries({ queryKey: ["sales-landing"] });
      await qc.invalidateQueries({ queryKey: ["sales-landing-admin"] });
      setStatus("idle");
      toast.success("Página publicada! Já está no ar.");
    } catch (e: any) { toastFriendlyError(e, "Erro ao publicar."); }
  }
  async function doDiscard() {
    const ok = await requestConfirm("Descartar as alterações não publicadas e voltar para a versão que está no ar?", { confirmLabel: "Descartar", danger: true });
    if (!ok || !data) return;
    try {
      await discard();
      dirty.current = false;
      setDraft(data.published);
      await qc.invalidateQueries({ queryKey: ["sales-landing-admin"] });
      setStatus("idle");
      toast.success("Voltou para a versão publicada.");
    } catch (e: any) { toastFriendlyError(e, "Erro ao descartar."); }
  }
  async function doResetDefault() {
    const ok = await requestConfirm("Restaurar todos os textos e imagens ao padrão original? Você ainda precisa publicar para valer no site.", { confirmLabel: "Restaurar", danger: true });
    if (!ok) return;
    edit(() => structuredClone(DEFAULT_LANDING));
  }

  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));

  const pixelValue = pixelDraft ?? tracking?.metaPixelId ?? "";
  const pixelDirty = pixelDraft !== null && pixelDraft !== (tracking?.metaPixelId ?? "");
  function savePixel() {
    api.updateSiteTrackingSettings.mutate({ data: { metaPixelId: pixelValue.trim() || null } }, {
      onSuccess: () => { toast.success("Pixel salvo."); setPixelDraft(null); },
      onError: (e: any) => toastFriendlyError(e, "Erro ao salvar o pixel."),
    });
  }

  if (isLoading || !draft) return <div className="py-16 text-center text-sm text-foreground/50"><Loader2 className="animate-spin inline mr-2" size={16} />Carregando…</div>;

  const d = draft;
  const tab = d.features.tabs[Math.min(tabIdx, d.features.tabs.length - 1)];

  const form = (
    <div className="grid gap-3">
      <Accordion id="hero" title="Topo da página" open={open === "hero"} onToggle={toggle}>
        <div className="grid grid-cols-2 gap-2.5">
          <Field single label="Selo (ex.: Novo)" value={d.hero.badge} max={30} onChange={(v) => edit((x) => { x.hero.badge = v; return x; })} />
          <Field single label="Texto do selo" value={d.hero.pill} max={120} onChange={(v) => edit((x) => { x.hero.pill = v; return x; })} />
        </div>
        <Field label="Título" value={d.hero.title} max={200} onChange={(v) => edit((x) => { x.hero.title = v; return x; })} />
        <div>
          <span className="block text-[11.5px] font-semibold text-foreground/60 mb-1">Tamanho do título: {d.hero.titleSize}px</span>
          <div className="flex items-center gap-3">
            <input type="range" min={28} max={90} step={1} value={d.hero.titleSize} aria-label="Tamanho do título"
              onChange={(e) => edit((x) => { x.hero.titleSize = Number(e.target.value); return x; })} className="flex-1 accent-[rgb(var(--lz-brand-rgb))]" />
            <button type="button" onClick={() => edit((x) => { x.hero.titleSize = DEFAULT_LANDING.hero.titleSize; return x; })}
              className="text-[11px] font-bold text-foreground/55 hover:text-foreground inline-flex items-center gap-1"><Undo2 size={12} /> Padrão</button>
          </div>
          <span className="block text-[10.5px] text-foreground/40 mt-1">No celular o título diminui sozinho. Este é o tamanho máximo no computador.</span>
        </div>
        <Field label="Frase em destaque (itálico)" value={d.hero.titleAccent} max={200} onChange={(v) => edit((x) => { x.hero.titleAccent = v; return x; })} />
        <Field label="Subtítulo" value={d.hero.subtitle} max={600} onChange={(v) => edit((x) => { x.hero.subtitle = v; return x; })} />
        <div className="grid grid-cols-2 gap-2.5">
          <Field single label="Botão principal" value={d.hero.ctaLabel} max={60} onChange={(v) => edit((x) => { x.hero.ctaLabel = v; return x; })} />
          <Field single label="Botão secundário" value={d.hero.ctaSecondaryLabel} max={60} onChange={(v) => edit((x) => { x.hero.ctaSecondaryLabel = v; return x; })} />
        </div>
        <div>
          <span className="block text-[11.5px] font-semibold text-foreground/60 mb-1">Garantias (abaixo dos botões)</span>
          <div className="grid gap-2">
            {d.hero.trust.map((t, i) => (
              <div key={i} className="flex gap-2">
                <input value={t} maxLength={80} onChange={(e) => edit((x) => { x.hero.trust[i] = e.target.value; return x; })} className={inputCls} />
                <button type="button" aria-label="Remover" onClick={() => edit((x) => { x.hero.trust.splice(i, 1); return x; })} className="p-2 text-foreground/50 hover:text-red-400"><X size={15} /></button>
              </div>
            ))}
            {d.hero.trust.length < 6 && <button type="button" onClick={() => edit((x) => { x.hero.trust.push("Nova garantia"); return x; })} className="text-xs font-bold text-foreground/60 hover:text-foreground inline-flex items-center gap-1 self-start"><Plus size={13} /> Adicionar</button>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <Field single label="Aviso flutuante 1 — título" value={d.hero.chipTitle} max={60} onChange={(v) => edit((x) => { x.hero.chipTitle = v; return x; })} />
          <Field single label="Aviso flutuante 1 — texto" value={d.hero.chipSub} max={80} onChange={(v) => edit((x) => { x.hero.chipSub = v; return x; })} />
          <Field single label="Aviso flutuante 2 — título" value={d.hero.chip2Title} max={60} onChange={(v) => edit((x) => { x.hero.chip2Title = v; return x; })} />
          <Field single label="Aviso flutuante 2 — texto" value={d.hero.chip2Sub} max={80} onChange={(v) => edit((x) => { x.hero.chip2Sub = v; return x; })} />
        </div>
        <ImageField label="Imagem principal (tela do sistema)" value={d.hero.image} onChange={(v) => edit((x) => { x.hero.image = v; return x; })} hint="Proporção 3:2 funciona melhor (ex.: 1500 × 1000)." />
      </Accordion>

      <Accordion id="numbers" title="Faixa de números" open={open === "numbers"} onToggle={toggle}>
        <p className="text-[11.5px] text-foreground/50">Os números de clientes e entregas vêm sozinhos do sistema (reais e atualizados). Aqui você edita os textos.</p>
        <Field label="Legenda do número de clientes" value={d.numbers.clientsLabel} max={120} onChange={(v) => edit((x) => { x.numbers.clientsLabel = v; return x; })} />
        <Field label="Legenda do número de entregas" value={d.numbers.deliveriesLabel} max={120} onChange={(v) => edit((x) => { x.numbers.deliveriesLabel = v; return x; })} />
        <div className="grid grid-cols-2 gap-2.5">
          <Field single label="Terceiro destaque" value={d.numbers.trialValue} max={40} onChange={(v) => edit((x) => { x.numbers.trialValue = v; return x; })} />
          <Field label="Legenda do terceiro" value={d.numbers.trialLabel} max={120} onChange={(v) => edit((x) => { x.numbers.trialLabel = v; return x; })} />
        </div>
      </Accordion>

      <Accordion id="ba" title="Antes e depois" open={open === "ba"} onToggle={toggle}>
        <Field single label="Etiqueta pequena" value={d.beforeAfter.eyebrow} max={80} onChange={(v) => edit((x) => { x.beforeAfter.eyebrow = v; return x; })} />
        <Field label="Título" value={d.beforeAfter.heading} max={200} onChange={(v) => edit((x) => { x.beforeAfter.heading = v; return x; })} />
        {d.beforeAfter.rows.map((r, i) => (
          <RowShell key={i} first={i === 0} last={i === d.beforeAfter.rows.length - 1}
            onUp={() => edit((x) => { x.beforeAfter.rows = moveItem(x.beforeAfter.rows, i, -1); return x; })}
            onDown={() => edit((x) => { x.beforeAfter.rows = moveItem(x.beforeAfter.rows, i, 1); return x; })}
            onRemove={() => edit((x) => { x.beforeAfter.rows.splice(i, 1); return x; })}>
            <Field label="Problema (antes)" value={r.before} max={200} onChange={(v) => edit((x) => { x.beforeAfter.rows[i].before = v; return x; })} />
            <div className="grid grid-cols-[auto_1fr] gap-2.5 items-end">
              <div><span className="block text-[11.5px] font-semibold text-foreground/60 mb-1">Ícone</span><IconSelect value={r.icon} onChange={(v) => edit((x) => { x.beforeAfter.rows[i].icon = v; return x; })} /></div>
              <Field label="Solução — título" value={r.title} max={120} onChange={(v) => edit((x) => { x.beforeAfter.rows[i].title = v; return x; })} />
            </div>
            <Field label="Solução — descrição" value={r.desc} max={300} onChange={(v) => edit((x) => { x.beforeAfter.rows[i].desc = v; return x; })} />
          </RowShell>
        ))}
        {d.beforeAfter.rows.length < 10 && (
          <button type="button" onClick={() => edit((x) => { x.beforeAfter.rows.push({ icon: "sparkles", before: "Novo problema", title: "Nova solução", desc: "" }); return x; })}
            className="text-xs font-bold text-foreground/60 hover:text-foreground inline-flex items-center gap-1 self-start"><Plus size={13} /> Adicionar linha</button>
        )}
      </Accordion>

      <Accordion id="features" title="Funções por área (abas)" open={open === "features"} onToggle={toggle}>
        <Field single label="Etiqueta pequena" value={d.features.eyebrow} max={80} onChange={(v) => edit((x) => { x.features.eyebrow = v; return x; })} />
        <Field label="Título" value={d.features.heading} max={200} onChange={(v) => edit((x) => { x.features.heading = v; return x; })} />
        <Field label="Subtítulo" value={d.features.subheading} max={300} onChange={(v) => edit((x) => { x.features.subheading = v; return x; })} />
        <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist">
          {d.features.tabs.map((t, i) => (
            <button key={t.id} type="button" role="tab" aria-selected={i === tabIdx} onClick={() => setTabIdx(i)}
              className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition"
              style={i === tabIdx ? { background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D", borderColor: "transparent" } : { borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}>
              {t.label}
            </button>
          ))}
        </div>
        {tab && (
          <div className="grid gap-3 rounded-lg border border-foreground/10 p-3">
            <Field single label="Nome da aba" value={tab.label} max={60} onChange={(v) => edit((x) => { x.features.tabs[tabIdx].label = v; return x; })} />
            {tab.feats.map((f, i) => (
              <RowShell key={i} first={i === 0} last={i === tab.feats.length - 1}
                onUp={() => edit((x) => { x.features.tabs[tabIdx].feats = moveItem(x.features.tabs[tabIdx].feats, i, -1); return x; })}
                onDown={() => edit((x) => { x.features.tabs[tabIdx].feats = moveItem(x.features.tabs[tabIdx].feats, i, 1); return x; })}
                onRemove={() => edit((x) => { x.features.tabs[tabIdx].feats.splice(i, 1); return x; })}>
                <div className="grid grid-cols-[auto_1fr] gap-2.5 items-end">
                  <div><span className="block text-[11.5px] font-semibold text-foreground/60 mb-1">Ícone</span><IconSelect value={f.icon} onChange={(v) => edit((x) => { x.features.tabs[tabIdx].feats[i].icon = v; return x; })} /></div>
                  <Field label="Título" value={f.title} max={120} onChange={(v) => edit((x) => { x.features.tabs[tabIdx].feats[i].title = v; return x; })} />
                </div>
                <Field label="Descrição" value={f.desc} max={400} onChange={(v) => edit((x) => { x.features.tabs[tabIdx].feats[i].desc = v; return x; })} />
                <Field single label="Selo (opcional)" value={f.chip} max={60} onChange={(v) => edit((x) => { x.features.tabs[tabIdx].feats[i].chip = v; return x; })} hint="Ex.: Novo, App Review aprovado. Deixe vazio para não mostrar." />
              </RowShell>
            ))}
            {tab.feats.length < 6 && (
              <button type="button" onClick={() => edit((x) => { x.features.tabs[tabIdx].feats.push({ icon: "sparkles", title: "Nova função", desc: "", chip: "" }); return x; })}
                className="text-xs font-bold text-foreground/60 hover:text-foreground inline-flex items-center gap-1 self-start"><Plus size={13} /> Adicionar função</button>
            )}
            {tab.id !== "ia" && (
              <ImageField label="Imagem da aba" value={tab.image} onChange={(v) => edit((x) => { x.features.tabs[tabIdx].image = v; return x; })}
                hint={tab.id === "aprovacao" ? "Tela de celular (vertical)." : "Print da tela do sistema."} />
            )}
            {tab.id === "gestao" && (
              <ImageField label="Segunda imagem (ranking)" value={tab.image2} onChange={(v) => edit((x) => { x.features.tabs[tabIdx].image2 = v; return x; })} />
            )}
            {tab.id === "ia" && <p className="text-[11px] text-foreground/45">O exemplo mostrado nesta aba é um cartão de amostra fixo (com nomes fictícios).</p>}
          </div>
        )}
      </Accordion>

      <Accordion id="ai" title="Planejamento com IA (destaque)" open={open === "ai"} onToggle={toggle}>
        <Field single label="Etiqueta pequena" value={d.ai.eyebrow} max={80} onChange={(v) => edit((x) => { x.ai.eyebrow = v; return x; })} />
        <Field label="Título" value={d.ai.heading} max={200} onChange={(v) => edit((x) => { x.ai.heading = v; return x; })} />
        {d.ai.steps.map((st, i) => (
          <RowShell key={i} first={i === 0} last={i === d.ai.steps.length - 1}
            onUp={() => edit((x) => { x.ai.steps = moveItem(x.ai.steps, i, -1); return x; })}
            onDown={() => edit((x) => { x.ai.steps = moveItem(x.ai.steps, i, 1); return x; })}
            onRemove={() => edit((x) => { x.ai.steps.splice(i, 1); return x; })}>
            <Field label={`Passo ${i + 1} — parte em negrito`} value={st.bold} max={160} onChange={(v) => edit((x) => { x.ai.steps[i].bold = v; return x; })} />
            <Field label="Continuação" value={st.rest} max={300} onChange={(v) => edit((x) => { x.ai.steps[i].rest = v; return x; })} />
          </RowShell>
        ))}
        {d.ai.steps.length < 8 && (
          <button type="button" onClick={() => edit((x) => { x.ai.steps.push({ bold: "Novo passo:", rest: "descrição" }); return x; })}
            className="text-xs font-bold text-foreground/60 hover:text-foreground inline-flex items-center gap-1 self-start"><Plus size={13} /> Adicionar passo</button>
        )}
        <Field single label="Botão" value={d.ai.ctaLabel} max={60} onChange={(v) => edit((x) => { x.ai.ctaLabel = v; return x; })} />
        <Field label="Observação embaixo do botão" value={d.ai.note} max={300} onChange={(v) => edit((x) => { x.ai.note = v; return x; })} />
      </Accordion>

      <Accordion id="aiConnector" title="Conector de IA — Claude/ChatGPT (destaque)" open={open === "aiConnector"} onToggle={toggle}>
        <Field single label="Etiqueta pequena" value={d.aiConnector.eyebrow} max={80} onChange={(v) => edit((x) => { x.aiConnector.eyebrow = v; return x; })} />
        <Field label="Título" value={d.aiConnector.heading} max={200} onChange={(v) => edit((x) => { x.aiConnector.heading = v; return x; })} />
        {d.aiConnector.steps.map((st, i) => (
          <RowShell key={i} first={i === 0} last={i === d.aiConnector.steps.length - 1}
            onUp={() => edit((x) => { x.aiConnector.steps = moveItem(x.aiConnector.steps, i, -1); return x; })}
            onDown={() => edit((x) => { x.aiConnector.steps = moveItem(x.aiConnector.steps, i, 1); return x; })}
            onRemove={() => edit((x) => { x.aiConnector.steps.splice(i, 1); return x; })}>
            <Field label={`Passo ${i + 1} — parte em negrito`} value={st.bold} max={160} onChange={(v) => edit((x) => { x.aiConnector.steps[i].bold = v; return x; })} />
            <Field label="Continuação" value={st.rest} max={300} onChange={(v) => edit((x) => { x.aiConnector.steps[i].rest = v; return x; })} />
          </RowShell>
        ))}
        {d.aiConnector.steps.length < 8 && (
          <button type="button" onClick={() => edit((x) => { x.aiConnector.steps.push({ bold: "Novo passo:", rest: "descrição" }); return x; })}
            className="text-xs font-bold text-foreground/60 hover:text-foreground inline-flex items-center gap-1 self-start"><Plus size={13} /> Adicionar passo</button>
        )}
        <Field single label="Botão" value={d.aiConnector.ctaLabel} max={60} onChange={(v) => edit((x) => { x.aiConnector.ctaLabel = v; return x; })} />
        <Field label="Observação embaixo do botão" value={d.aiConnector.note} max={300} onChange={(v) => edit((x) => { x.aiConnector.note = v; return x; })} />
      </Accordion>

      <Accordion id="order" title="Ordem e visibilidade das seções" open={open === "order"} onToggle={toggle}>
        <p className="text-[11.5px] text-foreground/50">O topo da página fica sempre primeiro. Planos, formulário, dúvidas e rodapé ficam sempre no fim.</p>
        <div className="grid gap-2">
          {d.sections.order.map((id, i) => {
            const meta = LANDING_SECTIONS.find((s) => s.id === id)!;
            const hidden = d.sections.hidden.includes(id);
            return (
              <div key={id} className="flex items-center gap-2 rounded-lg border border-foreground/10 px-3 py-2" style={{ opacity: hidden ? 0.5 : 1 }}>
                <div className="flex flex-col">
                  <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => edit((x) => { x.sections.order = moveItem(x.sections.order, i, -1); return x; })} className="text-foreground/50 hover:text-foreground disabled:opacity-25"><ChevronUp size={14} /></button>
                  <button type="button" aria-label="Descer" disabled={i === d.sections.order.length - 1} onClick={() => edit((x) => { x.sections.order = moveItem(x.sections.order, i, 1); return x; })} className="text-foreground/50 hover:text-foreground disabled:opacity-25"><ChevronDown size={14} /></button>
                </div>
                <span className="flex-1 text-[13px] font-semibold">{meta.label}</span>
                <button type="button" aria-label={hidden ? "Mostrar" : "Ocultar"} onClick={() => edit((x) => { x.sections.hidden = hidden ? x.sections.hidden.filter((h) => h !== id) : [...x.sections.hidden, id]; return x; })} className="p-1.5 rounded-md hover:bg-foreground/[0.06]">
                  {hidden ? <EyeOff size={16} className="text-foreground/40" /> : <Eye size={16} style={{ color: "var(--lz-accent-ink)" }} />}
                </button>
              </div>
            );
          })}
        </div>
      </Accordion>

      <Accordion id="tracking" title="Rastreamento (Meta Pixel)" open={open === "tracking"} onToggle={toggle}>
        <label className="block text-xs text-foreground/60 mb-1">Meta Pixel ID (Facebook/Instagram Ads)</label>
        <div className="flex items-center gap-2">
          <input value={pixelValue} onChange={(e) => setPixelDraft(e.target.value)} placeholder="Ex.: 3556074894637223" className={inputCls} />
          <button onClick={savePixel} disabled={!pixelDirty || api.updateSiteTrackingSettings.isPending}
            className="text-xs font-bold px-3 py-2 rounded-md disabled:opacity-40 shrink-0" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
            {api.updateSiteTrackingSettings.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
        <p className="text-[11px] text-foreground/40">Carrega só nas páginas públicas do site de vendas (nunca dentro do app logado). Dispara PageView ao carregar e StartTrial quando alguém termina o cadastro. Salva na hora (não depende de publicar).</p>
      </Accordion>

      <button type="button" onClick={doResetDefault} className="text-[11px] font-bold uppercase tracking-wider text-foreground/45 hover:text-foreground self-start">Restaurar textos originais</button>
    </div>
  );

  return (
    <div className="max-w-[1400px]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sticky top-0 z-20 bg-background/90 backdrop-blur py-2">
        <div className="text-sm text-foreground/60">
          {status === "saving" ? "Salvando rascunho…" : hasPending ? "Alterações não publicadas (rascunho salvo)" : "Tudo publicado"}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a href="https://modocriador.com.br/assinar" target="_blank" rel="noopener noreferrer" className="text-xs text-foreground/50 hover:text-foreground inline-flex items-center gap-1.5">Site no ar <ExternalLink size={12} /></a>
          <div className="xl:hidden inline-flex bg-card border border-foreground/8 rounded-lg p-1">
            {(["edit", "preview"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md ${view === v ? "bg-[rgb(var(--lz-brand-rgb))] text-black" : "text-foreground/60"}`}>{v === "edit" ? "Editar" : "Prévia"}</button>
            ))}
          </div>
          {hasPending && (
            <button onClick={doDiscard} className="text-xs font-bold px-3 py-2 rounded-md border border-foreground/15 inline-flex items-center gap-1.5 hover:border-foreground/30"><Undo2 size={13} /> Descartar</button>
          )}
          <button onClick={doPublish} disabled={!hasPending}
            className="text-xs font-bold px-4 py-2 rounded-md inline-flex items-center gap-1.5 disabled:opacity-40" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
            <Rocket size={13} /> Publicar
          </button>
        </div>
      </div>
      <p className="text-[12px] text-foreground/50 mb-3">Dica: nos textos, aperte <b>Enter</b> para quebrar a linha exatamente onde você quiser — a prévia ao lado mostra o resultado.</p>
      <div className="xl:grid xl:grid-cols-[440px_minmax(0,1fr)] xl:gap-6 xl:items-start">
        <div className={view === "preview" ? "hidden xl:block" : ""}>{form}</div>
        <div className={`${view === "edit" ? "hidden xl:block" : ""} xl:sticky xl:top-16 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto`}>
          <p className="text-[11px] text-foreground/40 mb-2 flex items-center gap-1.5"><Radar size={11} /> Prévia ao vivo, como aparece no computador.</p>
          <LivePreview content={draft} />
        </div>
      </div>
    </div>
  );
}
