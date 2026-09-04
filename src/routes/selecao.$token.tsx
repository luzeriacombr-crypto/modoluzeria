import { createFileRoute } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Heart, Lock, X } from "lucide-react";
import { publicPhotoSelectionQO, publicPhotoThumbsBatchQO } from "@/lib/luzeria/queries";
import { submitPhotoSelectionResponse } from "@/lib/luzeria/photo-selection.functions";

/** Fotos são buscadas em lotes (não uma de cada vez) — ver o comentário em
 * getPublicPhotoThumbnails no backend: cada lote gasta só 1 token do Drive,
 * então um lote pequeno demais volta a bater no mesmo limite que quebrava
 * galerias grandes. */
const THUMB_BATCH_SIZE = 10;

/** Busca as miniaturas de todas as fotos em lotes de THUMB_BATCH_SIZE e
 * devolve um mapa fileId -> dataUrl (undefined enquanto carrega, null se
 * essa foto específica falhou). */
function usePhotoThumbnails(token: string, photoIds: string[]) {
  const chunks = useMemo(() => {
    const out: string[][] = [];
    for (let i = 0; i < photoIds.length; i += THUMB_BATCH_SIZE) out.push(photoIds.slice(i, i + THUMB_BATCH_SIZE));
    return out;
  }, [photoIds.join(",")]);

  const results = useQueries({
    queries: chunks.map((ids) => publicPhotoThumbsBatchQO(token, ids)),
  });

  return useMemo(() => {
    const map = new Map<string, string | null | undefined>();
    for (const id of photoIds) map.set(id, undefined);
    for (const r of results) {
      if (r.data) for (const [id, url] of Object.entries(r.data)) map.set(id, url);
    }
    return map;
  }, [results.map((r) => r.dataUpdatedAt).join(","), photoIds.join(",")]);
}

