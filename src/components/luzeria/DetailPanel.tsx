import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Send, ExternalLink, Plus, Check, Pencil, ChevronDown, Copy, Calendar, AlertOctagon, ListChecks, Star, RotateCcw, Trash2 } from "lucide-react";
import { clientsQO, monthQO, profilesQO, useApi, useMe, appSettingsQO } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { STATUS_META, statusOptionsFor, REEL_TYPES, REEL_TYPE_LABEL, type Profile, type ContentItem, type ReelType, type Status } from "@/lib/luzeria/types";
import { Avatar } from "./Avatar";
import { STATUS_ICONS, detectDriveType } from "./icons";
import { MentionInput, renderMentions } from "./MentionInput";
import { ItemTimeline } from "./ItemTimeline";
import { QualityModal } from "./QualityModal";

function findItem(month: any, id: string): ContentItem | undefined {
  return (
    month?.posts.find((i: any) => i.id === id) ??
    month?.reels.find((i: any) => i.id === id) ??
    month?.outros?.find((i: any) => i.id === id)
  );
}

function normalizeExternalUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).href;
  } catch {
    try {
      return new URL(`https://${trimmed}`).href;
    } catch {
      return null;
    }
  }
}

function isPreviewFrame() {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

export function DetailPanel() {
  const { selectedItemId, openItem, selectedClientId, selectedMonthKey, flash } = useUI();
  const { data: month } = useQuery({ ...monthQO(selectedClientId ?? "", selectedMonthKey), enabled: !!selectedClientId && !!selectedItemId });
  const { data: profiles = [] } = useQuery(profilesQO());
  const { data: clients = [] } = useQuery(clientsQO());
  const me = useMe().data;
  const { setItemStatus, updateItem, addAssignee, removeAssignee, addCommentWithMentions, rateItem } = useApi();
  const { data: appSettings } = useQuery(appSettingsQO());

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
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [qualityFor, setQualityFor] = useState<Status | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [driveEditing, setDriveEditing] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [driveCopied, setDriveCopied] = useState(false);
  const [newCheck, setNewCheck] = useState("");
  const { updateChecklist } = useApi();

  useEffect(() => {
    if (item) {
      setTitle(item.title); setCopy(item.copy); setDrive(item.driveLink);
      setDriveEditing(!item.driveLink);
      setDueDate(item.dueDate ?? "");
      setBlockedReason(item.blockedReason ?? "");
    }
  }, [item?.id]); // eslint-disable-line

  if (!selectedItemId) return null;
  if (!item) return null;

  const assignees = item.assigneeIds.map((id) => profiles.find((p) => p.id === id)).filter(Boolean) as Profile[];
  const { Icon: DriveIcon, label: driveLabel } = detectDriveType(drive);
  const editor = item.editorId ? profiles.find((p) => p.id === item.editorId) : null;
  const canSetEditor = isAdmin || (me ? item.assigneeIds.includes(me.id) : false);
  const activeProfiles = profiles.filter((p) => p.active);
  const normalizedDriveUrl = normalizeExternalUrl(drive);
  const framedPreview = typeof window !== "undefined" && isPreviewFrame();
  const isOverdue =
    !!item.dueDate && item.status !== "FINALIZADO" &&
    new Date(item.dueDate + "T23:59:59").getTime() < Date.now();

  const checklist = item.checklist ?? [];
  const checklistDone = checklist.filter((c) => c.done).length;
  const reworkCount = item.reworkCount ?? 0;

  const itemId = item.id;
  function saveChecklist(next: typeof checklist) {
    updateChecklist.mutate({ data: { itemId, checklist: next } });
  }

  const copyDriveLink = async () => {
    if (!normalizedDriveUrl) return;
    try {
      await navigator.clipboard.writeText(normalizedDriveUrl);
      setDriveCopied(true);
      window.setTimeout(() => setDriveCopied(false), 1800);
    } catch {
      window.prompt("Copie o link do Drive:", normalizedDriveUrl);
    }
  };

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
              {item.type === "post" ? "Post" : item.type === "reel" ? "Reels" : "Item"} {String(item.idx).padStart(2, "0")}
              {client && <span className="ml-2 text-white/40 font-semibold">· {client.name}</span>}
            </div>
            <button onClick={() => openItem(null)} className="text-white/50 hover:text-white p-1 -mt-1 -mr-1 rounded hover:bg-white/5 transition">
              <X size={16} />
            </button>
          </div>
          {reworkCount > 0 && (
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ backgroundColor: "rgba(255,140,66,0.15)", color: "#FF8C42" }}>
              <RotateCcw size={10} /> Retrabalho ×{reworkCount}
            </div>
          )}
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { if (title.trim() && title !== item.title) updateItem.mutate({ data: { id: item.id, patch: { title: title.trim() } } }); }}
            className="mt-2 w-full bg-transparent text-[20px] font-bold text-white outline-none placeholder:text-white/30" />
        </div>

        {/* Status */}
        <Section label="Status">
          <div className="grid grid-cols-2 gap-2">
            {statusOptionsFor(item.type).map((s) => {
              const m = STATUS_META[s]; const I = STATUS_ICONS[s];
              const active = item.status === s;
              return (
                <button key={s}
                  onClick={() => {
                    if (s === "FINALIZADO" && appSettings?.requireRatingOnFinalize &&
                        item.status !== "FINALIZADO" && item.qualityRating == null) {
                      setQualityFor("FINALIZADO");
                      return;
                    }
                    setItemStatus.mutate({ data: { id: item.id, status: s } });
                    flash(item.id);
                  }}
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

        {item.status === "BLOQUEADO" && (
          <Section label="Motivo do bloqueio">
            <div className="flex items-start gap-2">
              <AlertOctagon size={16} className="mt-2.5" style={{ color: "#FF6B6B" }} />
              <textarea
                value={blockedReason}
                onChange={(e) => setBlockedReason(e.target.value)}
                onBlur={() => {
                  const v = blockedReason.trim();
                  if (v !== (item.blockedReason ?? ""))
                    updateItem.mutate({ data: { id: item.id, patch: { blocked_reason: v || null } } });
                }}
                rows={2}
                placeholder="Ex.: aguardando aprovação do cliente, falta de material…"
                className="flex-1 bg-[#252525] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B6B] focus:ring-1 focus:ring-[#FF6B6B] placeholder:text-white/30 resize-none"
              />
            </div>
          </Section>
        )}

        <Section label="Prazo">
          <div className="flex items-center gap-2">
            <Calendar size={15} style={{ color: isOverdue ? "#FF6B6B" : "#C8D44E" }} />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={() => {
                const v = dueDate || null;
                if (v !== (item.dueDate ?? null))
                  updateItem.mutate({ data: { id: item.id, patch: { due_date: v } } });
              }}
              className="flex-1 bg-[#252525] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E]"
            />
            {dueDate && (
              <button
                type="button"
                onClick={() => {
                  setDueDate("");
                  updateItem.mutate({ data: { id: item.id, patch: { due_date: null } } });
                }}
                className="text-[11px] text-white/40 hover:text-white px-2 py-1 rounded hover:bg-white/5"
              >Limpar</button>
            )}
          </div>
          {isOverdue && (
            <p className="mt-1.5 text-[10px] font-semibold" style={{ color: "#FF6B6B" }}>Prazo vencido.</p>
          )}
          {item.startedAt && (
            <p className="text-[10px] text-white/40 mt-1.5">
              Iniciado em {new Date(item.startedAt).toLocaleDateString("pt-BR")}
              {item.finishedAt && ` · Finalizado em ${new Date(item.finishedAt).toLocaleDateString("pt-BR")}`}
            </p>
          )}
        </Section>

        {/* Checklist */}
        <Section label={`Checklist${checklist.length ? ` · ${checklistDone}/${checklist.length}` : ""}`}>
          <div className="space-y-1.5">
            {checklist.map((c, idx) => (
              <div key={c.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => {
                    const next = checklist.map((x) => x.id === c.id ? { ...x, done: !x.done } : x);
                    saveChecklist(next);
                  }}
                  className="h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors"
                  style={{
                    borderColor: c.done ? "#C8D44E" : "rgba(255,255,255,0.25)",
                    backgroundColor: c.done ? "#C8D44E" : "transparent",
                  }}
                >
                  {c.done && <Check size={10} color="#0D0D0D" strokeWidth={3} />}
                </button>
                <input
                  value={c.text}
                  onChange={(e) => {
                    const next = checklist.map((x) => x.id === c.id ? { ...x, text: e.target.value } : x);
                    saveChecklist(next);
                  }}
                  className={`flex-1 bg-transparent text-sm outline-none ${c.done ? "line-through text-white/40" : "text-white/90"}`}
                />
                <button
                  onClick={() => saveChecklist(checklist.filter((x) => x.id !== c.id))}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/5"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-1">
              <ListChecks size={13} className="text-white/30 shrink-0" />
              <input
                value={newCheck}
                onChange={(e) => setNewCheck(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCheck.trim()) {
                    const id = (typeof crypto !== "undefined" && (crypto as any).randomUUID)
                      ? (crypto as any).randomUUID()
                      : Math.random().toString(36).slice(2);
                    saveChecklist([...checklist, { id, text: newCheck.trim(), done: false }]);
                    setNewCheck("");
                  }
                }}
                placeholder="Adicionar subtarefa e dar Enter…"
                className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/30 border-b border-white/[0.06] focus:border-[#C8D44E] py-1"
              />
            </div>
          </div>
        </Section>

        {/* Quality */}
        {(item.status === "FINALIZADO" || item.qualityRating != null) && (
          <Section label="Qualidade">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = (item.qualityRating ?? 0) >= n;
                return (
                  <button
                    key={n}
                    disabled={!isAdmin}
                    onClick={() => rateItem.mutate({ data: { itemId: item.id, rating: item.qualityRating === n ? null : n } })}
                    className="p-0.5 disabled:cursor-not-allowed transition-transform hover:scale-110 disabled:hover:scale-100"
                  >
                    <Star size={20} fill={filled ? "#C8D44E" : "transparent"} color={filled ? "#C8D44E" : "rgba(255,255,255,0.3)"} />
                  </button>
                );
              })}
              {item.qualityRating != null && (
                <span className="ml-2 text-xs font-bold text-[#C8D44E]">{item.qualityRating}/5</span>
              )}
            </div>
            {!isAdmin && (
              <p className="text-[10px] text-white/40 mt-1.5">Apenas administradores avaliam a qualidade.</p>
            )}
          </Section>
        )}

        {/* Reel video type (Reels only) */}
        {item.type === "reel" && (
          <Section label="Tipo de vídeo">
            <div className="flex items-center gap-2 flex-wrap">
              {REEL_TYPES.map((rt) => {
                const active = item.reelType === rt;
                return (
                  <button key={rt}
                    onClick={() => updateItem.mutate({
                      data: { id: item.id, patch: { reel_type: active ? null : rt } },
                    })}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: active ? "#C8D44E" : "rgba(255,255,255,0.08)",
                      color: active ? "#0D0D0D" : "#FFFFFF",
                      fontWeight: active ? 700 : 500,
                    }}>
                    {REEL_TYPE_LABEL[rt as ReelType]}
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {/* Assignees */}
        {item.type === "reel" && (
          <Section label="Editor">
            <div className="relative">
              <button
                disabled={!canSetEditor}
                onClick={() => setEditorOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-2 rounded-md bg-[#1C1C1C] border border-white/[0.08] px-3 py-2.5 text-sm text-white hover:border-[#C8D44E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-2 min-w-0">
                  {editor ? (
                    <>
                      <Avatar profile={editor} size={22} />
                      <span className="truncate">{editor.name}</span>
                    </>
                  ) : (
                    <span className="text-white/40">Selecionar editor…</span>
                  )}
                </span>
                <ChevronDown size={14} className="text-white/40 shrink-0" />
              </button>
              {editorOpen && (
                <div className="absolute z-50 mt-1 left-0 right-0 rounded-md bg-[#1C1C1C] border border-white/10 shadow-xl py-1 max-h-72 overflow-y-auto">
                  {editor && (
                    <button
                      onClick={() => {
                        updateItem.mutate({ data: { id: item.id, patch: { editor_id: null } } });
                        setEditorOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 text-left text-red-400"
                    >
                      <X size={13} /> Remover editor
                    </button>
                  )}
                  {activeProfiles.map((p) => {
                    const sel = item.editorId === p.id;
                    return (
                      <button key={p.id}
                        onClick={() => {
                          updateItem.mutate({ data: { id: item.id, patch: { editor_id: p.id } } });
                          setEditorOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 text-left"
                      >
                        <Avatar profile={p} size={22} />
                        <span className="text-white/80 flex-1">{p.name}</span>
                        {sel && <Check size={13} className="text-[#C8D44E]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {!canSetEditor && (
              <p className="text-[10px] text-white/40 mt-1.5">Apenas administradores ou responsáveis pela tarefa podem definir o editor.</p>
            )}
          </Section>
        )}

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
          {driveEditing || !drive ? (
            <div className="flex items-center gap-2">
              <input value={drive} onChange={(e) => setDrive(e.target.value)} autoFocus={driveEditing && !!item.driveLink}
                onBlur={() => {
                  if (drive !== item.driveLink) updateItem.mutate({ data: { id: item.id, patch: { drive_link: drive } } });
                  if (drive) setDriveEditing(false);
                }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                placeholder="Cole o link do Drive..."
                className="flex-1 bg-[#252525] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E] placeholder:text-white/30 transition-colors" />
            </div>
          ) : (
            <div className="rounded-md bg-[#1C1C1C] border border-white/[0.08] px-3 py-2.5">
              <div className="flex items-center gap-3">
                <DriveIcon size={18} style={{ color: "#C8D44E" }} />
                {normalizedDriveUrl ? (
                  <a
                    href={normalizedDriveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    referrerPolicy="no-referrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-w-0 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline text-left"
                    style={{ color: "#C8D44E" }}>
                    Abrir no Drive
                    <ExternalLink size={13} />
                    <span className="text-[10px] text-white/40 font-normal truncate ml-1">· {driveLabel}</span>
                  </a>
                ) : (
                  <span className="flex-1 text-sm font-semibold text-red-300">Link inválido</span>
                )}
                <button
                  type="button"
                  disabled={!normalizedDriveUrl}
                  onClick={(e) => {
                    e.stopPropagation();
                    copyDriveLink();
                  }}
                  title="Copiar link"
                  className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-semibold text-white/50 hover:text-[#C8D44E] hover:bg-white/5 transition disabled:opacity-30 disabled:cursor-not-allowed">
                  {driveCopied ? <Check size={13} /> : <Copy size={13} />}
                  {driveCopied ? "Copiado" : "Copiar"}
                </button>
              <button onClick={() => setDriveEditing(true)}
                title="Editar link"
                className="text-white/40 hover:text-white p-1 rounded hover:bg-white/5 transition">
                <Pencil size={13} />
              </button>
              </div>
              {framedPreview && (
                <p className="mt-2 text-[10px] leading-relaxed text-white/40">
                  Se o Drive bloquear no preview, use Copiar e cole o link em uma nova aba.
                </p>
              )}
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