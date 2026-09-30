import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X, AlertCircle, Pencil, Check, ChevronDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { bankAccountsQO, cashFlowEntriesQO, clientPaymentsQO, useApi, useMe } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { currentMonthKey, prevMonthKey, nextMonthKey, formatMonth, parseBRLToCents } from "@/lib/luzeria/utils";
import type { CashFlowEntry } from "@/lib/luzeria/cash-flow.functions";
import type { BankAccount } from "@/lib/luzeria/bank-accounts.functions";
import type { ClientPaymentRow } from "@/lib/luzeria/client-payments.functions";
import { Modal } from "./Modals";
import { BankAccountsSection } from "./BankAccountsSection";
import { CashFlowHistoryChart, ExpensesByCategory, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "./FinanceCharts";

const selectCls = "w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";

export function BankAccountSelect({ accounts, value, onChange }: { accounts: BankAccount[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={selectCls}>
      <option value="">Carteira / espécie</option>
      {/* Conta removida (arquivada) só aparece se já é a escolhida — pra
       * editar um lançamento antigo sem trocar a conta dele sem querer. */}
      {accounts.filter((a) => !a.archived || a.id === value).map((a) => (
        <option key={a.id} value={a.id}>{a.name}{a.archived ? " (removida)" : ""}</option>
      ))}
    </select>
  );
}

function CategorySelect({ options, value, onChange }: { options: string[]; value: string | null; onChange: (v: string | null) => void }) {
  // Categoria que não está na lista (ex: lista mudou depois) continua
  // aparecendo pra não sumir na edição.
  const all = value && !options.includes(value) ? [...options, value] : options;
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} className={selectCls}>
      <option value="">Sem categoria</option>
      {all.map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

/** Planilha do mês (abre no Excel/Google Planilhas): mensalidades de
 * clientes, outras entradas e saídas, com categoria, conta e status. `;`
 * como separador e BOM no começo pro Excel em português ler acentos e
 * colunas certo. */
function exportMonthCsv(monthKey: string, clients: ClientPaymentRow[], entries: CashFlowEntry[], bankName: (id: string | null) => string | null) {
  const brl = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
  const rows: string[][] = [["Tipo", "Descrição", "Categoria", "Valor (R$)", "Conta", "Status", "Vencimento"]];
  clients.forEach((c) => {
    if (c.contractValue == null) return;
    rows.push([
      "Entrada", `Mensalidade — ${c.name}`, "Mensalidade de cliente",
      brl(c.paidAmountCents ?? Math.round(c.contractValue * 100)), "",
      c.paidThisPeriod ? "Recebido" : "Pendente", c.paymentDueDay ? `dia ${c.paymentDueDay}` : "",
    ]);
  });
  entries.forEach((e) => {
    rows.push([
      e.direction === "entrada" ? "Entrada" : e.kind === "investimento" ? "Investimento" : e.kind === "fixo" ? "Saída fixa" : "Saída variável",
      e.label, e.category ?? "", brl(e.amountCents), bankName(e.bankAccountId) ?? "Carteira/espécie",
      e.direction === "entrada" ? "Recebido" : e.paidAt ? "Pago" : "A pagar", e.dueDay ? `dia ${e.dueDay}` : "",
    ]);
  });
  const csv = "\uFEFF" + rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `financeiro-${monthKey}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const inp = "w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";

/** Fluxo de caixa simples da agência: as mensalidades de cliente
 * (contract_value + client_payments, já existentes) entram sozinhas como
 * "entrada recorrente" — o resto (outras entradas avulsas e todas as
 * saídas) é lançado na mão aqui, fixo (recorrente) ou variável (só desse
 * mês). Mockup aprovado: claude.ai/artifact/7UyrDvHKAXxav7d6ay67DP. */
export function CashFlowSection() {
  // Pedido do Junior (30/09): dava pra ver só o mês atual — agora navega
  // livre entre meses passados (histórico) e futuros (projeção, assumindo
  // os mesmos clientes recorrentes de hoje). "Saldo em banco"/Carteira
  // ficam de fora de propósito: são um saldo atual, não um retrato do mês.
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const isFuture = monthKey > currentMonthKey();
  const { data: payments } = useQuery(clientPaymentsQO(monthKey));
  const { data: entries = [] } = useQuery(cashFlowEntriesQO(monthKey));
  const { data: bankAccounts = [] } = useQuery(bankAccountsQO());
  const { addCashFlowEntry, removeCashFlowEntry, setCashFlowEntryPaid } = useApi();
  const isMaster = useMe().data?.role === "master";

  const [addingIncome, setAddingIncome] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [incomeLabel, setIncomeLabel] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeBankAccountId, setIncomeBankAccountId] = useState<string | null>(null);
  const [incomeCategory, setIncomeCategory] = useState<string | null>(null);
  const [expenseLabel, setExpenseLabel] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseKind, setExpenseKind] = useState<"fixo" | "variavel" | "investimento">("fixo");
  const [expenseDueDay, setExpenseDueDay] = useState("");
  const [expenseBankAccountId, setExpenseBankAccountId] = useState<string | null>(null);
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseCategory, setExpenseCategory] = useState<string | null>(null);
  const [fillingClient, setFillingClient] = useState<ClientPaymentRow | null>(null);
  const [editingEntry, setEditingEntry] = useState<CashFlowEntry | null>(null);
  const [clientsOpen, setClientsOpen] = useState(true);
  const [saidasOpen, setSaidasOpen] = useState(true);

  const clients = payments?.clients ?? [];
  const incomes = entries.filter((e) => e.direction === "entrada");
  // "Saída" aqui é só fixo/variável de verdade — investimento é dinheiro
  // guardado, não gasto, então some pro cálculo de gastos/saldo e fica na
  // própria lista (renderizada junto, mas com contagem separada abaixo).
  const expenses = entries.filter((e) => e.direction === "saida");

  const clientsTotalCents = clients.reduce((s, c) => s + Math.round((c.contractValue ?? 0) * 100), 0);
  // Recebido usa o valor que de fato entrou (gravado ao marcar o pagamento);
  // pagamentos antigos, sem valor gravado, caem no valor do contrato.
  const clientsReceivedCents = clients.reduce((s, c) => s + (c.paidThisPeriod ? (c.paidAmountCents ?? Math.round((c.contractValue ?? 0) * 100)) : 0), 0);
  const clientsPaidCount = clients.filter((c) => c.paidThisPeriod).length;
  const incomesTotalCents = incomes.reduce((s, i) => s + i.amountCents, 0);
  const recebimentoPrevistoCents = clientsTotalCents + incomesTotalCents;
  const recebidoCents = clientsReceivedCents + incomesTotalCents;
  const recebidoPct = recebimentoPrevistoCents > 0 ? Math.min(100, Math.round((recebidoCents / recebimentoPrevistoCents) * 100)) : 0;

  const fixosCents = expenses.filter((e) => e.kind === "fixo").reduce((s, e) => s + e.amountCents, 0);
  const variaveisCents = expenses.filter((e) => e.kind === "variavel").reduce((s, e) => s + e.amountCents, 0);
  const investidoCents = expenses.filter((e) => e.kind === "investimento").reduce((s, e) => s + e.amountCents, 0);
  const gastosTotalCents = fixosCents + variaveisCents;
  const saldoCents = recebimentoPrevistoCents - gastosTotalCents;

  function saveIncome() {
    const cents = parseBRLToCents(incomeAmount);
    if (!incomeLabel.trim() || !cents) { toast.error("Preencha descrição e valor."); return; }
    addCashFlowEntry.mutate(
      { data: { direction: "entrada", label: incomeLabel.trim(), amountCents: cents, kind: "variavel", monthKey, bankAccountId: incomeBankAccountId, category: incomeCategory } },
      { onSuccess: () => { setIncomeLabel(""); setIncomeAmount(""); setIncomeBankAccountId(null); setIncomeCategory(null); setAddingIncome(false); } },
    );
  }

  function saveExpense() {
    const cents = parseBRLToCents(expenseAmount);
    if (!expenseLabel.trim() || !cents) { toast.error("Preencha descrição e valor."); return; }
    const dueDay = expenseDueDay ? parseInt(expenseDueDay, 10) : null;
    addCashFlowEntry.mutate(
      {
        data: {
          direction: "saida", label: expenseLabel.trim(), amountCents: cents, kind: expenseKind, monthKey, dueDay,
          bankAccountId: expenseBankAccountId,
          notes: expenseKind === "investimento" ? expenseNotes.trim() || null : null,
          category: expenseKind === "investimento" ? null : expenseCategory,
        },
      },
      { onSuccess: () => { setExpenseLabel(""); setExpenseAmount(""); setExpenseKind("fixo"); setExpenseDueDay(""); setExpenseBankAccountId(null); setExpenseNotes(""); setExpenseCategory(null); setAddingExpense(false); } },
    );
  }

  function bankAccountName(id: string | null): string | null {
    if (!id) return null;
    const account = bankAccounts.find((a) => a.id === id);
    if (!account) return null;
    return account.archived ? `${account.name} (removida)` : account.name;
  }

  async function remove(entry: CashFlowEntry) {
    // Fixa criada antes deste mês não é apagada: só para de contar daqui
    // em diante, e os meses anteriores ficam como estavam.
    const endsHere = entry.kind === "fixo" && entry.startMonth != null && entry.startMonth < monthKey;
    const message = endsHere
      ? `Parar de contar "${entry.label}" a partir de ${formatMonth(monthKey)}? Os meses anteriores continuam no histórico.`
      : `Excluir "${entry.label}"?${entry.direction === "entrada" || entry.paidAt ? " O valor volta pro saldo da conta." : ""}`;
    if (!(await requestConfirm(message, { danger: true }))) return;
    removeCashFlowEntry.mutate({ data: { id: entry.id, monthKey } });
  }

  return (
    <div className="space-y-4">
      {/* Navegação de mês — vale pro resumo e pra Entradas/Saídas abaixo;
       * Saldo em banco/Carteira ficam sempre no valor atual. */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setMonthKey(prevMonthKey(monthKey))}
          className="h-8 w-8 flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          {formatMonth(monthKey)}
          {isFuture && <span className="text-[9px] font-extrabold tracking-wider opacity-70">· PROJEÇÃO</span>}
        </span>
        <button
          onClick={() => setMonthKey(nextMonthKey(monthKey))}
          className="h-8 w-8 flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => exportMonthCsv(monthKey, clients, entries, bankAccountName)}
          title="Baixar planilha do mês (abre no Excel ou Google Planilhas)"
          className="ml-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/60 hover:text-foreground bg-foreground/5 hover:bg-foreground/10 rounded-md px-2.5 py-1.5 transition"
        >
          <Download size={13} /> Exportar
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-foreground/7 rounded-xl p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-foreground/40 mb-2">Recebimentos do mês</div>
          <div className="text-xl font-extrabold text-foreground">{money(recebidoCents)}</div>
          <div className="text-[11px] text-foreground/45 mb-2">de {money(recebimentoPrevistoCents)} previstos</div>
          <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden mb-2">
            <div className="h-full rounded-full" style={{ width: `${recebidoPct}%`, background: "linear-gradient(90deg, rgb(var(--lz-brand-rgb)), #8FE3B0)" }} />
          </div>
          {clients.length > 0 && (
            <div className="text-[10.5px] text-foreground/40">{clientsPaidCount} de {clients.length} clientes pagaram</div>
          )}
        </div>
        <div className="bg-card border border-foreground/7 rounded-xl p-4">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-foreground/40 mb-2">Gastos previstos do mês</div>
          <div className="text-xl font-extrabold text-foreground">{money(gastosTotalCents)}</div>
          <div className="text-[11px] text-foreground/45">{money(fixosCents)} fixos · {money(variaveisCents)} variáveis</div>
        </div>
        <div className="bg-card rounded-xl p-4" style={{ border: "1px solid rgba(183,156,255,0.35)" }}>
          <div className="text-[10.5px] font-bold uppercase tracking-wider mb-2" style={{ color: "#B79CFF" }}>Investido esse mês</div>
          <div className="text-xl font-extrabold text-foreground">{money(investidoCents)}</div>
          <div className="text-[11px] text-foreground/45">Guardado, não é gasto — não entra no saldo</div>
        </div>
        <div
          className="rounded-xl p-4"
          style={{
            background: `color-mix(in srgb, ${saldoCents >= 0 ? "#8FE3B0" : "#F0765A"} 14%, var(--card))`,
            border: `1px solid color-mix(in srgb, ${saldoCents >= 0 ? "#8FE3B0" : "#F0765A"} 35%, transparent)`,
          }}
        >
          <div className="text-[10.5px] font-bold uppercase tracking-wider mb-2" style={{ color: saldoCents >= 0 ? "#8FE3B0" : "#F0765A" }}>Saldo previsto do mês</div>
          <div className="text-xl font-extrabold text-foreground">{money(saldoCents)}</div>
          <div className="text-[11px] text-foreground/45">recebimentos previstos − gastos (sem contar investimento)</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2"><CashFlowHistoryChart /></div>
        <ExpensesByCategory expenses={expenses} monthKey={monthKey} />
      </div>

      <BankAccountsSection />

      {/* Entradas / Saídas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-card border border-foreground/7 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-bold text-foreground">Entradas</div>
            {/* Entrada soma no saldo na hora — num mês futuro ela ainda não
             * aconteceu, então não dá pra lançar. */}
            {!isFuture && <button
              onClick={() => setAddingIncome((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-md"
              style={{ background: "rgba(var(--lz-brand-rgb),0.14)", color: "var(--lz-accent-ink)" }}
            >
              <Plus size={12} /> Nova entrada
            </button>}
          </div>
          <p className="text-[11px] text-foreground/35 mb-3">Mensalidades de clientes entram sozinhas aqui — o resto você lança na mão.</p>

          {addingIncome && !isFuture && (
            <div className="rounded-lg p-3 mb-3 space-y-2" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
              <input value={incomeLabel} onChange={(e) => setIncomeLabel(e.target.value)} placeholder="Ex: Projeto avulso — Cliente X" className={inp} />
              <div className="flex gap-2">
                <input value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} placeholder="Valor (R$)" className={`${inp} flex-1 min-w-0`} />
                <div className="w-40 shrink-0">
                  <BankAccountSelect accounts={bankAccounts} value={incomeBankAccountId} onChange={setIncomeBankAccountId} />
                </div>
              </div>
              <CategorySelect options={INCOME_CATEGORIES} value={incomeCategory} onChange={setIncomeCategory} />
              <div className="flex justify-end gap-2">
                <button onClick={() => setAddingIncome(false)} className="text-xs text-foreground/50 hover:text-foreground px-2 py-1.5">Cancelar</button>
                <button onClick={saveIncome} disabled={addCashFlowEntry.isPending} className="lz-btn-primary text-xs px-4 py-1.5 rounded-md disabled:opacity-50">Salvar</button>
              </div>
            </div>
          )}

          <button
            onClick={() => setClientsOpen((v) => !v)}
            className="w-full flex items-center gap-1.5 mb-1.5 text-left"
          >
            <ChevronDown size={12} className={`text-foreground/40 transition-transform ${clientsOpen ? "" : "-rotate-90"}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/30">Clientes (recorrente)</span>
            <span className="text-[10px] font-bold text-foreground/20">· {clients.length}</span>
          </button>
          <div className={`space-y-1.5 mb-3 ${clientsOpen ? "" : "hidden"}`}>
            {clients.length === 0 ? (
              <div className="text-[11px] text-foreground/35 py-2">Nenhum cliente recorrente (Social Media/Pack Digital) cadastrado ainda.</div>
            ) : clients.map((c) => {
              const missing = c.missingValue || c.missingDueDay;
              return (
                <div key={c.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-md" style={{ background: "color-mix(in srgb, var(--foreground) 2.5%, transparent)" }}>
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                  <span className="flex-1 min-w-0 text-[13px] text-foreground truncate">{c.name}</span>
                  {missing ? (
                    <button
                      // Valor e vencimento do cliente só o master pode definir.
                      onClick={() => isMaster ? setFillingClient(c) : toast.info("Só o master da agência pode definir valor e vencimento do cliente.")}
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded"
                      style={{ backgroundColor: "rgba(240,166,90,0.15)", color: "#F0A65A" }}
                    >
                      <AlertCircle size={11} />
                      {c.missingValue && c.missingDueDay ? "Falta data e valor" : c.missingDueDay ? "Falta a data" : "Falta o valor"}
                    </button>
                  ) : (
                    <>
                      <span
                        className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                        style={c.paidThisPeriod ? { backgroundColor: "rgba(91,168,138,0.15)", color: "#5BA88A" } : { backgroundColor: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 50%, transparent)" }}
                      >
                        {c.paidThisPeriod ? "Recebido" : "Pendente"}
                      </span>
                      <span className="text-[13px] font-bold text-foreground w-20 text-right">{c.paidAmountCents != null ? money(c.paidAmountCents) : c.contractValue != null ? money(Math.round(c.contractValue * 100)) : "—"}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {incomes.length > 0 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mb-1.5">Outras entradas</div>
              <div className="space-y-1.5">
                {incomes.map((it) => (
                  <div key={it.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-md" style={{ background: "color-mix(in srgb, var(--foreground) 2.5%, transparent)" }}>
                    <span className="flex-1 min-w-0 text-[13px] text-foreground truncate">
                      {it.label}
                      {it.category && <span className="text-foreground/35 font-normal"> · {it.category}</span>}
                      {it.dueDay && <span className="text-foreground/35 font-normal"> · vence dia {it.dueDay}</span>}
                      <span className="text-foreground/35 font-normal"> · {bankAccountName(it.bankAccountId) ?? "carteira/espécie"}</span>
                    </span>
                    <span className="text-[13px] font-bold text-foreground w-20 text-right">{money(it.amountCents)}</span>
                    <button onClick={() => setEditingEntry(it)} className="text-foreground/30 hover:text-[var(--lz-accent-ink)] transition"><Pencil size={13} /></button>
                    <button onClick={() => remove(it)} className="text-foreground/30 hover:text-red-400 transition"><X size={14} /></button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-card border border-foreground/7 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => setSaidasOpen((v) => !v)} className="flex items-center gap-1.5">
              <ChevronDown size={13} className={`text-foreground/50 transition-transform ${saidasOpen ? "" : "-rotate-90"}`} />
              <span className="text-sm font-bold text-foreground">Saídas</span>
            </button>
            <button
              onClick={() => setAddingExpense((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-md"
              style={{ background: "rgba(240,118,90,0.14)", color: "#F0765A" }}
            >
              <Plus size={12} /> Nova saída
            </button>
          </div>
          <p className="text-[11px] text-foreground/35 mb-3">Fixa entra todo mês sozinha. Variável é só desse mês. Investimento não conta como gasto no saldo.</p>

          {addingExpense && (
            <div className="rounded-lg p-3 mb-3 space-y-2" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
              <input value={expenseLabel} onChange={(e) => setExpenseLabel(e.target.value)} placeholder="Ex: Assinatura Canva" className={inp} />
              <div className="flex gap-2">
                <input value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="Valor (R$)" className={`${inp} flex-1 min-w-0`} />
                <div className="w-28 shrink-0">
                  <input value={expenseDueDay} onChange={(e) => setExpenseDueDay(e.target.value.replace(/\D/g, ""))} placeholder="Dia venc." maxLength={2} className={inp} />
                </div>
              </div>
              <BankAccountSelect accounts={bankAccounts} value={expenseBankAccountId} onChange={setExpenseBankAccountId} />
              {expenseKind !== "investimento" && (
                <CategorySelect options={EXPENSE_CATEGORIES} value={expenseCategory} onChange={setExpenseCategory} />
              )}
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
                <button
                  onClick={() => setExpenseKind("investimento")}
                  className="flex-1 text-xs font-bold py-2 rounded-md transition"
                  style={expenseKind === "investimento" ? { background: "#B79CFF", color: "#1A0D2E" } : { background: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
                >
                  Investimento
                </button>
              </div>
              {expenseKind === "investimento" && (
                <textarea
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder="Observações (ex: CDB Nubank, resgate em 2027)"
                  rows={2}
                  className={`${inp} resize-none`}
                />
              )}
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

          <div className={`space-y-1.5 ${saidasOpen ? "" : "hidden"}`}>
            {expenses.length === 0 ? (
              <div className="text-[11px] text-foreground/35 py-2">Nenhuma saída lançada ainda.</div>
            ) : expenses.map((ex) => (
              <div key={ex.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-md" style={{ background: "color-mix(in srgb, var(--foreground) 2.5%, transparent)" }}>
                <span
                  className="text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
                  style={
                    ex.kind === "fixo" ? { backgroundColor: "rgba(111,164,255,0.15)", color: "#6FA4FF" }
                    : ex.kind === "investimento" ? { backgroundColor: "rgba(183,156,255,0.15)", color: "#B79CFF" }
                    : { backgroundColor: "rgba(240,118,90,0.15)", color: "#F0765A" }
                  }
                >
                  {ex.kind === "fixo" ? "Fixo" : ex.kind === "investimento" ? "Investimento" : "Variável"}
                </span>
                <span className="flex-1 min-w-0 text-[13px] text-foreground truncate" title={ex.notes ?? undefined}>
                  {ex.label}
                  {ex.category && <span className="text-foreground/35 font-normal"> · {ex.category}</span>}
                  {ex.dueDay && <span className="text-foreground/35 font-normal"> · vence dia {ex.dueDay}</span>}
                  <span className="text-foreground/35 font-normal"> · {bankAccountName(ex.bankAccountId) ?? "carteira/espécie"}</span>
                  {ex.notes && <span className="text-foreground/35 font-normal"> · {ex.notes}</span>}
                </span>
                <span className="text-[13px] font-bold text-foreground w-20 text-right">{money(ex.amountCents)}</span>
                <button
                  onClick={() => setCashFlowEntryPaid.mutate({ data: { entryId: ex.id, monthKey, paid: !ex.paidAt } })}
                  disabled={setCashFlowEntryPaid.isPending}
                  title={ex.paidAt ? "Marcar como não paga" : "Marcar como paga"}
                  className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 transition disabled:opacity-50"
                  style={ex.paidAt
                    ? { backgroundColor: "rgba(126,217,87,0.15)", color: "#7ED957" }
                    : { backgroundColor: "color-mix(in srgb, var(--foreground) 8%, transparent)", color: "color-mix(in srgb, var(--foreground) 45%, transparent)" }}
                >
                  {ex.paidAt && <Check size={10} />} {ex.paidAt ? "Pago" : "A pagar"}
                </button>
                <button onClick={() => setEditingEntry(ex)} className="text-foreground/30 hover:text-[var(--lz-accent-ink)] transition"><Pencil size={13} /></button>
                <button onClick={() => remove(ex)} className="text-foreground/30 hover:text-red-400 transition"><X size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {fillingClient && (
        <FillPaymentInfoModal client={fillingClient} onClose={() => setFillingClient(null)} />
      )}
      {editingEntry && (
        <EditEntryModal entry={editingEntry} monthKey={monthKey} onClose={() => setEditingEntry(null)} />
      )}
    </div>
  );
}

/** Corrige um lançamento (Saída ou outra Entrada) já existente — antes só
 * dava pra apagar e lançar de novo. Kind (Fixo/Variável) só aparece pra
 * saída; entrada avulsa é sempre do mês em que aconteceu. */
function EditEntryModal({ entry, monthKey, onClose }: { entry: CashFlowEntry; monthKey: string; onClose: () => void }) {
  const api = useApi();
  const { data: bankAccounts = [] } = useQuery(bankAccountsQO());
  const [label, setLabel] = useState(entry.label);
  const [amount, setAmount] = useState((entry.amountCents / 100).toFixed(2).replace(".", ","));
  const [kind, setKind] = useState<"fixo" | "variavel" | "investimento">(entry.kind);
  const [dueDay, setDueDay] = useState(entry.dueDay != null ? String(entry.dueDay) : "");
  const [bankAccountId, setBankAccountId] = useState<string | null>(entry.bankAccountId);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [category, setCategory] = useState<string | null>(entry.category);

  function save() {
    const cents = parseBRLToCents(amount);
    if (!label.trim() || !cents) { toast.error("Preencha descrição e valor."); return; }
    api.updateCashFlowEntry.mutate(
      {
        data: {
          id: entry.id, label: label.trim(), amountCents: cents, kind, monthKey,
          dueDay: dueDay ? parseInt(dueDay, 10) : null,
          bankAccountId,
          notes: kind === "investimento" ? notes.trim() || null : null,
          category: kind === "investimento" ? null : category,
        },
      },
      { onSuccess: () => { toast.success("Lançamento atualizado."); onClose(); } },
    );
  }

  return (
    <Modal open onClose={onClose} title={`Editar ${entry.direction === "saida" ? "saída" : "entrada"}`}>
      <div className="space-y-3">
        {entry.kind === "fixo" && entry.startMonth != null && entry.startMonth < monthKey && (
          <p className="text-[11px] text-foreground/45 leading-relaxed">
            Mudanças de valor, conta ou tipo valem a partir de {formatMonth(monthKey)}. Os meses anteriores continuam como estavam.
          </p>
        )}
        <label className="block">
          <span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Descrição</span>
          <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} className={inp} />
        </label>
        <div className="flex gap-2">
          <label className="block flex-1">
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Valor (R$)</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} className={inp} />
          </label>
          <label className="block w-28 shrink-0">
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Dia venc.</span>
            <input value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ""))} placeholder="Ex: 10" maxLength={2} className={inp} />
          </label>
        </div>
        <label className="block">
          <span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Conta</span>
          <BankAccountSelect accounts={bankAccounts} value={bankAccountId} onChange={setBankAccountId} />
        </label>
        {kind !== "investimento" && (
          <label className="block">
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Categoria</span>
            <CategorySelect options={entry.direction === "entrada" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES} value={category} onChange={setCategory} />
          </label>
        )}
        {entry.direction === "saida" && (
          <div className="flex gap-2">
            <button
              onClick={() => setKind("fixo")}
              className="flex-1 text-xs font-bold py-2 rounded-md transition"
              style={kind === "fixo" ? { background: "#6FA4FF", color: "#0D0D0D" } : { background: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
            >Fixo</button>
            <button
              onClick={() => setKind("variavel")}
              className="flex-1 text-xs font-bold py-2 rounded-md transition"
              style={kind === "variavel" ? { background: "#F0765A", color: "#1A0D0D" } : { background: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
            >Variável</button>
            <button
              onClick={() => setKind("investimento")}
              className="flex-1 text-xs font-bold py-2 rounded-md transition"
              style={kind === "investimento" ? { background: "#B79CFF", color: "#1A0D2E" } : { background: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
            >Investimento</button>
          </div>
        )}
        {entry.direction === "saida" && kind === "investimento" && (
          <label className="block">
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Observações</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: CDB Nubank, resgate em 2027" rows={2} className={`${inp} resize-none`} />
          </label>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 mt-5">
        <button onClick={onClose} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Cancelar</button>
        <button onClick={save} disabled={api.updateCashFlowEntry.isPending} className="lz-btn-primary text-xs px-5 py-2.5 rounded-md disabled:opacity-50">
          {api.updateCashFlowEntry.isPending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

/** Preenche direto da lista de Entradas o que falta pro cliente entrar como
 * mensalidade recorrente (valor e/ou dia de vencimento) — mesmo patch que
 * já existe em Configuração do cliente na Ficha, só que sem precisar sair
 * daqui pra achar. Salva com updateClient, que já invalida client-payments
 * sozinho (a linha vira Recebido/Pendente na hora). */
function FillPaymentInfoModal({ client, onClose }: { client: ClientPaymentRow; onClose: () => void }) {
  const api = useApi();
  const [value, setValue] = useState(client.contractValue != null ? String(client.contractValue).replace(".", ",") : "");
  const [dueDay, setDueDay] = useState(client.paymentDueDay != null ? String(client.paymentDueDay) : "");

  function save() {
    const patch: Record<string, any> = {};
    if (client.missingValue) {
      const cents = parseBRLToCents(value);
      if (!cents) { toast.error("Informe um valor válido."); return; }
      patch.contract_value = cents / 100;
    }
    if (client.missingDueDay) {
      const d = parseInt(dueDay, 10);
      if (!d || d < 1 || d > 31) { toast.error("Informe um dia entre 1 e 31."); return; }
      patch.payment_due_day = d;
    }
    api.updateClient.mutate(
      { data: { id: client.id, patch } },
      { onSuccess: () => { toast.success("Cadastro completo — já entra em Entradas."); onClose(); } },
    );
  }

  return (
    <Modal open onClose={onClose} title={`Completar cadastro · ${client.name}`}>
      <div className="space-y-3">
        {client.missingValue && (
          <label className="block">
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Valor mensal (R$)</span>
            <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" className={inp} />
          </label>
        )}
        {client.missingDueDay && (
          <label className="block">
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Dia de vencimento</span>
            <input autoFocus={!client.missingValue} value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ""))} placeholder="Ex: 15" maxLength={2} className={inp} />
          </label>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 mt-5">
        <button onClick={onClose} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Cancelar</button>
        <button onClick={save} disabled={api.updateClient.isPending} className="lz-btn-primary text-xs px-5 py-2.5 rounded-md disabled:opacity-50">
          {api.updateClient.isPending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}
