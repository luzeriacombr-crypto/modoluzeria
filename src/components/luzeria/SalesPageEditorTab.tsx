import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Loader2, ImagePlus, X, GripVertical,
  Monitor, Smartphone, Circle,
} from "lucide-react";
import { salesPageBlocksAdminQO, useApi } from "@/lib/luzeria/queries";
import { useMarketingAssetUpload } from "@/lib/luzeria/use-marketing-asset-upload";
import {
  BACKGROUND_SWATCHES, type BackgroundKey, ICON_KEYS, BUILTIN_KEYS, BUILTIN_LABELS,
  BUILTIN_ILLUSTRATIONS, type ImageSpec, SalesPageBody,
} from "./salesPageBlocks";
import type { SalesPageBlock, SalesPageBlockType } from "@/lib/luzeria/sales-page.functions";

const TYPE_LABELS: Record<Exclude<SalesPageBlockType, "hero">, string> = {
  bullet_list: "Lista com marcadores",
  steps: "Passo a passo",
  feature: "Destaque com imagem",
  gallery: "Galeria de imagens",
  text_blurb: "Texto simples",
};
const TYPE_DESCRIPTIONS: Record<Exclude<SalesPageBlockType, "hero">, string> = {
  bullet_list: "Título + lista de itens com ✓ ou ✕ (ex.: \"Dores\", \"Você vai ter...\")",
  steps: "Título + passos numerados com ícone (ex.: \"Simples assim\")",
  feature: "Título + texto + até 4 imagens de um lado, ideal pra mostrar uma funcionalidade",
  gallery: "Título + grade de imagens (ex.: depoimentos, prints de clientes)",
  text_blurb: "Só um texto curto com ícone (ex.: \"Sobre nós\")",
};

function emptyContent(type: Exclude<SalesPageBlockType, "hero">): any {
  switch (type) {
    case "bullet_list": return { heading: "Novo título", icon: "check", items: ["Novo item"], background: "white" };
    case "steps": return { heading: "Novo título", background: "white", items: [{ icon: "star", number: "01", title: "Passo 1", description: "" }] };
    case "feature": return { eyebrowIcon: "star", eyebrowLabel: "Novo destaque", title: "Título do destaque", description: "", background: "white", reverse: false, images: [] };
    case "gallery": return { heading: "Nova galeria", background: "white", images: [] };
    case "text_blurb": return { eyebrowIcon: "star", eyebrowLabel: "Texto", paragraph: "", background: "white" };
  }
}

function headingOf(block: SalesPageBlock): string {
  return block.content.heading || block.content.title || block.content.eyebrowLabel || "(sem título)";
}

