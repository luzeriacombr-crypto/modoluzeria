import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { clientsQO } from "@/lib/luzeria/queries";
import { X } from "lucide-react";

/**
 * Floating picker for choosing a client (not a free-text option — every
 * client already exists in the system). Calls onPick with a client id,
 * or null to clear.
 */
export function ClientPicker({
  anchorRect, onClose, onPick,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  onPick: (clientId: string | null) => void;
}) {
  const { data: clients = [] } = useQuery(clientsQO());
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
  const filtered = clients.filter((c) => !c.archived && (!term || c.name.toLowerCase().includes(term)));

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
        placeholder="Buscar cliente…"
        className="w-full text-xs bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
      />
      <div className="max-h-60 overflow-y-auto mt-1">
        {filtered.length === 0 && (
          <p className="text-[11px] text-white/30 px-2 py-2">Nenhum cliente encontrado.</p>
        )}
        {filtered.map((c) => (
          <button key={c.id}
            onClick={() => { onPick(c.id); onClose(); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 text-left">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
            <span className="text-xs text-white truncate">{c.name}</span>
          </button>
        ))}
      </div>
      <button
        onClick={() => { onPick(null); onClose(); }}
        className="mt-2 w-full flex items-center gap-1.5 justify-center text-[11px] text-red-400 hover:bg-red-500/10 rounded py-1.5">
        <X size={11} /> Limpar cliente
      </button>
    </div>
  );
}
