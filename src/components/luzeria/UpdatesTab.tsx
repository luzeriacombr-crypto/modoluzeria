import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Trash2, ArrowRight, Megaphone } from "lucide-react";
import { platformUpdatesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";

export function UpdatesTab() {
  const me = useMe().data;
  const api = useApi();
  const { data: updates = [] } = useQuery(platformUpdatesQO());
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);

  function goTo(path: string) {
    if (path.startsWith("/")) {
      navigate({ to: path as any });
    } else {
      window.location.href = path;
    }
  }

  return (
    <div className="max-w-2xl">
      {me?.isPlatformAdmin && (
        <div className="flex justify-end mb-5">
          <button onClick={() => setAdding(true)}
            className="lz-btn-primary text-xs px-4 py-2.5 rounded-md inline-flex items-center gap-2">
            <Plus size={14} /> Nova atualização
          </button>
        </div>
      )}

      {adding && <NewUpdateForm onClose={() => setAdding(false)} />}

      {updates.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-lg p-16 text-center">
          <Megaphone size={22} className="mx-auto mb-3 text-white/20" />
          <p className="text-white/50 text-sm">Nenhuma atualização publicada ainda.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {updates.map((u) => (
            <div key={u.id} className="bg-[#1C1C1C] rounded-lg p-5 group relative">
              <div className="text-[11px] text-white/40 mb-1.5">
                {new Date(u.publishedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5">{u.title}</h3>
              <p className="text-sm text-white/60 leading-relaxed mb-3">{u.description}</p>
              {u.linkPath && (
                <button
                  onClick={() => goTo(u.linkPath!)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition"
                  style={{ background: "rgba(var(--lz-brand-light-rgb),0.14)", color: "rgb(var(--lz-brand-rgb))" }}
                >
                  {u.linkLabel || "Ver atualização"} <ArrowRight size={12} />
                </button>
              )}
              {me?.isPlatformAdmin && (
                <button
                  onClick={async () => { if (await requestConfirm(`Excluir a atualização "${u.title}"?`, { danger: true })) api.deletePlatformUpdate.mutate({ data: { id: u.id } }); }}
                  className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/5 transition"
                ><Trash2 size={13} /></button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewUpdateForm({ onClose }: { onClose: () => void }) {
  const api = useApi();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [linkPath, setLinkPath] = useState("");
  const [linkLabel, setLinkLabel] = useState("");

  function submit() {
    if (!title.trim() || !description.trim()) { toast.error("Preencha título e descrição."); return; }
    api.createPlatformUpdate.mutate({
      data: {
        title: title.trim(),
        description: description.trim(),
        linkPath: linkPath.trim() || undefined,
        linkLabel: linkLabel.trim() || undefined,
      },
    }, {
      onSuccess: () => { toast.success("Atualização publicada."); onClose(); },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao publicar"),
    });
  }

  return (
    <div className="bg-[#1C1C1C] rounded-lg p-5 mb-5 space-y-3">
      <input
        value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Título (ex.: Novo checklist de onboarding)"
        className="w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
      />
      <textarea
        value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição rápida do que melhorou"
        rows={3}
        className="w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-none"
      />
      <div className="flex gap-2">
        <input
          value={linkPath} onChange={(e) => setLinkPath(e.target.value)}
          placeholder="Caminho no app (opcional, ex.: /configuracoes?tab=drive)"
          className="flex-1 bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-xs text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
        />
        <input
          value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)}
          placeholder="Texto do botão (opcional)"
          className="w-48 bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-xs text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="text-xs text-white/50 hover:text-white px-3 py-2">Cancelar</button>
        <button
          onClick={submit}
          disabled={api.createPlatformUpdate.isPending}
          className="lz-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-50"
        >Publicar</button>
      </div>
    </div>
  );
}
