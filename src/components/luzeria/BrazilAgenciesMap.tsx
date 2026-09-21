import { useState } from "react";
import { BRAZIL_MAP_VIEWBOX, UF_NAMES, UF_PATHS } from "@/lib/luzeria/brazil-uf-paths";

/**
 * Mapa do Brasil com a distribuição de agências por estado — o estado
 * escurece/acende conforme a quantidade, e passar o mouse (ou tocar, no
 * celular) sincroniza mapa e lista nos dois sentidos.
 *
 * A UF de cada agência é estimada pelo DDD do WhatsApp (ver ufFromWhatsapp
 * no AgenciesBillingPanel), então isso é uma aproximação, não um cadastro
 * de endereço.
 */
export function BrazilAgenciesMap({ counts }: { counts: Map<string, number> }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  const max = Math.max(1, ...counts.values());
  const rows = Object.keys(UF_PATHS)
    .map((uf) => ({ uf, count: counts.get(uf) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.uf.localeCompare(b.uf));

  const fillFor = (count: number, isHovered: boolean) => {
    if (!count) {
      return isHovered
        ? "color-mix(in srgb, var(--foreground) 14%, transparent)"
        : "color-mix(in srgb, var(--foreground) 6%, transparent)";
    }
    // Piso alto o bastante pra um estado com 1 agência ainda se ler como
    // "tem agência" ao lado de um SP com 12.
    const alpha = 0.28 + 0.62 * (count / max);
    return `rgba(var(--lz-brand-rgb), ${isHovered ? Math.min(1, alpha + 0.2) : alpha})`;
  };

  const hoveredCount = hovered ? (counts.get(hovered) ?? 0) : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div
        className="relative"
        onMouseLeave={() => {
          setHovered(null);
          setTip(null);
        }}
      >
        <svg
          viewBox={BRAZIL_MAP_VIEWBOX}
          className="w-full h-auto max-h-[360px]"
          role="img"
          aria-label="Mapa do Brasil com a quantidade de agências por estado"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setTip({ x: e.clientX - r.left, y: e.clientY - r.top });
          }}
        >
          {Object.entries(UF_PATHS).map(([uf, d]) => {
            const isHovered = hovered === uf;
            return (
              <path
                key={uf}
                d={d}
                fill={fillFor(counts.get(uf) ?? 0, isHovered)}
                stroke={
                  isHovered
                    ? "rgba(var(--lz-brand-rgb), 0.9)"
                    : "color-mix(in srgb, var(--foreground) 14%, transparent)"
                }
                strokeWidth={isHovered ? 3 : 1.5}
                strokeLinejoin="round"
                className="cursor-default transition-[fill,stroke] duration-150"
                onMouseEnter={() => setHovered(uf)}
                onClick={(e) => {
                  const box = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                  if (box) setTip({ x: e.clientX - box.left, y: e.clientY - box.top });
                  setHovered((cur) => (cur === uf ? null : uf));
                }}
              />
            );
          })}
        </svg>

        {hovered && tip && (
          <div
            className="pointer-events-none absolute z-20 hidden sm:block bg-card border border-foreground/10 rounded-lg shadow-xl px-2.5 py-1.5 whitespace-nowrap"
            style={{ left: tip.x + 12, top: tip.y + 12 }}
          >
            <div className="text-xs font-bold text-foreground">{UF_NAMES[hovered]}</div>
            <div className="text-[10.5px] text-foreground/50">
              {hoveredCount === 0
                ? "Nenhuma agência"
                : `${hoveredCount} agência${hoveredCount > 1 ? "s" : ""}`}
            </div>
          </div>
        )}
        {/* Celular: sem mouse não há balão — mostra o estado tocado numa faixa fixa. */}
        <div className="sm:hidden mt-2 rounded-lg bg-foreground/[0.05] px-3 py-2 text-xs min-h-[38px] flex items-center">
          {hovered ? (
            <span>
              <b className="text-foreground">{UF_NAMES[hovered]}</b>
              <span className="text-foreground/60"> — {hoveredCount === 0 ? "nenhuma agência" : `${hoveredCount} agência${hoveredCount > 1 ? "s" : ""}`}</span>
            </span>
          ) : (
            <span className="text-foreground/45">Toque em um estado para ver a quantidade de agências.</span>
          )}
        </div>
      </div>

      {/* columns-2 (e não grid) pra o ranking descer a primeira coluna
          inteira antes de começar a segunda, em vez de zigue-zaguear. */}
      <div className="columns-2 gap-x-3">
        {rows.map(({ uf, count }) => {
          const isHovered = hovered === uf;
          return (
            <button
              key={uf}
              type="button"
              onMouseEnter={() => setHovered(uf)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(uf)}
              onBlur={() => setHovered(null)}
              onClick={() => setHovered((cur) => (cur === uf ? null : uf))}
              title={UF_NAMES[uf]}
              className={`relative flex w-full break-inside-avoid items-center justify-between gap-2 rounded px-2 py-1 text-xs overflow-hidden text-left transition-colors ${isHovered ? "bg-foreground/[0.07]" : ""}`}
            >
              {count > 0 && (
                <span
                  className="absolute inset-y-0 left-0 rounded"
                  style={{
                    width: `${(count / max) * 100}%`,
                    background: `rgba(var(--lz-brand-rgb), ${isHovered ? 0.28 : 0.14})`,
                  }}
                />
              )}
              <span
                className={`relative font-bold ${count > 0 ? "text-foreground" : "text-foreground/35"}`}
              >
                {uf}
              </span>
              <span
                className={`relative tabular-nums ${count > 0 ? "text-foreground/50" : "text-foreground/25"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
