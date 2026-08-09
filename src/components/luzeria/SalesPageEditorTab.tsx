import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Trash2, ChevronUp, ChevronDown, Eye, EyeOff, Loader2, X,
  Monitor, Smartphone, Palette, FlipHorizontal, ExternalLink,
} from "lucide-react";
import { salesPageBlocksAdminQO, useApi } from "@/lib/luzeria/queries";
import { BACKGROUND_SWATCHES, HeroSection, renderBlockNode, BG_BLUE } from "./salesPageBlocks";
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

export function SalesPageEditorTab() {
  const { data: blocks = [], isLoading } = useQuery(salesPageBlocksAdminQO());
  const api = useApi();
  const [adding, setAdding] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<"desktop" | "mobile">("desktop");
  // Cópia local de rascunho por bloco — os campos editam ela na hora (feedback
  // instantâneo), e cada edição também dispara o salvamento automático.
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

  function saveContent(b: SalesPageBlock, content: any) {
    setDrafts((d) => ({ ...d, [b.id]: content }));
    api.updateSalesPageBlock.mutate({ data: { id: b.id, type: b.type, content } as any }, {
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
    });
  }

  function toggleVisible(b: SalesPageBlock) {
    api.updateSalesPageBlock.mutate({ data: { id: b.id, type: b.type, content: drafts[b.id] ?? b.content, isVisible: !b.isVisible } as any });
  }

  function remove(b: SalesPageBlock) {
    if (!confirm(`Remover esta seção do site?`)) return;
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

  function addBlock(type: Exclude<SalesPageBlockType, "hero">) {
    api.createSalesPageBlock.mutate({ data: { type, content: emptyContent(type) } as any }, {
      onSuccess: () => setAdding(false),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao criar bloco"),
    });
  }

  if (isLoading) {
    return <div className="flex items-center gap-2 text-sm text-white/40 py-10"><Loader2 size={14} className="animate-spin" /> Carregando...</div>;
  }

  return (
    <div className="max-w-[1200px]">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-sm text-white/50 max-w-lg">
          Clique em qualquer texto ou imagem abaixo pra editar direto — é o site de verdade. Passe o mouse
          numa seção pra ver as opções de reordenar, cor e visibilidade. Cabeçalho, planos, formulário,
          dúvidas frequentes e rodapé não entram aqui.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <a href="https://modocriador.com.br" target="_blank" rel="noopener noreferrer"
            className="text-xs text-white/50 hover:text-white inline-flex items-center gap-1.5">
            Ver site publicado <ExternalLink size={12} />
          </a>
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
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: "85vh", background: BG_BLUE }}>
          <div style={{ width: previewWidth === "mobile" ? 390 : "100%", margin: "0 auto" }}>
            <div className="text-white" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
              {hero && (
                <HeroSection
                  content={drafts[hero.id] ?? hero.content}
                  onChange={(c) => saveContent(hero, c)}
                />
              )}

              {rest.map((b, i) => (
                <div key={b.id} className="relative group/block" style={{ opacity: b.isVisible ? 1 : 0.4 }}>
                  {renderBlockNode({ id: b.id, type: b.type, content: drafts[b.id] ?? b.content }, (c) => saveContent(b, c))}
                  <BlockToolbar
                    isVisible={b.isVisible}
                    canUp={i > 0}
                    canDown={i < rest.length - 1}
                    onMoveUp={() => moveBy(b.id, -1)}
                    onMoveDown={() => moveBy(b.id, 1)}
                    background={(drafts[b.id] ?? b.content).background}
                    onBackground={(bg) => saveContent(b, { ...(drafts[b.id] ?? b.content), background: bg })}
                    onFlip={b.type === "feature" ? () => saveContent(b, { ...(drafts[b.id] ?? b.content), reverse: !(drafts[b.id] ?? b.content).reverse }) : undefined}
                    onToggleVisible={() => toggleVisible(b)}
                    onDelete={() => remove(b)}
                  />
                </div>
              ))}

              <div className="px-5 sm:px-10 py-8 flex justify-center border-t border-white/10">
                <button
                  onClick={() => setAdding(true)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white/50 hover:text-white border-2 border-dashed border-white/15 hover:border-[rgb(var(--lz-brand-rgb))] rounded-xl px-6 py-3 transition"
                >
                  <Plus size={16} /> Adicionar seção
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {adding && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setAdding(false)}>
          <div className="w-full max-w-md bg-[#1C1C1C] border border-white/10 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-white">Que tipo de seção?</span>
              <button onClick={() => setAdding(false)} className="text-white/40 hover:text-white"><X size={16} /></button>
            </div>
            <div className="space-y-2">
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
          </div>
        </div>
      )}
    </div>
  );
}

function BlockToolbar({
  isVisible, canUp, canDown, onMoveUp, onMoveDown, background, onBackground, onFlip, onToggleVisible, onDelete,
}: {
  isVisible: boolean; canUp: boolean; canDown: boolean; onMoveUp: () => void; onMoveDown: () => void;
  background: string; onBackground: (key: any) => void; onFlip?: () => void; onToggleVisible: () => void; onDelete: () => void;
}) {
  const [colorOpen, setColorOpen] = useState(false);
  return (
    <div
      className="absolute top-3 right-3 z-30 opacity-0 group-hover/block:opacity-100 focus-within:opacity-100 transition flex items-center gap-0.5 bg-black/80 backdrop-blur rounded-lg p-1 shadow-xl"
      onMouseLeave={() => setColorOpen(false)}
    >
      <button onClick={onMoveUp} disabled={!canUp} title="Mover pra cima" className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent"><ChevronUp size={14} /></button>
      <button onClick={onMoveDown} disabled={!canDown} title="Mover pra baixo" className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent"><ChevronDown size={14} /></button>
      {onFlip && <button onClick={onFlip} title="Inverter lado da imagem" className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10"><FlipHorizontal size={14} /></button>}
      <div className="relative">
        <button onClick={() => setColorOpen((v) => !v)} title="Cor de fundo" className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10"><Palette size={14} /></button>
        {colorOpen && (
          <div className="absolute top-full right-0 mt-1 bg-[#1C1C1C] border border-white/10 rounded-lg p-1.5 flex gap-1.5 shadow-xl">
            {BACKGROUND_SWATCHES.map((s) => (
              <button
                key={s.key}
                onClick={() => { onBackground(s.key); setColorOpen(false); }}
                title={s.label}
                className="h-6 w-6 rounded border-2"
                style={{ background: s.color, borderColor: background === s.key ? "rgb(var(--lz-brand-rgb))" : "transparent" }}
              />
            ))}
          </div>
        )}
      </div>
      <button onClick={onToggleVisible} title={isVisible ? "Ocultar do site" : "Mostrar no site"} className="p-1.5 rounded text-white/70 hover:text-white hover:bg-white/10">
        {isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
      <button onClick={onDelete} title="Excluir" className="p-1.5 rounded text-white/70 hover:text-red-400 hover:bg-white/10"><Trash2 size={14} /></button>
    </div>
  );
}
