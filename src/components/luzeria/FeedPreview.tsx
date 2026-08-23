import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, CheckCircle2, Copy as CopyIcon, Download, Film, Image as ImageIcon, Layers, Loader2, MessageSquare, RefreshCw, Share2 } from "lucide-react";
import { itemFilesQO, gridThumbnailsQO, feedApprovalSummaryQO, activeFeedMonthQO, useApi, useMe } from "@/lib/luzeria/queries";
import { listItemFiles, getDriveVideoToken } from "@/lib/luzeria/drive.functions";
import { downloadDriveFilesAsZip } from "@/lib/luzeria/drive-download";
import type { Client, ContentItem, MonthData } from "@/lib/luzeria/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { InstagramPostModal, type IGModalItem } from "./InstagramPostModal";

type FeedItem = ContentItem & { _key: string };

export function FeedPreview({ month, client }: { month: MonthData; client: Client }) {
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const isMobile = useIsMobile();
  const isChronological = month.feedOrderMode === "cronologica";
  const canDrag = isAdmin && !isMobile && !isChronological;
  const { updateFeedOrder, setFeedOrderMode, setFeedOrderDirection } = useApi();

  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const FEED_STATUSES = new Set([
    "REVISAO_CLIENTE",
    "AGENDAMENTO",
    "REVISAO_AGENDAMENTO",
    "PRONTO_PARA_PUBLICAR",
    "FINALIZADO",
  ]);

  const ready = useMemo(() => {
    const all = [...month.posts, ...month.reels].filter(
      (i) => FEED_STATUSES.has(i.status) && !i.campaignInternal,
    );
    if (isChronological) {
      const dir = month.feedOrderDirection === "desc" ? -1 : 1;
      all.sort((a, b) => {
        const at = a.scheduledAt ? new Date(a.scheduledAt).getTime() : null;
        const bt = b.scheduledAt ? new Date(b.scheduledAt).getTime() : null;
        if (at === null && bt === null) {
          if (a.type !== b.type) return a.type === "reel" ? 1 : -1;
          return a.idx - b.idx;
        }
        if (at === null) return 1;
        if (bt === null) return -1;
        return (at - bt) * dir;
      });
    } else {
      all.sort((a, b) => {
        const ao = a.feedOrder ?? Number.POSITIVE_INFINITY;
        const bo = b.feedOrder ?? Number.POSITIVE_INFINITY;
        if (ao !== bo) return ao - bo;
        if (a.type !== b.type) return a.type === "reel" ? 1 : -1;
        return a.idx - b.idx;
      });
    }
    return all.map<FeedItem>((i) => ({ ...i, _key: i.id }));
  }, [month.posts, month.reels, isChronological, month.feedOrderDirection]);

  // Local order for optimistic drag-and-drop
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  useEffect(() => { setLocalOrder(null); }, [isChronological]);
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

  const itemIds = useMemo(() => cells.items.map((i) => i.id), [cells.items]);
  const { data: gridThumbs } = useQuery(gridThumbnailsQO(itemIds));

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
          <div className="text-[12px] uppercase tracking-wider text-foreground/40 font-semibold">
            Preview de feed · {cells.items.length} publicaç{cells.items.length === 1 ? "ão" : "ões"}
            {canDrag && <span className="ml-2 text-foreground/30 normal-case tracking-normal">— arraste para reordenar</span>}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <ActiveMonthToggle clientId={client.id} monthId={month.id} />
              {cells.items.length > 0 && <DownloadAllButton items={cells.items} zipName={`${client.name} - ${month.key}.zip`} />}
              <ShareButton clientId={client.id} monthId={month.id} />
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-1.5 mb-3">
          <span className="text-[10px] uppercase font-semibold text-foreground/30 tracking-wider mr-1">Ordem</span>
          {(["personalizada", "cronologica"] as const).map((m) => {
            const active = month.feedOrderMode === m;
            return (
              <button
                key={m}
                disabled={!isAdmin}
                onClick={() => setFeedOrderMode.mutate({ data: { monthId: month.id, mode: m } })}
                className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors disabled:cursor-default"
                style={{
                  backgroundColor: active ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 6%, transparent)",
                  color: active ? "#0D0D0D" : "color-mix(in srgb, var(--foreground) 50%, transparent)",
                }}
              >
                {m === "personalizada" ? "Personalizada" : "Cronológica"}
              </button>
            );
          })}
          {isChronological && (
            <select
              value={month.feedOrderDirection}
              disabled={!isAdmin}
              onChange={(e) => setFeedOrderDirection.mutate({ data: { monthId: month.id, direction: e.target.value as "asc" | "desc" } })}
              className="ml-1 bg-transparent border border-foreground/10 rounded-full px-2.5 py-1 text-[10px] font-semibold text-foreground/50 outline-none cursor-pointer hover:text-foreground/70 hover:border-foreground/20 transition-colors disabled:cursor-default"
            >
              <option value="desc" className="bg-card text-foreground">Recentes primeiro</option>
              <option value="asc" className="bg-card text-foreground">Antigas primeiro</option>
            </select>
          )}
        </div>
        <div className="grid grid-cols-3 gap-[3px] bg-black/30 p-[3px] rounded-md">
          {cells.items.map((item) => (
            <FeedCell
              key={item._key}
              item={item}
              gridThumb={gridThumbs?.[item.id]}
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
              className="aspect-[4/5] flex items-center justify-center"
              style={{ background: "var(--card)" }}
            >
              <ImageIcon size={22} style={{ color: "color-mix(in srgb, var(--foreground) 10%, transparent)" }} />
            </div>
          ))}
        </div>
        {isAdmin && cells.items.length > 0 && (
          <FeedApprovalDetails
            clientId={client.id}
            monthId={month.id}
            items={cells.items}
            onOpenItem={setActiveItemId}
          />
        )}
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

