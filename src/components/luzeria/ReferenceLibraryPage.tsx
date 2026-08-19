import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookMarked, Plus, Search, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { clientsQO, referenceLibraryQO, useApi, useMe } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";

type LibraryItem = {
  id: string;
  clientId: string | null;
  clientName: string | null;
  clientColor: string | null;
  title: string;
  url: string | null;
  notes: string | null;
  tags: string[];
  createdBy: string | null;
  createdAt: string;
};

export function ReferenceLibraryPage() {
  const me = useMe().data;
  const { data: clients = [] } = useQuery(clientsQO());
  const { data: items = [], isLoading } = useQuery(referenceLibraryQO());
  const { upsertReferenceLibraryItem, deleteReferenceLibraryItem } = useApi();

  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all"); // "all" | "general" | clientId
  const [editing, setEditing] = useState<LibraryItem | null | "new">(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (items as LibraryItem[]).filter((it) => {
      if (clientFilter === "general" && it.clientId !== null) return false;
      if (clientFilter !== "all" && clientFilter !== "general" && it.clientId !== clientFilter) return false;
      if (!term) return true;
      return (
        it.title.toLowerCase().includes(term) ||
        (it.notes ?? "").toLowerCase().includes(term) ||
        it.tags.some((t) => t.toLowerCase().includes(term))
      );
    });
  }, [items, search, clientFilter]);

  async function handleDelete(id: string) {
    if (!(await requestConfirm("Remover essa referência?", { danger: true }))) return;
    deleteReferenceLibraryItem.mutate({ data: { id } });
  }

  return (
    <div className="px-5 md:px-10 py-8 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="text-white font-semibold text-lg inline-flex items-center gap-2">
          <BookMarked size={18} className="text-[rgb(var(--lz-brand-rgb))]" />
          Biblioteca de Referências
        </h1>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-2 rounded-md text-black"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
        >
          <Plus size={14} /> Nova referência
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, nota ou tag…"
            className="w-full bg-[#1A1A1A] border border-white/[0.08] rounded-md pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition-colors placeholder:text-white/30"
          />
        </div>
        <select
          value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}
          className="bg-[#1A1A1A] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
        >
          <option value="all">Todos os clientes</option>
          <option value="general">Geral</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="text-white/40 text-sm py-10 text-center">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="text-white/30 text-sm py-14 text-center">
          {items.length === 0 ? "Nenhuma referência salva ainda." : "Nada encontrado com esse filtro."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((it) => {
            const canEdit = !!me && (it.createdBy === me.id || me.role === "master" || me.role === "setor");
            return (
              <div key={it.id} className="rounded-xl bg-[#161616] border border-white/[0.07] p-4 flex flex-col gap-2.5 group/card">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
                    style={{
                      backgroundColor: it.clientId ? `${it.clientColor ?? "#888"}22` : "rgba(255,255,255,0.08)",
                      color: it.clientId ? (it.clientColor ?? "#fff") : "rgba(255,255,255,0.5)",
                    }}>
                    {it.clientId ? it.clientName : "Geral"}
                  </span>
                  {canEdit && (
                    <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition">
                      <button onClick={() => setEditing(it)} className="p-1 rounded text-white/40 hover:text-[rgb(var(--lz-brand-rgb))] hover:bg-white/5 transition">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleDelete(it.id)} className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="text-white text-sm font-semibold leading-snug">{it.title}</div>
                {it.url && (
                  <a href={it.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[rgb(var(--lz-brand-rgb))] hover:underline truncate">
                    <ExternalLink size={11} className="shrink-0" /> <span className="truncate">{it.url}</span>
                  </a>
                )}
                {it.notes && <p className="text-white/50 text-xs leading-relaxed line-clamp-3">{it.notes}</p>}
                {it.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-auto pt-1">
                    {it.tags.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50">#{t}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <ReferenceEditorModal
          item={editing === "new" ? null : editing}
          clients={clients}
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

function ReferenceEditorModal({
  item, clients, onClose, onSave,
}: {
  item: LibraryItem | null;
  clients: { id: string; name: string }[];
  onClose: () => void;
  onSave: (vals: { clientId: string | null; title: string; url?: string; notes?: string; tags?: string[] }) => void;
}) {
  const [clientId, setClientId] = useState<string>(item?.clientId ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [url, setUrl] = useState(item?.url ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [tagsInput, setTagsInput] = useState((item?.tags ?? []).join(", "));

  function submit() {
    if (!title.trim()) return;
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    onSave({ clientId: clientId || null, title: title.trim(), url: url.trim() || undefined, notes: notes.trim() || undefined, tags });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[#161616] border border-white/10 rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">{item ? "Editar referência" : "Nova referência"}</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white p-1 rounded hover:bg-white/5 transition">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Cliente</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]">
              <option value="">Geral (nenhum cliente específico)</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Título</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} autoFocus
              className="w-full bg-[#1A1A1A] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Link (Reels, TikTok, YouTube…)</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…"
              className="w-full bg-[#1A1A1A] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Notas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000}
              className="w-full bg-[#1A1A1A] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-none" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Tags (separadas por vírgula)</label>
            <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="ex: depoimento, humor, bastidor"
              className="w-full bg-[#1A1A1A] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
          </div>
        </div>
        <button
          onClick={submit} disabled={!title.trim()}
          className="w-full mt-5 font-bold uppercase text-sm px-5 py-3 rounded-md transition disabled:opacity-40"
          style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
