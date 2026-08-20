import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { clientsQO, referenceLibraryQO, useApi } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { ReferenceBlockCards, ReferenceEditorModal, type LibraryItem } from "./ReferenceLibraryPage";

/** Same data/mutations as the standalone Biblioteca page, scoped to one
 * client — lives as a tab in the Ficha do Cliente so everything about that
 * client is in one place, without losing the standalone page (still useful
 * for "Geral" references and browsing across clients). */
export function ClientReferenceLibraryTab({ clientId }: { clientId: string }) {
  const { data: clients = [] } = useQuery(clientsQO());
  const { data: items = [], isLoading } = useQuery(referenceLibraryQO());
  const { upsertReferenceLibraryItem, deleteReferenceLibraryItem } = useApi();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<LibraryItem | null | "new">(null);

  const blocks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (items as LibraryItem[]).filter((it) => {
      if (it.clientId !== clientId) return false;
      if (!term) return true;
      return (
        it.title.toLowerCase().includes(term) ||
        (it.notes ?? "").toLowerCase().includes(term) ||
        it.tags.some((t) => t.toLowerCase().includes(term)) ||
        it.links.some((l) => (l.label ?? "").toLowerCase().includes(term) || l.url.toLowerCase().includes(term))
      );
    });
  }, [items, clientId, search]);

  async function handleDelete(id: string) {
    if (!(await requestConfirm("Remover esse bloco de referências?", { danger: true }))) return;
    deleteReferenceLibraryItem.mutate({ data: { id } });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="w-full bg-[#1A1A1A] border border-white/[0.08] rounded-md pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition-colors placeholder:text-white/30"
          />
        </div>
        <button
          onClick={() => setEditing("new")}
          className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-2 rounded-md text-black"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
        >
          <Plus size={14} /> Nova referência
        </button>
      </div>

      {isLoading ? (
        <div className="text-white/40 text-sm py-10 text-center">Carregando…</div>
      ) : (
        <ReferenceBlockCards
          blocks={blocks}
          emptyMessage={search.trim() ? "Nada encontrado com esse filtro." : "Nenhuma referência salva pra esse cliente ainda."}
          onEdit={setEditing}
          onDelete={handleDelete}
        />
      )}

      {editing && (
        <ReferenceEditorModal
          item={editing === "new" ? null : editing}
          clients={clients}
          defaultClientId={editing === "new" ? clientId : editing.clientId}
          onClose={() => setEditing(null)}
          onSave={(vals) => {
            upsertReferenceLibraryItem.mutate({
              data: { id: editing === "new" ? undefined : editing.id, ...vals },
            });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
