import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookMarked, Plus, Search, ExternalLink, Pencil, Trash2, X, ChevronLeft, Folder, Link2 } from "lucide-react";
import { clientsQO, referenceLibraryQO, useApi, useMe } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";

const GENERAL_KEY = "__general__";

type LibraryLink = { label: string | null; url: string };

type LibraryItem = {
  id: string;
  clientId: string | null;
  clientName: string | null;
  clientColor: string | null;
  title: string;
  links: LibraryLink[];
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

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null); // null = grid de pastas
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<LibraryItem | null | "new">(null);

  const folders = useMemo(() => {
    const map = new Map<string, { key: string; clientId: string | null; name: string; color: string | null; count: number }>();
    for (const it of items as LibraryItem[]) {
      const key = it.clientId ?? GENERAL_KEY;
      if (!map.has(key)) {
        map.set(key, {
          key, clientId: it.clientId,
          name: it.clientId ? (it.clientName ?? "Cliente") : "Geral",
          color: it.clientColor, count: 0,
        });
      }
      map.get(key)!.count++;
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.key === GENERAL_KEY) return -1;
      if (b.key === GENERAL_KEY) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [items]);

  const currentFolder = folders.find((f) => f.key === selectedFolder) ?? null;

  const blocksInFolder = useMemo(() => {
    if (!selectedFolder) return [];
    const term = search.trim().toLowerCase();
    return (items as LibraryItem[]).filter((it) => {
      const key = it.clientId ?? GENERAL_KEY;
      if (key !== selectedFolder) return false;
      if (!term) return true;
      return (
        it.title.toLowerCase().includes(term) ||
        (it.notes ?? "").toLowerCase().includes(term) ||
        it.tags.some((t) => t.toLowerCase().includes(term)) ||
        it.links.some((l) => (l.label ?? "").toLowerCase().includes(term) || l.url.toLowerCase().includes(term))
      );
    });
  }, [items, selectedFolder, search]);

  async function handleDelete(id: string) {
    if (!(await requestConfirm("Remover esse bloco de referências?", { danger: true }))) return;
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

      {isLoading ? (
        <div className="text-white/40 text-sm py-10 text-center">Carregando…</div>
      ) : !selectedFolder ? (
        folders.length === 0 ? (
          <EmptyState onCreate={() => setEditing("new")} />
        ) : (
          <>
          <p className="text-white/40 text-xs leading-relaxed mb-5 max-w-xl">
            Guarde links de referência (Reels, TikTok, YouTube…) por cliente ou geral, pra puxar
            na hora de escrever um roteiro novo. Clique numa pasta pra ver o que já foi salvo, ou
            use "Nova referência" acima pra criar uma direto, escolhendo o cliente no formulário.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {folders.map((f) => (
              <button
                key={f.key}
                onClick={() => setSelectedFolder(f.key)}
                className="rounded-xl bg-[#161616] border border-white/[0.07] p-5 flex flex-col items-center gap-2 text-center hover:border-[rgb(var(--lz-brand-rgb))]/40 transition"
              >
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: f.clientId ? `${f.color ?? "#888"}22` : "rgba(255,255,255,0.08)",
                    color: f.clientId ? (f.color ?? "#fff") : "rgba(255,255,255,0.6)",
                  }}
                >
                  <Folder size={20} />
                </div>
                <div className="text-white text-sm font-semibold leading-snug truncate w-full">{f.name}</div>
                <div className="text-white/40 text-xs">{f.count} {f.count === 1 ? "referência" : "referências"}</div>
              </button>
            ))}
          </div>
          </>
        )
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <button
              onClick={() => { setSelectedFolder(null); setSearch(""); }}
              className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white transition px-2 py-2"
            >
              <ChevronLeft size={14} /> Todas as pastas
            </button>
            <span
              className="text-xs font-bold uppercase px-2 py-1 rounded"
              style={{
                backgroundColor: currentFolder?.clientId ? `${currentFolder.color ?? "#888"}22` : "rgba(255,255,255,0.08)",
                color: currentFolder?.clientId ? (currentFolder.color ?? "#fff") : "rgba(255,255,255,0.6)",
              }}
            >
              {currentFolder?.name}
            </span>
            <div className="relative flex-1 min-w-[180px] max-w-sm ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar…"
                className="w-full bg-[#1A1A1A] border border-white/[0.08] rounded-md pl-9 pr-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition-colors placeholder:text-white/30"
              />
            </div>
          </div>

          {blocksInFolder.length === 0 ? (
            <div className="text-white/30 text-sm py-14 text-center">
              {search.trim() ? "Nada encontrado com esse filtro." : "Nenhuma referência salva aqui ainda."}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {blocksInFolder.map((it) => {
                const canEdit = !!me && (it.createdBy === me.id || me.role === "master" || me.role === "setor");
                return (
                  <div key={it.id} className="rounded-xl bg-[#161616] border border-white/[0.07] p-4 flex flex-col gap-2.5 group/card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-white text-sm font-semibold leading-snug">{it.title}</div>
                      {canEdit && (
                        <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition shrink-0">
                          <button onClick={() => setEditing(it)} className="p-1 rounded text-white/40 hover:text-[rgb(var(--lz-brand-rgb))] hover:bg-white/5 transition">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => handleDelete(it.id)} className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                    {it.notes && <p className="text-white/50 text-xs leading-relaxed line-clamp-3">{it.notes}</p>}
                    {it.links.length > 0 && (
                      <div className="flex flex-col gap-1">
                        {it.links.map((l, i) => (
                          <a
                            key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-[rgb(var(--lz-brand-rgb))] hover:underline"
                          >
                            <Link2 size={11} className="shrink-0" />
                            <span className="truncate">{l.label || l.url}</span>
                          </a>
                        ))}
                      </div>
                    )}
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
        </>
      )}

      {editing && (
        <ReferenceEditorModal
          item={editing === "new" ? null : editing}
          clients={clients}
          defaultClientId={
            editing === "new"
              ? (selectedFolder && selectedFolder !== GENERAL_KEY ? selectedFolder : null)
              : editing.clientId
          }
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="text-center py-14">
      <p className="text-white/30 text-sm mb-4">Nenhuma referência salva ainda.</p>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-2 rounded-md text-black"
        style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
      >
        <Plus size={14} /> Nova referência
      </button>
    </div>
  );
}

function ReferenceEditorModal({
  item, clients, defaultClientId, onClose, onSave,
}: {
  item: LibraryItem | null;
  clients: { id: string; name: string }[];
  defaultClientId: string | null;
  onClose: () => void;
  onSave: (vals: { clientId: string | null; title: string; links: LibraryLink[]; notes?: string; tags?: string[] }) => void;
}) {
  const [clientId, setClientId] = useState<string>(item?.clientId ?? defaultClientId ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [tagsInput, setTagsInput] = useState((item?.tags ?? []).join(", "));
  const [links, setLinks] = useState<LibraryLink[]>(item?.links ?? []);
  const [linksInput, setLinksInput] = useState("");

  function commitLinksInput() {
    const lines = linksInput.split("\n").map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) return;
    setLinks((prev) => [...prev, ...lines.map((url) => ({ label: null, url }))]);
    setLinksInput("");
  }

  function updateLabel(i: number, value: string) {
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, label: value } : l)));
  }

  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit() {
    if (!title.trim()) return;
    const extra = linksInput.split("\n").map((s) => s.trim()).filter(Boolean).map((url) => ({ label: null, url }));
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    onSave({ clientId: clientId || null, title: title.trim(), links: [...links, ...extra], notes: notes.trim() || undefined, tags });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[#161616] border border-white/10 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
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
            <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Título / do que se trata</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} autoFocus
              placeholder="ex: Referências de humor pro Reels"
              className="w-full bg-[#1A1A1A] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Descrição rápida (opcional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000}
              placeholder="sobre o que é esse bloco de referências…"
              className="w-full bg-[#1A1A1A] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-none" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Links (Reels, TikTok, YouTube…)</label>
            {links.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {links.map((l, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <input
                      value={l.label ?? ""} onChange={(e) => updateLabel(i, e.target.value)}
                      placeholder="Nome (opcional)"
                      className="w-28 shrink-0 bg-[#1A1A1A] border border-white/[0.08] rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
                    />
                    <a href={l.url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 min-w-0 truncate text-xs text-[rgb(var(--lz-brand-rgb))] hover:underline">
                      {l.url}
                    </a>
                    <button onClick={() => removeLink(i)} className="p-1 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              value={linksInput}
              onChange={(e) => setLinksInput(e.target.value)}
              onBlur={commitLinksInput}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitLinksInput();
                }
              }}
              rows={2}
              placeholder="Cole um link e aperte Enter (dá pra colar vários, um por linha)"
              className="w-full bg-[#1A1A1A] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-none placeholder:text-white/30"
            />
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
