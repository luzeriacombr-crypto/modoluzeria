import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Printer, Loader2 } from "lucide-react";
import { cashFlowEntriesQO, clientPaymentsQO } from "@/lib/luzeria/queries";
import { currentMonthKey, prevMonthKey, nextMonthKey, formatMonth } from "@/lib/luzeria/utils";
import type { CashFlowEntry } from "@/lib/luzeria/cash-flow.functions";
import type { ClientPaymentRow } from "@/lib/luzeria/client-payments.functions";

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Line = { label: string; cents: number };

type MonthResult = {
  receitas: Line[];
  receitasTotal: number;
  aReceber: number;
  despesas: Line[];
  despesasTotal: number;
  aPagar: number;
  investido: number;
  resultado: number;
};

/** Regime de competência simples: receita = mensalidades pagas no mês (valor
 * que de fato entrou; pagamentos antigos usam o contrato) + outras entradas;
 * despesa = saídas fixas e variáveis do mês, pagas ou não. Investimento fica
 * fora do resultado (é dinheiro guardado, não gasto). */
function computeResult(clients: ClientPaymentRow[], entries: CashFlowEntry[]): MonthResult {
  const receitaMap = new Map<string, number>();
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  let aReceber = 0;
  clients.forEach((c) => {
    if (c.contractValue == null) return;
    if (c.paidThisPeriod) add(receitaMap, "Mensalidades de clientes", c.paidAmountCents ?? Math.round(c.contractValue * 100));
    else aReceber += Math.round(c.contractValue * 100);
  });
  const despesaMap = new Map<string, number>();
  let aPagar = 0;
  let investido = 0;
  entries.forEach((e) => {
    if (e.direction === "entrada") { add(receitaMap, e.category ?? "Outras entradas", e.amountCents); return; }
    if (e.kind === "investimento") { investido += e.amountCents; return; }
    add(despesaMap, e.category ?? "Sem categoria", e.amountCents);
    if (!e.paidAt) aPagar += e.amountCents;
  });
  const sort = (m: Map<string, number>) => [...m.entries()].map(([label, cents]) => ({ label, cents })).sort((a, b) => b.cents - a.cents);
  const receitas = sort(receitaMap);
  const despesas = sort(despesaMap);
  const receitasTotal = receitas.reduce((s, l) => s + l.cents, 0);
  const despesasTotal = despesas.reduce((s, l) => s + l.cents, 0);
  return { receitas, receitasTotal, aReceber, despesas, despesasTotal, aPagar, investido, resultado: receitasTotal - despesasTotal };
}

