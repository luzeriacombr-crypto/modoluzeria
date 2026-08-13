import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { STATUS_META, STATUS_ORDER, statusLabel, type Status } from "@/lib/luzeria/types";
import { STATUS_ICONS } from "./icons";

export function StatusBadge({
  status, onChange, size = "sm", options, isAvulso = false,
}: { status: Status; onChange?: (s: Status) => void; size?: "sm" | "md"; options?: Status[]; isAvulso?: boolean }) {
  const list = options ?? STATUS_ORDER;
  const meta = STATUS_META[status];
  const Icon = STATUS_ICONS[status];
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
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
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, left: rect.left });
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
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
          boxShadow: onChange ? `0 0 0 0 ${meta.color}00` : undefined,
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
          className="fixed z-[200] min-w-[180px] rounded-md bg-[#1C1C1C] border border-white/10 shadow-xl py-1 max-h-[60vh] overflow-y-auto"
          style={{ top: pos.top, left: pos.left }}
        >
          {list.map((s) => {
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
                <span className="text-white/80">{statusLabel(s, isAvulso)}</span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}