export function SalesPageEditorTab() {
  const { data: blocks = [], isLoading } = useQuery(salesPageBlocksAdminQO());
  const api = useApi();
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewWidth, setPreviewWidth] = useState<"desktop" | "mobile">("desktop");
  // Draft content per block id — a live copy the fields edit immediately,
  // so the preview updates as you type instead of only after "Salvar".
  const [drafts, setDrafts] = useState<Record<string, any>>({});

  useEffect(() => {
    setDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const b of blocks) {
        if (!(b.id in next)) { next[b.id] = b.content; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [blocks]);

  const hero = blocks.find((b) => b.type === "hero");
  const rest = blocks.filter((b) => b.type !== "hero");

  const previewHero = hero ? { content: drafts[hero.id] ?? hero.content } : undefined;
  const previewBlocks = rest
    .filter((b) => b.isVisible)
    .map((b) => ({ id: b.id, type: b.type, content: drafts[b.id] ?? b.content }));

  function moveBy(id: string, delta: number) {
    const idx = rest.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= rest.length) return;
    const order = rest.map((b) => b.id);
    [order[idx], order[target]] = [order[target], order[idx]];
    api.reorderSalesPageBlocks.mutate({ data: { orderedIds: order } });
  }

  function addBlock(type: Exclude<SalesPageBlockType, "hero">) {
    api.createSalesPageBlock.mutate({ data: { type, content: emptyContent(type) } as any }, {
      onSuccess: (r: any) => { setAdding(false); setExpandedId(r.id); },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao criar bloco"),
    });
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 text-sm text-white/40 py-10"><Loader2 size={14} className="animate-spin" /> Carregando...</div>;
  }

  return (
    <div className="grid lg:grid-cols-[420px_1fr] gap-6 items-start">
      {/* Coluna de edição */}
      <div className="space-y-6 min-w-0">
        <p className="text-sm text-white/50">
          Edita o conteúdo do site de vendas (modocriador.com.br). Cabeçalho, planos, formulário de cadastro,
          dúvidas frequentes e rodapé não fazem parte daqui — veja a prévia ao lado.
        </p>

        {hero && (
          <HeroCard
            block={hero}
            draftContent={drafts[hero.id] ?? hero.content}
            onDraftChange={(c) => setDrafts((d) => ({ ...d, [hero.id]: c }))}
          />
        )}

        <div className="space-y-3">
          {rest.map((b, i) => (
            <BlockRow
              key={b.id}
              block={b}
              draftContent={drafts[b.id] ?? b.content}
              onDraftChange={(c) => setDrafts((d) => ({ ...d, [b.id]: c }))}
              isFirst={i === 0}
              isLast={i === rest.length - 1}
              expanded={expandedId === b.id}
              onToggleExpand={() => setExpandedId(expandedId === b.id ? null : b.id)}
              onMoveUp={() => moveBy(b.id, -1)}
              onMoveDown={() => moveBy(b.id, 1)}
            />
          ))}
        </div>

        {adding ? (
          <div className="bg-[#1C1C1C] rounded-lg p-5 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-white">Que tipo de seção?</span>
              <button onClick={() => setAdding(false)} className="text-white/40 hover:text-white"><X size={16} /></button>
            </div>
            {(Object.keys(TYPE_LABELS) as Exclude<SalesPageBlockType, "hero">[]).map((t) => (
              <button
                key={t}
                onClick={() => addBlock(t)}
                disabled={api.createSalesPageBlock.isPending}
                className="w-full text-left px-4 py-3 rounded-md bg-[#0D0D0D] border border-white/[0.08] hover:border-[rgb(var(--lz-brand-rgb))] transition disabled:opacity-50"
              >
                <div className="text-sm font-semibold text-white">{TYPE_LABELS[t]}</div>
                <div className="text-xs text-white/40 mt-0.5">{TYPE_DESCRIPTIONS[t]}</div>
              </button>
            ))}
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="lz-btn-primary text-xs px-4 py-2.5 rounded-md inline-flex items-center gap-2">
            <Plus size={14} /> Adicionar seção
          </button>
        )}
      </div>

      {/* Prévia ao vivo */}
      <div className="lg:sticky lg:top-6 min-w-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-white/40">Prévia do site</span>
          <div className="inline-flex items-center gap-1 rounded-full bg-[#1C1C1C] p-1 border border-white/10">
            <button
              onClick={() => setPreviewWidth("desktop")}
              title="Desktop"
              className="h-7 w-7 rounded-full flex items-center justify-center transition"
              style={{ background: previewWidth === "desktop" ? "rgb(var(--lz-brand-rgb))" : "transparent", color: previewWidth === "desktop" ? "#0D0D0D" : "rgba(255,255,255,0.5)" }}
            ><Monitor size={13} /></button>
            <button
              onClick={() => setPreviewWidth("mobile")}
              title="Celular"
              className="h-7 w-7 rounded-full flex items-center justify-center transition"
              style={{ background: previewWidth === "mobile" ? "rgb(var(--lz-brand-rgb))" : "transparent", color: previewWidth === "mobile" ? "#0D0D0D" : "rgba(255,255,255,0.5)" }}
            ><Smartphone size={13} /></button>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-y-auto overflow-x-hidden" style={{ height: "80vh", background: "#0A0E23" }}>
            <div style={{ width: previewWidth === "mobile" ? 390 : "100%", margin: "0 auto" }}>
              <div className="text-white" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
                <SalesPageBody hero={previewHero} blocks={previewBlocks} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroCard({ block, draftContent, onDraftChange }: { block: SalesPageBlock; draftContent: any; onDraftChange: (c: any) => void }) {
  const api = useApi();
  const [open, setOpen] = useState(true);
  const dirty = JSON.stringify(draftContent) !== JSON.stringify(block.content);
  const set = (patch: any) => onDraftChange({ ...draftContent, ...patch });

  function save() {
    api.updateSalesPageBlock.mutate({ data: { id: block.id, type: "hero", content: draftContent } as any }, {
      onSuccess: () => toast.success("Hero salvo."),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
    });
  }

  return (
    <div className="bg-[#1C1C1C] rounded-lg border border-white/10 overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: "rgba(var(--lz-brand-light-rgb),0.15)", color: "rgb(var(--lz-brand-rgb))" }}>
            Fixo
          </span>
          <span className="text-sm font-bold text-white">Topo do site (Hero)</span>
          {dirty && <Circle size={7} className="fill-amber-400 text-amber-400" />}
        </div>
        {open ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3 border-t border-white/[0.06] pt-4">
          <TextField label="Selo (eyebrow)" value={draftContent.eyebrowLabel} onChange={(v) => set({ eyebrowLabel: v })} />
          <IconPicker label="Ícone do selo" value={draftContent.eyebrowIcon} onChange={(v) => set({ eyebrowIcon: v })} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Título — linha 1" value={draftContent.titleLine1} onChange={(v) => set({ titleLine1: v })} />
            <TextField label="Título — linha 2" value={draftContent.titleLine2} onChange={(v) => set({ titleLine2: v })} />
            <TextField label="Título destaque — linha 1" value={draftContent.titleAccentLine1} onChange={(v) => set({ titleAccentLine1: v })} />
            <TextField label="Título destaque — linha 2" value={draftContent.titleAccentLine2} onChange={(v) => set({ titleAccentLine2: v })} />
          </div>
          <TextArea label="Subtítulo" value={draftContent.subtitle} onChange={(v) => set({ subtitle: v })} rows={3} />
          <TextField label="Texto do botão" value={draftContent.ctaLabel} onChange={(v) => set({ ctaLabel: v })} />
          <ImageStackEditor images={draftContent.images ?? []} onChange={(images) => set({ images })} />
          <div className="flex justify-end pt-1">
            <button onClick={save} disabled={api.updateSalesPageBlock.isPending || !dirty} className="lz-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-50">
              {api.updateSalesPageBlock.isPending ? "Salvando..." : dirty ? "Salvar" : "Salvo ✓"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BlockRow({
  block, draftContent, onDraftChange, isFirst, isLast, expanded, onToggleExpand, onMoveUp, onMoveDown,
}: {
  block: SalesPageBlock; draftContent: any; onDraftChange: (c: any) => void;
  isFirst: boolean; isLast: boolean; expanded: boolean;
  onToggleExpand: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const api = useApi();
  const dirty = JSON.stringify(draftContent) !== JSON.stringify(block.content);

  function save() {
    api.updateSalesPageBlock.mutate({ data: { id: block.id, type: block.type, content: draftContent, isVisible: block.isVisible } as any }, {
      onSuccess: () => toast.success("Seção salva."),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
    });
  }

  function toggleVisible() {
    api.updateSalesPageBlock.mutate({ data: { id: block.id, type: block.type, content: block.content, isVisible: !block.isVisible } as any });
  }

  function remove() {
    if (!confirm(`Remover a seção "${headingOf(block)}"?`)) return;
    api.deleteSalesPageBlock.mutate({ data: { id: block.id } }, {
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
    });
  }

  return (
    <div className="bg-[#1C1C1C] rounded-lg border border-white/10 overflow-hidden" style={{ opacity: block.isVisible ? 1 : 0.55 }}>
      <div className="flex items-center gap-2 px-4 py-3">
        <GripVertical size={14} className="text-white/20 shrink-0" />
        <div className="flex flex-col shrink-0">
          <button onClick={onMoveUp} disabled={isFirst} className="text-white/30 hover:text-white disabled:opacity-20"><ChevronUp size={13} /></button>
          <button onClick={onMoveDown} disabled={isLast} className="text-white/30 hover:text-white disabled:opacity-20"><ChevronDown size={13} /></button>
        </div>
        <button onClick={onToggleExpand} className="flex-1 min-w-0 text-left flex items-center gap-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">{TYPE_LABELS[block.type as Exclude<SalesPageBlockType, "hero">]}</span>
          <span className="text-sm font-semibold text-white truncate">{headingOf(block)}</span>
          {dirty && <Circle size={7} className="fill-amber-400 text-amber-400 shrink-0" />}
        </button>
        <button onClick={toggleVisible} title={block.isVisible ? "Ocultar do site" : "Mostrar no site"} className="text-white/40 hover:text-white shrink-0">
          {block.isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        <button onClick={remove} className="text-white/40 hover:text-red-400 shrink-0"><Trash2 size={15} /></button>
      </div>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-4">
          <BlockFields type={block.type as Exclude<SalesPageBlockType, "hero">} content={draftContent} onChange={onDraftChange} />
          <div className="flex justify-end pt-1">
            <button onClick={save} disabled={api.updateSalesPageBlock.isPending || !dirty} className="lz-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-50">
              {api.updateSalesPageBlock.isPending ? "Salvando..." : dirty ? "Salvar" : "Salvo ✓"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BlockFields({ type, content, onChange }: { type: Exclude<SalesPageBlockType, "hero">; content: any; onChange: (c: any) => void }) {
  const set = (patch: any) => onChange({ ...content, ...patch });

  if (type === "bullet_list") {
    return (
      <>
        <TextField label="Título" value={content.heading} onChange={(v) => set({ heading: v })} />
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs text-white/70">
            <input type="radio" checked={content.icon === "check"} onChange={() => set({ icon: "check" })} /> ✓ (positivo)
          </label>
          <label className="flex items-center gap-1.5 text-xs text-white/70">
            <input type="radio" checked={content.icon === "x"} onChange={() => set({ icon: "x" })} /> ✕ (dor/problema)
          </label>
        </div>
        <StringListEditor items={content.items ?? []} onChange={(items) => set({ items })} />
        <TextField label="Frase de fechamento (parte normal, opcional)" value={content.closingTextPlain ?? ""} onChange={(v) => set({ closingTextPlain: v })} />
        <TextField label="Frase de fechamento (parte destacada, opcional)" value={content.closingTextAccent ?? ""} onChange={(v) => set({ closingTextAccent: v })} />
        <BackgroundPicker value={content.background} onChange={(v) => set({ background: v })} />
      </>
    );
  }
  if (type === "steps") {
    return (
      <>
        <TextField label="Título" value={content.heading} onChange={(v) => set({ heading: v })} />
        <StepsListEditor items={content.items ?? []} onChange={(items) => set({ items })} />
        <BackgroundPicker value={content.background} onChange={(v) => set({ background: v })} />
      </>
    );
  }
  if (type === "feature") {
    return (
      <>
        <IconPicker label="Ícone do selo" value={content.eyebrowIcon} onChange={(v) => set({ eyebrowIcon: v })} />
        <TextField label="Selo (eyebrow)" value={content.eyebrowLabel} onChange={(v) => set({ eyebrowLabel: v })} />
        <TextField label="Título" value={content.title} onChange={(v) => set({ title: v })} />
        <TextArea label="Descrição" value={content.description} onChange={(v) => set({ description: v })} rows={3} />
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input type="checkbox" checked={!!content.reverse} onChange={(e) => set({ reverse: e.target.checked })} /> Imagem à esquerda, texto à direita
        </label>
        <ImageStackEditor images={content.images ?? []} onChange={(images) => set({ images })} />
        <BackgroundPicker value={content.background} onChange={(v) => set({ background: v })} />
      </>
    );
  }
  if (type === "gallery") {
    return (
      <>
        <TextField label="Título" value={content.heading} onChange={(v) => set({ heading: v })} />
        <ImageStackEditor images={content.images ?? []} onChange={(images) => set({ images })} simple />
        <BackgroundPicker value={content.background} onChange={(v) => set({ background: v })} />
      </>
    );
  }
  // text_blurb
  return (
    <>
      <IconPicker label="Ícone do selo" value={content.eyebrowIcon} onChange={(v) => set({ eyebrowIcon: v })} />
      <TextField label="Selo (eyebrow)" value={content.eyebrowLabel} onChange={(v) => set({ eyebrowLabel: v })} />
      <TextArea label="Parágrafo" value={content.paragraph} onChange={(v) => set({ paragraph: v })} rows={4} />
      <BackgroundPicker value={content.background} onChange={(v) => set({ background: v })} />
    </>
  );
}

/* ---------------- Campos genéricos ---------------- */

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">{label}</span>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="lz-input-dark w-full" />
    </label>
  );
}

function TextArea({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">{label}</span>
      <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={rows} className="lz-input-dark w-full resize-none" />
    </label>
  );
}

function IconPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="lz-input-dark w-full">
        {ICON_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
    </label>
  );
}

function BackgroundPicker({ value, onChange }: { value: BackgroundKey; onChange: (v: BackgroundKey) => void }) {
  return (
    <div>
      <span className="block text-[10px] uppercase tracking-wide text-white/40 mb-1.5">Cor de fundo</span>
      <div className="flex gap-2">
        {BACKGROUND_SWATCHES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onChange(s.key)}
            title={s.label}
            className="h-8 w-8 rounded-md border-2 transition"
            style={{ background: s.color, borderColor: value === s.key ? "rgb(var(--lz-brand-rgb))" : "transparent" }}
          />
        ))}
      </div>
    </div>
  );
}

function StringListEditor({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  return (
    <div>
      <span className="block text-[10px] uppercase tracking-wide text-white/40 mb-1.5">Itens</span>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex gap-1.5">
            <input value={it} onChange={(e) => { const next = [...items]; next[i] = e.target.value; onChange(next); }} className="lz-input-dark flex-1" />
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-white/40 hover:text-red-400 px-2"><X size={14} /></button>
          </div>
        ))}
      </div>
      <button onClick={() => onChange([...items, ""])} className="mt-1.5 text-xs text-white/50 hover:text-white inline-flex items-center gap-1"><Plus size={12} /> Adicionar item</button>
    </div>
  );
}

function StepsListEditor({ items, onChange }: { items: any[]; onChange: (items: any[]) => void }) {
  return (
    <div>
      <span className="block text-[10px] uppercase tracking-wide text-white/40 mb-1.5">Passos</span>
      <div className="space-y-2.5">
        {items.map((it, i) => (
          <div key={i} className="bg-[#0D0D0D] rounded-md p-3 border border-white/[0.06] space-y-1.5">
            <div className="flex items-center gap-2">
              <select value={it.icon} onChange={(e) => { const next = [...items]; next[i] = { ...it, icon: e.target.value }; onChange(next); }} className="lz-input-dark text-xs">
                {ICON_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <input value={it.number} onChange={(e) => { const next = [...items]; next[i] = { ...it, number: e.target.value }; onChange(next); }} className="lz-input-dark w-14 text-xs" placeholder="01" />
              <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="ml-auto text-white/40 hover:text-red-400"><X size={14} /></button>
            </div>
            <input value={it.title} onChange={(e) => { const next = [...items]; next[i] = { ...it, title: e.target.value }; onChange(next); }} className="lz-input-dark w-full text-sm" placeholder="Título do passo" />
            <textarea value={it.description} onChange={(e) => { const next = [...items]; next[i] = { ...it, description: e.target.value }; onChange(next); }} className="lz-input-dark w-full text-xs resize-none" rows={2} placeholder="Descrição" />
          </div>
        ))}
      </div>
      <button onClick={() => onChange([...items, { icon: "star", number: String(items.length + 1).padStart(2, "0"), title: "", description: "" }])} className="mt-1.5 text-xs text-white/50 hover:text-white inline-flex items-center gap-1">
        <Plus size={12} /> Adicionar passo
      </button>
    </div>
  );
}

function ImageStackEditor({ images, onChange, simple }: { images: ImageSpec[]; onChange: (images: ImageSpec[]) => void; simple?: boolean }) {
  const { upload, uploading } = useMarketingAssetUpload();

  function updateAt(i: number, patch: Partial<ImageSpec>) {
    const next = [...images];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }

  async function handleUpload(i: number, file: File) {
    const url = await upload(file);
    if (url) updateAt(i, { source: "upload", url, builtinKey: undefined });
  }

  function addImage() {
    if (images.length >= 4) return;
    onChange([...images, {
      id: `img-${Date.now()}`, source: "builtin", builtinKey: BUILTIN_KEYS[0],
      floating: false, floatVariant: "a", widthPct: 100, top: 0, left: 0, z: images.length,
    }]);
  }

  return (
    <div>
      <span className="block text-[10px] uppercase tracking-wide text-white/40 mb-1.5">Imagens (até 4)</span>
      <div className="space-y-3">
        {images.map((img, i) => (
          <div key={img.id} className="bg-[#0D0D0D] rounded-md p-3 border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => updateAt(i, { source: "upload" })}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${img.source === "upload" ? "bg-[rgb(var(--lz-brand-rgb))] text-[#0D0D0D]" : "border border-white/15 text-white/60"}`}
                >Enviar foto</button>
                <button
                  onClick={() => updateAt(i, { source: "builtin", builtinKey: img.builtinKey ?? BUILTIN_KEYS[0] })}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${img.source === "builtin" ? "bg-[rgb(var(--lz-brand-rgb))] text-[#0D0D0D]" : "border border-white/15 text-white/60"}`}
                >Usar ilustração pronta</button>
              </div>
              <button onClick={() => onChange(images.filter((_, j) => j !== i))} className="text-white/40 hover:text-red-400"><Trash2 size={14} /></button>
            </div>

            {img.source === "upload" ? (
              <div className="flex items-center gap-3">
                {img.url && <img src={img.url} alt="" className="h-14 w-14 rounded-md object-cover border border-white/10" />}
                <label className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white cursor-pointer border border-white/15 rounded-md px-3 py-2">
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                  {img.url ? "Trocar imagem" : "Escolher imagem"}
                  <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(i, f); }} />
                </label>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="h-14 w-20 rounded-md overflow-hidden border border-white/10 flex items-center justify-center bg-[#141414] shrink-0 scale-[0.3] origin-top-left" style={{ width: 420, height: 200 }}>
                  {(() => { const Cmp = BUILTIN_ILLUSTRATIONS[img.builtinKey ?? ""]; return Cmp ? <Cmp /> : null; })()}
                </div>
                <select value={img.builtinKey} onChange={(e) => updateAt(i, { builtinKey: e.target.value })} className="lz-input-dark text-xs">
                  {BUILTIN_KEYS.map((k) => <option key={k} value={k}>{BUILTIN_LABELS[k] ?? k}</option>)}
                </select>
              </div>
            )}

            {!simple && (
              <>
                <label className="flex items-center gap-2 text-xs text-white/70">
                  <input type="checkbox" checked={img.floating} onChange={(e) => updateAt(i, { floating: e.target.checked })} /> Flutuante
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="block text-[9px] uppercase text-white/30 mb-0.5">Tamanho %</span>
                    <input type="number" min={5} max={100} value={img.widthPct} onChange={(e) => updateAt(i, { widthPct: Number(e.target.value) })} className="lz-input-dark w-full text-xs" />
                  </label>
                  <label className="block">
                    <span className="block text-[9px] uppercase text-white/30 mb-0.5">Topo %</span>
                    <input type="number" min={-20} max={120} value={img.top} onChange={(e) => updateAt(i, { top: Number(e.target.value) })} className="lz-input-dark w-full text-xs" />
                  </label>
                  <label className="block">
                    <span className="block text-[9px] uppercase text-white/30 mb-0.5">Esquerda %</span>
                    <input type="number" min={-20} max={120} value={img.left} onChange={(e) => updateAt(i, { left: Number(e.target.value) })} className="lz-input-dark w-full text-xs" />
                  </label>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      {images.length < 4 && (
        <button onClick={addImage} className="mt-1.5 text-xs text-white/50 hover:text-white inline-flex items-center gap-1"><Plus size={12} /> Adicionar imagem</button>
      )}
    </div>
  );
}
