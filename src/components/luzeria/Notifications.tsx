import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { notificationsQO, useApi } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { useIsMobile } from "@/hooks/use-mobile";

export function NotificationsBell() {
  const { data: list = [] } = useQuery(notificationsQO());
  const unread = list.filter((n) => !n.read).length;
  const { markNotificationRead } = useApi();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const { selectMonth, openItem, flash } = useUI();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open) return;
    if (!isMobile) {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, isMobile]);

  return (
    <div className="relative" ref={ref}>
      <button ref={btnRef} onClick={() => setOpen((o) => !o)}
        data-tour="notifications"
        className="relative p-2 rounded-md text-white/60 hover:text-white hover:bg-white/5 transition">
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (isMobile || pos) && createPortal(
        <>
          {isMobile && (
            <div
              className="fixed inset-0 z-[99] bg-black/60"
              onClick={() => setOpen(false)}
            />
          )}
        <div
          ref={popRef}
          className={isMobile ? "fixed inset-0 z-[100] flex flex-col lz-notif-pop" : "fixed w-[380px] overflow-hidden z-[100] lz-notif-pop"}
          style={isMobile ? {
            background: "#1C1C1C",
          } : {
            top: pos!.top,
            right: pos!.right,
            background: "#1C1C1C",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2">
              {isMobile && (
                <button onClick={() => setOpen(false)} className="p-1 -ml-1 text-white/60 hover:text-white">
                  <X size={18} />
                </button>
              )}
              <span className="text-sm font-bold text-white">Notificações</span>
            </div>
            {unread > 0 && (
              <button onClick={() => markNotificationRead.mutate({ data: { all: true } })}
                className="text-[11px] text-[#C8D44E] hover:underline">Marcar todas como lidas</button>
            )}
          </div>
          <div className={isMobile ? "flex-1 overflow-y-auto" : "max-h-[480px] overflow-y-auto"}>
            {list.length === 0 && <p className="text-xs text-white/40 px-4 py-6 text-center">Sem notificações.</p>}
            {list.map((n: any) => (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.read) markNotificationRead.mutate({ data: { id: n.id } });
                  setOpen(false);
                  if (n.clientId && n.monthKey && n.itemId) {
                    navigate({ to: "/cliente/$clientId", params: { clientId: n.clientId } });
                    selectMonth(n.monthKey);
                    setTimeout(() => { openItem(n.itemId); flash(n.itemId); }, 50);
                    setTimeout(() => flash(null), 2050);
                  }
                }}
                className="w-full text-left px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors block"
                style={{
                  backgroundColor: !n.read ? "rgba(200,212,78,0.06)" : "transparent",
                  opacity: n.read ? 0.6 : 1,
                }}
              >
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
        </>,
        document.body
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