export const Route = createFileRoute("/selecao/$token")({
  component: PublicPhotoSelectionPage,
  loader: async ({ params, context }) => {
    try {
      return await (context as any).queryClient.fetchQuery(publicPhotoSelectionQO(params.token));
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => {
    const title = loaderData?.title
      ? `Seleção de fotos — ${loaderData.title}`
      : "Seleção de fotos";
    return { meta: [{ title }, { name: "robots", content: "noindex" }] };
  },
});

function daysUntil(dateOnly: string): number {
  const target = new Date(`${dateOnly}T00:00:00`).getTime();
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.ceil((target - todayMidnight) / 86_400_000);
}

function formatFullDate(dateOnly: string) {
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function PublicPhotoSelectionPage() {
  const { token } = Route.useParams();
  const q = useQuery(publicPhotoSelectionQO(token));
  const submitFn = useServerFn(submitPhotoSelectionResponse);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedAs, setSubmittedAs] = useState<string | null>(null);

  // Hooks não podem vir depois de um return condicional — calculado com
  // array vazio até q.data chegar, sem efeito no resultado.
  const photoIds = useMemo(() => (q.data?.photos ?? []).map((p) => p.id), [q.data?.photos]);
  const thumbs = usePhotoThumbnails(token, photoIds);

  if (q.isLoading) {
    return <Shell><div className="text-white/60 text-sm">Carregando…</div></Shell>;
  }
  if (!q.data) {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-white text-2xl font-bold mb-2">Link inválido</div>
          <div className="text-white/50 text-sm">Este link não existe ou foi removido. Solicite um novo à sua agência.</div>
        </div>
      </Shell>
    );
  }

  const { title, clientName, status, deadline, photos } = q.data;
  const isClosed = status === "encerrada";
  const remainingDays = deadline ? daysUntil(deadline) : null;
  const photosById = new Map(photos.map((p) => [p.id, p]));

  function toggle(id: string) {
    if (isClosed || submittedAs) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openNamePrompt() {
    if (selected.size === 0) { toast.error("Escolha ao menos uma foto antes de finalizar."); return; }
    setShowNamePrompt(true);
  }

  async function handleConfirmName(name: string) {
    setSubmitting(true);
    try {
      const choices = [...selected].map((id) => ({
        driveFileId: id,
        fileName: photosById.get(id)?.name ?? id,
      }));
      await submitFn({ data: { token, respondentName: name, choices } });
      setShowNamePrompt(false);
      setSubmittedAs(name);
      toast.success("Seleção enviada!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar seleção.");
    } finally {
      setSubmitting(false);
    }
  }

  function selectAsSomeoneElse() {
    setSubmittedAs(null);
    setSelected(new Set());
    document.getElementById("galeria")?.scrollIntoView({ behavior: "smooth" });
  }

  function scrollToGallery() {
    document.getElementById("galeria")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="min-h-screen pb-28 select-none" style={{ background: "#0D0D0D" }}>
      <Toaster theme="dark" position="bottom-right" />

      {/* Capa cheia */}
      <div className="relative w-full h-[100vh] min-h-[520px] flex items-end justify-center overflow-hidden">
        {photos[0] ? (
          <ProtectedPhoto dataUrl={thumbs.get(photos[0].id)} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #1C1C1C, #0D0D0D)" }} />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0.35) 100%)" }} />
        <div className="relative z-10 flex flex-col items-center gap-6 pb-16 px-6 text-center">
          <h1
            className="text-white text-4xl sm:text-6xl leading-tight"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            {title}
          </h1>
          <button
            type="button"
            onClick={scrollToGallery}
            className="size-10 rounded-full grid place-items-center text-white/80 hover:text-white border border-white/30 hover:border-white/60 transition animate-bounce"
            aria-label="Ver fotos"
          >
            <ChevronDown size={18} />
          </button>
        </div>
      </div>

      {/* Barra de info */}
      <div className="border-b border-white/8 sticky top-0 z-30" style={{ background: "rgba(13,13,13,0.92)", backdropFilter: "blur(8px)" }}>
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-white font-semibold" style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20 }}>
              {title}
            </div>
            <div className="text-white/40 text-[11px] mt-0.5">
              {clientName ? `${clientName} · ` : ""}{photos.length} foto{photos.length === 1 ? "" : "s"}
            </div>
          </div>
          {deadline && !isClosed && (
            <div className="text-right">
              <div className="text-white/40 text-[10px] uppercase tracking-wider">Prazo de seleção</div>
              <div className="text-white text-[12px] font-semibold">
                {formatFullDate(deadline)}
                {remainingDays != null && (
                  <span className="text-white/40 font-normal"> {remainingDays > 0 ? `(restam ${remainingDays} dia${remainingDays === 1 ? "" : "s"})` : remainingDays === 0 ? "(é hoje)" : "(prazo vencido)"}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div id="galeria" className="max-w-[1200px] mx-auto px-4 sm:px-8 pt-6">
        {!isClosed && !submittedAs && (
          <div className="text-white/40 text-[12px] mb-5 leading-snug">
            Clique nas fotos que você quer escolher e depois clique em "Finalizar seleção" — você vai colocar seu nome pra sua agência saber quem escolheu.
          </div>
        )}

        {submittedAs ? (
          <div className="rounded-xl p-8 text-center mb-8" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="size-12 rounded-full mx-auto mb-3 grid place-items-center" style={{ background: "rgba(34,197,94,0.15)" }}>
              <Check size={22} color="rgb(34,197,94)" />
            </div>
            <div className="text-white font-bold text-base mb-1">Obrigado, {submittedAs}!</div>
            <div className="text-white/50 text-sm mb-5">Sua seleção foi registrada. Sua agência já foi avisada.</div>
            {!isClosed && (
              <button
                type="button"
                onClick={selectAsSomeoneElse}
                className="text-[12px] font-semibold text-white/50 hover:text-white underline underline-offset-2 transition"
              >
                Selecionar como outra pessoa
              </button>
            )}
          </div>
        ) : isClosed ? (
          <div className="rounded-xl p-8 text-center mb-8" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="size-12 rounded-full mx-auto mb-3 grid place-items-center" style={{ background: "rgba(148,163,184,0.15)" }}>
              <Lock size={20} color="rgb(148,163,184)" />
            </div>
            <div className="text-white font-bold text-base mb-1">Essa seleção foi encerrada</div>
            <div className="text-white/50 text-sm">Sua agência não está mais recebendo respostas por esse link.</div>
          </div>
        ) : photos.length === 0 ? (
          <div className="rounded-xl py-14 text-center text-white/40 text-sm" style={{ background: "#1C1C1C" }}>
            Nenhuma foto encontrada nessa pasta ainda.
          </div>
        ) : null}

        {!submittedAs && !isClosed && photos.length > 0 && (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-2">
            {photos.map((p, idx) => {
              const isSelected = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLightboxIndex(idx)}
                  className="relative block w-full mb-2 overflow-hidden rounded-md break-inside-avoid"
                  style={{ background: "#1C1C1C" }}
                >
                  <ProtectedPhoto dataUrl={thumbs.get(p.id)} className="w-full h-auto block" />
                  {isSelected && (
                    <div
                      className="absolute top-1.5 right-1.5 size-6 rounded-full grid place-items-center border-2"
                      style={{ background: "rgb(var(--lz-brand-rgb))", borderColor: "rgb(var(--lz-brand-rgb))" }}
                    >
                      <Check size={14} color="#0D0D0D" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {lightboxIndex != null && photos[lightboxIndex] && !submittedAs && !isClosed && (
        <Lightbox
          photos={photos}
          thumbs={thumbs}
          index={lightboxIndex}
          selected={selected}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onToggle={toggle}
        />
      )}

      {!submittedAs && !isClosed && photos.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3" style={{ background: "rgba(13,13,13,0.95)", borderTop: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}>
          <div className="max-w-[1200px] mx-auto flex items-center gap-3">
            <span className="text-white text-sm font-semibold flex-1">
              {selected.size} selecionada{selected.size === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={openNamePrompt}
              className="px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wide transition"
              style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
            >
              Finalizar seleção
            </button>
          </div>
        </div>
      )}

      {showNamePrompt && (
        <NamePromptModal
          count={selected.size}
          submitting={submitting}
          onCancel={() => setShowNamePrompt(false)}
          onConfirm={handleConfirmName}
        />
      )}
    </div>
  );
}

function NamePromptModal({ count, submitting, onCancel, onConfirm }: {
  count: number; submitting: boolean; onCancel: () => void; onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState("");

  function submit() {
    if (!name.trim()) { toast.error("Digita seu nome pra continuar."); return; }
    onConfirm(name.trim());
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onCancel}>
      <div
        className="w-full max-w-sm rounded-xl p-5"
        style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-white text-base font-bold mb-1">Quase lá!</div>
        <div className="text-white/50 text-xs mb-4">
          {count} foto{count === 1 ? "" : "s"} selecionada{count === 1 ? "" : "s"}. Coloca seu nome pra sua agência saber quem escolheu.
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="Seu nome"
          maxLength={80}
          className="w-full rounded-md px-3 py-2.5 text-sm text-white outline-none mb-4"
          style={{ background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.12)" }}
        />
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel} className="text-xs text-white/50 hover:text-white px-3 py-2">Cancelar</button>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-4 py-2 rounded-md text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
          >
            {submitting ? "Enviando…" : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Única forma de uma foto aparecer nessa página: os bytes já vêm do
 * servidor com a marca d'água da agência queimada (getPublicPhotoThumbnails,
 * em lote — ver comentário lá) — nunca a URL crua do Drive.
 * `draggable`/clique-direito bloqueados como dificultador extra (não é
 * proteção de verdade, só tira o caminho fácil). */
function ProtectedPhoto({ dataUrl, className }: { dataUrl: string | null | undefined; className?: string }) {
  if (!dataUrl) {
    return <div className={`${className ?? ""} animate-pulse aspect-square`} style={{ background: "#1C1C1C" }} />;
  }
  return (
    <img
      src={dataUrl}
      alt=""
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      className={className}
    />
  );
}

function Lightbox({ photos, thumbs, index, selected, onClose, onNavigate, onToggle }: {
  photos: Array<{ id: string; name: string }>;
  thumbs: Map<string, string | null | undefined>;
  index: number;
  selected: Set<string>;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onToggle: (id: string) => void;
}) {
  const photo = photos[index];
  const isSelected = selected.has(photo.id);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onNavigate(Math.min(index + 1, photos.length - 1));
      else if (e.key === "ArrowLeft") onNavigate(Math.max(index - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onClose, onNavigate]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col" style={{ background: "#0D0D0D" }}>
      {/* Topo */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 shrink-0">
        <button
          type="button"
          onClick={() => onToggle(photo.id)}
          className="inline-flex items-center gap-2 text-sm font-medium transition"
          style={{ color: isSelected ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.8)" }}
        >
          <Heart size={18} fill={isSelected ? "currentColor" : "none"} /> {isSelected ? "Selecionada" : "Selecionar"}
        </button>
        <button type="button" onClick={onClose} className="text-white/70 hover:text-white transition" aria-label="Fechar">
          <X size={22} />
        </button>
      </div>

      {/* Imagem */}
      <div className="flex-1 relative grid place-items-center px-4 sm:px-16 min-h-0">
        <ProtectedPhoto dataUrl={thumbs.get(photo.id)} className="max-w-full max-h-full object-contain" />
        {index > 0 && (
          <button
            type="button"
            onClick={() => onNavigate(index - 1)}
            className="absolute left-1 sm:left-3 top-1/2 -translate-y-1/2 size-10 rounded-full grid place-items-center text-white/70 hover:text-white hover:bg-white/10 transition"
            aria-label="Anterior"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        {index < photos.length - 1 && (
          <button
            type="button"
            onClick={() => onNavigate(index + 1)}
            className="absolute right-1 sm:right-3 top-1/2 -translate-y-1/2 size-10 rounded-full grid place-items-center text-white/70 hover:text-white hover:bg-white/10 transition"
            aria-label="Próxima"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {/* Rodapé */}
      <div className="text-center py-3 text-white/40 text-[11px] shrink-0">{photo.name}</div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center px-6" style={{ background: "#0D0D0D" }}>
      <div className="max-w-md w-full">{children}</div>
    </div>
  );
}
