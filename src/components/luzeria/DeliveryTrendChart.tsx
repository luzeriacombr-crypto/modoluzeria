import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { deliveryTrendQO } from "@/lib/luzeria/queries";

/** Linha com área preenchida mostrando entregas finalizadas por mês, nos
 * últimos 6 meses — mesmo espírito do gráfico de fluxo de caixa que vimos
 * num sistema de referência: tooltip com o valor exato no hover. Puro SVG,
 * sem biblioteca de gráfico. */
export function DeliveryTrendChart() {
  const { data } = useQuery(deliveryTrendQO());
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!data || data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  const w = 640, h = 180, padL = 28, padB = 22, chartW = w - padL - 10, chartH = h - padB - 10;
  const stepX = data.length > 1 ? chartW / (data.length - 1) : 0;
  const pts = data.map((d, i) => ({
    x: padL + stepX * i,
    y: 10 + chartH - (d.count / max) * chartH,
  }));
  const linePath = "M" + pts.map((p) => `${p.x},${p.y}`).join(" L");
  const areaPath = `M${pts[0].x},${10 + chartH} L` + pts.map((p) => `${p.x},${p.y}`).join(" L") + ` L${pts[pts.length - 1].x},${10 + chartH} Z`;
  const hasAny = data.some((d) => d.count > 0);

  return (
    <div className="bg-card rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">Entregas por mês</h3>
        <span className="text-[11px] text-foreground/40">últimos 6 meses</span>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40">
          <defs>
            <linearGradient id="deliveryTrendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--lz-brand-rgb))" stopOpacity="0.35" />
              <stop offset="100%" stopColor="rgb(var(--lz-brand-rgb))" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.5, 1].map((p) => (
            <line key={p} x1={padL} y1={10 + chartH - p * chartH} x2={w - 10} y2={10 + chartH - p * chartH} stroke="color-mix(in srgb, var(--foreground) 6%, transparent)" strokeWidth={1} />
          ))}
          {!hasAny ? (
            <text x={w / 2} y={h / 2} textAnchor="middle" fill="color-mix(in srgb, var(--foreground) 30%, transparent)" fontSize={12}>Sem entregas registradas ainda</text>
          ) : (
            <>
              <path d={areaPath} fill="url(#deliveryTrendGrad)" />
              <path d={linePath} fill="none" stroke="var(--lz-accent-ink)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={hoverIdx === i ? 5.5 : 3.5} fill="#1C1C1C" stroke="var(--lz-accent-ink)" strokeWidth={2} style={{ transition: "r .12s ease" }} />
              ))}
            </>
          )}
          {data.map((d, i) => (
            <text key={d.key} x={padL + stepX * i} y={h - 4} textAnchor="middle" fill="color-mix(in srgb, var(--foreground) 35%, transparent)" fontSize={10}>{d.label}</text>
          ))}
          {data.map((d, i) => (
            <rect
              key={d.key}
              x={padL + stepX * i - stepX / 2} y={0} width={stepX || w} height={h - padB}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          ))}
        </svg>
        {hoverIdx !== null && (
          <div
            className="absolute z-20 bg-background border border-foreground/10 rounded-md px-2.5 py-1.5 pointer-events-none text-[11px] whitespace-nowrap"
            style={{ left: `${(pts[hoverIdx].x / w) * 100}%`, top: `${(pts[hoverIdx].y / h) * 100}%`, transform: "translate(-50%, -130%)" }}
          >
            <span className="text-foreground font-bold">{data[hoverIdx].count}</span> <span className="text-foreground/50">entregue{data[hoverIdx].count === 1 ? "" : "s"}</span>
          </div>
        )}
      </div>
      <p className="text-[10px] text-foreground/25 mt-1">Passe o mouse pra ver o valor exato de cada mês.</p>
    </div>
  );
}
