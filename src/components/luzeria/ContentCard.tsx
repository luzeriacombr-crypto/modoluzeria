import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link as LinkIcon, MessageCircle, Plus, Scissors, Calendar, Image as ImageIcon, Trash2, Check, Megaphone } from "lucide-react";
import { isDoneStatus, hasSetorPermission, type ContentItem, type Profile } from "@/lib/luzeria/types";
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

export function ContentCard({ item, profiles, idx, isAvulso, isAdmin, onDelete, navList, selectMode, selected, onToggleSelect }: {
  item: ContentItem;
  profiles: Profile[];
  idx: number;
  isAvulso?: boolean;
  isAdmin: boolean;
  onDelete?: () => void;
  navList?: string[];
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
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
    !!item.dueDate && !isDoneStatus(item.status) &&
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
      className={`group relative flex flex-col rounded-xl overflow-hidden border bg-card hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 cursor-pointer ${flashed ? "lz-flash" : ""} ${selectMode && selected ? "border-[rgb(var(--lz-brand-rgb))]" : "border-foreground/6 hover:border-foreground/15"}`}
      style={EASE}
      onClick={() => (selectMode ? onToggleSelect?.() : openItem(item.id, navList))}
    >
      <div className="relative w-full aspect-[4/5] shrink-0">
        <CardThumb itemId={item.id} coverUrl={item.coverUrl ?? null} />
        <span
          className="absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums"
          style={{ backgroundColor: "rgba(0,0,0,0.55)", color: "rgb(var(--lz-brand-rgb))" }}
        >
          {String(idx).padStart(2, "0")}
        </span>
        {selectMode ? (
          <span
            className="absolute top-2 right-2 h-5 w-5 rounded-md flex items-center justify-center border transition-colors"
            style={{
              backgroundColor: selected ? "rgb(var(--lz-brand-rgb))" : "rgba(0,0,0,0.55)",
              borderColor: selected ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 30%, transparent)",
            }}
          >
            {selected && <Check size={13} color="#0D0D0D" />}
          </span>
        ) : isAdmin && onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Excluir item"
            className="absolute top-2 right-2 p-1.5 rounded-md text-foreground/70 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity duration-200"
            style={{ backgroundColor: "rgba(0,0,0,0.55)", ...EASE }}
          ><Trash2 size={13} /></button>
        )}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          {item.driveLink && (
            <span className="flex items-center justify-center rounded-md p-1" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
              <LinkIcon size={12} style={{ color: "var(--lz-accent-ink)" }} />
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
            className="bg-transparent text-[14px] font-medium text-foreground outline-none border-b border-[rgb(var(--lz-brand-rgb))] py-0.5"
          />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className={`text-left text-[14px] font-medium truncate hover:text-[var(--lz-accent-ink)] transition-colors ${item.title ? "text-foreground" : "text-foreground/40 italic"}`}
            title={item.title || "Clique para inserir um título"}
          >
            <span className="truncate">{item.title || "Clique para inserir um título"}</span>
          </button>
        )}

        {item.campaignName && (
          <span
            className="self-start inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}
          >
            <Megaphone size={10} /> {item.campaignName}
          </span>
        )}
        {item.type === "post" && item.postFormat && (
          <span
            className="self-start rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
          >
            {POST_FORMAT_LABEL[item.postFormat as PostFormat]}
          </span>
        )}
        {item.type === "reel" && item.reelType && (
          <span
            className="self-start rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
          >
            {REEL_TYPE_LABEL[item.reelType as ReelType]}
          </span>
        )}

        <div onClick={(e) => e.stopPropagation()}>
          <StatusBadge status={item.status}
            options={statusOptionsFor(item.type).filter((s) => (s === "PRONTO_PARA_PUBLICAR" || s === "FINALIZADO" ? hasSetorPermission(me, "approve_finalize") : true))}
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
                className="h-6 w-6 rounded-full border border-dashed border-foreground/20 text-foreground/40 hover:text-[var(--lz-accent-ink)] hover:border-[rgb(var(--lz-brand-rgb))] flex items-center justify-center transition-colors"
              ><Plus size={12} /></button>
            ) : null}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(item.type === "reel" || item.type === "story") && editor && (
              <span
                className="flex items-center gap-1 text-[10px] font-semibold tabular-nums"
                style={{ color: "color-mix(in srgb, var(--foreground) 40%, transparent)" }}
                title={`Editor: ${editor.name}`}
              >
                <Scissors size={12} />
                <span>{editorInitials}</span>
              </span>
            )}
            <DueDateChip item={item} isOverdue={isOverdue} dueLabel={dueLabel} onSave={(v) => updateItem.mutate({ data: { id: item.id, patch: { due_date: v } } })} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Linha compacta — mesma informação e edição inline do ContentCard (título,
 * status, prazo), só que numa lista em vez de grade de cards. Pensada pra
 * escanear/editar um board grande rapidamente, sem depender de miniatura. */