function Variation({ now, before, inverse }: { now: number; before: number | undefined; inverse?: boolean }) {
  if (before == null) return <span className="text-foreground/25">—</span>;
  if (before === 0) return <span className="text-foreground/35">{now === 0 ? "0%" : "novo"}</span>;
  const pct = Math.round(((now - before) / Math.abs(before)) * 100);
  if (pct === 0) return <span className="text-foreground/40">0%</span>;
  // Pra despesa, subir é ruim (inverse). Cor + sinal, nunca só cor.
  const good = inverse ? pct < 0 : pct > 0;
  return <span className="font-semibold" style={{ color: good ? "var(--lz-chart-in)" : "var(--lz-chart-out)" }}>{pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%</span>;
}

function Section({ title, lines, total, prevLines, prevTotal, inverse }: {
  title: string; lines: Line[]; total: number; prevLines?: Line[]; prevTotal?: number; inverse?: boolean;
}) {
  const prevOf = (label: string) => prevLines ? (prevLines.find((l) => l.label === label)?.cents ?? 0) : undefined;
  return (
    <div className="mb-5">
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-baseline text-[10px] uppercase tracking-wider font-bold text-foreground/40 pb-1.5 border-b border-foreground/10">
        <span>{title}</span>
        <span className="text-right w-28">Este mês</span>
        <span className="text-right w-28 hidden sm:block">Mês anterior</span>
        <span className="text-right w-16">Variação</span>
      </div>
      {lines.length === 0 ? (
        <div className="text-[12px] text-foreground/35 py-2">Nada lançado.</div>
      ) : lines.map((l) => (
        <div key={l.label} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-baseline text-[13px] py-1.5 border-b border-foreground/5">
          <span className={l.label === "Sem categoria" ? "text-foreground/50 italic" : "text-foreground/80"}>{l.label}</span>
          <span className="text-right w-28 text-foreground">{money(l.cents)}</span>
          <span className="text-right w-28 text-foreground/45 hidden sm:block">{prevOf(l.label) != null ? money(prevOf(l.label)!) : "—"}</span>
          <span className="text-right w-16 text-[11px]"><Variation now={l.cents} before={prevOf(l.label)} inverse={inverse} /></span>
        </div>
      ))}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-baseline text-[13px] font-bold py-2">
        <span className="text-foreground">Total</span>
        <span className="text-right w-28 text-foreground">{money(total)}</span>
        <span className="text-right w-28 text-foreground/45 hidden sm:block">{prevTotal != null ? money(prevTotal) : "—"}</span>
        <span className="text-right w-16 text-[11px]"><Variation now={total} before={prevTotal} inverse={inverse} /></span>
      </div>
    </div>
  );
}

/** "Resultado do mês" (Etapa 3): um DRE simples — receitas, despesas por
 * categoria e resultado, comparando com o mês anterior. Imprime/salva PDF
 * pelo próprio navegador (só esta área, ver .lz-print-area em styles.css). */
export function MonthResultPanel() {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const prevKey = prevMonthKey(monthKey);
  const { data: pay, isLoading: l1 } = useQuery(clientPaymentsQO(monthKey));
  const { data: entries, isLoading: l2 } = useQuery(cashFlowEntriesQO(monthKey));
  const { data: prevPay } = useQuery(clientPaymentsQO(prevKey));
  const { data: prevEntries } = useQuery(cashFlowEntriesQO(prevKey));

  const loading = l1 || l2 || !pay || !entries;
  const cur = loading ? null : computeResult(pay.clients, entries);
  const prev = prevPay && prevEntries ? computeResult(prevPay.clients, prevEntries) : undefined;
  const margem = cur && cur.receitasTotal > 0 ? Math.round((cur.resultado / cur.receitasTotal) * 100) : null;
  const isFuture = monthKey > currentMonthKey();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-3 lz-no-print">
        <button onClick={() => setMonthKey(prevKey)} aria-label="Mês anterior"
          className="h-8 w-8 flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition">
          <ChevronLeft size={16} />
        </button>
        <span className="inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          {formatMonth(monthKey)}
          {isFuture && <span className="text-[9px] font-extrabold tracking-wider opacity-70">· PROJEÇÃO</span>}
        </span>
        <button onClick={() => setMonthKey(nextMonthKey(monthKey))} aria-label="Próximo mês"
          className="h-8 w-8 flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition">
          <ChevronRight size={16} />
        </button>
        <button onClick={() => window.print()} title="Imprimir ou salvar como PDF"
          className="ml-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/60 hover:text-foreground bg-foreground/5 hover:bg-foreground/10 rounded-md px-2.5 py-1.5 transition">
          <Printer size={13} /> Imprimir / PDF
        </button>
      </div>

      {!cur ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-foreground/40" size={24} /></div>
      ) : (
        <div className="lz-print-area bg-card border border-foreground/7 rounded-xl p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
            <div>
              <div className="text-lg font-bold text-foreground">Resultado de {formatMonth(monthKey)}</div>
              <p className="text-[11px] text-foreground/40 mt-0.5">Receitas recebidas menos despesas do mês (pagas ou não). Investimento fica de fora.</p>
            </div>
            <div className="text-right">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-foreground/40">Resultado</div>
              <div className="text-2xl font-extrabold" style={{ color: cur.resultado >= 0 ? "var(--lz-chart-in)" : "var(--lz-chart-out)" }}>
                {money(cur.resultado)}
              </div>
              {margem != null && <div className="text-[11px] text-foreground/50">margem de {margem}% sobre as receitas</div>}
            </div>
          </div>

          <Section title="Receitas" lines={cur.receitas} total={cur.receitasTotal} prevLines={prev?.receitas} prevTotal={prev?.receitasTotal} />
          <Section title="Despesas" lines={cur.despesas} total={cur.despesasTotal} prevLines={prev?.despesas} prevTotal={prev?.despesasTotal} inverse />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div className="rounded-lg px-3 py-2.5" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)" }}>
              <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/40">Ainda a receber</div>
              <div className="text-[15px] font-bold text-foreground">{money(cur.aReceber)}</div>
              <div className="text-[10.5px] text-foreground/40">mensalidades pendentes, fora das receitas</div>
            </div>
            <div className="rounded-lg px-3 py-2.5" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)" }}>
              <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/40">Ainda a pagar</div>
              <div className="text-[15px] font-bold text-foreground">{money(cur.aPagar)}</div>
              <div className="text-[10.5px] text-foreground/40">já contado nas despesas</div>
            </div>
            <div className="rounded-lg px-3 py-2.5" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)" }}>
              <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/40">Investido</div>
              <div className="text-[15px] font-bold text-foreground">{money(cur.investido)}</div>
              <div className="text-[10.5px] text-foreground/40">guardado, fora do resultado</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
