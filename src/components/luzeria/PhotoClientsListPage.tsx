import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Images, Plus, Trash2 } from "lucide-react";
import { photoClientsQO, useApi } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { Modal } from "./Modals";

/** Página inicial da área independente "Seleção de Fotos": lista os
 * clientes de fotografia (entidade própria, sem nada de posts/reels) da
 * agência; clicar num deles vai pra `/selecao-de-fotos/$clientId`, que
 * gerencia as seleções dele via `PhotoSelectionsPanel`. */
export function PhotoClientsListPage() {
  const { data: photoClients = [], isLoading } = useQuery(photoClientsQO());
  const { deletePhotoClient } = useApi();
  const [showNew, setShowNew] = useState(false);

  async function handleDelete(id: string, name: string) {
    if (!(await requestConfirm(`Remover "${name}"? Todas as seleções desse cliente também somem.`, { danger: true }))) return;
    deletePhotoClient.mutate({ data: { id } });
  }

  return (
    <div className="px-5 md:px-10 py-8 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="text-foreground font-semibold text-lg inline-flex items-center gap-2">
          <Images size={18} className="text-[var(--lz-accent-ink)]" />
          Seleção de Fotos
        </h1>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-2 rounded-md text-black"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
        >
          <Plus size={14} /> Novo cliente
        </button>
      </div>

      <p className="text-foreground/40 text-xs leading-relaxed mb-5 max-w-xl">
        Área independente pra clientes de fotografia escolherem suas fotos
        direto de uma pasta do Google Drive, sem precisar de login. Cadastre
        o cliente, entre nele e crie um link de seleção.
      </p>

      {isLoading ? (
        <div className="text-foreground/40 text-sm py-10 text-center">Carregando…</div>
      ) : photoClients.length === 0 ? (
        <div className="border border-dashed border-foreground/10 rounded-lg p-14 text-center text-foreground/30 text-sm">
          Nenhum cliente de fotografia cadastrado ainda.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {photoClients.map((c) => (
            <div key={c.id} className="relative group">
              <Link
                to="/selecao-de-fotos/$clientId"
                params={{ clientId: c.id }}
                className="rounded-xl bg-card border border-foreground/7 p-5 flex flex-col items-center gap-2 text-center hover:border-[rgb(var(--lz-brand-rgb))]/40 transition w-full"
              >
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: "color-mix(in srgb, var(--foreground) 8%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
                >
                  <Images size={20} />
                </div>
                <div className="text-foreground text-sm font-semibold leading-snug truncate w-full">{c.name}</div>
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); handleDelete(c.id, c.name); }}
                className="absolute top-2 right-2 p-1.5 rounded text-foreground/30 hover:text-red-400 hover:bg-foreground/5 transition opacity-0 group-hover:opacity-100"
                title="Remover cliente"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showNew && <NewPhotoClientModal onClose={() => setShowNew(false)} />}
    </div>
  );
}

function NewPhotoClientModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const { createPhotoClient } = useApi();

  function submit() {
    if (!name.trim()) { toast.error("Dá um nome pra esse cliente."); return; }
    createPhotoClient.mutate({ data: { name: name.trim() } }, {
      onSuccess: () => { toast.success(`Cliente "${name.trim()}" criado.`); onClose(); },
      onError: (e: any) => toast.error(e?.message ?? "Não consegui criar o cliente. Tenta de novo?"),
    });
  }

  return (
    <Modal open onClose={onClose} title="Novo cliente de fotografia">
      <label className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Nome</label>
      <input
        value={name} onChange={(e) => setName(e.target.value)} autoFocus
        placeholder="Ex: Andreia Rodrigues"
        className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))]"
      />
      <div className="flex items-center justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-3 py-2 text-sm text-foreground/60 hover:text-foreground">Cancelar</button>
        <button
          disabled={!name.trim() || createPhotoClient.isPending}
          onClick={submit}
          className="px-4 py-2 rounded-md text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          Criar
        </button>
      </div>
    </Modal>
  );
}
