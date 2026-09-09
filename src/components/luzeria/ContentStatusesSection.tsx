import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, Lock } from "lucide-react";
import { contentStatusesQO, useApi } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { STATUS_META, CUSTOMIZABLE_BUILTIN_STATUS_KEYS, PROTECTED_STATUS_KEYS } from "@/lib/luzeria/types";
import type { ContentStatusRow } from "@/lib/luzeria/content-statuses.functions";

export function ContentStatusesSection() {
  const { data: rows = [] } = useQuery(contentStatusesQO());
  const overrideByKey = new Map(rows.map((r) => [r.key, r]));
  const customRows = rows.filter((r) => r.isCustom).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-2 max-w-2xl">
      <p className="text-[11px] text-foreground/40 mb-3">
        Renomeie as etapas do meio do fluxo, ou adicione etapas novas — elas aparecem no seletor de status de
        posts, reels e stories. As etapas protegidas abaixo não podem ser alteradas: são usadas nas metas,
        relatórios e automações do sistema.
      </p>

      <div className="space-y-2">
        {CUSTOMIZABLE_BUILTIN_STATUS_KEYS.map((key) => (
          <BuiltinRow key={key} statusKey={key} override={overrideByKey.get(key)} />
        ))}
        {customRows.map((row) => (
          <CustomRow key={row.id} row={row} />
        ))}
      </div>

      <AddStatusButton />

      <div className="mt-6">
        <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/40 mb-2 flex items-center gap-1.5">
          <Lock size={11} /> Protegidos
        </div>
        <div className="space-y-2">
          {PROTECTED_STATUS_KEYS.map((key) => (
            <div key={key} className="bg-card border border-foreground/6 rounded-md px-3 py-2.5 flex items-center justify-between gap-3 opacity-70">
              <span className="text-sm font-semibold text-foreground">{STATUS_META[key].label}</span>
              <span className="flex items-center gap-1.5 text-[10px] text-foreground/40 shrink-0" title="Usado nas métricas e automações do sistema — não pode ser alterado.">
                <Lock size={11} /> Não pode ser alterado
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BuiltinRow({ statusKey, override }: { statusKey: keyof typeof STATUS_META; override: ContentStatusRow | undefined }) {
  const api = useApi();
  const [editing, setEditing] = useState(false);
  const currentLabel = override?.label ?? STATUS_META[statusKey].label;

  if (editing) {
    return (
      <StatusEditForm
        initialLabel={currentLabel}
        onCancel={() => setEditing(false)}
        onSave={(label) => {
          api.upsertContentStatus.mutate({ data: override ? { id: override.id, label } : { key: statusKey, label } });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="bg-card border border-foreground/6 rounded-md px-3 py-2.5 flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-foreground">{currentLabel}</span>
      <button onClick={() => setEditing(true)} className="p-1 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5 shrink-0" title="Editar">
        <Pencil size={13} />
      </button>
    </div>
  );
}

function CustomRow({ row }: { row: ContentStatusRow }) {
  const api = useApi();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <StatusEditForm
        initialLabel={row.label}
        onCancel={() => setEditing(false)}
        onSave={(label) => {
          api.upsertContentStatus.mutate({ data: { id: row.id, label } });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="bg-card border border-foreground/6 rounded-md px-3 py-2.5 flex items-center justify-between gap-3">
      <span className="text-sm font-semibold text-foreground">{row.label}</span>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => setEditing(true)} className="p-1 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5" title="Editar">
          <Pencil size={13} />
        </button>
        <button
          onClick={async () => { if (await requestConfirm(`Excluir o status "${row.label}"?`, { danger: true })) api.deleteContentStatus.mutate({ data: { id: row.id } }); }}
          className="p-1 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5" title="Excluir"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function AddStatusButton() {
  const api = useApi();
  const [adding, setAdding] = useState(false);

  if (adding) {
    return (
      <StatusEditForm
        initialLabel=""
        onCancel={() => setAdding(false)}
        onSave={(label) => {
          api.upsertContentStatus.mutate({ data: { label } });
          setAdding(false);
        }}
      />
    );
  }

  return (
    <button onClick={() => setAdding(true)}
      className="w-full mt-2 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-foreground/15 py-2 text-[11px] text-foreground/50 hover:text-[var(--lz-accent-ink)] hover:border-[rgb(var(--lz-brand-rgb))]">
      <Plus size={12} /> Adicionar status
    </button>
  );
}

function StatusEditForm({ initialLabel, onCancel, onSave }: {
  initialLabel: string;
  onCancel: () => void;
  onSave: (label: string) => void;
}) {
  const [label, setLabel] = useState(initialLabel);

  return (
    <div className="bg-card border border-foreground/8 rounded-md p-3 space-y-2">
      <input
        autoFocus
        value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome do status"
        className="w-full bg-background border border-foreground/10 rounded px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
      />
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="inline-flex items-center gap-1 text-[11px] text-foreground/50 hover:text-foreground px-2 py-1">
          <X size={12} /> Cancelar
        </button>
        <button
          disabled={!label.trim()}
          onClick={() => onSave(label.trim())}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold disabled:opacity-30"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          <Check size={12} /> Salvar
        </button>
      </div>
    </div>
  );
}
