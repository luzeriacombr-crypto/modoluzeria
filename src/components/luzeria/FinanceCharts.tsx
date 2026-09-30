import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { cashFlowHistoryQO } from "@/lib/luzeria/queries";
import { shortMonth, formatMonth } from "@/lib/luzeria/utils";
import type { CashFlowEntry } from "@/lib/luzeria/cash-flow.functions";

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function compactMoney(cents: number) {
  const v = cents / 100;
  if (Math.abs(v) >= 1000) return `R$ ${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(v)}`;
}

/** Categorias sugeridas (texto livre no banco — dá pra trocar a lista sem
 * migration). Investimento não tem categoria. */
export const EXPENSE_CATEGORIES = [
  "Equipe e salários", "Pró-labore", "Freelancers", "Ferramentas e assinaturas", "Anúncios e marketing",
  "Impostos e taxas", "Aluguel e contas", "Equipamentos", "Transporte", "Alimentação", "Outros",
];
export const INCOME_CATEGORIES = ["Projeto avulso", "Consultoria", "Reembolso", "Rendimento", "Outros"];

function MonthTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const saldo = p.entradasCents - p.saidasCents;
  return (
    <div className="bg-background border border-foreground/10 rounded-md px-3 py-2 text-[11px] shadow-xl min-w-44">
      <div className="font-bold text-foreground mb-1.5">{formatMonth(p.monthKey)}</div>
      <div className="flex items-center justify-between gap-4 text-foreground/70">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: "var(--lz-chart-in)" }} />Entradas</span>
        <span className="font-semibold text-foreground">{money(p.entradasCents)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 text-foreground/70">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: "var(--lz-chart-out)" }} />Saídas</span>
        <span className="font-semibold text-foreground">{money(p.saidasCents)}</span>
      </div>
      <div className="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-foreground/10 text-foreground/70">
        <span>Saldo</span>
        <span className="font-bold text-foreground">{money(saldo)}</span>
      </div>
    </div>
  );
}

/** Entradas x saídas dos últimos 6 meses (terminando no mês atual). */
export function CashFlowHistoryChart() {
  const { data = [], isLoading } = useQuery(cashFlowHistoryQO());
  const [showTable, setShowTable] = useState(false);
  const chartData = data.map((d) => ({ ...d, label: shortMonth(d.monthKey) }));
  const empty = !isLoading && data.every((d) => d.entradasCents === 0 && d.saidasCents === 0);

  return (
    <div className="bg-card border border-foreground/7 rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
        <div className="text-sm font-bold text-foreground">Entradas x saídas · últimos 6 meses</div>
        <div className="flex items-center gap-3 text-[11px] text-foreground/60">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--lz-chart-in)" }} />Entradas</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--lz-chart-out)" }} />Saídas</span>
          <button onClick={() => setShowTable((v) => !v)} className="text-foreground/45 hover:text-foreground underline underline-offset-2">
            {showTable ? "Ver gráfico" : "Ver tabela"}
          </button>
        </div>
      </div>
      <p className="text-[11px] text-foreground/35 mb-3">Saídas sem contar investimento. Mensalidades antigas, sem valor gravado, usam o valor do contrato.</p>

      {empty ? (
        <div className="text-[12px] text-foreground/40 py-10 text-center">Ainda não tem lançamentos nesses meses.</div>
      ) : showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-foreground/40 border-b border-foreground/7">
                <th className="py-2 pr-3 font-semibold">Mês</th>
                <th className="py-2 px-3 font-semibold text-right">Entradas</th>
                <th className="py-2 px-3 font-semibold text-right">Saídas</th>
                <th className="py-2 pl-3 font-semibold text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.monthKey} className="border-b border-foreground/4 last:border-0">
                  <td className="py-2 pr-3 text-foreground">{formatMonth(d.monthKey)}</td>
                  <td className="py-2 px-3 text-right text-foreground/70">{money(d.entradasCents)}</td>
                  <td className="py-2 px-3 text-right text-foreground/70">{money(d.saidasCents)}</td>
                  <td className="py-2 pl-3 text-right font-semibold text-foreground">{money(d.entradasCents - d.saidasCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-56 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barGap={2} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="color-mix(in srgb, var(--foreground) 7%, transparent)" />
              <XAxis dataKey="label" axisLine={false} tickLine={false}
                tick={{ fill: "color-mix(in srgb, var(--foreground) 45%, transparent)", fontSize: 10, fontWeight: 600 }} />
              <YAxis axisLine={false} tickLine={false} width={64} tickFormatter={compactMoney}
                tick={{ fill: "color-mix(in srgb, var(--foreground) 40%, transparent)", fontSize: 10 }} />
              <Tooltip content={<MonthTooltip />} cursor={{ fill: "color-mix(in srgb, var(--foreground) 5%, transparent)" }} />
              <Bar dataKey="entradasCents" name="Entradas" fill="var(--lz-chart-in)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="saidasCents" name="Saídas" fill="var(--lz-chart-out)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/** Pra onde foi o dinheiro no mês: saídas (sem investimento) somadas por
 * categoria, maior primeiro. Uma cor só — é tamanho, não identidade. */
export function ExpensesByCategory({ expenses, monthKey }: { expenses: CashFlowEntry[]; monthKey: string }) {
  const totals = new Map<string, number>();
  expenses.filter((e) => e.kind !== "investimento").forEach((e) => {
    const key = e.category ?? "Sem categoria";
    totals.set(key, (totals.get(key) ?? 0) + e.amountCents);
  });
  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  if (rows.length === 0) return null;

  return (
    <div className="bg-card border border-foreground/7 rounded-xl p-4">
      <div className="text-sm font-bold text-foreground mb-1">Gastos por categoria</div>
      <p className="text-[11px] text-foreground/35 mb-3">{formatMonth(monthKey)} · sem contar investimento</p>
      <div className="space-y-2.5">
        {rows.map(([category, cents]) => {
          const pct = total > 0 ? Math.round((cents / total) * 100) : 0;
          return (
            <div key={category} title={`${category}: ${money(cents)} (${pct}%)`}>
              <div className="flex items-center justify-between text-[12px] mb-1">
                <span className={category === "Sem categoria" ? "text-foreground/45 italic" : "text-foreground"}>{category}</span>
                <span className="text-foreground/60"><span className="font-semibold text-foreground">{money(cents)}</span> · {pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, background: "var(--lz-chart-out)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
