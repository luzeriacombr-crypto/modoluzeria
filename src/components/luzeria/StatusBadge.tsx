import { useEffect, useRef, useState } from "react";
import { STATUS_META, STATUS_ORDER, type Status } from "@/lib/luzeria/types";
import { STATUS_ICONS } from "./icons";

export function StatusBadge({
  status, onChange, size = "sm",
}: { status: Status; onChange?: (s: Status) => void; size?: "sm" | "md" }) {
  const meta = STATUS_META[status];
  const Icon = STATUS_ICONS[status];
  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        disabled={!onChange}
        onClick={(e) => { e.stopPropagation(); if (onChange) setOpen((o) => !o); }}
        className={`inline-flex items-center gap-1.5 rounded ${size === "md" ? "px-2.5 py-1 text-[11px]" : "px-2 py-1 text-[10px]"} font-bold uppercase tracking-wide transition-transform ${pulse ? "lz-pulse" : ""} ${onChange ? "hover:opacity-90 cursor-pointer" : "cursor-default"}`}
        style={{ backgroundColor: meta.bg, color: meta.color }}
      >
        <Icon size={12} />
        <span>{meta.label}</span>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 left-0 min-w-[180px] rounded-md bg-[#1C1C1C] border border-white/10 shadow-xl py-1">
          {STATUS_ORDER.map((s) => {
            const m = STATUS_META[s];
            const I = STATUS_ICONS[s];
            return (
              <button key={s}
                onClick={(e) => { e.stopPropagation(); onChange?.(s); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 transition-colors text-left">
                <span className="rounded p-1" style={{ backgroundColor: m.bg, color: m.color }}>
                  <I size={11} />
                </span>
                <span className="text-white/80">{m.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}