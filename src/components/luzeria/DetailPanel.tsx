import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Send, ExternalLink, Plus, Check, ChevronDown, Calendar, AlertOctagon, ListChecks, Star, RotateCcw, Trash2, Upload, Loader2 } from "lucide-react";
import { clientsQO, monthQO, profilesQO, useApi, useMe, appSettingsQO, driveThumbnailQO, itemFilesQO } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { STATUS_META, statusOptionsFor, REEL_TYPES, REEL_TYPE_LABEL, type Profile, type ContentItem, type ReelType, type Status } from "@/lib/luzeria/types";
import { Avatar } from "./Avatar";
import { STATUS_ICONS } from "./icons";
import { MentionInput, renderMentions } from "./MentionInput";
import { ItemTimeline } from "./ItemTimeline";
import { QualityModal } from "./QualityModal";
import { FilesSection } from "./FilesSection";

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

function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /\/d\/([A-Za-z0-9_-]{10,})/,
    /[?&]id=([A-Za-z0-9_-]{10,})/,
    /\/folders\/([A-Za-z0-9_-]{10,})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

function MediaPreview({ itemId, onEmpty }: { itemId: string; onEmpty: () => void }) {
  const { data: files = [], isLoading: filesLoading } = useQuery(itemFilesQO(itemId));
  const first = files[0];
  const fileId = first?.driveFileId ?? null;
  const { data: thumbData, isLoading: thumbLoading } = useQuery(driveThumbnailQO(fileId, !!fileId));
  const thumb = thumbData?.dataUrl ?? null;
  const href = first ? normalizeExternalUrl(first.webViewUrl) : null;

  if (!filesLoading && !first) {
    return (
      <button
        type="button"
        onClick={onEmpty}
        className="group w-full h-[200px] rounded-[10px] border border-dashed border-white/15 bg-[#141414] hover:border-[#C8D44E] hover:bg-[#171717] transition-colors flex flex-col items-center justify-center gap-2"
      >
        <Upload size={22} className="text-white/30 group-hover:text-[#C8D44E] transition-colors" />
        <span className="text-xs text-white/40 group-hover:text-white/70 transition-colors">
          Envie um arquivo ou cole o link do Drive
        </span>
      </button>
    );
  }

  return (
    <a
      href={href ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => { if (!href) e.preventDefault(); }}
      className="group relative block w-full h-[200px] rounded-[10px] overflow-hidden bg-[#141414] border border-white/[0.08]"
      title={first?.name}
    >
      {thumb ? (
        <img src={thumb} alt={first?.name ?? "Preview"} className="w-full h-full object-cover" loading="lazy" />
      ) : thumbLoading || filesLoading ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 size={18} className="animate-spin text-white/30" />
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-white/40 px-4 text-center">
          <ExternalLink size={20} />
          <span className="text-[11px] truncate max-w-full">{first?.name ?? "Abrir no Drive"}</span>
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/55 transition-colors flex items-center justify-center">
        <ExternalLink
          size={28}
          className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg"
        />
      </div>
    </a>
  );
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

  useEffect(() => {
    if (!selectedItemId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") openItem(null); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedItemId, openItem]);

  const [title, setTitle] = useState("");
  const [copy, setCopy] = useState("");
  const [caption, setCaption] = useState("");
  const [drive, setDrive] = useState("");
  const [comment, setComment] = useState("");
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [qualityFor, setQualityFor] = useState<Status | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [newCheck, setNewCheck] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const { updateChecklist } = useApi();

  useEffect(() => {
    if (item) {
      setTitle(item.title); setCopy(item.copy); setDrive(item.driveLink);
      setCaption(item.caption ?? "");
      setDueDate(item.dueDate ?? "");
      setBlockedReason(item.blockedReason ?? "");
    }
  }, [item?.id]); // eslint-disable-line

  useEffect(() => {
    if (!statusOpen) return;
    const h = (e: MouseEvent) => { if (!statusRef.current?.contains(e.target as Node)) setStatusOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [statusOpen]);

  if (!selectedItemId) return null;
  if (!item) return null;

  const assignees = item.assigneeIds.map((id) => profiles.find((p) => p.id === id)).filter(Boolean) as Profile[];
  const editor = item.editorId ? profiles.find((p) => p.id === item.editorId) : null;
  const canSetEditor = isAdmin || (me ? item.assigneeIds.includes(me.id) : false);
  const canEditFiles = isAdmin || (me ? item.assigneeIds.includes(me.id) : false);
  const activeProfiles = profiles.filter((p) => p.active);
  const isOverdue =
    !!item.dueDate && item.status !== "PRONTO_PARA_PUBLICAR" &&
    new Date(item.dueDate + "T23:59:59").getTime() < Date.now();

  const checklist = item.checklist ?? [];
  const checklistDone = checklist.filter((c) => c.done).length;
  const reworkCount = item.reworkCount ?? 0;

  const itemId = item.id;
  function saveChecklist(next: typeof checklist) {
    updateChecklist.mutate({ data: { itemId, checklist: next } });
  }

  const showQuality = item.status === "PRONTO_PARA_PUBLICAR" || item.qualityRating != null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-6 bg-black/75 backdrop-blur-[8px] lz-overlay-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) openItem(null); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full md:w-[760px] md:max-w-full bg-[#1A1A1A] border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden
          max-h-[92vh] md:max-h-[90vh]
          rounded-t-2xl md:rounded-2xl
          lz-sheet-in md:lz-modal-in"
      >
        {/* Mobile handle */}
        <div className="md:hidden flex justify-center pt-2 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-5 md:px-6 pt-4 md:pt-5 pb-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase font-bold tracking-wider text-white/40">
                <span className="text-[#C8D44E]">
                  {item.type === "post" ? "Post" : item.type === "reel" ? "Reels" : "Item"} {String(item.idx).padStart(2, "0")}
                </span>
                {client && <span className="ml-1.5">· {client.name}</span>}
                {reworkCount > 0 && (
                  <span
                    className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded align-middle"
                    style={{ backgroundColor: "rgba(255,140,66,0.15)", color: "#FF8C42" }}
                  >
                    <RotateCcw size={10} /> Retrabalho ×{reworkCount}
                  </span>
                )}
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => { if (title.trim() && title !== item.title) updateItem.mutate({ data: { id: item.id, patch: { title: title.trim() } } }); }}
                className="mt-1.5 w-full bg-transparent text-[22px] font-bold text-white outline-none placeholder:text-white/30 border-b border-transparent focus:border-[#C8D44E] transition-colors pb-0.5"
              />
            </div>
            <button
              onClick={() => openItem(null)}
              aria-label="Fechar"
              className="shrink-0 text-white/50 hover:text-white p-1.5 rounded-md hover:bg-white/5 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body — two columns on desktop, stacked on mobile */}
        <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden md:grid md:grid-cols-[55fr_45fr]">
          {/* LEFT COLUMN */}
          <div className="md:overflow-y-auto md:border-r md:border-white/[0.06]">
            {/* Drive preview */}
            <ModalSection label="Mídia">
              <MediaPreview itemId={item.id} onEmpty={() => {
                const el = document.getElementById("lz-files-section");
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
              }} />
            </ModalSection>

            {/* Briefing (era Copy) */}
            <ModalSection label="Briefing">
              <textarea
                value={copy}
                onChange={(e) => setCopy(e.target.value)}
                rows={5}
                onBlur={() => { if (copy !== item.copy) updateItem.mutate({ data: { id: item.id, patch: { copy } } }); }}
                placeholder="Descreva o briefing do conteúdo..."
                className="w-full bg-[#252525] border border-transparent rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E] placeholder:text-white/30 resize-none transition-colors"
              />
            </ModalSection>

            {/* Legenda */}
            <ModalSection label="Legenda">
              <div className="relative">
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={5}
                  onBlur={() => { if (caption !== (item.caption ?? "")) updateItem.mutate({ data: { id: item.id, patch: { caption } } }); }}
                  placeholder="Digite a legenda que será publicada..."
                  className="w-full bg-[#252525] border border-transparent rounded-lg px-3 py-2.5 pb-6 text-sm text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E] placeholder:text-white/30 resize-none transition-colors"
                />
                <div className="absolute bottom-2 right-3 text-[10px] text-white/40 pointer-events-none">
                  {caption.length} caracteres
                </div>
              </div>
            </ModalSection>

            {/* Comentários + Timeline */}
            <ModalSection label="Comentários" last>
              <div className="space-y-2.5 mb-3">
                {item.comments.length === 0 && <p className="text-xs text-white/40">Sem comentários ainda.</p>}
                {item.comments.map((c) => {
                  const author = profiles.find((p) => p.id === c.authorId);
                  if (c.system) return (
                    <div key={c.id} className="rounded-md px-3 py-2 text-[11px] italic"
                      style={{ backgroundColor: "rgba(200,212,78,0.06)", borderLeft: "2px solid #C8D44E", color: "rgba(255,255,255,0.7)" }}>
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
                        <div className="text-xs text-white/80 whitespace-pre-wrap mt-0.5">{renderMentions(c.text)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <MentionInput value={comment}
                    onChange={(v, ids) => { setComment(v); setCommentMentions(ids); }}
                    onSubmit={() => {
                      if (!comment.trim()) return;
                      addCommentWithMentions.mutate({ data: { itemId: item.id, text: comment.trim(), mentionedUserIds: commentMentions } });
                      setComment(""); setCommentMentions([]);
                    }}
                    placeholder="Novo comentário... use @ para mencionar"
                    rows={2} />
                  <div className="text-[10px] text-white/30 mt-1">Ctrl/⌘ + Enter envia · @ menciona</div>
                </div>
                <button disabled={!comment.trim()}
                  onClick={() => {
                    addCommentWithMentions.mutate({ data: { itemId: item.id, text: comment.trim(), mentionedUserIds: commentMentions } });
                    setComment(""); setCommentMentions([]);
                  }}
                  className="px-3 py-2 rounded-md text-sm font-bold disabled:opacity-30 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}>
                  <Send size={14} />
                </button>
              </div>
              <div className="mt-5">
                <ItemTimeline itemId={item.id} />
              </div>
            </ModalSection>
          </div>

          {/* RIGHT COLUMN */}
          <div className="md:overflow-y-auto">
            {/* Status */}
            <ModalSection label="Status">
              <div className="relative" ref={statusRef}>
                <button
                  onClick={() => setStatusOpen((o) => !o)}
                  className="w-full flex items-center justify-between gap-3 rounded-md px-4 py-3 text-sm font-bold uppercase tracking-wide transition-all"
                  style={{
                    backgroundColor: STATUS_META[item.status].bg,
                    color: STATUS_META[item.status].color,
                    border: `1px solid ${STATUS_META[item.status].color}`,
                  }}>
                  <span className="flex items-center gap-3">
                    {(() => {
                      const I = STATUS_ICONS[item.status];
                      return <I size={16} />;
                    })()}
                    {STATUS_META[item.status].label}
                  </span>
                  <ChevronDown size={16} className={`transition-transform ${statusOpen ? "rotate-180" : ""}`} />
                </button>
                {statusOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 rounded-md bg-[#1C1C1C] border border-white/10 shadow-xl py-1 max-h-[60vh] overflow-y-auto">
                    {statusOptionsFor(item.type).map((s) => {
                      const m = STATUS_META[s]; const I = STATUS_ICONS[s];
                      const active = item.status === s;
                      return (
                        <button key={s}
                          onClick={() => {
                            if (s === "PRONTO_PARA_PUBLICAR" && appSettings?.requireRatingOnFinalize &&
                                item.status !== "PRONTO_PARA_PUBLICAR" && item.qualityRating == null) {
                              setQualityFor("PRONTO_PARA_PUBLICAR");
                              setStatusOpen(false);
                              return;
                            }
                            setItemStatus.mutate({ data: { id: item.id, status: s } });
                            setStatusOpen(false);
                            flash(item.id);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-all"
                          style={{
                            backgroundColor: active ? m.bg : "transparent",
                            color: active ? m.color : "rgba(255,255,255,0.6)",
                          }}>
                          <I size={16} /> {m.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </ModalSection>

        {/* Responsáveis */}
        <ModalSection label="Responsáveis">
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
                <div className="absolute z-[60] mt-1 left-0 min-w-[200px] rounded-md bg-[#1C1C1C] border border-white/10 shadow-xl py-1 max-h-72 overflow-y-auto">
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
        </ModalSection>

        {/* Editor (Reels) */}
        {item.type === "reel" && (
          <ModalSection label="Editor">
            <div className="relative">
              <button
                disabled={!canSetEditor}
                onClick={() => setEditorOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-2 rounded-md bg-[#252525] border border-white/[0.08] px-3 py-2.5 text-sm text-white hover:border-[#C8D44E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="absolute z-[60] mt-1 left-0 right-0 rounded-md bg-[#1C1C1C] border border-white/10 shadow-xl py-1 max-h-72 overflow-y-auto">
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
          </ModalSection>
        )}

        {/* Tipo de vídeo (Reels) */}
        {item.type === "reel" && (
          <ModalSection label="Tipo de vídeo">
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
          </ModalSection>
        )}

        {/* Prazo */}
        <ModalSection label="Prazo">
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
              {item.finishedAt && ` · Publicado em ${new Date(item.finishedAt).toLocaleDateString("pt-BR")}`}
            </p>
          )}
        </ModalSection>

        {item.status === "TRAVADO" && (
          <ModalSection label="Motivo do travamento">
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
          </ModalSection>
        )}

        {/* Checklist */}
        <ModalSection label={`Checklist${checklist.length ? ` · ${checklistDone}/${checklist.length}` : ""}`}>
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
        </ModalSection>

        {/* Quality */}
        {showQuality && (
          <ModalSection label="Qualidade">
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
          </ModalSection>
        )}

        {/* Files */}
        <ModalSection label="Arquivos" last>
          <div id="lz-files-section">
            <FilesSection itemId={item.id} canEdit={canEditFiles} clientId={selectedClientId} />
          </div>
        </ModalSection>
          </div>
        </div>
      </div>

      <QualityModal
        open={qualityFor !== null}
        onClose={() => setQualityFor(null)}
        itemTitle={item.title}
        onConfirm={(rating) => {
          rateItem.mutate({ data: { itemId: item.id, rating } }, {
            onSuccess: () => {
              setItemStatus.mutate({ data: { id: item.id, status: qualityFor! } });
              flash(item.id);
              setQualityFor(null);
            },
          });
        }}
      />
    </div>
  );
}

function ModalSection({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`px-5 md:px-6 py-4 ${last ? "" : "border-b border-white/[0.06]"}`}>
      <div className="text-[10px] uppercase font-bold tracking-wider mb-2.5" style={{ color: "#C8D44E" }}>{label}</div>
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