import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Loader2, X,
  Monitor, Smartphone, Palette, FlipHorizontal, ExternalLink, Rocket, Layers, Pencil, Maximize2, Minimize2, Undo2, ImagePlus, GripVertical,
} from "lucide-react";
import { salesPageBlocksAdminQO, useApi } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { BACKGROUND_SWATCHES, HeroSection, renderBlockNode, SalesPageBody, BG_BLUE, useDragReorder } from "./salesPageBlocks";
import { PreviewFrame } from "./PreviewFrame";
import { useMarketingAssetUpload } from "@/lib/luzeria/use-marketing-asset-upload";
import type { SalesPageBlock, SalesPageBlockType } from "@/lib/luzeria/sales-page.functions";

const TYPE_LABELS: Record<Exclude<SalesPageBlockType, "hero">, string> = {
  bullet_list: "Lista com marcadores",
  steps: "Passo a passo",
  feature: "Destaque com imagem",
  gallery: "Galeria de imagens",
  text_blurb: "Texto simples",
  image_banner: "Imagem de ponta a ponta",
  single_image: "Uma imagem",
};
const TYPE_DESCRIPTIONS: Record<Exclude<SalesPageBlockType, "hero">, string> = {
  bullet_list: "Título + lista de itens com ✓ ou ✕ (ex.: \"Dores\", \"Você vai ter...\")",
  steps: "Título + passos numerados com ícone (ex.: \"Simples assim\")",
  feature: "Título + texto + até 4 imagens de um lado, ideal pra mostrar uma funcionalidade",
  gallery: "Título + grade de imagens (ex.: depoimentos, prints de clientes)",
  text_blurb: "Só um texto curto com ícone (ex.: \"Sobre nós\")",
  image_banner: "Só uma foto, ocupando a seção inteira de ponta a ponta na horizontal",
  single_image: "Só uma foto centralizada, com cantos arredondados, dentro da largura normal da página",
};

function emptyContent(type: Exclude<SalesPageBlockType, "hero">): any {
  switch (type) {
    case "bullet_list": return { heading: "Novo título", icon: "check", items: ["Novo item"], background: "white", size: "normal" };
    case "steps": return { heading: "Novo título", background: "white", size: "normal", items: [{ icon: "star", number: "01", title: "Passo 1", description: "" }] };
    case "feature": return { eyebrowIcon: "star", eyebrowLabel: "Novo destaque", title: "Título do destaque", description: "", background: "white", size: "normal", reverse: false, images: [] };
    case "gallery": return { heading: "Nova galeria", background: "white", size: "normal", images: [] };
    case "text_blurb": return { eyebrowIcon: "star", eyebrowLabel: "Texto", paragraph: "", background: "white", size: "normal" };
    case "image_banner": return { imageUrl: null, alt: "", background: "white", size: "normal" };
    case "single_image": return { imageUrl: null, alt: "", background: "white", size: "normal" };
  }
}

function headingOf(content: any): string {
  return content.heading || content.title || content.eyebrowLabel || "(sem título)";
}

