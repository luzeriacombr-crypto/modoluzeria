import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { STATUS_META, STATUS_ORDER, STATUS_GROUPS, statusLabel, type Status } from "@/lib/luzeria/types";
import { STATUS_ICONS } from "./icons";

export function StatusBadge({
  status, onChange, size = "sm", options, isAvulso = false,
}: { status: Status; onChange?: (s: Status) => void; size?: "sm" | "md"; options?: Status[]; isAvulso?: boolean }) {
  const list = options ?? STATUS_ORDER;
  // Grouped by pipeline phase once the list is long enough that a flat wall
  // of options is hard to scan; short lists (e.g. activities: só Pendente/
  // Concluído) stay flat — headers would just add noise for 2-3 items.
  const groups = list.length > 4
    ? STATUS_GROUPS
        .map((g) => ({ label: g.label, items: list.filter((s) => g.statuses.includes(s)) }))
        .filter((g) => g.items.length > 0)
    : [{ label: null as string | null, items: list }];
  const meta = STATUS_META[status];
  const Icon = STATUS_ICONS[status];
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const prev = useRef(status);

  useEffect(() => {
    if (prev.current !== status) {
      prev.current = status;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 220);
      return () => clearTimeout(t);
    }
  }, [status]);

  useEffect(() => {
    if (!open) return;
    // Keeps the popover glued to the button — recomputed on scroll/resize
    // (capture phase, so it fires for scrollable ancestors too, not just
    // window), otherwise it stays frozen where the button used to be as
    // soon as the board/grid underneath scrolls.
    function place() {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      // Flip upward when there's more room above than below and not much
      // room below — otherwise the popover (up to 60vh tall) runs off the
      // bottom of the screen instead of adapting, especially on cards near
      // the end of the page.
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Havia trava vertical mas nenhuma horizontal: numa tela estreita o
      // menu abria pra fora da direita e as opções ficavam inalcançáveis
      // (é fixed, então não dá nem pra rolar até elas).
      const MENU_W = 188;
      const left = Math.max(4, Math.min(rect.left, window.innerWidth - MENU_W - 4));
      if (spaceBelow < 240 && spaceAbove > spaceBelow) {
        setPos({ bottom: window.innerHeight - rect.top + 4, left });
      } else {
        setPos({ top: rect.bottom + 4, left });
      }
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", h);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={!onChange}
        onClick={(e) => { e.stopPropagation(); if (onChange) setOpen((o) => !o); }}
        className={`group inline-flex items-center gap-1.5 rounded ${size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-1 text-[10px]"} font-bold uppercase tracking-wide transition-all duration-200 ${pulse ? "lz-pulse" : ""} ${onChange ? "cursor-pointer hover:scale-[1.05] hover:brightness-110" : "cursor-default"}`}
        style={{
          backgroundColor: meta.bg,
          color: meta.color,
          boxShadow: onChange ? "0 0 0 0 transparent" : undefined,
        }}
        onMouseEnter={(e) => {
          if (onChange) e.currentTarget.style.boxShadow = `0 0 0 3px ${meta.bg}`;
        }}
        onMouseLeave={(e) => {
          if (onChange) e.currentTarget.style.boxShadow = `0 0 0 0 ${meta.bg}`;
        }}
      >
        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
        <Icon size={12} />
        <span>{statusLabel(status, isAvulso)}</span>
        {onChange && (
          <ChevronDown
            size={11}
            className="opacity-0 -ml-0.5 group-hover:opacity-80 transition-opacity duration-200"
          />
        )}
      </button>
      {open && pos && createPortal(
        <div
          ref={popRef}
          className="fixed z-[200] min-w-[180px] rounded-md bg-card border border-foreground/10 shadow-xl py-1 max-h-[60vh] overflow-y-auto"
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left }}
        >
          {groups.map((g, gi) => (
            <div key={g.label ?? gi}>
              {g.label && (
                <div className={`px-3 pb-1 text-[9.5px] font-bold uppercase tracking-wider text-foreground/35 ${gi > 0 ? "pt-2.5 mt-1 border-t border-foreground/6" : "pt-1.5"}`}>
                  {g.label}
                </div>
              )}
              {g.items.map((s) => {
                const m = STATUS_META[s];
                const I = STATUS_ICONS[s];
                return (
                  <button key={s}
                    onClick={(e) => { e.stopPropagation(); onChange?.(s); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-all duration-150 text-left hover:translate-x-0.5"
                    style={{ backgroundColor: "transparent" }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = m.bg; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}>
                    <span className="rounded p-1" style={{ backgroundColor: m.bg, color: m.color }}>
                      <I size={11} />
                    </span>
                    <span className="text-foreground/80">{statusLabel(s, isAvulso)}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}