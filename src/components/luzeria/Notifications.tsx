import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { notificationsQO, useApi } from "@/lib/luzeria/queries";

export function NotificationsBell() {
  const { data: list = [] } = useQuery(notificationsQO());
  const unread = list.filter((n) => !n.read).length;
  const { markNotificationRead } = useApi();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-md text-white/60 hover:text-white hover:bg-white/5 transition">
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[340px] rounded-lg bg-[#1C1C1C] border border-white/10 shadow-2xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-bold text-white">Notificações</span>
            {unread > 0 && (
              <button onClick={() => markNotificationRead.mutate({ data: { all: true } })}
                className="text-[11px] text-[#C8D44E] hover:underline">Marcar todas lidas</button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {list.length === 0 && <p className="text-xs text-white/40 px-4 py-6 text-center">Sem notificações.</p>}
            {list.map((n) => (
              <button key={n.id}
                onClick={() => { if (!n.read) markNotificationRead.mutate({ data: { id: n.id } }); }}
                className="w-full text-left px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors block">
                <div className="flex items-start gap-2">
                  {!n.read && <span className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "#C8D44E" }} />}
                  <div className="flex-1">
                    <p className="text-xs text-white/90">{n.message}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">{relTime(n.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `há ${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}