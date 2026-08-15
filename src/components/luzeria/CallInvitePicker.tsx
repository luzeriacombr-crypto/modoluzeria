import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { profilesQO, useMe } from "@/lib/luzeria/queries";
import { startScreenShareCall } from "@/lib/luzeria/call-store";
import { Avatar } from "./Avatar";

/** Floating picker to start a screen-share call, adapted from
 * AssigneePicker.tsx's positioning/close-on-outside-click pattern but
 * simplified: no free-text entry, just active org teammates (minus self). */
export function CallInvitePicker({ anchorRect, onClose }: { anchorRect: DOMRect; onClose: () => void }) {
  const me = useMe().data;
  const { data: profiles = [] } = useQuery(profilesQO());
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onScroll = () => onClose();
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("mousedown", h);
    return () => {
      document.removeEventListener("mousedown", h);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  const term = q.trim().toLowerCase();
  const filtered = profiles.filter((p) => p.active && p.id !== me?.id && (!term || p.name.toLowerCase().includes(term)));

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
        placeholder="Buscar…"
        className="w-full text-xs bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
      />
      <div className="max-h-60 overflow-y-auto mt-1">
        {filtered.map((p) => (
          <button key={p.id}
            onClick={() => { startScreenShareCall(p.id, p.name, p.avatarUrl ?? null); onClose(); }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 text-left">
            <Avatar profile={p} size={22} />
            <span className="text-xs text-white truncate">{p.name}</span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="px-2 py-3 text-[11px] text-white/30 text-center">
            {term ? "Ninguém encontrado." : "Nenhum outro membro ativo."}
          </div>
        )}
      </div>
    </div>
  );
}