/* ============ Approval details (admin only) ============ */
function FeedApprovalDetails({
  clientId, monthId, items, onOpenItem,
}: {
  clientId: string;
  monthId: string;
  items: FeedItem[];
  onOpenItem: (itemId: string) => void;
}) {
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);
  const { data } = useQuery(feedApprovalSummaryQO(clientId, monthId, itemIds));
  if (!data) return null;

  const byId = new Map(items.map((i) => [i.id, i]));
  const approved = data.items.filter((r) => r.approved);
  const withComment = data.items.filter((r) => !r.approved && r.comment);

  return (
    <div className="mt-5 pt-4 border-t border-foreground/6">
      <div className="text-[12px] uppercase tracking-wider text-foreground/40 font-semibold mb-3">Detalhes</div>

      <div className="text-[13px] mb-4" style={{ color: data.feedApprovedAt ? "var(--lz-accent-ink)" : "color-mix(in srgb, var(--foreground) 40%, transparent)" }}>
        {data.feedApprovedAt
          ? `✓ Feed aprovado pelo cliente em ${new Date(data.feedApprovedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
          : "Feed ainda não aprovado pelo cliente."}
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-foreground/50 mb-1.5">
            <CheckCircle2 size={13} /> Posts aprovados ({approved.length})
          </div>
          {approved.length === 0 ? (
            <div className="text-[12px] text-foreground/30">Nenhum ainda.</div>
          ) : (
            <ul className="space-y-1">
              {approved.map((r) => (
                <li key={r.itemId}>
                  <button onClick={() => onOpenItem(r.itemId)} className="text-[12.5px] text-foreground/70 hover:text-foreground transition-colors text-left">
                    {byId.get(r.itemId)?.title || "Sem título"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-foreground/50 mb-1.5">
            <MessageSquare size={13} /> Posts com sugestão de alteração ({withComment.length})
          </div>
          {withComment.length === 0 ? (
            <div className="text-[12px] text-foreground/30">Nenhum ainda.</div>
          ) : (
            <ul className="space-y-1.5">
              {withComment.map((r) => (
                <li key={r.itemId}>
                  <button onClick={() => onOpenItem(r.itemId)} className="text-[12.5px] text-foreground/70 hover:text-foreground transition-colors text-left">
                    {byId.get(r.itemId)?.title || "Sem título"}
                  </button>
                  <div className="text-[11.5px] text-foreground/40 pl-0.5">{r.comment}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function FeedCell({
  item, gridThumb, draggable, isDragging, isOver,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd, onOpen,
}: {
  item: FeedItem;
  gridThumb: { thumbUrl: string | null; fileCount: number } | undefined;
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
  const url = cover ?? gridThumb?.thumbUrl ?? null;
  const isCarousel = (gridThumb?.fileCount ?? 0) > 1;
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
      className="relative aspect-[4/5] overflow-hidden group transition"
      style={{
        background: "var(--card)",
        cursor: draggable ? "grab" : "pointer",
        opacity: isDragging ? 0.4 : 1,
        outline: isOver ? "2px solid rgb(var(--lz-brand-rgb))" : "none",
        outlineOffset: isOver ? "-2px" : 0,
      }}
      title={item.title}
    >
      {url ? (
        <img src={url} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1">
          <ImageIcon size={26} style={{ color: "color-mix(in srgb, var(--foreground) 18%, transparent)" }} />
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "color-mix(in srgb, var(--foreground) 45%, transparent)" }}>
            #{String(item.idx).padStart(2, "0")} · {isReel ? "Reel" : "Post"}
          </div>
        </div>
      )}
      {(isReel || isCarousel) && (
        <div className="absolute top-1.5 right-1.5 text-foreground drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {isReel ? <Film size={16} /> : <Layers size={16} />}
        </div>
      )}
      <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 text-[10px] font-semibold text-foreground truncate opacity-0 group-hover:opacity-100 transition"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}>
        {item.title || "Sem título"}
      </div>
    </button>
  );
}

/* ============ Download all (high quality, from Drive) ============ */
function DownloadAllButton({ items, zipName }: { items: FeedItem[]; zipName: string }) {
  const [downloading, setDownloading] = useState(false);
  const fetchDriveToken = useServerFn(getDriveVideoToken);
  const fetchItemFiles = useServerFn(listItemFiles);

  async function handleDownloadAll() {
    setDownloading(true);
    try {
      const fileLists = await Promise.all(items.map((i) => fetchItemFiles({ data: { itemId: i.id } })));
      const allFiles = fileLists.flat().map((f: any) => ({ driveFileId: f.driveFileId, name: f.name }));
      if (allFiles.length === 0) { toast.error("Nenhum arquivo pra baixar ainda."); return; }
      await downloadDriveFilesAsZip(fetchDriveToken, allFiles, zipName);
      toast.success(`${allFiles.length} arquivo${allFiles.length === 1 ? "" : "s"} baixado${allFiles.length === 1 ? "" : "s"} num .zip.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao baixar arquivos.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownloadAll}
      disabled={downloading}
      title="Baixa os arquivos originais (posts e reels) direto do Drive, sem perda de qualidade"
      className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full transition disabled:opacity-50"
      style={{ background: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 80%, transparent)", border: "1px solid color-mix(in srgb, var(--foreground) 12%, transparent)" }}
    >
      {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      {downloading ? "Baixando…" : "Baixar em alta qualidade"}
    </button>
  );
}

/* ============ Share button ============ */
/** O link fixo do cliente sempre mostra o mês "ativo" (clients.active_month_id),
 * escolhido manualmente — não pula sozinho pro mês mais novo, já que um mês
 * novo pode existir (container vazio, avulso futuro) sem ainda ser o que a
 * agência quer mostrar pro cliente. */
function ActiveMonthToggle({ clientId, monthId }: { clientId: string; monthId: string }) {
  const { data } = useQuery(activeFeedMonthQO(clientId));
  const { setActiveFeedMonth } = useApi();
  const isActive = data?.monthId === monthId;

  if (isActive) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full"
        style={{ background: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}
      >
        <CheckCircle2 size={13} /> Mês ativo no link
      </span>
    );
  }
  return (
    <button
      onClick={() => setActiveFeedMonth.mutate({ data: { clientId, monthId } })}
      disabled={setActiveFeedMonth.isPending}
      title="Faz o link fixo do cliente passar a mostrar esse mês"
      className="text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full border border-foreground/15 text-foreground/60 hover:text-foreground hover:border-foreground/30 transition disabled:opacity-50"
    >
      {setActiveFeedMonth.isPending ? "Ativando…" : "Ativar esse mês no link"}
    </button>
  );
}