export function SalesPageEditorTab() {
  const { data: blocks = [], isLoading } = useQuery(salesPageBlocksAdminQO());
  const api = useApi();
  const [adding, setAdding] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<"desktop" | "mobile">("desktop");
  const [previewMode, setPreviewMode] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // Cópia local de rascunho por bloco — os campos editam ela na hora (feedback
  // instantâneo), e cada edição também dispara o salvamento automático como
  // rascunho (draft_content) — só vira público quando clica em "Publicar".
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setDrafts((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const b of blocks) {
        if (!(b.id in next)) { next[b.id] = b.draftContent ?? b.content; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [blocks]);

  const hero = blocks.find((b) => b.type === "hero");
  const rest = blocks.filter((b) => b.type !== "hero");
  const pendingCount = blocks.filter((b) => b.draftContent != null).length;

  function saveContent(b: SalesPageBlock, content: any) {
    setDrafts((d) => ({ ...d, [b.id]: content }));
    api.updateSalesPageBlock.mutate({ data: { id: b.id, type: b.type, content } as any }, {
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
    });
  }

  function toggleVisible(b: SalesPageBlock) {
    api.updateSalesPageBlock.mutate({ data: { id: b.id, type: b.type, content: drafts[b.id] ?? b.content, isVisible: !b.isVisible } as any });
  }

  async function remove(b: SalesPageBlock) {
    if (!(await requestConfirm(`Remover esta seção do site?`, { danger: true }))) return;
    api.deleteSalesPageBlock.mutate({ data: { id: b.id } }, {
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
    });
  }

  function moveBy(id: string, delta: number) {
    const idx = rest.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= rest.length) return;
    const order = rest.map((b) => b.id);
    [order[idx], order[target]] = [order[target], order[idx]];
    api.reorderSalesPageBlocks.mutate({ data: { orderedIds: order } });
  }

  const blockDrag = useDragReorder(rest, (next) => {
    api.reorderSalesPageBlocks.mutate({ data: { orderedIds: next.map((b) => b.id) } });
  });

  function addBlock(type: Exclude<SalesPageBlockType, "hero">) {
    api.createSalesPageBlock.mutate({ data: { type, content: emptyContent(type) } as any }, {
      onSuccess: () => setAdding(false),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao criar bloco"),
    });
  }

  async function publish() {
    if (pendingCount === 0) return;
    if (!(await requestConfirm(`Publicar ${pendingCount} alteração${pendingCount > 1 ? "ões" : ""} pro site ao vivo?`))) return;
    api.publishSalesPageBlocks.mutate(undefined as any, {
      onSuccess: (r: any) => toast.success(`${r?.count ?? pendingCount} alteração(ões) publicada(s)!`),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao publicar"),
    });
  }

  async function cancelEdit() {
    if (pendingCount === 0) return;
    if (!(await requestConfirm(`Descartar ${pendingCount} alteração${pendingCount > 1 ? "ões" : ""} não publicada${pendingCount > 1 ? "s" : ""} e voltar pro que já está no ar?`, { danger: true }))) return;
    api.discardSalesPageDraft.mutate(undefined as any, {
      onSuccess: () => {
        // Volta os campos pro conteúdo publicado na hora, sem esperar o refetch —
        // a lista de blocos (`blocks`) só é atualizada depois que a query revalida.
        setDrafts((d) => {
          const next = { ...d };
          for (const b of blocks) if (b.draftContent != null) next[b.id] = b.content;
          return next;
        });
        toast.success("Edição cancelada.");
      },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao cancelar"),
    });
  }

  function scrollTo(id: string) {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    setSectionsOpen(false);
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 text-sm text-foreground/40 py-10"><Loader2 size={14} className="animate-spin" /> Carregando...</div>;
  }

  const previewHero = hero ? { content: drafts[hero.id] ?? hero.content } : undefined;
  const previewBlocks = rest
    .filter((b) => b.isVisible)
    .map((b) => ({ id: b.id, type: b.type, content: drafts[b.id] ?? b.content }));

  const pageBody = previewMode ? (
    <SalesPageBody hero={previewHero} blocks={previewBlocks} />
  ) : (
    <>
      {hero && (
        <div ref={(el) => { sectionRefs.current[hero.id] = el; }}>
          <HeroSection content={drafts[hero.id] ?? hero.content} onChange={(c) => saveContent(hero, c)} />
        </div>
      )}

      {rest.map((b, i) => (
        <div
          key={b.id}
          ref={(el) => { sectionRefs.current[b.id] = el; }}
          className={`relative group/block transition ${blockDrag.overIndex === i ? "outline outline-2 outline-dashed outline-[rgb(var(--lz-brand-rgb))] outline-offset-[-4px]" : ""}`}
          style={{ opacity: b.isVisible ? 1 : 0.4 }}
          onDragOver={(e) => blockDrag.onDragOverItem(e, i)}
          onDrop={(e) => blockDrag.onDropItem(e, i)}
        >
          {renderBlockNode({ id: b.id, type: b.type, content: drafts[b.id] ?? b.content }, (c) => saveContent(b, c))}
          <BlockToolbar
            isVisible={b.isVisible}
            canUp={i > 0}
            canDown={i < rest.length - 1}
            onMoveUp={() => moveBy(b.id, -1)}
            onMoveDown={() => moveBy(b.id, 1)}
            onDragHandleStart={() => blockDrag.onDragStart(i)}
            onDragHandleEnd={blockDrag.onDragEnd}
            background={(drafts[b.id] ?? b.content).background}
            onBackground={(bg) => saveContent(b, { ...(drafts[b.id] ?? b.content), background: bg })}
            backgroundImage={(drafts[b.id] ?? b.content).backgroundImage}
            onBackgroundImage={(url) => saveContent(b, { ...(drafts[b.id] ?? b.content), backgroundImage: url })}
            hideBackgroundImage={b.type === "image_banner"}
            onFlip={b.type === "feature" ? () => saveContent(b, { ...(drafts[b.id] ?? b.content), reverse: !(drafts[b.id] ?? b.content).reverse }) : undefined}
            onToggleVisible={() => toggleVisible(b)}
            onDelete={() => remove(b)}
          />
        </div>
      ))}

      <div className="px-5 sm:px-10 py-8 flex justify-center border-t border-foreground/10">
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-foreground/50 hover:text-foreground border-2 border-dashed border-foreground/15 hover:border-[rgb(var(--lz-brand-rgb))] rounded-xl px-6 py-3 transition"
        >
          <Plus size={16} /> Adicionar seção
        </button>
      </div>
    </>
  );

  return (
    <div className={fullscreen ? "fixed inset-0 z-[400] bg-background overflow-y-auto p-4 md:p-6" : "max-w-[1200px]"}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-sm text-foreground/50 max-w-md">
          {previewMode
            ? "Prévia de como o site vai ficar depois de publicar — sem os controles de edição."
            : "Clique em qualquer texto ou imagem abaixo pra editar direto. Cabeçalho, planos, formulário, dúvidas frequentes e rodapé não entram aqui."}
        </p>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <a href="https://modocriador.com.br/assinar" target="_blank" rel="noopener noreferrer"
            className="text-xs text-foreground/50 hover:text-foreground inline-flex items-center gap-1.5">
            Site no ar <ExternalLink size={12} />
          </a>
          {!previewMode && (
            <button onClick={() => setSectionsOpen(true)}
              className="text-xs font-semibold text-foreground/70 hover:text-foreground inline-flex items-center gap-1.5 border border-foreground/15 hover:border-foreground/30 rounded-full px-3 py-1.5 transition">
              <Layers size={13} /> Seções
            </button>
          )}
          <button
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? "Sair da tela cheia" : "Editar em tela cheia"}
            className="h-7 w-7 rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground border border-foreground/15 hover:border-foreground/30 transition shrink-0"
          >
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <div className="inline-flex items-center gap-1 rounded-full bg-card p-1 border border-foreground/10">
            <button
              onClick={() => setPreviewWidth("desktop")}
              title="Desktop"
              className="h-7 w-7 rounded-full flex items-center justify-center transition"
              style={{ background: previewWidth === "desktop" ? "rgb(var(--lz-brand-rgb))" : "transparent", color: previewWidth === "desktop" ? "#0D0D0D" : "color-mix(in srgb, var(--foreground) 50%, transparent)" }}
            ><Monitor size={13} /></button>
            <button
              onClick={() => setPreviewWidth("mobile")}
              title="Celular"
              className="h-7 w-7 rounded-full flex items-center justify-center transition"
              style={{ background: previewWidth === "mobile" ? "rgb(var(--lz-brand-rgb))" : "transparent", color: previewWidth === "mobile" ? "#0D0D0D" : "color-mix(in srgb, var(--foreground) 50%, transparent)" }}
            ><Smartphone size={13} /></button>
          </div>
          <button
            onClick={() => setPreviewMode((v) => !v)}
            className="text-xs font-semibold inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition border"
            style={previewMode
              ? { background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D", borderColor: "rgb(var(--lz-brand-rgb))" }
              : { background: "transparent", color: "color-mix(in srgb, var(--foreground) 70%, transparent)", borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)" }}
          >
            {previewMode ? <><Pencil size={13} /> Editar</> : <><Eye size={13} /> Visualizar</>}
          </button>
          <button
            onClick={cancelEdit}
            disabled={pendingCount === 0 || api.discardSalesPageDraft.isPending}
            title="Descartar alterações não publicadas"
            className="text-xs font-semibold inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition border border-foreground/15 text-foreground/60 hover:text-red-400 hover:border-red-400/40 disabled:opacity-30 disabled:hover:text-foreground/60 disabled:hover:border-foreground/15"
          >
            <Undo2 size={13} /> Cancelar edição
          </button>
          <button
            onClick={publish}
            disabled={pendingCount === 0 || api.publishSalesPageBlocks.isPending}
            className="text-xs font-black uppercase tracking-wide inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 transition disabled:opacity-40"
            style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
          >
            <Rocket size={13} />
            {api.publishSalesPageBlocks.isPending ? "Publicando..." : pendingCount > 0 ? `Publicar (${pendingCount})` : "Publicado"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 overflow-hidden">
        <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: fullscreen ? "calc(100vh - 120px)" : "85vh", background: BG_BLUE }}>
          {previewWidth === "mobile" ? (
            <div style={{ width: 390, margin: "0 auto" }}>
              <PreviewFrame width={390}>
                <div className="text-foreground" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif", background: BG_BLUE }}>
                  {pageBody}
                </div>
              </PreviewFrame>
            </div>
          ) : (
            <div className="text-foreground" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
              {pageBody}
            </div>
          )}
        </div>
      </div>

      {adding && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setAdding(false)}>
          <div className="w-full max-w-md bg-card border border-foreground/10 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-foreground">Que tipo de seção?</span>
              <button onClick={() => setAdding(false)} className="text-foreground/40 hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-2">
              {(Object.keys(TYPE_LABELS) as Exclude<SalesPageBlockType, "hero">[]).map((t) => (
                <button
                  key={t}
                  onClick={() => addBlock(t)}
                  disabled={api.createSalesPageBlock.isPending}
                  className="w-full text-left px-4 py-3 rounded-md bg-background border border-foreground/8 hover:border-[rgb(var(--lz-brand-rgb))] transition disabled:opacity-50"
                >
                  <div className="text-sm font-semibold text-foreground">{TYPE_LABELS[t]}</div>
                  <div className="text-xs text-foreground/40 mt-0.5">{TYPE_DESCRIPTIONS[t]}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {sectionsOpen && (
        <div className="fixed inset-0 z-[280] flex" onClick={() => setSectionsOpen(false)}>
          <div className="w-80 max-w-[85vw] bg-card border-r border-foreground/10 h-full overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-foreground">Seções do site</span>
              <button onClick={() => setSectionsOpen(false)} className="text-foreground/40 hover:text-foreground"><X size={16} /></button>
            </div>
            <p className="text-[11px] text-foreground/40 mb-3 leading-relaxed">
              Reordene, oculte ou clique pra ir direto numa seção — útil pra enxugar a página.
            </p>
            {hero && (
              <button onClick={() => scrollTo(hero.id)} className="w-full text-left px-3 py-2.5 rounded-md text-xs text-foreground/60 bg-foreground/[0.03] mb-3 hover:bg-foreground/[0.06] transition">
                Topo (Hero) — fixo
              </button>
            )}
            <div className="space-y-1.5">
              {rest.map((b, i) => (
                <div
                  key={b.id}
                  className={`flex items-center gap-1 bg-foreground/[0.03] rounded-md px-2 py-1.5 transition ${blockDrag.overIndex === i ? "outline outline-2 outline-dashed outline-[rgb(var(--lz-brand-rgb))]" : ""}`}
                  style={{ opacity: b.isVisible ? 1 : 0.5 }}
                  onDragOver={(e) => blockDrag.onDragOverItem(e, i)}
                  onDrop={(e) => blockDrag.onDropItem(e, i)}
                >
                  <span
                    draggable
                    onDragStart={() => blockDrag.onDragStart(i)}
                    onDragEnd={blockDrag.onDragEnd}
                    title="Arrastar pra reordenar"
                    className="text-foreground/30 hover:text-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none"
                  >
                    <GripVertical size={13} />
                  </span>
                  <button onClick={() => scrollTo(b.id)} className="flex-1 min-w-0 text-left text-xs text-foreground truncate flex items-center gap-1.5">
                    {b.draftContent != null && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" title="Tem alteração não publicada" />}
                    <span className="truncate">{headingOf(drafts[b.id] ?? b.content)}</span>
                  </button>
                  <button onClick={() => moveBy(b.id, -1)} disabled={i === 0} className="text-foreground/40 hover:text-foreground disabled:opacity-20 shrink-0"><ChevronUp size={13} /></button>
                  <button onClick={() => moveBy(b.id, 1)} disabled={i === rest.length - 1} className="text-foreground/40 hover:text-foreground disabled:opacity-20 shrink-0"><ChevronDown size={13} /></button>
                  <button onClick={() => toggleVisible(b)} className="text-foreground/40 hover:text-foreground shrink-0">
                    {b.isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1" />
        </div>
      )}
    </div>
  );
}

function BlockToolbar({
  isVisible, canUp, canDown, onMoveUp, onMoveDown, onDragHandleStart, onDragHandleEnd, background, onBackground, backgroundImage, onBackgroundImage, hideBackgroundImage, onFlip, onToggleVisible, onDelete,
}: {
  isVisible: boolean; canUp: boolean; canDown: boolean; onMoveUp: () => void; onMoveDown: () => void;
  onDragHandleStart: () => void; onDragHandleEnd: () => void;
  background: string; onBackground: (key: any) => void;
  backgroundImage: string | null | undefined; onBackgroundImage: (url: string | null) => void; hideBackgroundImage?: boolean;
  onFlip?: () => void; onToggleVisible: () => void; onDelete: () => void;
}) {
  const [colorOpen, setColorOpen] = useState(false);
  const { upload, uploading } = useMarketingAssetUpload();

  async function handleBackgroundFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file);
    if (url) { onBackgroundImage(url); setColorOpen(false); }
  }
  return (
    <div
      className="absolute top-3 right-3 z-30 opacity-0 group-hover/block:opacity-100 focus-within:opacity-100 transition flex items-center gap-0.5 bg-black/80 backdrop-blur rounded-lg p-1 shadow-xl"
      onMouseLeave={() => setColorOpen(false)}
    >
      <span
        draggable
        onDragStart={onDragHandleStart}
        onDragEnd={onDragHandleEnd}
        title="Arrastar pra mover a seção"
        className="p-1.5 rounded text-foreground/70 hover:text-foreground hover:bg-foreground/10 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripVertical size={14} />
      </span>
      <button onClick={onMoveUp} disabled={!canUp} title="Mover pra cima" className="p-1.5 rounded text-foreground/70 hover:text-foreground hover:bg-foreground/10 disabled:opacity-20 disabled:hover:bg-transparent"><ChevronUp size={14} /></button>
      <button onClick={onMoveDown} disabled={!canDown} title="Mover pra baixo" className="p-1.5 rounded text-foreground/70 hover:text-foreground hover:bg-foreground/10 disabled:opacity-20 disabled:hover:bg-transparent"><ChevronDown size={14} /></button>
      {onFlip && <button onClick={onFlip} title="Inverter lado da imagem" className="p-1.5 rounded text-foreground/70 hover:text-foreground hover:bg-foreground/10"><FlipHorizontal size={14} /></button>}
      <div className="relative">
        <button onClick={() => setColorOpen((v) => !v)} title="Fundo da seção" className="p-1.5 rounded text-foreground/70 hover:text-foreground hover:bg-foreground/10"><Palette size={14} /></button>
        {colorOpen && (
          <div className="absolute top-full right-0 mt-1 bg-card border border-foreground/10 rounded-lg p-2 shadow-xl w-[190px]">
            <div className="text-[9px] uppercase tracking-wide text-foreground/30 mb-1.5 px-0.5">Cor de fundo</div>
            <div className="flex gap-1.5 mb-2.5">
              {BACKGROUND_SWATCHES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => { onBackground(s.key); setColorOpen(false); }}
                  title={s.label}
                  className="h-6 w-6 rounded border-2"
                  style={{ background: s.color, borderColor: !backgroundImage && background === s.key ? "rgb(var(--lz-brand-rgb))" : "transparent" }}
                />
              ))}
            </div>
            {!hideBackgroundImage && (
              <>
                <div className="text-[9px] uppercase tracking-wide text-foreground/30 mb-1.5 px-0.5 border-t border-foreground/10 pt-2">Imagem de fundo</div>
                {backgroundImage ? (
                  <div className="flex items-center gap-2">
                    <img src={backgroundImage} alt="" className="h-8 w-12 rounded object-cover border border-foreground/10 shrink-0" />
                    <button onClick={() => onBackgroundImage(null)} className="text-[10px] text-foreground/50 hover:text-red-400">Remover</button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-1.5 text-[11px] text-foreground/60 hover:text-foreground cursor-pointer border border-foreground/15 rounded-md px-2.5 py-1.5 w-full">
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
                    Enviar foto
                    <input type="file" accept="image/*" hidden onChange={handleBackgroundFile} />
                  </label>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <button onClick={onToggleVisible} title={isVisible ? "Ocultar do site" : "Mostrar no site"} className="p-1.5 rounded text-foreground/70 hover:text-foreground hover:bg-foreground/10">
        {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
      <button onClick={onDelete} title="Excluir" className="p-1.5 rounded text-foreground/70 hover:text-red-400 hover:bg-foreground/10"><Trash2 size={14} /></button>
    </div>
  );
}
