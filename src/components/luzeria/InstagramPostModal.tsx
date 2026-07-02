import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Play, Send, Share2, X, Bookmark, ExternalLink, Calendar, Pencil } from "lucide-react";
import { driveThumbnailQO, publicDriveThumbQO } from "@/lib/luzeria/queries";

/* ------------ Shared types ------------ */
export type IGModalFile = {
  id: string;
  driveFileId: string;
  mimeType: string | null;
  webViewUrl?: string | null;
};
export type IGModalFeedback = { id: string; authorName: string; text: string; createdAt: string };
export type IGModalItem = {
  id: string;
  type: "post" | "reel" | "outros" | "gravacao" | "roteiro" | "sistema";
  title: string;
  caption: string;
  dueDate: string | null;
  coverUrl: string | null;
  files: IGModalFile[];
  feedback: IGModalFeedback[];
};
export type IGModalClient = { name: string; color: string };

/** Either internal (auth thumbnail) or public (token-signed thumbnail). */
type ThumbMode =
  | { kind: "internal" }
  | { kind: "public"; token: string };

function isVideo(m: string | null | undefined) {
  return !!m && m.startsWith("video/");
}

function formatDateBR(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function FileThumb({ file, mode, fallback }: { file: IGModalFile; mode: ThumbMode; fallback?: string | null }) {
  // If file is a video and we don't have a custom cover, try drive thumbnail.
  const enabled = !fallback;
  const internalQ = useQuery({
    ...driveThumbnailQO(file.driveFileId, mode.kind === "internal" && enabled),
  });
  const publicQ = useQuery({
    ...publicDriveThumbQO(mode.kind === "public" ? mode.token : "", file.driveFileId),
    enabled: mode.kind === "public" && enabled && !!file.driveFileId,
  });
  const url = fallback ?? internalQ.data?.dataUrl ?? publicQ.data?.dataUrl ?? null;
  return url ? (
    <img src={url} alt="" className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full bg-neutral-100 animate-pulse" />
  );
}

export function InstagramPostModal({
  item,
  client,
  mode,
  canComment,
  onClose,
  onSubmitFeedback,
  initialAuthorName,
}: {
  item: IGModalItem;
  client: IGModalClient;
  mode: ThumbMode;
  canComment: boolean;
  onClose: () => void;
  onSubmitFeedback?: (author: string, text: string) => Promise<void> | void;
  initialAuthorName?: string;
}) {
  // Carousel state
  const [slide, setSlide] = useState(0);
  const slides = useMemo(() => {
    if (item.type === "reel") {
      // single slide showing cover (or first file thumb)
      const firstVideo = item.files.find((f) => isVideo(f.mimeType)) ?? item.files[0];
      return firstVideo ? [firstVideo] : [];
    }
    return item.files;
  }, [item]);
  const total = slides.length;
  const current = slides[slide];

  // Caption expand
  const [expanded, setExpanded] = useState(false);

  // Comment input
  const [author, setAuthor] = useState(initialAuthorName ?? "");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const isPublic = mode.kind === "public";
  const feedbackLabel = isPublic ? "Sugestões" : "Comentários";
  const detailsRef = useRef<HTMLDivElement>(null);

  // Scroll to composer buttons when opened (mobile public view)
  useEffect(() => {
    if (isPublic && composerOpen && detailsRef.current) {
      const el = detailsRef.current;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        });
      });
    }
  }, [isPublic, composerOpen]);


  // Lock scroll & ESC
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && total > 1) setSlide((s) => Math.max(0, s - 1));
      if (e.key === "ArrowRight" && total > 1) setSlide((s) => Math.min(total - 1, s + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, total]);

  async function submit() {
    if (!onSubmitFeedback) return;
    const a = author.trim(); const t = text.trim();
    if (!a || !t) return;
    setSubmitting(true);
    try { await onSubmitFeedback(a, t); setText(""); setComposerOpen(false); }
    finally { setSubmitting(false); }
  }

  const isReel = item.type === "reel";
  const reelVideoUrl = isReel ? current?.webViewUrl ?? null : null;

  const initial = client.name.trim().charAt(0).toUpperCase() || "L";

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-6"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full h-full md:h-auto md:max-h-[92vh] md:w-[920px] bg-white text-neutral-900 md:rounded-xl overflow-hidden flex flex-col md:flex-row shadow-2xl"
      >
        {/* Close (mobile floats over media) */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 size-9 grid place-items-center rounded-full bg-black/60 text-white hover:bg-black/80 md:bg-white/90 md:text-neutral-900 md:hover:bg-white"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        {/* LEFT: media (4:5) */}
        <div className="relative bg-black md:flex-[0_0_460px] w-full md:w-[460px]">
          <div className="relative w-full" style={{ aspectRatio: "4 / 5" }}>
            {current ? (
              <FileThumb
                file={current}
                mode={mode}
                fallback={isReel ? item.coverUrl : null}
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-white/60 text-sm">
                Sem mídia anexada
              </div>
            )}

            {/* Reel play overlay */}
            {isReel && reelVideoUrl && (
              <a
                href={reelVideoUrl}
                target="_blank" rel="noreferrer"
                className="absolute inset-0 grid place-items-center group"
              >
                <div className="size-16 rounded-full bg-black/60 backdrop-blur grid place-items-center group-hover:scale-110 transition">
                  <Play size={28} className="text-white fill-white ml-1" />
                </div>
              </a>
            )}

            {/* Carousel arrows */}
            {total > 1 && (
              <>
                {slide > 0 && (
                  <button
                    onClick={() => setSlide((s) => s - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-white/90 hover:bg-white grid place-items-center text-neutral-900 shadow"
                    aria-label="Anterior"
                  ><ChevronLeft size={18} /></button>
                )}
                {slide < total - 1 && (
                  <button
                    onClick={() => setSlide((s) => s + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-full bg-white/90 hover:bg-white grid place-items-center text-neutral-900 shadow"
                    aria-label="Próximo"
                  ><ChevronRight size={18} /></button>
                )}
                {/* Counter badge */}
                <div className="absolute right-3 top-3 text-[11px] font-semibold text-white bg-black/55 rounded-full px-2 py-0.5">
                  {slide + 1}/{total}
                </div>
                {/* Dots */}
                <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                  {slides.map((_, i) => (
                    <div
                      key={i}
                      className={`size-1.5 rounded-full transition ${i === slide ? "bg-white" : "bg-white/50"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT: details */}
        <div ref={detailsRef} className="flex-1 flex flex-col min-h-0 max-h-full md:max-h-[92vh] bg-white overflow-y-auto md:overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200">
            <div
              className="size-9 rounded-full grid place-items-center font-semibold text-white text-sm shrink-0"
              style={{ background: client.color }}
            >{initial}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-neutral-900 truncate">{client.name}</div>
              {item.dueDate && (
                <div className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5">
                  <Calendar size={11} /> Publicação prevista · {formatDateBR(item.dueDate)}
                </div>
              )}
            </div>
          </div>

          {/* Caption + feedback scroll area */}
          <div className="flex-1 md:overflow-y-auto px-4 py-3 text-sm">
            {/* Caption */}
            {item.caption ? (
              <div className="text-[14px] leading-relaxed text-neutral-800 whitespace-pre-wrap">
                <span className="font-semibold mr-1">{client.name}</span>
                {expanded || item.caption.length <= 220
                  ? item.caption
                  : (
                    <>
                      {item.caption.slice(0, 220)}…{" "}
                      <button onClick={() => setExpanded(true)} className="text-neutral-500 hover:text-neutral-800">mais</button>
                    </>
                  )}
              </div>
            ) : (
              <div className="text-[13px] text-neutral-400 italic">Sem legenda definida.</div>
            )}

            {isReel && reelVideoUrl && (
              <a
                href={reelVideoUrl} target="_blank" rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-neutral-700 hover:text-neutral-900"
              >
                <ExternalLink size={13} /> Assistir vídeo no Drive
              </a>
            )}

            {/* Feedback list */}
            <div className="mt-5 pt-4 border-t border-neutral-200">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-neutral-500 mb-3">
                {feedbackLabel} · {item.feedback.length}
              </div>
              {item.feedback.length === 0 ? (
                <div className="text-[13px] text-neutral-400">
                  {isPublic ? "Nenhuma sugestão ainda." : "Nenhum comentário ainda."}
                </div>
              ) : (
                <div className="space-y-3">
                  {item.feedback.map((f) => (
                    <div key={f.id} className="text-[13px] leading-snug">
                      <span className="font-semibold text-neutral-900 mr-1">{f.authorName}</span>
                      <span className="text-neutral-800">{f.text}</span>
                      <div className="text-[11px] text-neutral-400 mt-0.5">{relativeTime(f.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* IG-style action bar — somente no modo interno */}
          {!isPublic && (
            <div className="border-t border-neutral-200 px-4 pt-3 pb-1">
              <div className="flex items-center gap-4 text-neutral-800">
                <Heart size={22} />
                <MessageCircle size={22} />
                <Send size={22} />
                <div className="flex-1" />
                <Bookmark size={22} />
              </div>
              <div className="mt-2 text-[11px] text-neutral-500">
                {item.dueDate ? `Prevista para ${formatDateBR(item.dueDate)}` : "Sem data definida"}
              </div>
            </div>
          )}

          {/* Composer interno (equipe) */}
          {!isPublic && canComment && onSubmitFeedback && (
            <div className="border-t border-neutral-200 px-4 py-3 bg-white">
              {!initialAuthorName && (
                <input
                  type="text"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full text-[13px] px-3 py-2 mb-2 border border-neutral-200 rounded-md outline-none focus:border-neutral-400"
                  maxLength={60}
                />
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  placeholder="Adicione um comentário…"
                  className="flex-1 text-[14px] px-3 py-2 outline-none placeholder:text-neutral-400"
                  maxLength={1000}
                />
                <button
                  onClick={submit}
                  disabled={submitting || !author.trim() || !text.trim()}
                  className="text-[14px] font-semibold text-blue-500 disabled:text-blue-300"
                >Publicar</button>
              </div>
            </div>
          )}

          {/* Composer público: "Sugerir alteração" */}
          {isPublic && canComment && onSubmitFeedback && (
            <div className={`border-t border-neutral-200 px-4 py-4 ${composerOpen ? "pb-12" : "pb-10"} md:py-3 md:pb-6 bg-white`}>
              {!composerOpen ? (
                <button
                  onClick={() => setComposerOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 text-[15px] font-semibold py-4 min-h-[56px] rounded-md transition active:scale-[0.98]"
                  style={{ background: "#C8D44E", color: "#0D0D0D" }}
                >
                  <Pencil size={17} /> Sugerir alteração
                </button>
              ) : (
                <div>
                  {!initialAuthorName && (
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full text-[13px] px-3 py-2.5 mb-2 border border-neutral-200 rounded-md outline-none focus:border-neutral-400"
                      maxLength={60}
                    />
                  )}
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Descreva sua sugestão de alteração…"
                    rows={3}
                    className="w-full text-[14px] px-3 py-2.5 border border-neutral-200 rounded-md outline-none focus:border-neutral-400 resize-none"
                    maxLength={1000}
                  />
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => { setComposerOpen(false); setText(""); }}
                      className="text-[13px] font-medium text-neutral-500 hover:text-neutral-800 px-3 py-3"
                    >Cancelar</button>
                    <button
                      onClick={submit}
                      disabled={submitting || !author.trim() || !text.trim()}
                      className="text-[14px] font-semibold px-5 py-3 rounded-md transition disabled:opacity-50"
                      style={{ background: "#C8D44E", color: "#0D0D0D" }}
                    >{submitting ? "Enviando…" : "Enviar sugestão"}</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!canComment && (
            <div className="border-t border-neutral-200 px-4 py-3 text-[12px] text-neutral-500 bg-white">
              <Share2 size={12} className="inline mr-1.5" />
              Compartilhe o link com o cliente para receber comentários aqui.
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