export function ContentListRow({ item, profiles, idx, isAvulso, isAdmin, onDelete, navList, selectMode, selected, onToggleSelect }: {
  item: ContentItem;
  profiles: Profile[];
  idx: number;
  isAvulso?: boolean;
  isAdmin: boolean;
  onDelete?: () => void;
  navList?: string[];
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
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
  const isOverdue =
    !!item.dueDate && !isDoneStatus(item.status) &&
    new Date(item.dueDate + "T23:59:59").getTime() < Date.now();
  const dueLabel = item.dueDate
    ? new Date(item.dueDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : null;
  const formatBadge = item.type === "post" && item.postFormat ? POST_FORMAT_LABEL[item.postFormat as PostFormat]
    : item.type === "reel" && item.reelType ? REEL_TYPE_LABEL[item.reelType as ReelType]
    : null;

  function commit() {
    setEditing(false);
    if (title.trim() && title !== item.title)
      updateItem.mutate({ data: { id: item.id, patch: { title: title.trim() } } });
    else setTitle(item.title);
  }

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card hover:bg-card transition-colors cursor-pointer ${flashed ? "lz-flash" : ""} ${selectMode && selected ? "border-[rgb(var(--lz-brand-rgb))]" : "border-foreground/6 hover:border-foreground/15"}`}
      onClick={() => (selectMode ? onToggleSelect?.() : openItem(item.id, navList))}
    >
      {selectMode && (
        <span
          className="shrink-0 h-5 w-5 rounded-md flex items-center justify-center border transition-colors"
          style={{
            backgroundColor: selected ? "rgb(var(--lz-brand-rgb))" : "transparent",
            borderColor: selected ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 30%, transparent)",
          }}
        >
          {selected && <Check size={13} color="#0D0D0D" />}
        </span>
      )}
      <span className="text-[11px] font-bold tabular-nums text-foreground/30 w-5 shrink-0">{String(idx).padStart(2, "0")}</span>

      <div className="flex-1 min-w-0 flex items-center gap-2">
        {editing ? (
          <input
            autoFocus value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setTitle(item.title); setEditing(false); } }}
            onClick={(e) => e.stopPropagation()}
            className="bg-transparent text-[13px] font-medium text-foreground outline-none border-b border-[rgb(var(--lz-brand-rgb))] py-0.5 flex-1 min-w-0"
          />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className={`text-left text-[13px] font-medium truncate hover:text-[var(--lz-accent-ink)] transition-colors min-w-0 ${item.title ? "text-foreground" : "text-foreground/40 italic"}`}
            title={item.title || "Clique para inserir um título"}
          >
            <span className="truncate">{item.title || "Clique para inserir um título"}</span>
          </button>
        )}
        {formatBadge && (
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-foreground/50 bg-foreground/[0.06]">
            {formatBadge}
          </span>
        )}
        {item.campaignName && (
          <span
            className="shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}
          >
            <Megaphone size={9} /> {item.campaignName}
          </span>
        )}
      </div>

      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        <StatusBadge status={item.status}
          options={statusOptionsFor(item.type).filter((s) => (s === "PRONTO_PARA_PUBLICAR" || s === "FINALIZADO" ? hasSetorPermission(me, "approve_finalize") : true))}
          isAvulso={isAvulso}
          onChange={(s) => { setItemStatus.mutate({ data: { id: item.id, status: s } }); flash(item.id); }} />
      </div>

      <div className="shrink-0 w-14 flex justify-end">
        <DueDateChip item={item} isOverdue={isOverdue} dueLabel={dueLabel} onSave={(v) => updateItem.mutate({ data: { id: item.id, patch: { due_date: v } } })} />
      </div>

      <div onClick={(e) => e.stopPropagation()} className="shrink-0">
        {assignees.length > 0 ? (
          <AvatarStack profiles={assignees} size={22} />
        ) : me ? (
          <button
            onClick={() => addAssignee.mutate({ data: { itemId: item.id, userId: me.id } })}
            title="Atribuir-me"
            className="h-6 w-6 rounded-full border border-dashed border-foreground/20 text-foreground/40 hover:text-[var(--lz-accent-ink)] hover:border-[rgb(var(--lz-brand-rgb))] flex items-center justify-center transition-colors"
          ><Plus size={11} /></button>
        ) : null}
      </div>

      {!selectMode && isAdmin && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Excluir item"
          className="shrink-0 p-1.5 rounded-md text-foreground/30 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
        ><Trash2 size={13} /></button>
      )}
    </div>
  );
}

/** Prazo clicável — abre um mini popover com date input pra editar sem sair
 * do card (inline edit, igual o status já fazia). Some quando não há prazo,
 * pra não poluir cards sem data. */
function DueDateChip({ item, isOverdue, dueLabel, onSave }: {
  item: ContentItem; isOverdue: boolean; dueLabel: string | null; onSave: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) setPos({ top: rect.bottom + 4, left: Math.max(4, rect.right - 170) });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", h);
    };
  }, [open]);

  if (!dueLabel) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        title={isOverdue ? "Prazo vencido — clique pra mudar" : "Prazo — clique pra mudar"}
        className="flex items-center gap-1 text-[10px] font-semibold tabular-nums hover:opacity-80 transition-opacity"
        style={{ color: isOverdue ? "#FF6B6B" : "color-mix(in srgb, var(--foreground) 50%, transparent)" }}
      >
        <Calendar size={12} />
        <span>{dueLabel}</span>
      </button>
      {open && pos && createPortal(
        <div
          ref={popRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 170 }}
          className="z-[200] rounded-md bg-card border border-foreground/10 shadow-xl p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="date"
            autoFocus
            defaultValue={item.dueDate ?? ""}
            onChange={(e) => { onSave(e.target.value || null); setOpen(false); }}
            className="w-full bg-background border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
          />
          <button
            onClick={() => { onSave(null); setOpen(false); }}
            className="mt-1.5 w-full text-[10px] text-foreground/40 hover:text-red-400 transition-colors"
          >
            Remover prazo
          </button>
        </div>,
        document.body,
      )}
    </>
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
      style={{ background: "var(--card)" }}
    >
      {url ? (
        <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <ImageIcon size={32} style={{ color: "color-mix(in srgb, var(--foreground) 20%, transparent)" }} />
      )}
    </div>
  );
}
