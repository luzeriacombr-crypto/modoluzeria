import { useEffect, useState } from "react";
import { Link as LinkIcon, MessageCircle, Plus, Scissors, Calendar, Image as ImageIcon, Trash2 } from "lucide-react";
import type { ContentItem, Profile } from "@/lib/luzeria/types";
import {
  statusOptionsFor, REEL_TYPE_LABEL, POST_FORMAT_LABEL,
  type ReelType, type PostFormat,
} from "@/lib/luzeria/types";
import { useApi, useMe, itemFilesQO, driveThumbnailQO } from "@/lib/luzeria/queries";
import { useQuery } from "@tanstack/react-query";
import { StatusBadge } from "./StatusBadge";
import { AvatarStack } from "./Avatar";
import { useUI } from "@/lib/luzeria/ui-store";

const EASE = { transitionTimingFunction: "var(--ease-premium)" as const };

export function ContentCard({ item, profiles, idx, isAvulso, isAdmin, onDelete }: {
  item: ContentItem;
  profiles: Profile[];
  idx: number;
  isAvulso?: boolean;
  isAdmin: boolean;
  onDelete?: () => void;
}) {
  const { setItemStatus, updateItem, addAssignee } = useApi();
  const me = useMe().data;
  const { openItem, flash, recentlyUpdated } = useUI();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const flashed = recentlyUpdated === item.id;

  useEffect(() => setTitle(item.title), [item.title]);
  useEffect(() => {
    if (flashed) { const t = setTimeout(() => flash(null), 1500); return () => clearTimeout(t); }
  }, [flashed, flash]);

  const assignees = item.assigneeIds
    .map((id) => profiles.find((p) => p.id === id))
    .filter(Boolean) as Profile[];
  const editor = (item.type === "reel" || item.type === "story") && item.editorId
    ? profiles.find((p) => p.id === item.editorId)
    : null;
  const editorInitials = editor
    ? editor.name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("")
    : "";
  const isOverdue =
    !!item.dueDate && item.status !== "PRONTO_PARA_PUBLICAR" && item.status !== "FINALIZADO" &&
    new Date(item.dueDate + "T23:59:59").getTime() < Date.now();
  const dueLabel = item.dueDate
    ? new Date(item.dueDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : null;

  function commit() {
    setEditing(false);
    if (title.trim() && title !== item.title)
      updateItem.mutate({ data: { id: item.id, patch: { title: title.trim() } } });
    else setTitle(item.title);
  }

  return (
    <div
      className={`group relative flex flex-col rounded-xl overflow-hidden border border-white/[0.06] bg-[#161616] hover:border-white/15 hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 cursor-pointer ${flashed ? "lz-flash" : ""}`}
      style={EASE}
      onClick={() => openItem(item.id)}
    >
      <div className="relative w-full aspect-[4/5] shrink-0">
        <CardThumb itemId={item.id} coverUrl={item.coverUrl ?? null} />
        <span
          className="absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
          style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "rgb(var(--lz-brand-rgb))" }}
        >
          {String(idx).padStart(2, "0")}
        </span>
        {isAdmin && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Excluir item"
            className="absolute top-2 right-2 p-1.5 rounded-md text-white/70 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity duration-200"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", ...EASE }}
          ><Trash2 size={13} /></button>
        )}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          {item.driveLink && (
            <span className="flex items-center justify-center rounded-md p-1" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
              <LinkIcon size={12} style={{ color: "rgb(var(--lz-brand-rgb))" }} />
            </span>
          )}
          {item.comments.length > 0 && (
            <span
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-semibold tabular-nums"
              style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "rgb(var(--lz-brand-rgb))" }}
            >
              <MessageCircle size={11} /> {item.comments.length}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 p-3">
        {editing ? (
          <input
            autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setTitle(item.title); setEditing(false); } }}
            onClick={(e) => e.stopPropagation()}
            className="bg-transparent text-[14px] font-medium text-white outline-none border-b border-[rgb(var(--lz-brand-rgb))] py-0.5"
          />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="text-left text-[14px] font-medium text-white truncate hover:text-[rgb(var(--lz-brand-rgb))] transition-colors"
            title={item.title}
          >
            <span className="truncate">{item.title || "Sem título"}</span>
          </button>
        )}

        {item.type === "post" && item.postFormat && (
          <span
            className="self-start rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
          >
            {POST_FORMAT_LABEL[item.postFormat as PostFormat]}
          </span>
        )}
        {item.type === "reel" && item.reelType && (
          <span
            className="self-start rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
          >
            {REEL_TYPE_LABEL[item.reelType as ReelType]}
          </span>
        )}

        <div onClick={(e) => e.stopPropagation()}>
          <StatusBadge status={item.status}
            options={statusOptionsFor(item.type).filter((s) => isAdmin || (s !== "PRONTO_PARA_PUBLICAR" && s !== "FINALIZADO"))}
            isAvulso={isAvulso}
            onChange={(s) => { setItemStatus.mutate({ data: { id: item.id, status: s } }); flash(item.id); }} />
        </div>

        <div className="flex items-center justify-between pt-0.5">
          <div onClick={(e) => e.stopPropagation()} className="flex items-center">
            {assignees.length > 0 ? (
              <AvatarStack profiles={assignees} size={24} />
            ) : me ? (
              <button
                onClick={() => addAssignee.mutate({ data: { itemId: item.id, userId: me.id } })}
                title="Atribuir-me"
                className="h-6 w-6 rounded-full border border-dashed border-white/20 text-white/40 hover:text-[rgb(var(--lz-brand-rgb))] hover:border-[rgb(var(--lz-brand-rgb))] flex items-center justify-center transition-colors"
              ><Plus size={12} /></button>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(item.type === "reel" || item.type === "story") && editor && (
              <span
                className="flex items-center gap-1 text-[10px] font-semibold tabular-nums"
                style={{ color: "rgba(255,255,255,0.4)" }}
                title={`Editor: ${editor.name}`}
              >
                <Scissors size={12} />
                <span>{editorInitials}</span>
              </span>
            )}
            {dueLabel && (
              <span
                className="flex items-center gap-1 text-[10px] font-semibold tabular-nums"
                title={isOverdue ? "Prazo vencido" : "Prazo"}
                style={{ color: isOverdue ? "#FF6B6B" : "rgba(255,255,255,0.5)" }}
              >
                <Calendar size={12} />
                <span>{dueLabel}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardThumb({ itemId, coverUrl }: { itemId: string; coverUrl: string | null }) {
  const filesQ = useQuery({ ...itemFilesQO(itemId), enabled: !coverUrl });
  const first = filesQ.data?.[0];
  const fileId = first?.driveFileId ?? null;
  const thumbQ = useQuery(driveThumbnailQO(fileId, !!fileId && !coverUrl));
  const url = coverUrl ?? thumbQ.data?.dataUrl ?? null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: "#1C1C1C" }}
    >
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <ImageIcon size={32} style={{ color: "rgba(255,255,255,0.2)" }} />
      )}
    </div>
  );
}
