import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Check, Loader2 } from "lucide-react";
import { publicPhotoSelectionQO } from "@/lib/luzeria/queries";
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

function PublicPhotoSelectionPage() {
  const { token } = Route.useParams();
  const q = useQuery(publicPhotoSelectionQO(token));
  const submitFn = useServerFn(submitPublicPhotoSelection);
  const finalizeFn = useServerFn(finalizePublicPhotoSelection);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [dirty, setDirty] = useState(false);

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

  return (
    <div className="min-h-screen pb-28" style={{ background: "#0D0D0D" }}>
      <Toaster theme="dark" position="bottom-right" />
      <div className="px-4 pt-8 pb-6 max-w-[880px] mx-auto">
        <div className="text-white text-xl font-bold leading-tight">{title}</div>
        <div className="text-white/50 text-[13px] mt-0.5">
          {clientName ? `${clientName} · ` : ""}Seleção de fotos
        </div>
        {deadline && (
          <div className="text-white/40 text-[12px] mt-2">
            Prazo: {new Date(`${deadline}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </div>
        )}
        {!isFinalized && (
          <div className="text-white/40 text-[12px] mt-2 leading-snug">
            Clique nas fotos que você quer escolher. Você pode salvar e voltar depois — quando terminar, clique em "Finalizar seleção".
          </div>
        )}
      </div>

      <div className="max-w-[880px] mx-auto px-4">
        {isFinalized ? (
          <div className="rounded-xl p-8 text-center" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" }}>
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
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
            {photos.map((p) => {
              const isSelected = selected.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="relative aspect-square overflow-hidden rounded-md"
                  style={{ background: "#1C1C1C" }}
                >
                  {p.thumbnailUrl ? (
                    <img src={p.thumbnailUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center text-white/20 text-[10px]">sem prévia</div>
                  )}
                  <div
                    className="absolute inset-0 transition"
                    style={{ background: isSelected ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0)" }}
                  />
                  <div
                    className="absolute top-1.5 right-1.5 size-6 rounded-full grid place-items-center border-2 transition"
                    style={{
                      background: isSelected ? "rgb(var(--lz-brand-rgb))" : "rgba(0,0,0,0.4)",
                      borderColor: isSelected ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {isSelected && <Check size={14} color="#0D0D0D" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!isFinalized && photos.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 px-4 py-3" style={{ background: "rgba(13,13,13,0.95)", borderTop: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}>
          <div className="max-w-[880px] mx-auto flex items-center gap-3">
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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center px-6" style={{ background: "#0D0D0D" }}>
      <div className="max-w-md w-full">{children}</div>
    </div>
  );
}
