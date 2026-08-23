import { useEffect, useRef, useState } from "react";
import { Move } from "lucide-react";

export type CellRect = { x: number; y: number; w: number; h: number };

type Widget = {
  id: string;
  node: React.ReactNode;
  default: CellRect;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
};

function rectsOverlap(a: CellRect, b: CellRect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

type DragState = {
  id: string;
  mode: "move" | "resize";
  startClientX: number;
  startClientY: number;
  startRect: CellRect;
  liveRect: CellRect;
  invalid: boolean;
};

/** Grid de "quadros" arrastáveis/redimensionáveis (estilo Grafana/Notion),
 * construído do zero com pointer events em vez de uma lib de terceiros —
 * evita mexer no package.json/bun.lock enquanto outra sessão já está com
 * mudanças pendentes neles. Posição/tamanho em unidades de grid (não px),
 * pra persistir de forma estável independente da largura da tela. Rejeita
 * (reverte) um drop que sobreporia outro card, em vez de empurrar/compactar
 * os outros — mais simples e previsível com poucos widgets. */
export function DashboardGrid({
  widgets, layout, editing, onLayoutChange, cols = 12, rowHeight = 140, gap = 12,
}: {
  widgets: Widget[];
  layout: Record<string, CellRect>;
  editing: boolean;
  onLayoutChange: (layout: Record<string, CellRect>) => void;
  cols?: number;
  rowHeight?: number;
  gap?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => setContainerWidth(entries[0].contentRect.width));
    obs.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => obs.disconnect();
  }, []);

  const cellW = cols > 0 ? (containerWidth - gap * (cols - 1)) / cols : 0;

  function effectiveRect(w: Widget): CellRect {
    if (drag?.id === w.id) return drag.liveRect;
    return layout[w.id] ?? w.default;
  }

  function rectStyle(r: CellRect): React.CSSProperties {
    return {
      position: "absolute",
      left: r.x * (cellW + gap),
      top: r.y * (rowHeight + gap),
      width: r.w * cellW + (r.w - 1) * gap,
      height: r.h * rowHeight + (r.h - 1) * gap,
      transition: drag ? "none" : "left 200ms ease, top 200ms ease, width 200ms ease, height 200ms ease",
    };
  }

  function startDrag(w: Widget, mode: "move" | "resize", e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startRect = layoutRef.current[w.id] ?? w.default;
    const state: DragState = {
      id: w.id, mode, startClientX: e.clientX, startClientY: e.clientY, startRect, liveRect: startRect, invalid: false,
    };
    dragRef.current = state;
    setDrag(state);

    function onMove(ev: PointerEvent) {
      const cur = dragRef.current;
      if (!cur) return;
      const dxCells = Math.round((ev.clientX - cur.startClientX) / (cellW + gap));
      const dyCells = Math.round((ev.clientY - cur.startClientY) / (rowHeight + gap));
      let next: CellRect;
      if (cur.mode === "move") {
        next = {
          x: clamp(cur.startRect.x + dxCells, 0, cols - cur.startRect.w),
          y: Math.max(0, cur.startRect.y + dyCells),
          w: cur.startRect.w,
          h: cur.startRect.h,
        };
      } else {
        const minW = w.minW ?? 2, minH = w.minH ?? 1;
        const maxW = w.maxW ?? cols, maxH = w.maxH ?? 6;
        next = {
          x: cur.startRect.x,
          y: cur.startRect.y,
          w: clamp(cur.startRect.w + dxCells, minW, Math.min(maxW, cols - cur.startRect.x)),
          h: clamp(cur.startRect.h + dyCells, minH, maxH),
        };
      }
      const invalid = widgets.some((other) => other.id !== w.id && rectsOverlap(next, layoutRef.current[other.id] ?? other.default));
      const updated: DragState = { ...cur, liveRect: next, invalid };
      dragRef.current = updated;
      setDrag(updated);
    }

    function onUp() {
      const cur = dragRef.current;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      dragRef.current = null;
      setDrag(null);
      if (cur && !cur.invalid) {
        onLayoutChange({ ...layoutRef.current, [w.id]: cur.liveRect });
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const maxY = Math.max(1, ...widgets.map((w) => { const r = effectiveRect(w); return r.y + r.h; }));
  const containerHeight = maxY * (rowHeight + gap) - gap;

  return (
    <div ref={containerRef} className="relative" style={{ height: containerHeight }}>
      {widgets.map((w) => {
        const r = effectiveRect(w);
        const isDraggingThis = drag?.id === w.id;
        return (
          <div key={w.id} style={rectStyle(r)}>
            <div className="relative h-full w-full">
              {w.node}
              {editing && (
                <div
                  className="absolute inset-0 rounded-xl z-10"
                  style={{
                    outline: isDraggingThis ? `2px solid ${drag!.invalid ? "#FF4444" : "rgb(var(--lz-brand-rgb))"}` : "2px dashed color-mix(in srgb, var(--foreground) 25%, transparent)",
                    outlineOffset: 2,
                    cursor: "grab",
                    background: isDraggingThis ? (drag!.invalid ? "rgba(255,68,68,0.08)" : "rgba(var(--lz-brand-rgb),0.08)") : "transparent",
                  }}
                  onPointerDown={(e) => startDrag(w, "move", e)}
                >
                  <div className="absolute top-1.5 left-1.5 h-6 w-6 rounded-md bg-black/60 backdrop-blur flex items-center justify-center text-foreground/70">
                    <Move size={13} />
                  </div>
                  <div
                    className="absolute bottom-0 right-0 h-5 w-5 rounded-tl-md cursor-nwse-resize flex items-end justify-end p-0.5"
                    style={{ background: isDraggingThis && drag!.mode === "resize" ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 35%, transparent)" }}
                    onPointerDown={(e) => startDrag(w, "resize", e)}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
