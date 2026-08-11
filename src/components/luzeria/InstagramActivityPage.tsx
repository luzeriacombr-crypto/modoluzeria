import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Instagram, Clock, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { instagramActivityQO, gridThumbnailsQO, useMe } from "@/lib/luzeria/queries";
import type { InstagramActivityItem } from "@/lib/luzeria/instagram.functions";
import { useUI } from "@/lib/luzeria/ui-store";
import { POST_FORMAT_LABEL, CONTENT_TYPE_LABEL } from "@/lib/luzeria/types";

function typeLabel(item: InstagramActivityItem) {
  if (item.type === "post" && item.postFormat) {
    return POST_FORMAT_LABEL[item.postFormat as keyof typeof POST_FORMAT_LABEL] ?? item.postFormat;
  }
  return CONTENT_TYPE_LABEL[item.type as keyof typeof CONTENT_TYPE_LABEL] ?? item.type;
}

export function InstagramActivityPage() {
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const { data: items = [], isLoading } = useQuery({ ...instagramActivityQO(), enabled: isAdmin });
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);
  const { data: thumbs } = useQuery({ ...gridThumbnailsQO(itemIds), enabled: isAdmin && itemIds.length > 0 });

  if (me && !isAdmin) {
    return (
      <div className="px-5 md:px-10 py-8 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Instagram size={20} className="text-[rgb(var(--lz-brand-rgb))]" />
          <h1 className="text-[28px] font-bold text-white tracking-tight">Instagram</h1>
        </div>
        <p className="text-sm text-white/40 mt-6">Essa tela é só pra Adm Master e Adm de Setor.</p>
      </div>
    );
  }

  const scheduled = useMemo(
    () => items.filter((i) => i.igAutoPublish).sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()),
    [items],
  );
  const published = useMemo(
    () => items.filter((i) => !!i.igPublishedAt).sort((a, b) => new Date(b.igPublishedAt!).getTime() - new Date(a.igPublishedAt!).getTime()),
    [items],
  );

  return (
    <div className="px-5 md:px-10 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Instagram size={20} className="text-[rgb(var(--lz-brand-rgb))]" />
        <h1 className="text-[28px] font-bold text-white tracking-tight">Instagram</h1>
      </div>
      <p className="text-xs text-white/40 mb-8">
        Posts programados e já publicados pelo Modo Criador, de todos os clientes. Publicação feita direto no
        Instagram (fora do app) não aparece aqui.
      </p>

      {isLoading && <p className="text-xs text-white/30 text-center mt-10">Carregando…</p>}

      {!isLoading && items.length === 0 && (
        <div className="border border-dashed border-white/10 rounded-lg p-16 text-center">
          <Instagram size={22} className="mx-auto mb-3 text-white/20" />
          <p className="text-white/50 text-sm">Nenhuma publicação programada ou feita pelo app ainda.</p>
        </div>
      )}

      {scheduled.length > 0 && (
        <ActivitySection
          label="Programados"
          icon={<Clock size={13} />}
          items={scheduled}
          thumbs={thumbs}
          dateOf={(i) => i.scheduledAt!}
          datePrefix="Programado pra"
        />
      )}

      {published.length > 0 && (
        <ActivitySection
          label="Publicados"
          icon={<CheckCircle2 size={13} />}
          items={published}
          thumbs={thumbs}
          dateOf={(i) => i.igPublishedAt!}
          datePrefix="Publicado em"
        />
      )}
    </div>
  );
}

function ActivitySection({ label, icon, items, thumbs, dateOf, datePrefix }: {
  label: string;
  icon: React.ReactNode;
  items: InstagramActivityItem[];
  thumbs: Record<string, { thumbUrl: string | null; fileCount: number }> | undefined;
  dateOf: (i: InstagramActivityItem) => string;
  datePrefix: string;
}) {
  const navigate = useNavigate();
  const { selectMonth, openItem, flash } = useUI();

  function goToItem(item: InstagramActivityItem) {
    navigate({ to: "/cliente/$clientId", params: { clientId: item.clientId } });
    selectMonth(item.monthKey);
    setTimeout(() => { openItem(item.id); flash(item.id); }, 50);
    setTimeout(() => flash(null), 2050);
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-1.5 mb-3 text-white/50">
        {icon}
        <span className="text-[11px] uppercase font-bold tracking-wider">{label}</span>
        <span className="text-[11px] text-white/30">· {items.length}</span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => goToItem(item)}
            className="text-left group rounded-lg overflow-hidden bg-[#161616] border border-white/[0.07] hover:border-white/20 transition"
          >
            <div className="relative aspect-square bg-[#111]">
              {thumbs?.[item.id]?.thumbUrl ? (
                <img src={thumbs[item.id]!.thumbUrl!} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon size={22} className="text-white/15" />
                </div>
              )}
              <span
                className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider"
                style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#FFFFFF", backdropFilter: "blur(2px)" }}
              >
                {typeLabel(item)}
              </span>
            </div>
            <div className="p-2">
              <span
                className="inline-block max-w-full truncate text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mb-1"
                style={{ backgroundColor: `${item.clientColor}22`, color: item.clientColor }}
              >
                {item.clientName}
              </span>
              <div className="text-white text-xs truncate group-hover:text-white/80 transition">{item.title}</div>
              <div className="text-[10px] text-white/35 mt-0.5">
                {datePrefix} {new Date(dateOf(item)).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
