import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatMonth, shortMonth } from "@/lib/luzeria/utils";

function WeekTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-background border border-foreground/10 rounded-md p-2 text-[10px] text-foreground/80 w-48 shadow-xl">
      <div className="font-semibold text-[var(--lz-accent-ink)] mb-1">
        {p.label} · {p.count} tarefa{p.count === 1 ? "" : "s"}
      </div>
      {p.items.slice(0, 5).map((t: string, j: number) => <div key={j} className="truncate">• {t}</div>)}
      {p.items.length > 5 && <div className="text-foreground/40">+{p.items.length - 5}</div>}
      {p.items.length === 0 && <div className="text-foreground/40">Nenhuma tarefa finalizada</div>}
    </div>
  );
}

export function ProductivityBlock({ prod, monthKey }: { prod: { weeks: number[]; items: string[][]; total: number; history: { key: string; count: number }[] }; monthKey: string }) {
  const [showHist, setShowHist] = useState(false);
  const avg = (prod.weeks.reduce((a, b) => a + b, 0) / 4).toFixed(1);
  const bestIdx = prod.weeks.indexOf(Math.max(...prod.weeks));
  const histMax = Math.max(...prod.history.map((h) => h.count), 1);
  const histBest = prod.history.reduce((a, b) => (b.count > a.count ? b : a), prod.history[0] ?? { key: "", count: 0 });
  const chartData = prod.weeks.map((v, i) => ({
    week: `S${i + 1}`, label: `Semana ${i + 1}`, count: v, items: prod.items[i],
  }));
  const renderDot = (props: any) => {
    const { cx, cy, index, payload } = props;
    const isBest = index === bestIdx && payload.count > 0;
    return (
      <circle key={`dot-${index}`} cx={cx} cy={cy} r={isBest ? 5 : 3.5}
        fill={isBest ? "var(--lz-accent-ink)" : "#8FA832"} stroke="#1C1C1C" strokeWidth={2} />
    );
  };

  return (
    <div className="mt-10 rounded-lg p-6" style={{ background: "var(--card)", border: "1px solid rgba(var(--lz-brand-light-rgb),0.15)" }}>
      <div className="flex items-end justify-between mb-1">
        <h3 className="text-lg font-bold text-foreground">Como estou indo?</h3>
        <span className="text-xs text-foreground/40">{formatMonth(monthKey)}</span>
      </div>
      <p className="text-xs text-foreground/50 mb-6">
        <span className="text-[var(--lz-accent-ink)] font-bold">{prod.total}</span> tarefa{prod.total === 1 ? "" : "s"} finalizada{prod.total === 1 ? "" : "s"} em {formatMonth(monthKey)}
      </p>

      <div className="h-44 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 12, bottom: 0 }}>
            <defs>
              <linearGradient id="prodFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--lz-brand-rgb))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="rgb(var(--lz-brand-rgb))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="week" axisLine={false} tickLine={false}
              tick={{ fill: "color-mix(in srgb, var(--foreground) 40%, transparent)", fontSize: 10, fontWeight: 600 }} />
            <Tooltip content={<WeekTooltip />} cursor={{ stroke: "rgba(var(--lz-brand-light-rgb),0.3)", strokeWidth: 1 }} />
            <Area
              type="monotone" dataKey="count"
              stroke="var(--lz-accent-ink)" strokeWidth={2} strokeLinecap="round"
              fill="url(#prodFill)"
              dot={renderDot}
              activeDot={{ r: 6, fill: "rgb(var(--lz-brand-rgb))", stroke: "#1C1C1C", strokeWidth: 2 }}
              animationDuration={600} animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between mt-5 text-xs">
        <span className="text-[var(--lz-accent-ink)] font-semibold">
          {prod.weeks[bestIdx] > 0 ? `Melhor: Semana ${bestIdx + 1} com ${prod.weeks[bestIdx]} tarefa${prod.weeks[bestIdx] === 1 ? "" : "s"}` : "Sem tarefas finalizadas ainda"}
        </span>
        <span className="text-foreground/50">Média: {avg}/semana</span>
      </div>

      <button onClick={() => setShowHist((x) => !x)}
        className="mt-5 inline-flex items-center gap-1 text-[11px] text-foreground/50 hover:text-foreground">
        {showHist ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Histórico 6 meses
      </button>
      {showHist && (
        <div className="mt-3 flex items-end gap-2 h-20">
          {prod.history.map((h) => {
            const isBest = h.key === histBest.key && h.count > 0;
            return (
              <div key={h.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] font-bold" style={{ color: isBest ? "var(--lz-accent-ink)" : "color-mix(in srgb, var(--foreground) 50%, transparent)" }}>{h.count}</div>
                <div className="w-full rounded-t" style={{
                  height: `${(h.count / histMax) * 60 + 4}px`,
                  background: isBest ? "rgb(var(--lz-brand-rgb))" : "rgba(var(--lz-brand-light-rgb),0.25)",
                }} />
                <div className="text-[9px] text-foreground/40">{shortMonth(h.key)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