function ShareButton({ clientId, monthId }: { clientId: string; monthId: string }) {
  const { getOrCreateShareToken, rotateShareToken } = useApi();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const PUBLIC_PREVIEW_BASE = import.meta.env.VITE_APP_URL ?? "https://www.modocriador.com.br";
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
        style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
      >
        <Share2 size={13} />
        Compartilhar preview
      </button>
      {open && token && (
        <div
          className="absolute right-0 mt-2 z-50 w-[340px] rounded-xl p-3 shadow-2xl"
          style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}
        >
          <div className="text-[11px] uppercase tracking-wider text-foreground/40 font-semibold mb-2">
            Link público do preview
          </div>
          <div className="flex items-stretch gap-1.5">
            <input
              readOnly
              value={`${PUBLIC_PREVIEW_BASE}/preview/${token}`}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 text-[12px] px-2.5 py-2 rounded-md outline-none"
              style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}
            />
            <button
              onClick={copyLink}
              className="px-2.5 rounded-md text-[12px] font-semibold inline-flex items-center gap-1"
              style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
            >
              {copied ? <Check size={14} /> : <CopyIcon size={14} />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={rotate}
              disabled={rotateShareToken.isPending}
              className="text-[11px] text-foreground/60 hover:text-foreground inline-flex items-center gap-1"
            >
              <RefreshCw size={11} /> Gerar novo link (revoga o anterior)
            </button>
            <button onClick={() => setOpen(false)} className="text-[11px] text-foreground/40 hover:text-foreground">Fechar</button>
          </div>
          <div className="mt-2 text-[10.5px] text-foreground/40 leading-snug">
            Link fixo — não muda de mês pra mês, sempre mostra o mês mais recente. Quem tiver
            o link vê apenas as publicações prontas e pode deixar comentários.
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
      scheduledAt: item.scheduledAt ?? null,
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
      client={{ name: client.name, color: client.color, photoUrl: client.photoUrl }}
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