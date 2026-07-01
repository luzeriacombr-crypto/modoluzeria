import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy as CopyIcon, Film, Image as ImageIcon, Layers, RefreshCw, Share2 } from "lucide-react";
import { itemFilesQO, driveThumbnailQO, useApi, useMe } from "@/lib/luzeria/queries";
import type { Client, ContentItem, MonthData } from "@/lib/luzeria/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { InstagramPostModal, type IGModalItem } from "./InstagramPostModal";

type FeedItem = ContentItem & { _key: string };

export function FeedPreview({ month, client }: { month: MonthData; client: Client }) {
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const isMobile = useIsMobile();
  const canDrag = isAdmin && !isMobile;
  const { updateFeedOrder } = useApi();

  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const ready = useMemo(() => {
    const all = [...month.posts, ...month.reels].filter(
      (i) => i.status === "PRONTO_PARA_PUBLICAR",
    );
    all.sort((a, b) => {
      const ao = a.feedOrder ?? Number.POSITIVE_INFINITY;
      const bo = b.feedOrder ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      if (a.type !== b.type) return a.type === "reel" ? 1 : -1;
      return a.idx - b.idx;
    });
    return all.map<FeedItem>((i) => ({ ...i, _key: i.id }));
  }, [month.posts, month.reels]);

  // Local order for optimistic drag-and-drop
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const orderedItems: FeedItem[] = useMemo(() => {
    if (!localOrder) return ready;
    const byId = new Map(ready.map((i) => [i.id, i]));
    const seen = new Set<string>();
    const result: FeedItem[] = [];
    for (const id of localOrder) {
      const it = byId.get(id);
      if (it && !seen.has(id)) { result.push(it); seen.add(id); }
    }
    for (const it of ready) if (!seen.has(it.id)) result.push(it);
    return result;
  }, [ready, localOrder]);

  const cells = useMemo(() => {
    const min = 12;
    const fill = Math.max(0, min - orderedItems.length);
    return { items: orderedItems, placeholders: fill };
  }, [orderedItems]);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  function commitOrder(nextIds: string[]) {
    setLocalOrder(nextIds);
    updateFeedOrder.mutate({ data: { monthId: month.id, orderedItemIds: nextIds } });
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const ids = orderedItems.map((i) => i.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return; }
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    commitOrder(ids);
    setDragId(null);
    setOverId(null);
  }

  return (
    <div className="mt-6">
      {/* IG-style "profile" header */}
      <div className="mx-auto max-w-[640px] px-4">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <div className="text-[12px] uppercase tracking-wider text-white/40 font-semibold">
            Preview de feed · {cells.items.length} publicaç{cells.items.length === 1 ? "ão" : "ões"}
            {canDrag && <span className="ml-2 text-white/30 normal-case tracking-normal">— arraste para reordenar</span>}
          </div>
          {isAdmin && (
            <ShareButton clientId={client.id} monthId={month.id} />
          )}
        </div>
        <div className="grid grid-cols-3 gap-[3px] bg-black/30 p-[3px] rounded-md">
          {cells.items.map((item) => (
            <FeedCell
              key={item._key}
              item={item}
              draggable={canDrag}
              isDragging={dragId === item.id}
              isOver={overId === item.id}
              onDragStart={() => setDragId(item.id)}
              onDragOver={(e) => { e.preventDefault(); if (dragId && dragId !== item.id) setOverId(item.id); }}
              onDragLeave={() => { if (overId === item.id) setOverId(null); }}
              onDrop={() => onDrop(item.id)}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
              onOpen={() => setActiveItemId(item.id)}
            />
          ))}
          {Array.from({ length: cells.placeholders }).map((_, i) => (
            <div
              key={`ph-${i}`}
              className="aspect-square flex items-center justify-center"
              style={{ background: "#161616" }}
            >
              <ImageIcon size={22} style={{ color: "rgba(255,255,255,0.10)" }} />
            </div>
          ))}
        </div>
      </div>
      {activeItemId && (
        <InternalPostModal
          item={orderedItems.find((i) => i.id === activeItemId)!}
          client={client}
          onClose={() => setActiveItemId(null)}
        />
      )}
    </div>
  );
}

