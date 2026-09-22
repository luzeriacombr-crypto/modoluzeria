import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { cashFlowEntriesQO, clientPaymentsQO, useApi } from "@/lib/luzeria/queries";
import type { CashFlowEntry } from "@/lib/luzeria/cash-flow.functions";

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const inp = "w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";

/** Fluxo de caixa simples da agência: as mensalidades de cliente
 * (contract_value + client_payments, já existentes) entram sozinhas como
 * "entrada recorrente" — o resto (outras entradas avulsas e todas as
 * saídas) é lançado na mão aqui, fixo (recorrente) ou variável (só desse
 * mês). Mockup aprovado: claude.ai/artifact/7UyrDvHKAXxav7d6ay67DP. */
export function CashFlowSection() {
  const monthKey = currentMonthKey();
  const { data: payments } = useQuery(clientPaymentsQO());
  const { data: entries = [] } = useQuery(cashFlowEntriesQO(monthKey));
  const { addCashFlowEntry, removeCashFlowEntry } = useApi();

  const [addingIncome, setAddingIncome] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [incomeLabel, setIncomeLabel] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [expenseLabel, setExpenseLabel] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseKind, setExpenseKind] = useState<"fixo" | "variavel">("fixo");

  const clients = payments?.clients ?? [];
  const incomes = entries.filter((e) => e.direction === "entrada");
  const expenses = entries.filter((e) => e.direction === "saida");

  const clientsTotalCents = clients.reduce((s, c) => s + Math.round((c.contractValue ?? 0) * 100), 0);
  const clientsReceivedCents = clients.reduce((s, c) => s + (c.paidThisPeriod ? Math.round((c.contractValue ?? 0) * 100) : 0), 0);
  const incomesTotalCents = incomes.reduce((s, i) => s + i.amountCents, 0);
  const recebimentoPrevistoCents = clientsTotalCents + incomesTotalCents;
  const recebidoCents = clientsReceivedCents + incomesTotalCents;
  const recebidoPct = recebimentoPrevistoCents > 0 ? Math.min(100, Math.round((recebidoCents / recebimentoPrevistoCents) * 100)) : 0;

  const fixosCents = expenses.filter((e) => e.kind === "fixo").reduce((s, e) => s + e.amountCents, 0);
  const variaveisCents = expenses.filter((e) => e.kind === "variavel").reduce((s, e) => s + e.amountCents, 0);
  const gastosTotalCents = fixosCents + variaveisCents;
  const saldoCents = recebimentoPrevistoCents - gastosTotalCents;

  function parseAmount(raw: string): number | null {
    const n = parseFloat(raw.replace(/\./g, "").replace(",", "."));
    if (!n || n <= 0) return null;
    return Math.round(n * 100);
  }

  function saveIncome() {
    const cents = parseAmount(incomeAmount);
    if (!incomeLabel.trim() || !cents) { toast.error("Preencha descrição e valor."); return; }
    addCashFlowEntry.mutate(
      { data: { direction: "entrada", label: incomeLabel.trim(), amountCents: cents, kind: "variavel", monthKey } },
      { onSuccess: () => { setIncomeLabel(""); setIncomeAmount(""); setAddingIncome(false); } },
    );
  }

  function saveExpense() {
    const cents = parseAmount(expenseAmount);
    if (!expenseLabel.trim() || !cents) { toast.error("Preencha descrição e valor."); return; }
    addCashFlowEntry.mutate(
      { data: { direction: "saida", label: expenseLabel.trim(), amountCents: cents, kind: expenseKind, monthKey } },
      { onSuccess: () => { setExpenseLabel(""); setExpenseAmount(""); setExpenseKind("fixo"); setAddingExpense(false); } },
    );
  }

  function remove(entry: CashFlowEntry) {
    removeCashFlowEntry.mutate({ data: { id: entry.id } });
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-foreground/7 rounded-xl p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-foreground/40 mb-2">Recebimentos do mês</div>
          <div className="text-xl font-extrabold text-foreground">{money(recebidoCents)}</div>
          <div className="text-[11px] text-foreground/45 mb-2">de {money(recebimentoPrevistoCents)} previstos</div>
          <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${recebidoPct}%`, background: "linear-gradient(90deg, rgb(var(--lz-brand-rgb)), #8FE3B0)" }} />
          </div>
        </div>
        <div className="bg-card border border-foreground/7 rounded-xl p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-foreground/40 mb-2">Gastos previstos do mês</div>
          <div className="text-xl font-extrabold text-foreground">{money(gastosTotalCents)}</div>
          <div className="text-[11px] text-foreground/45">{money(fixosCents)} fixos · {money(variaveisCents)} variáveis</div>
        </div>
        <div className="bg-card border border-foreground/7 rounded-xl p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-foreground/40 mb-2">Saldo previsto do mês</div>
          <div className="text-xl font-extrabold" style={{ color: saldoCents >= 0 ? "#5BA88A" : "#F0765A" }}>{money(saldoCents)}</div>
          <div className="text-[11px] text-foreground/45">recebimentos previstos − gastos previstos</div>
        </div>
      </div>

      {/* Entradas / Saídas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-card border border-foreground/7 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-bold text-foreground">Entradas</div>
            <button
              onClick={() => setAddingIncome((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-md"
              style={{ background: "rgba(var(--lz-brand-rgb),0.14)", color: "var(--lz-accent-ink)" }}
            >
              <Plus size={12} /> Nova entrada
            </button>
          </div>
          <p className="text-[11px] text-foreground/35 mb-3">Mensalidades de clientes entram sozinhas aqui — o resto você lança na mão.</p>

          {addingIncome && (
            <div className="rounded-lg p-3 mb-3 space-y-2" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
              <input value={incomeLabel} onChange={(e) => setIncomeLabel(e.target.value)} placeholder="Ex: Projeto avulso — Cliente X" className={inp} />
              <input value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} placeholder="Valor (R$)" className={inp} />
              <div className="flex justify-end gap-2">
                <button onClick={() => setAddingIncome(false)} className="text-xs text-foreground/50 hover:text-foreground px-2 py-1.5">Cancelar</button>
                <button onClick={saveIncome} disabled={addCashFlowEntry.isPending} className="lz-btn-primary text-xs px-4 py-1.5 rounded-md disabled:opacity-50">Salvar</button>
              </div>
            </div>
          )}

          <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-1.5">Clientes (recorrente)</div>
          <div className="space-y-1.5 mb-3">
            {clients.length === 0 ? (
              <div className="text-[11px] text-foreground/35 py-2">Nenhum cliente com dia de vencimento cadastrado.</div>
            ) : clients.map((c) => (
              <div key={c.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-md" style={{ background: "color-mix(in srgb, var(--foreground) 2.5%, transparent)" }}>
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="flex-1 min-w-0 text-[13px] text-foreground truncate">{c.name}</span>
                <span
                  className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                  style={c.paidThisPeriod ? { backgroundColor: "rgba(91,168,138,0.15)", color: "#5BA88A" } : { backgroundColor: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 50%, transparent)" }}
                >
                  {c.paidThisPeriod ? "Recebido" : "Pendente"}
                </span>
                <span className="text-[13px] font-bold text-foreground w-20 text-right">{c.contractValue != null ? money(Math.round(c.contractValue * 100)) : "—"}</span>
              </div>
            ))}
          </div>

          {incomes.length > 0 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-1.5">Outras entradas</div>
              <div className="space-y-1.5">
                {incomes.map((it) => (
                  <div key={it.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-md" style={{ background: "color-mix(in srgb, var(--foreground) 2.5%, transparent)" }}>
                    <span className="flex-1 min-w-0 text-[13px] text-foreground truncate">{it.label}</span>
                    <span className="text-[13px] font-bold text-foreground w-20 text-right">{money(it.amountCents)}</span>
                    <button onClick={() => remove(it)} className="text-foreground/30 hover:text-red-400 transition"><X size={14} /></button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-card border border-foreground/7 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-bold text-foreground">Saídas</div>
            <button
              onClick={() => setAddingExpense((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-md"
              style={{ background: "rgba(240,118,90,0.14)", color: "#F0765A" }}
            >
              <Plus size={12} /> Nova saída
            </button>
          </div>
          <p className="text-[11px] text-foreground/35 mb-3">Fixa entra todo mês sozinha até você remover. Variável é só desse mês.</p>

          {addingExpense && (
            <div className="rounded-lg p-3 mb-3 space-y-2" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
              <input value={expenseLabel} onChange={(e) => setExpenseLabel(e.target.value)} placeholder="Ex: Assinatura Canva" className={inp} />
              <input value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="Valor (R$)" className={inp} />
              <div className="flex gap-2">
                <button
                  onClick={() => setExpenseKind("fixo")}
                  className="flex-1 text-xs font-bold py-2 rounded-md transition"
                  style={expenseKind === "fixo" ? { background: "#6FA4FF", color: "#0D0D0D" } : { background: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
                >
                  Fixo
                </button>
                <button
                  onClick={() => setExpenseKind("variavel")}
                  className="flex-1 text-xs font-bold py-2 rounded-md transition"
                  style={expenseKind === "variavel" ? { background: "#F0765A", color: "#1A0D0D" } : { background: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
                >
                  Variável
                </button>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setAddingExpense(false)} className="text-xs text-foreground/50 hover:text-foreground px-2 py-1.5">Cancelar</button>
                <button
                  onClick={saveExpense}
                  disabled={addCashFlowEntry.isPending}
                  className="text-xs font-bold px-4 py-1.5 rounded-md disabled:opacity-50"
                  style={{ background: "#F0765A", color: "#1A0D0D" }}
                >
                  Salvar
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            {expenses.length === 0 ? (
              <div className="text-[11px] text-foreground/35 py-2">Nenhuma saída lançada ainda.</div>
            ) : expenses.map((ex) => (
              <div key={ex.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-md" style={{ background: "color-mix(in srgb, var(--foreground) 2.5%, transparent)" }}>
                <span
                  className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
                  style={ex.kind === "fixo" ? { backgroundColor: "rgba(111,164,255,0.15)", color: "#6FA4FF" } : { backgroundColor: "rgba(240,118,90,0.15)", color: "#F0765A" }}
                >
                  {ex.kind === "fixo" ? "Fixo" : "Variável"}
                </span>
                <span className="flex-1 min-w-0 text-[13px] text-foreground truncate">{ex.label}</span>
                <span className="text-[13px] font-bold text-foreground w-20 text-right">{money(ex.amountCents)}</span>
                <button onClick={() => remove(ex)} className="text-foreground/30 hover:text-red-400 transition"><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
