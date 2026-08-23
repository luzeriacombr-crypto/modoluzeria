import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { profilesQO, useMe } from "@/lib/luzeria/queries";
import { startScreenShareCall } from "@/lib/luzeria/call-store";
import { Avatar } from "./Avatar";

/** Floating picker to start a video call, adapted from AssigneePicker.tsx's
 * positioning/close-on-outside-click pattern but simplified: no free-text
 * entry, just active org teammates (minus self). Supports picking several
 * people at once for a group call — a single click still calls that one
 * person immediately, like before; picking 2+ needs the "Ligar" button. */
export function CallInvitePicker({ anchorRect, onClose }: { anchorRect: DOMRect; onClose: () => void }) {
  const me = useMe().data;
  const { data: profiles = [] } = useQuery(profilesQO());
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
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

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function callNow(ids: string[]) {
    const invitees = profiles
      .filter((p) => ids.includes(p.id))
      .map((p) => ({ userId: p.id, name: p.name, avatarUrl: p.avatarUrl ?? null }));
    if (invitees.length === 0) return;
    startScreenShareCall(invitees);
    onClose();
  }

  const vw = typeof window !== "undefined" ? window.innerWidth : 1000;
  const W = 240;
  let left = anchorRect.left;
  if (left + W > vw - 8) left = Math.max(8, vw - W - 8);
  const top = Math.min(anchorRect.bottom + 4, (typeof window !== "undefined" ? window.innerHeight : 800) - 320);

  return (
    <div ref={ref}
      style={{ position: "fixed", top, left, width: W }}
      className="z-[1100] rounded-md bg-card border border-foreground/10 shadow-2xl p-2"
    >
      <input
        autoFocus value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar…"
        className="w-full text-xs bg-background border border-foreground/10 rounded px-2 py-1.5 text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
      />
      <div className="max-h-60 overflow-y-auto mt-1">
        {filtered.map((p) => {
          const isPicked = picked.has(p.id);
          return (
            <button key={p.id}
              onClick={() => (picked.size > 0 ? toggle(p.id) : callNow([p.id]))}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-foreground/5 text-left">
              <span
                onClick={(e) => { e.stopPropagation(); toggle(p.id); }}
                className="shrink-0 h-4 w-4 rounded flex items-center justify-center border transition-colors"
                style={{
                  backgroundColor: isPicked ? "rgb(var(--lz-brand-rgb))" : "transparent",
                  borderColor: isPicked ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 25%, transparent)",
                }}
                title="Selecionar pra chamada em grupo"
              >
                {isPicked && <Check size={11} color="#0D0D0D" />}
              </span>
              <Avatar profile={p} size={22} />
              <span className="text-xs text-foreground truncate">{p.name}</span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-2 py-3 text-[11px] text-foreground/30 text-center">
            {term ? "Ninguém encontrado." : "Nenhum outro membro ativo."}
          </div>
        )}
      </div>
      {picked.size > 0 && (
        <button
          onClick={() => callNow([...picked])}
          className="w-full mt-1.5 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-2 rounded-md"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          Ligar pra {picked.size} {picked.size === 1 ? "pessoa" : "pessoas"}
        </button>
      )}
    </div>
  );
}
