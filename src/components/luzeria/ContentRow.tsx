import { useEffect, useRef, useState } from "react";
import { Link as LinkIcon, MessageCircle, Plus, Scissors, Calendar } from "lucide-react";
import type { ContentItem, Profile } from "@/lib/luzeria/types";
import { statusOptionsFor, REEL_TYPE_LABEL, type ReelType } from "@/lib/luzeria/types";
import { useApi, useMe } from "@/lib/luzeria/queries";
import { StatusBadge } from "./StatusBadge";
import { Avatar, AvatarStack } from "./Avatar";
import { useUI } from "@/lib/luzeria/ui-store";

export function ContentRow({ item, profiles, idx }: {
  item: ContentItem;
  profiles: Profile[];
  idx: number;
}) {
  const { setItemStatus, updateItem, addAssignee } = useApi();
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
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
  const editor = item.type === "reel" && item.editorId
    ? profiles.find((p) => p.id === item.editorId)
    : null;
  const editorInitials = editor
    ? editor.name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("")
    : "";
  const isOverdue =
    !!item.dueDate && item.status !== "FINALIZADO" &&
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
      className={`group flex items-center gap-3 px-4 h-16 border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors cursor-pointer ${flashed ? "lz-flash" : ""}`}
      onClick={() => openItem(item.id)}
    >
      <span className="text-[14px] font-bold w-7 shrink-0" style={{ color: "#C8D44E" }}>
        {String(idx).padStart(2, "0")}
      </span>

      {editing ? (
        <input
          autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setTitle(item.title); setEditing(false); } }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-transparent text-[15px] font-medium text-white outline-none border-b border-[#C8D44E] py-0.5"
        />
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          className="flex-1 text-left text-[15px] font-medium text-white truncate hover:text-[#C8D44E] transition-colors min-w-0"
          title={item.title}
        >
          <span className="truncate">{item.title}</span>
          {item.type === "reel" && item.reelType && (
            <span className="ml-2 text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
              {REEL_TYPE_LABEL[item.reelType as ReelType]}
            </span>
          )}
        </button>
      )}

      <div onClick={(e) => e.stopPropagation()}>
        <StatusBadge status={item.status} options={statusOptionsFor(item.type)}
          onChange={(s) => { setItemStatus.mutate({ data: { id: item.id, status: s } }); flash(item.id); }} />
      </div>

      <div onClick={(e) => e.stopPropagation()} className="flex items-center">
        {assignees.length > 0 ? (
          <AvatarStack profiles={assignees} size={28} />
        ) : me ? (
          <button
            onClick={() => addAssignee.mutate({ data: { itemId: item.id, userId: me.id } })}
            title="Atribuir-me"
            className="h-7 w-7 rounded-full border border-dashed border-white/20 text-white/40 hover:text-[#C8D44E] hover:border-[#C8D44E] flex items-center justify-center transition-colors"
          ><Plus size={14} /></button>
        ) : null}
        {isAdmin && assignees.length > 0 && (
          <button onClick={() => openItem(item.id)} title="Gerenciar responsáveis"
            className="ml-1 h-7 w-7 rounded-full border border-dashed border-white/15 text-white/30 hover:text-white/70 hover:border-white/30 flex items-center justify-center transition-colors">
            <Plus size={12} />
          </button>
        )}
      </div>

      <LinkIcon size={15}
        style={{ color: item.driveLink ? "#C8D44E" : "rgba(255,255,255,0.25)", opacity: item.driveLink ? 1 : 0.4 }} />
      {dueLabel && (
        <div
          className="hidden sm:flex items-center gap-1 text-[11px] font-semibold tabular-nums"
          title={isOverdue ? "Prazo vencido" : "Prazo"}
          style={{
            color: isOverdue ? "#FF6B6B" : "rgba(255,255,255,0.55)",
          }}
        >
          <Calendar size={13} />
          <span>{dueLabel}</span>
        </div>
      )}
      {item.type === "reel" && editor && (
        <div
          className="flex items-center gap-1 text-[11px] font-semibold tabular-nums"
          style={{ color: "rgba(255,255,255,0.4)" }}
          title={`Editor: ${editor.name}`}
        >
          <Scissors size={13} />
          <span>{editorInitials}</span>
        </div>
      )}
      <div className="flex items-center gap-1 text-[11px] tabular-nums"
        style={{ color: item.comments.length ? "#C8D44E" : "rgba(255,255,255,0.25)", opacity: item.comments.length ? 1 : 0.4 }}>
        <MessageCircle size={14} />
        <span>{item.comments.length}</span>
      </div>
    </div>
  );
}