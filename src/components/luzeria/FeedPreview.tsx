import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Film, Image as ImageIcon, Layers } from "lucide-react";
import { itemFilesQO, driveThumbnailQO, useApi, useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import type { ContentItem, MonthData } from "@/lib/luzeria/types";
import { useIsMobile } from "@/hooks/use-mobile";

type FeedItem = ContentItem & { _key: string };

export function FeedPreview({ month }: { month: MonthData }) {
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const isMobile = useIsMobile();
  const canDrag = isAdmin && !isMobile;
  const { updateFeedOrder } = useApi();

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
        <div className="text-[12px] uppercase tracking-wider text-white/40 font-semibold mb-3">
          Preview de feed · {cells.items.length} publicaç{cells.items.length === 1 ? "ão" : "ões"}
          {canDrag && <span className="ml-2 text-white/30 normal-case tracking-normal">— arraste para reordenar</span>}
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
    </div>
  );
}

function FeedCell({
  item, draggable, isDragging, isOver,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
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
}) {
  const openItem = useUI((s) => s.openItem);
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
      onClick={() => openItem(item.id)}
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