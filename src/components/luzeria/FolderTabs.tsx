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
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const computeRef = useRef<(force?: boolean) => void>(() => {});
  // Quando uma linha se mostra estourada de verdade, vira um "piso": não volta pra um estado mais largo
  // enquanto a largura da área não crescer de fato.
  const floorRef = useRef({ rank: 0, width: 0 });
  const itemsKey = items.map((i) => `${i.id}:${i.label}:${i.badge ?? ""}`).join("|");

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const measure = measureRef.current;
    if (!wrap || !measure) return;
    // Estados em ordem de preferência: 0-2 = uma linha (normal, apertado, sem ícones), 3 = duas linhas, 4 = caixa de seleção.
    const rankOf = (l: Layout) => (l.kind === "select" ? 4 : l.rows.length === 2 ? 3 : l.level);
    const compute = (force = false) => {
      const levels = Array.from(measure.children).map((row) => Array.from(row.firstElementChild!.children).map((c) => (c as HTMLElement).getBoundingClientRect().width));
      if (levels.length !== 3 || levels.some((w) => w.length !== items.length || w.some((x) => x === 0))) return;
      const avail = wrap.clientWidth - ROW_PADDING - (trailing ? 44 : 0) - 16; // folga: arredondamento e fonte que carrega depois
      const sum = (widths: number[], a: number, b: number) => widths.slice(a, b).reduce((t, w) => t + w, 0) + GAP * Math.max(0, b - a - 1);
      const w0 = levels[0];
      let best = -1, bestMax = Infinity;
      for (let k = 1; k < items.length; k++) {
        const m = Math.max(sum(w0, 0, k), sum(w0, k, items.length));
        if (m < bestMax) { bestMax = m; best = k; }
      }
      const cur = rankOf(layoutRef.current);
      const floor = wrap.clientWidth >= floorRef.current.width + 28 ? 0 : floorRef.current.rank;
      // Histerese: pra VOLTAR a um estado mais folgado, exige 28px a mais. Sem isso, mudar a altura da página
      // faz a barra de rolagem aparecer/sumir, a largura oscila e a tela fica "tremendo".
      const need = (r: number) => (r < cur ? 28 : 0);
      let next: Layout = { kind: "select" };
      for (let r = floor; r < 5; r++) {
        if (r < 3 && sum(levels[r], 0, items.length) + need(r) <= avail) { next = { kind: "rows", rows: [items], level: r as 0 | 1 | 2 }; break; }
        if (r === 3 && best > 0 && bestMax + need(r) <= avail) { next = { kind: "rows", rows: [items.slice(0, best), items.slice(best)], level: 0 }; break; }
      }
      const prev = layoutRef.current;
      const same = rankOf(prev) === rankOf(next) && (next.kind !== "rows" || (prev.kind === "rows" && prev.rows[0].length === next.rows[0].length));
      if (force || !same) setLayout(next);
    };
    computeRef.current = compute;
    compute(true);
    let lastW = wrap.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth;
      if (Math.abs(w - lastW) < 1) return; // mudou só a altura (ex.: 1 linha -> 2): não precisa medir de novo
      lastW = w;
      compute();
    });
    ro.observe(wrap);
    // A fonte (Inter) pode terminar de carregar depois da 1ª medição e deixar as abas mais largas: mede de novo.
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) compute(); });
    return () => { alive = false; ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, size, !!trailing]);

  // Rede de segurança: se, depois de desenhar, alguma linha ainda passa da largura (medição errada, fonte diferente...),
  // desce um degrau (mais apertado -> sem ícones -> duas linhas -> caixa de seleção) em vez de deixar a aba estourar.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || layout.kind !== "rows") return;
    const overflowing = Array.from(wrap.querySelectorAll<HTMLElement>('[role="tablist"] .lz-ftab-row')).some((r) => r.scrollWidth > r.clientWidth + 1);
    if (!overflowing) return;
    floorRef.current = { rank: Math.min(4, (layout.rows.length === 2 ? 3 : layout.level) + 1), width: wrap.clientWidth };
    computeRef.current(true);
  });

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
            <div key={ri} className="lz-ftab-row" style={{ flexWrap: "nowrap" }}>
              {row.map((t) => tabButton(t, t.id === activeId, () => onChange(t.id)))}
              {ri === lastRow && trailing ? <div className="lz-ftab-trailing">{trailing}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
