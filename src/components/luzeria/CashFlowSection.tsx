import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X, AlertCircle, Pencil, Check, ChevronDown } from "lucide-react";
import { cashFlowEntriesQO, clientPaymentsQO, useApi } from "@/lib/luzeria/queries";
import type { CashFlowEntry } from "@/lib/luzeria/cash-flow.functions";
import type { ClientPaymentRow } from "@/lib/luzeria/client-payments.functions";
import { Modal } from "./Modals";
import { BankAccountsSection } from "./BankAccountsSection";

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
  const { addCashFlowEntry, removeCashFlowEntry, setCashFlowEntryPaid } = useApi();

  const [addingIncome, setAddingIncome] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [incomeLabel, setIncomeLabel] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [expenseLabel, setExpenseLabel] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseKind, setExpenseKind] = useState<"fixo" | "variavel" | "investimento">("fixo");
  const [expenseDueDay, setExpenseDueDay] = useState("");
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
  const clientsReceivedCents = clients.reduce((s, c) => s + (c.paidThisPeriod ? Math.round((c.contractValue ?? 0) * 100) : 0), 0);
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
    const dueDay = expenseDueDay ? parseInt(expenseDueDay, 10) : null;
    addCashFlowEntry.mutate(
      { data: { direction: "saida", label: expenseLabel.trim(), amountCents: cents, kind: expenseKind, monthKey, dueDay } },
      { onSuccess: () => { setExpenseLabel(""); setExpenseAmount(""); setExpenseKind("fixo"); setExpenseDueDay(""); setAddingExpense(false); } },
    );
  }

  function remove(entry: CashFlowEntry) {
    removeCashFlowEntry.mutate({ data: { id: entry.id } });
  }

  return (
    <div className="space-y-4">
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

      <BankAccountsSection />

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
                      onClick={() => setFillingClient(c)}
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
                      <span className="text-[13px] font-bold text-foreground w-20 text-right">{c.contractValue != null ? money(Math.round(c.contractValue * 100)) : "—"}</span>
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
                      {it.dueDay && <span className="text-foreground/35 font-normal"> · vence dia {it.dueDay}</span>}
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
                <span className="flex-1 min-w-0 text-[13px] text-foreground truncate">
                  {ex.label}
                  {ex.dueDay && <span className="text-foreground/35 font-normal"> · vence dia {ex.dueDay}</span>}
                </span>
                <span className="text-[13px] font-bold text-foreground w-20 text-right">{money(ex.amountCents)}</span>
                <button
                  onClick={() => setCashFlowEntryPaid.mutate({ data: { entryId: ex.id, monthKey, paid: !ex.paidAt } })}
                  title={ex.paidAt ? "Marcar como não paga" : "Marcar como paga"}
                  className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 transition"
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
  const [label, setLabel] = useState(entry.label);
  const [amount, setAmount] = useState((entry.amountCents / 100).toFixed(2).replace(".", ","));
  const [kind, setKind] = useState<"fixo" | "variavel" | "investimento">(entry.kind);
  const [dueDay, setDueDay] = useState(entry.dueDay != null ? String(entry.dueDay) : "");

  function save() {
    const cents = parseFloat(amount.replace(/\./g, "").replace(",", ".")) * 100;
    if (!label.trim() || !cents || cents <= 0) { toast.error("Preencha descrição e valor."); return; }
    api.updateCashFlowEntry.mutate(
      { data: { id: entry.id, label: label.trim(), amountCents: Math.round(cents), kind, monthKey, dueDay: dueDay ? parseInt(dueDay, 10) : null } },
      { onSuccess: () => { toast.success("Lançamento atualizado."); onClose(); } },
    );
  }

  return (
    <Modal open onClose={onClose} title={`Editar ${entry.direction === "saida" ? "saída" : "entrada"}`}>
      <div className="space-y-3">
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
      const n = parseFloat(value.replace(/\./g, "").replace(",", "."));
      if (!n || n <= 0) { toast.error("Informe um valor válido."); return; }
      patch.contract_value = n;
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
