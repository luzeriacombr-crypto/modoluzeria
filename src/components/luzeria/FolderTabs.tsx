import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Folder, FolderOpen } from "lucide-react";

export type FolderTabItem = { id: string; label: string; badge?: number | string | null };

type Layout = { kind: "rows"; rows: FolderTabItem[][]; level: 0 | 1 | 2 } | { kind: "select" };
const LEVEL_CLASS = ["", "lz-ftabs--compact", "lz-ftabs--compact lz-ftabs--noicon"] as const;

const GAP = 5; // mesmo gap do .lz-ftab-row
const ROW_PADDING = 24; // padding horizontal do .lz-ftab-row (12px de cada lado)

/** Abas em formato de divisória de pasta (estilos em styles.css, `.lz-ftab*`).
 * Sempre tenta caber tudo em UMA linha; se não couber, divide em DUAS (a linha da aba atual desce pra ficar
 * colada no conteúdo); se nem em duas couber (tela estreita), vira uma caixa de seleção.
 * `size="sm"` é a versão menor, pra sub-abas dentro de uma tela. `trailing` entra no fim da última linha. */
export function FolderTabs({
  items, activeId, onChange, size = "md", icons = true, trailing, className = "", ...rest
}: {
  items: FolderTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  size?: "md" | "sm";
  icons?: boolean;
  trailing?: React.ReactNode;
  className?: string;
  "data-tour"?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout>({ kind: "rows", rows: [items], level: 0 });
  const itemsKey = items.map((i) => `${i.id}:${i.label}:${i.badge ?? ""}`).join("|");

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const measure = measureRef.current;
    if (!wrap || !measure) return;
    const compute = () => {
      const levels = Array.from(measure.children).map((row) => Array.from(row.firstElementChild!.children).map((c) => (c as HTMLElement).getBoundingClientRect().width));
      if (levels.length !== 3 || levels.some((w) => w.length !== items.length || w.some((x) => x === 0))) return;
      const avail = wrap.clientWidth - ROW_PADDING - (trailing ? 44 : 0) - 16; // folga: arredondamento e fonte que carrega depois
      const sum = (widths: number[], a: number, b: number) => widths.slice(a, b).reduce((t, w) => t + w, 0) + GAP * Math.max(0, b - a - 1);
      // 1) tudo em uma linha, apertando um pouco se precisar (espaçamento menor, depois sem ícones)
      for (let lv = 0; lv < 3; lv++) {
        if (sum(levels[lv], 0, items.length) <= avail) { setLayout({ kind: "rows", rows: [items], level: lv as 0 | 1 | 2 }); return; }
      }
      // 2) no máximo duas linhas (tamanho normal)
      const w0 = levels[0];
      let best = -1, bestMax = Infinity;
      for (let k = 1; k < items.length; k++) {
        const m = Math.max(sum(w0, 0, k), sum(w0, k, items.length));
        if (m < bestMax) { bestMax = m; best = k; }
      }
      if (best > 0 && bestMax <= avail) setLayout({ kind: "rows", rows: [items.slice(0, best), items.slice(best)], level: 0 });
      else setLayout({ kind: "select" }); // 3) tela estreita: caixa de seleção
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    // A fonte (Inter) pode terminar de carregar depois da 1ª medição e deixar as abas mais largas: mede de novo.
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) compute(); });
    return () => { alive = false; ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, size, !!trailing]);

  const tabButton = (t: FolderTabItem, active: boolean, onClick?: () => void) => {
    const Icon = active ? FolderOpen : Folder;
    return (
      <button key={t.id} type="button" role="tab" aria-selected={active} onClick={onClick} tabIndex={onClick ? 0 : -1} className="lz-ftab">
        {icons && <Icon size={size === "sm" ? 12 : 14} className="lz-ftab-icon" />}
        {t.label}
        {t.badge != null && t.badge !== "" && <span className="lz-ftab-badge">{t.badge}</span>}
      </button>
    );
  };

  let rows: FolderTabItem[][] = layout.kind === "rows" ? layout.rows : [];
  if (rows.length > 1) rows = [...rows].sort((a, b) => Number(a.some((t) => t.id === activeId)) - Number(b.some((t) => t.id === activeId)));
  const lastRow = rows.length - 1;

  return (
    <div ref={wrapRef} className={`lz-ftabs ${size === "sm" ? "lz-ftabs--sm" : ""} ${layout.kind === "rows" ? LEVEL_CLASS[layout.level] : ""} lz-no-print relative ${className}`} data-tour={rest["data-tour"]}>
      {/* Linha invisível só pra medir a largura natural de cada aba. */}
      <div ref={measureRef} aria-hidden style={{ position: "absolute", visibility: "hidden", pointerEvents: "none", height: 0, overflow: "hidden", whiteSpace: "nowrap" }}>
        {LEVEL_CLASS.map((cls, lv) => (
          <div key={lv} className={cls}>
            <div className="lz-ftab-row" style={{ borderBottom: 0, flexWrap: "nowrap", width: "max-content" }}>
              {items.map((t) => tabButton(t, false))}
            </div>
          </div>
        ))}
      </div>

      {layout.kind === "select" ? (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <select aria-label="Seção" value={activeId} onChange={(e) => onChange(e.target.value)}
              className="w-full appearance-none rounded-xl border border-foreground/15 bg-card text-foreground text-[13px] font-bold uppercase tracking-wider pl-4 pr-10 py-3 outline-none focus:border-[rgb(var(--lz-brand-rgb))]">
              {items.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-foreground/50" />
          </div>
          {trailing}
        </div>
      ) : (
        <div role="tablist">
          {rows.map((row, ri) => (
            <div key={ri} className="lz-ftab-row" style={rows.length === 1 ? { flexWrap: "nowrap" } : undefined}>
              {row.map((t) => tabButton(t, t.id === activeId, () => onChange(t.id)))}
              {ri === lastRow && trailing ? <div className="lz-ftab-trailing">{trailing}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
