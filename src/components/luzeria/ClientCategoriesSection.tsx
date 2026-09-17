import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, Lock } from "lucide-react";
import { clientCategoriesQO, useApi } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import type { ClientCategoryRow } from "@/lib/luzeria/client-categories.functions";

const PROTECTED_NAMES = ["Social Media", "Avulsos"];

/** Categorias fixas (Social Media, Avulsos) continuam vindo direto do
 * código — só existem aqui pra explicar que não dá pra mexer nelas.
 * Categorias customizadas de verdade vêm de client_categories, uma linha
 * por categoria criada pelo dono da agência. */
export function ClientCategoriesSection() {
  const { data: rows = [] } = useQuery(clientCategoriesQO());
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-2 max-w-2xl">
      <p className="text-[11px] text-foreground/40 mb-3">
        Categorias organizam seus clientes em pastas separadas na barra lateral. "Social Media" e "Avulsos" são
        fixas do sistema — adicione outras pra separar tipos diferentes de serviço, se sua agência trabalhar com mais de um.
      </p>

      <div className="space-y-2">
        {sorted.map((row) => (
          <CategoryRow key={row.id} row={row} />
        ))}
      </div>

      <AddCategoryButton />

      <div className="mt-6">
        <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/40 mb-2 flex items-center gap-1.5">
          <Lock size={11} /> Padrão do sistema
        </div>
        <div className="space-y-2">
          {PROTECTED_NAMES.map((name) => (
            <div key={name} className="bg-card border border-foreground/6 rounded-md px-3 py-2.5 flex items-center justify-between gap-3 opacity-70">
              <span className="text-sm font-semibold text-foreground">{name}</span>
              <span className="flex items-center gap-1.5 text-[10px] text-foreground/40 shrink-0" title="Categoria fixa do sistema — não pode ser renomeada ou apagada.">
                <Lock size={11} /> Não pode ser alterada
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryRow({ row }: { row: ClientCategoryRow }) {
  const api = useApi();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <CategoryEditForm
        initialName={row.name}
        onCancel={() => setEditing(false)}
        onSave={(name) => {
          api.renameClientCategory.mutate({ data: { id: row.id, name } });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="bg-card border border-foreground/6 rounded-md px-3 py-2.5 flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-foreground">{row.name}</span>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => setEditing(true)} className="p-1 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5" title="Editar">
          <Pencil size={13} />
        </button>
        <button
          onClick={async () => { if (await requestConfirm(`Excluir a categoria "${row.name}"?`, { danger: true })) api.deleteClientCategory.mutate({ data: { id: row.id } }); }}
          className="p-1 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5" title="Excluir"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function AddCategoryButton() {
  const api = useApi();
  const [adding, setAdding] = useState(false);

  if (adding) {
    return (
      <CategoryEditForm
        initialName=""
        onCancel={() => setAdding(false)}
        onSave={(name) => {
          api.createClientCategory.mutate({ data: { name } });
          setAdding(false);
        }}
      />
    );
  }

  return (
    <button onClick={() => setAdding(true)}
      className="w-full mt-2 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-foreground/15 py-2 text-[11px] text-foreground/50 hover:text-[var(--lz-accent-ink)] hover:border-[rgb(var(--lz-brand-rgb))]">
      <Plus size={12} /> Adicionar categoria
    </button>
  );
}

function CategoryEditForm({ initialName, onCancel, onSave }: {
  initialName: string;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);

  return (
    <div className="bg-card border border-foreground/8 rounded-md p-3 space-y-2">
      <input
        autoFocus
        value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da categoria"
        className="w-full bg-background border border-foreground/10 rounded px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
      />
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="inline-flex items-center gap-1 text-[11px] text-foreground/50 hover:text-foreground px-2 py-1">
          <X size={12} /> Cancelar
        </button>
        <button
          disabled={!name.trim()}
          onClick={() => onSave(name.trim())}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold disabled:opacity-30"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          <Check size={12} /> Salvar
        </button>
      </div>
    </div>
  );
}
