import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { profilesQO } from "@/lib/luzeria/queries";
import { Avatar } from "./Avatar";
import { X } from "lucide-react";

/**
 * Floating picker. Lists active profiles and accepts a free-text name
 * (for collaborators that aren't system users yet). Calls onPick with
 * { userId, label } where exactly one of them is set, or both null to clear.
 */
export function AssigneePicker({
  anchorRect, onClose, onPick,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  onPick: (p: { userId: string | null; label: string | null }) => void;
}) {
  const { data: profiles = [] } = useQuery(profilesQO());
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const term = q.trim().toLowerCase();
  const filtered = profiles.filter((p) => p.active && (!term || p.name.toLowerCase().includes(term)));

  const vw = typeof window !== "undefined" ? window.innerWidth : 1000;
  const W = 240;
  let left = anchorRect.left;
  if (left + W > vw - 8) left = Math.max(8, vw - W - 8);
  const top = Math.min(anchorRect.bottom + 4, (typeof window !== "undefined" ? window.innerHeight : 800) - 320);

  return (
    <div ref={ref}
      style={{ position: "fixed", top, left, width: W }}
      className="z-[1100] rounded-md bg-[#1C1C1C] border border-white/10 shadow-2xl p-2"
    >
      <input
        autoFocus value={q} onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && q.trim()) {
            onPick({ userId: null, label: q.trim() }); onClose();
          }
        }}
        placeholder="Buscar ou digitar nome…"
        className="w-full text-xs bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-white outline-none focus:border-[#C8D44E]"
      />
      <div className="max-h-60 overflow-y-auto mt-1">
        {filtered.map((p) => (
          <button key={p.id}
            onClick={() => { onPick({ userId: p.id, label: null }); onClose(); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 text-left">
            <Avatar profile={p} size={22} />
            <span className="text-xs text-white truncate">{p.name}</span>
          </button>
        ))}
        {q.trim() && !filtered.some((p) => p.name.toLowerCase() === term) && (
          <button
            onClick={() => { onPick({ userId: null, label: q.trim() }); onClose(); }}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-white/5 text-xs text-[#C8D44E]">
            + Usar “{q.trim()}”
          </button>
        )}
      </div>
      <button
        onClick={() => { onPick({ userId: null, label: null }); onClose(); }}
        className="mt-2 w-full flex items-center gap-1.5 justify-center text-[11px] text-red-400 hover:bg-red-500/10 rounded py-1.5">
        <X size={11} /> Limpar atribuição
      </button>
    </div>
  );
}

/** Pick a stable color from a free-text label so cells are visually distinct. */
const LABEL_PALETTE = [
  "#C8D44E", "#FF6B6B", "#4A9EFF", "#FF8C42", "#A855F7",
  "#10B981", "#F59E0B", "#EC4899", "#22D3EE", "#F472B6", "#84CC16",
];
export function colorForLabel(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return LABEL_PALETTE[h % LABEL_PALETTE.length];
}