import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil } from "lucide-react";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import {
  listOperatingCosts, createOperatingCost, updateOperatingCost, deleteOperatingCost,
  type PlatformOperatingCost,
} from "@/lib/luzeria/platform-costs.functions";

const emptyForm = { name: "", amount: "", currency: "USD" as "USD" | "BRL", notes: "" };

// Não tem cotação em tempo real aqui dentro — é só uma estimativa fixa pra
// dar uma noção de custo total em R$. Se o dólar mudar muito, ajusta essa
// constante (ou pede pra eu ajustar).
const USD_TO_BRL_ESTIMATE = 5.4;

/** "Quanto eu pago pra tudo isso rodar" — lançado à mão (Vercel, Supabase,
 * Backblaze, Resend, Claude Code etc.), pra comparar contra a receita das
 * agências logo acima. Mora dentro de AgenciesBillingPanel de propósito —
 * é o contraponto direto da "Receita mensal", não um relatório à parte. */
export function PlatformCostsPanel() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: costs = [] } = useQuery({ queryKey: ["platform-operating-costs"], queryFn: () => listOperatingCosts() });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["platform-operating-costs"] });
  const createMutation = useMutation({
    mutationFn: useServerFn(createOperatingCost),
    onSuccess: () => { invalidate(); resetForm(); toast.success("Custo adicionado."); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });
  const updateMutation = useMutation({
    mutationFn: useServerFn(updateOperatingCost),
    onSuccess: () => { invalidate(); resetForm(); toast.success("Custo atualizado."); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });
  const deleteMutation = useMutation({
    mutationFn: useServerFn(deleteOperatingCost),
    onSuccess: () => { invalidate(); toast.success("Removido."); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover."),
  });

  function resetForm() {
    setForm(emptyForm);
    setShowForm(false);
    setEditingId(null);
  }

  function startEdit(c: PlatformOperatingCost) {
    setEditingId(c.id);
    setForm({ name: c.name, amount: (c.amountCents / 100).toFixed(2).replace(".", ","), currency: c.currency, notes: c.notes ?? "" });
    setShowForm(true);
  }

  function save() {
    const name = form.name.trim();
    if (!name) { toast.error("Dá um nome pro custo."); return; }
    const amountCents = Math.round(parseFloat(form.amount.replace(",", ".")) * 100) || 0;
    const payload = { name, amountCents, currency: form.currency, notes: form.notes.trim() || null };
    if (editingId) updateMutation.mutate({ data: { id: editingId, ...payload } });
    else createMutation.mutate({ data: payload });
  }

  const fmtBRL = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmt = (cents: number, currency: string) =>
    (cents / 100).toLocaleString(currency === "BRL" ? "pt-BR" : "en-US", { style: "currency", currency });
  const toBRLCents = (c: PlatformOperatingCost) =>
    c.currency === "BRL" ? c.amountCents : Math.round(c.amountCents * USD_TO_BRL_ESTIMATE);
  const totalBRLCents = costs.reduce((sum, c) => sum + toBRLCents(c), 0);

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mt-4 pt-4 border-t border-foreground/6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] text-foreground/50">Custos operacionais</div>
        <button
          type="button"
          onClick={() => { resetForm(); setShowForm((s) => !s); }}
          className="flex items-center gap-1 text-[11px] font-semibold text-foreground/50 hover:text-foreground transition"
        >
          <Plus size={12} /> Novo custo
        </button>
      </div>

      {costs.length === 0 ? (
        <div className="bg-foreground/[0.03] rounded-lg px-3 py-2.5 text-xs text-foreground/40">
          Nenhum custo lançado ainda.
        </div>
      ) : (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
          className="w-full text-left bg-foreground/[0.03] hover:bg-foreground/[0.06] rounded-lg px-3 py-2.5 transition-colors"
          style={expanded ? { boxShadow: "0 0 0 1px rgb(var(--lz-brand-rgb)) inset" } : undefined}
        >
          <div className="text-lg font-bold text-foreground">{fmtBRL(totalBRLCents)}</div>
          <div className="text-[11px] text-foreground/50 mt-0.5">Custos operacionais/mês — {costs.length} item{costs.length === 1 ? "" : "s"}</div>
        </button>
      )}

      {expanded && costs.length > 0 && (
        <div className="mt-2 rounded-lg border border-foreground/8 bg-foreground/[0.03] px-3 py-2 space-y-1">
          {costs.map((c) => (
            <div key={c.id} className="group flex items-center gap-3 justify-between text-xs py-1">
              <div className="min-w-0 truncate">
                <span className="text-foreground/80 font-medium">{c.name}</span>
                {c.notes && <span className="text-foreground/35 ml-2">{c.notes}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-foreground/50 font-semibold tabular-nums">
                  {fmt(c.amountCents, c.currency)}
                  {c.currency === "USD" && <span className="text-foreground/30 font-normal"> (~{fmtBRL(toBRLCents(c))})</span>}
                </span>
                <button onClick={() => startEdit(c)} className="opacity-0 group-hover:opacity-100 text-foreground/40 hover:text-foreground transition p-0.5" title="Editar">
                  <Pencil size={12} />
                </button>
                <button
                  onClick={async () => { if (await requestConfirm(`Remover "${c.name}" dos custos?`, { danger: true })) deleteMutation.mutate({ data: { id: c.id } }); }}
                  className="opacity-0 group-hover:opacity-100 text-foreground/40 hover:text-red-400 transition p-0.5"
                  title="Remover"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="mt-2 rounded-lg border border-foreground/10 bg-foreground/[0.03] p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome (ex: Vercel)"
              className="bg-background border border-foreground/10 rounded-md px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
            />
            <div className="flex items-center gap-1">
              <input
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0,00"
                inputMode="decimal"
                className="flex-1 bg-background border border-foreground/10 rounded-md px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
              />
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value as "USD" | "BRL" })}
                className="bg-background border border-foreground/10 rounded-md px-1.5 py-1.5 text-xs text-foreground outline-none"
              >
                <option value="USD">US$</option>
                <option value="BRL">R$</option>
              </select>
            </div>
          </div>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Nota (opcional)"
            className="w-full bg-background border border-foreground/10 rounded-md px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 px-3 py-1.5 rounded-md text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
            >
              {saving ? "Salvando…" : editingId ? "Salvar" : "Adicionar"}
            </button>
            <button onClick={resetForm} className="px-3 py-1.5 rounded-md text-xs font-semibold text-foreground/60 hover:text-foreground transition">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <p className="text-[10.5px] text-foreground/30 mt-2 leading-relaxed">
        Lançado à mão — atualiza quando conferir a fatura de cada serviço. Total em R$ usa dólar estimado em {USD_TO_BRL_ESTIMATE.toFixed(2).replace(".", ",")} pra converter — não é cotação em tempo real.
      </p>
    </div>
  );
}
