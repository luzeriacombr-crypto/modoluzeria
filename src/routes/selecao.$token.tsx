import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Heart, Loader2, X } from "lucide-react";
import { publicPhotoSelectionQO, publicPhotoThumbQO } from "@/lib/luzeria/queries";
import { submitPublicPhotoSelection, finalizePublicPhotoSelection } from "@/lib/luzeria/photo-selection.functions";

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
  const submitFn = useServerFn(submitPublicPhotoSelection);
  const finalizeFn = useServerFn(finalizePublicPhotoSelection);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (q.data) setSelected(new Set(q.data.selectedFileIds));
  }, [q.data?.selectionId]);

  const photosById = useMemo(() => new Map((q.data?.photos ?? []).map((p) => [p.id, p])), [q.data?.photos]);

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
  const isFinalized = status === "finalizada";
  const remainingDays = deadline ? daysUntil(deadline) : null;

  function toggle(id: string) {
    if (isFinalized) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const choices = [...selected].map((id) => ({
        driveFileId: id,
        fileName: photosById.get(id)?.name ?? id,
      }));
      await submitFn({ data: { token, choices } });
      setDirty(false);
      toast.success("Seleção salva.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar seleção.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFinalize() {
    if (selected.size === 0) { toast.error("Escolha ao menos uma foto antes de finalizar."); return; }
    const ok = window.confirm(
      `Finalizar com ${selected.size} foto${selected.size === 1 ? "" : "s"} escolhida${selected.size === 1 ? "" : "s"}? Depois disso não dá mais pra mudar.`,
    );
    if (!ok) return;
    setFinalizing(true);
    try {
      if (dirty) {
        const choices = [...selected].map((id) => ({
          driveFileId: id,
          fileName: photosById.get(id)?.name ?? id,
        }));
        await submitFn({ data: { token, choices } });
      }
      await finalizeFn({ data: { token } });
      setDirty(false);
      await q.refetch();
      toast.success("Seleção finalizada!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao finalizar seleção.");
    } finally {
      setFinalizing(false);
    }
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
          <ProtectedPhoto token={token} fileId={photos[0].id} className="absolute inset-0 w-full h-full object-cover" />
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
          {deadline && !isFinalized && (
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
        {!isFinalized && (
          <div className="text-white/40 text-[12px] mb-5 leading-snug">
            Clique nas fotos que você quer escolher. Você pode salvar e voltar depois — quando terminar, clique em "Finalizar seleção".
          </div>
        )}

        {isFinalized ? (
          <div className="rounded-xl p-8 text-center mb-8" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="size-12 rounded-full mx-auto mb-3 grid place-items-center" style={{ background: "rgba(34,197,94,0.15)" }}>
              <Check size={22} color="rgb(34,197,94)" />
            </div>
            <div className="text-white font-bold text-base mb-1">Seleção finalizada!</div>
            <div className="text-white/50 text-sm">
              {selected.size} foto{selected.size === 1 ? "" : "s"} escolhida{selected.size === 1 ? "" : "s"}. Sua agência já foi avisada.
            </div>
          </div>
        ) : photos.length === 0 ? (
          <div className="rounded-xl py-14 text-center text-white/40 text-sm" style={{ background: "#1C1C1C" }}>
            Nenhuma foto encontrada nessa pasta ainda.
          </div>
        ) : null}

        {photos.length > 0 && (
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
                  <ProtectedPhoto token={token} fileId={p.id} className="w-full h-auto block" />
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

      {lightboxIndex != null && photos[lightboxIndex] && (
        <Lightbox
          token={token}
          photos={photos}
          index={lightboxIndex}
          selected={selected}
          canSelect={!isFinalized}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onToggle={toggle}
        />
      )}

      {!isFinalized && photos.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3" style={{ background: "rgba(13,13,13,0.95)", borderTop: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}>
          <div className="max-w-[1200px] mx-auto flex items-center gap-3">
            <span className="text-white text-sm font-semibold flex-1">
              {selected.size} selecionada{selected.size === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || finalizing || !dirty}
              className="px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wide transition disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.08)", color: "white" }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : "Salvar seleção"}
            </button>
            <button
              type="button"
              onClick={handleFinalize}
              disabled={finalizing || saving}
              className="px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wide transition disabled:opacity-50"
              style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
            >
              {finalizing ? "Finalizando…" : "Finalizar seleção"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Única forma de uma foto aparecer nessa página: os bytes já vêm do
 * servidor com a marca d'água da agência queimada (getPublicPhotoThumbnail)
 * — nunca a URL crua do Drive. `draggable`/clique-direito bloqueados como
 * dificultador extra (não é proteção de verdade, só tira o caminho fácil). */
function ProtectedPhoto({ token, fileId, className }: { token: string; fileId: string; className?: string }) {
  const { data, isLoading } = useQuery(publicPhotoThumbQO(token, fileId));
  if (isLoading || !data?.dataUrl) {
    return <div className={`${className ?? ""} animate-pulse aspect-square`} style={{ background: "#1C1C1C" }} />;
  }
  return (
    <img
      src={data.dataUrl}
      alt=""
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      className={className}
    />
  );
}

function Lightbox({ token, photos, index, selected, canSelect, onClose, onNavigate, onToggle }: {
  token: string;
  photos: Array<{ id: string; name: string }>;
  index: number;
  selected: Set<string>;
  canSelect: boolean;
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
        {canSelect ? (
          <button
            type="button"
            onClick={() => onToggle(photo.id)}
            className="inline-flex items-center gap-2 text-sm font-medium transition"
            style={{ color: isSelected ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.8)" }}
          >
            <Heart size={18} fill={isSelected ? "currentColor" : "none"} /> {isSelected ? "Selecionada" : "Selecionar"}
          </button>
        ) : <span />}
        <button type="button" onClick={onClose} className="text-white/70 hover:text-white transition" aria-label="Fechar">
          <X size={22} />
        </button>
      </div>

      {/* Imagem */}
      <div className="flex-1 relative grid place-items-center px-4 sm:px-16 min-h-0">
        <ProtectedPhoto token={token} fileId={photo.id} className="max-w-full max-h-full object-contain" />
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
