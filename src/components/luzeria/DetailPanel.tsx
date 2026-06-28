import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Send, ExternalLink, Plus, Check } from "lucide-react";
import { clientsQO, monthQO, profilesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { STATUS_META, STATUS_ORDER, type Status, type Profile, type ContentItem } from "@/lib/luzeria/types";
import { Avatar } from "./Avatar";
import { STATUS_ICONS, detectDriveType } from "./icons";

function findItem(month: any, id: string): ContentItem | undefined {
  return month?.posts.find((i: any) => i.id === id) ?? month?.reels.find((i: any) => i.id === id);
}

export function DetailPanel() {
  const { selectedItemId, openItem, selectedClientId, selectedMonthKey, flash } = useUI();
  const { data: month } = useQuery({ ...monthQO(selectedClientId ?? "", selectedMonthKey), enabled: !!selectedClientId && !!selectedItemId });
  const { data: profiles = [] } = useQuery(profilesQO());
  const { data: clients = [] } = useQuery(clientsQO());
  const me = useMe().data;
  const { setItemStatus, updateItem, addAssignee, removeAssignee, addComment } = useApi();

  const item = useMemo(() => (selectedItemId && month ? findItem(month, selectedItemId) : undefined), [month, selectedItemId]);
  const client = clients.find((c) => c.id === selectedClientId);
  const isAdmin = me?.role === "master" || me?.role === "setor";

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedItemId) return;
    const h = (e: MouseEvent) => { if (!panelRef.current?.contains(e.target as Node)) openItem(null); };
    const t = setTimeout(() => document.addEventListener("mousedown", h), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", h); };
  }, [selectedItemId, openItem]);

  const [title, setTitle] = useState("");
  const [copy, setCopy] = useState("");
  const [drive, setDrive] = useState("");
  const [comment, setComment] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);

  useEffect(() => {
    if (item) { setTitle(item.title); setCopy(item.copy); setDrive(item.driveLink); }
  }, [item?.id]); // eslint-disable-line

  if (!selectedItemId) return null;
  if (!item) return null;

  const assignees = item.assigneeIds.map((id) => profiles.find((p) => p.id === id)).filter(Boolean) as Profile[];
  const { Icon: DriveIcon, label: driveLabel } = detectDriveType(drive);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
      <div ref={panelRef}
        className="fixed z-50 bg-[#0D0D0D] border-white/10 flex flex-col lz-slide-in overflow-y-auto
          inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl border-t
          md:rounded-none md:border-t-0 md:border-l md:right-0 md:top-0 md:bottom-0 md:left-auto md:w-[420px] md:max-h-none">
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.08]">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[12px] uppercase font-bold tracking-wider" style={{ color: "#C8D44E" }}>
              {item.type === "post" ? "Post" : "Reels"} {String(item.idx).padStart(2, "0")}
              {client && <span className="ml-2 text-white/40 font-semibold">· {client.name}</span>}
            </div>
            <button onClick={() => openItem(null)} className="text-white/50 hover:text-white p-1 -mt-1 -mr-1 rounded hover:bg-white/5 transition">
              <X size={16} />
            </button>
          </div>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { if (title.trim() && title !== item.title) updateItem.mutate({ data: { id: item.id, patch: { title: title.trim() } } }); }}
            className="mt-2 w-full bg-transparent text-[20px] font-bold text-white outline-none placeholder:text-white/30" />
        </div>

        {/* Status */}
        <Section label="Status">
          <div className="grid grid-cols-2 gap-2">
            {STATUS_ORDER.map((s) => {
              const m = STATUS_META[s]; const I = STATUS_ICONS[s];
              const active = item.status === s;
              return (
                <button key={s}
                  onClick={() => { setItemStatus.mutate({ data: { id: item.id, status: s } }); flash(item.id); }}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wide transition-all"
                  style={{
                    backgroundColor: active ? m.bg : "transparent",
                    color: active ? m.color : "rgba(255,255,255,0.6)",
                    border: `1px solid ${active ? m.color : "rgba(255,255,255,0.08)"}`,
                  }}>
                  <I size={12} /> {m.label}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Assignees */}
        <Section label="Responsáveis">
          <div className="flex items-center gap-2 flex-wrap">
            {assignees.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 bg-white/5 rounded-full pl-1 pr-2 py-1">
                <Avatar profile={p} size={22} />
                <span className="text-xs text-white/80">{p.name}</span>
                {(isAdmin || p.id === me?.id) && (
                  <button onClick={() => removeAssignee.mutate({ data: { itemId: item.id, userId: p.id } })}
                    className="text-white/40 hover:text-red-400 ml-0.5"><X size={12} /></button>
                )}
              </div>
            ))}
            <div className="relative">
              <button onClick={() => setAssignOpen((o) => !o)}
                className="h-8 w-8 rounded-full border border-dashed border-white/20 text-white/40 hover:text-[#C8D44E] hover:border-[#C8D44E] flex items-center justify-center transition-colors">
                <Plus size={14} />
              </button>
              {assignOpen && (
                <div className="absolute z-50 mt-1 left-0 min-w-[200px] rounded-md bg-[#1C1C1C] border border-white/10 shadow-xl py-1 max-h-72 overflow-y-auto">
                  {profiles.map((p) => {
                    const has = item.assigneeIds.includes(p.id);
                    const allowed = isAdmin || p.id === me?.id;
                    return (
                      <button key={p.id} disabled={!allowed}
                        onClick={() => {
                          if (has) removeAssignee.mutate({ data: { itemId: item.id, userId: p.id } });
                          else addAssignee.mutate({ data: { itemId: item.id, userId: p.id } });
                          setAssignOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed text-left">
                        <Avatar profile={p} size={22} />
                        <span className="text-white/80 flex-1">{p.name}</span>
                        {has && <Check size={13} className="text-[#C8D44E]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* Copy */}
        <Section label="Copy">
          <textarea value={copy} onChange={(e) => setCopy(e.target.value)} rows={5}
            onBlur={() => { if (copy !== item.copy) updateItem.mutate({ data: { id: item.id, patch: { copy } } }); }}
            placeholder="Escreva a copy..."
            className="w-full bg-[#252525] border border-white/[0.08] rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E] placeholder:text-white/30 resize-none transition-colors" />
        </Section>

        {/* Drive */}
        <Section label="Arquivos">
          <input value={drive} onChange={(e) => setDrive(e.target.value)}
            onBlur={() => { if (drive !== item.driveLink) updateItem.mutate({ data: { id: item.id, patch: { drive_link: drive } } }); }}
            placeholder="Cole o link do Google Drive..."
            className="w-full bg-[#252525] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E] placeholder:text-white/30 transition-colors" />
          {drive && (
            <div className="mt-2 flex items-center gap-3 rounded-md bg-[#1C1C1C] border border-white/[0.08] px-3 py-2">
              <DriveIcon size={20} style={{ color: "#C8D44E" }} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-white">{driveLabel}</div>
                <div className="text-[10px] text-white/40 truncate">{drive}</div>
              </div>
              <a href={drive} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C8D44E] hover:underline">
                <ExternalLink size={12} /> Abrir
              </a>
            </div>
          )}
          <p className="text-[10px] text-white/40 mt-1.5">Suporta links de pastas, vídeos e carrosséis do Drive.</p>
        </Section>

        {/* Comments */}
        <Section label="Comentários" last>
          <div className="space-y-2.5 mb-3">
            {item.comments.length === 0 && <p className="text-xs text-white/40">Sem comentários ainda.</p>}
            {item.comments.map((c) => {
              const author = profiles.find((p) => p.id === c.authorId);
              if (c.system) return (
                <div key={c.id} className="rounded-md px-3 py-2 text-[11px] italic"
                  style={{ backgroundColor: "rgba(200,212,78,0.08)", borderLeft: "2px solid #C8D44E", color: "rgba(255,255,255,0.7)" }}>
                  <span>{c.text}</span>
                  <span className="text-white/40 ml-2 not-italic">{relTime(c.createdAt)}</span>
                </div>
              );
              return (
                <div key={c.id} className="flex gap-2.5">
                  <Avatar profile={author ?? undefined} size={26} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-white">{author?.name ?? "Alguém"}</span>
                      <span className="text-[10px] text-white/40">{relTime(c.createdAt)}</span>
                    </div>
                    <div className="text-xs text-white/80 whitespace-pre-wrap mt-0.5">{c.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input value={comment} onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && comment.trim()) { addComment.mutate({ data: { itemId: item.id, text: comment.trim() } }); setComment(""); } }}
              placeholder="Novo comentário..."
              className="flex-1 bg-[#252525] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E] placeholder:text-white/30 transition-colors" />
            <button disabled={!comment.trim()}
              onClick={() => { addComment.mutate({ data: { itemId: item.id, text: comment.trim() } }); setComment(""); }}
              className="px-3 rounded-md text-sm font-bold disabled:opacity-30 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}>
              <Send size={14} />
            </button>
          </div>
        </Section>
      </div>
    </>
  );
}

function Section({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`px-6 py-5 ${last ? "" : "border-b border-white/[0.08]"}`}>
      <div className="text-[10px] uppercase font-bold tracking-wider mb-3" style={{ color: "#C8D44E" }}>{label}</div>
      {children}
    </div>
  );
}

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `há ${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}