function FeedCell({
  item, draggable, isDragging, isOver,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, onOpen,
}: {
  item: FeedItem;
  draggable: boolean;
  isDragging: boolean;
  isOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
}) {
  const cover = item.coverUrl ?? null;
  const filesQ = useQuery({ ...itemFilesQO(item.id), enabled: !cover });
  const first = filesQ.data?.[0];
  const fileId = first?.driveFileId ?? null;
  const thumbQ = useQuery(driveThumbnailQO(fileId, !!fileId && !cover));
  const url = cover ?? thumbQ.data?.dataUrl ?? null;
  const isCarousel = (filesQ.data?.length ?? 0) > 1;
  const isReel = item.type === "reel";

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragOver={draggable ? onDragOver : undefined}
      onDragLeave={draggable ? onDragLeave : undefined}
      onDrop={draggable ? onDrop : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onClick={onOpen}
      className="relative aspect-square overflow-hidden group transition"
      style={{
        background: "#1C1C1C",
        cursor: draggable ? "grab" : "pointer",
        opacity: isDragging ? 0.4 : 1,
        outline: isOver ? "2px solid #C8D44E" : "none",
        outlineOffset: isOver ? "-2px" : 0,
      }}
      title={item.title}
    >
      {url ? (
        <img src={url} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1">
          <ImageIcon size={26} style={{ color: "rgba(255,255,255,0.18)" }} />
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.45)" }}>
            #{String(item.idx).padStart(2, "0")} · {isReel ? "Reel" : "Post"}
          </div>
        </div>
      )}
      {(isReel || isCarousel) && (
        <div className="absolute top-1.5 right-1.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {isReel ? <Film size={16} /> : <Layers size={16} />}
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 text-[10px] font-semibold text-white truncate opacity-0 group-hover:opacity-100 transition"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}>
        {item.title || "Sem título"}
      </div>
    </button>
  );
}

/* ============ Share button ============ */
function ShareButton({ clientId, monthId }: { clientId: string; monthId: string }) {
  const { getOrCreateShareToken, rotateShareToken } = useApi();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const PUBLIC_PREVIEW_BASE = "https://modo.luzeriaestudio.com.br";
  async function generate() {
    const r = await getOrCreateShareToken.mutateAsync({ data: { clientId, monthId } });
    setToken(r.token); setOpen(true);
  }
  async function rotate() {
    const r = await rotateShareToken.mutateAsync({ data: { clientId, monthId } });
    setToken(r.token); setCopied(false);
  }
  function copyLink() {
    if (!token) return;
    const url = `${PUBLIC_PREVIEW_BASE}/preview/${token}`;
    navigator.clipboard.writeText(url);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={generate}
        disabled={getOrCreateShareToken.isPending}
        className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full transition"
        style={{ background: "#C8D44E", color: "#0D0D0D" }}
      >
        <Share2 size={13} />
        Compartilhar preview
      </button>
      {open && token && (
        <div
          className="absolute right-0 mt-2 z-50 w-[340px] rounded-xl p-3 shadow-2xl"
          style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2">
            Link público do preview
          </div>
          <div className="flex items-stretch gap-1.5">
            <input
              readOnly
              value={`${PUBLIC_PREVIEW_BASE}/preview/${token}`}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 text-[12px] px-2.5 py-2 rounded-md outline-none"
              style={{ background: "#0D0D0D", color: "#fff", border: "1px solid rgba(255,255,255,0.08)" }}
            />
            <button
              onClick={copyLink}
              className="px-2.5 rounded-md text-[12px] font-semibold inline-flex items-center gap-1"
              style={{ background: "#C8D44E", color: "#0D0D0D" }}
            >
              {copied ? <Check size={14} /> : <CopyIcon size={14} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={rotate}
              disabled={rotateShareToken.isPending}
              className="text-[11px] text-white/60 hover:text-white inline-flex items-center gap-1"
            >
              <RefreshCw size={11} /> Gerar novo link (revoga o anterior)
            </button>
            <button onClick={() => setOpen(false)} className="text-[11px] text-white/40 hover:text-white">Fechar</button>
          </div>
          <div className="mt-2 text-[10.5px] text-white/40 leading-snug">
            Quem tiver o link vê apenas as publicações prontas e pode deixar comentários.
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ Internal IG-style modal (uses team comments? no — feedback only) ============ */
function InternalPostModal({
  item, client, onClose,
}: { item: FeedItem; client: Client; onClose: () => void }) {
  const filesQ = useQuery(itemFilesQO(item.id));
  const igItem: IGModalItem = useMemo(() => {
    const files = (filesQ.data ?? []).map((f) => ({
      id: f.id, driveFileId: f.driveFileId, mimeType: f.mimeType, webViewUrl: f.webViewUrl,
    }));
    return {
      id: item.id,
      type: item.type,
      title: item.title,
      caption: item.caption ?? "",
      dueDate: item.dueDate ?? null,
      coverUrl: item.coverUrl ?? null,
      files,
      feedback: [], // populated below
    };
  }, [filesQ.data, item]);

  // Lazy load client feedback (team view only)
  const fbQ = useFeedbackForItem(item.id);
  const enriched: IGModalItem = { ...igItem, feedback: fbQ.data ?? [] };

  return (
    <InstagramPostModal
      item={enriched}
      client={{ name: client.name, color: client.color }}
      mode={{ kind: "internal" }}
      canComment={false}
      onClose={onClose}
    />
  );
}

function useFeedbackForItem(itemId: string) {
  // Inline import to avoid extra top-level dep
  const { clientFeedbackQO } = require("@/lib/luzeria/queries") as typeof import("@/lib/luzeria/queries");
  return useQuery(clientFeedbackQO(itemId));
}