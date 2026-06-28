import { LayoutDashboard, Users, Bell, User, Camera, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useUI } from "@/lib/luzeria/ui-store";
import { useMe, notificationsQO, clientsQO, useApi } from "@/lib/luzeria/queries";
import { Avatar } from "./Avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

export function MobileNav() {
  const isMobile = useIsMobile();
  const { view, setView, selectClient } = useUI();
  const me = useMe().data;
  const { data: notes = [] } = useQuery(notificationsQO());
  const { data: clients = [] } = useQuery(clientsQO());
  const { markNotificationRead } = useApi();
  const unread = notes.filter((n) => !n.read).length;
  const [tab, setTab] = useState<"home" | "clients" | "bell" | "me">("home");
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view === "my" || view === "stories" || view === "cleaning" || view === "admin") setTab("home");
    if (view === "client") setTab("clients");
  }, [view]);

  if (!isMobile) return null;

  return (
    <>
      {tab === "clients" && view !== "client" && (
        <div className="fixed inset-0 z-40 bg-[#0D0D0D] pt-14 pb-20 overflow-y-auto">
          <div className="px-5 py-4 border-b border-white/[0.06] sticky top-14 bg-[#0D0D0D]">
            <h2 className="text-lg font-bold text-white">Clientes</h2>
          </div>
          <ul>
            {clients.filter((c) => !c.archived).map((c) => (
              <li key={c.id}>
                <button onClick={() => { selectClient(c.id); setTab("home"); }}
                  className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.03] text-left">
                  <Avatar name={c.name} color={c.color} size={32} />
                  <span className="text-sm text-white truncate flex-1">{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "bell" && (
        <div className="fixed inset-0 z-40 bg-[#0D0D0D] pt-14 pb-20 overflow-y-auto" onClick={() => setTab("home")}>
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between sticky top-14 bg-[#0D0D0D]">
            <h2 className="text-lg font-bold text-white">Notificações</h2>
            {unread > 0 && (
              <button onClick={(e) => { e.stopPropagation(); markNotificationRead.mutate({ data: { all: true } }); }}
                className="text-xs text-[#C8D44E]">Marcar todas</button>
            )}
          </div>
          {notes.length === 0 && <p className="text-xs text-white/40 px-5 py-10 text-center">Sem notificações.</p>}
          {notes.map((n) => (
            <div key={n.id} className="px-5 py-3 border-b border-white/[0.04]">
              <div className="flex gap-2">
                {!n.read && <span className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 bg-[#C8D44E]" />}
                <p className="text-xs text-white/90 flex-1">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "me" && (
        <div className="fixed inset-0 z-40 bg-[#0D0D0D] pt-14 pb-20" onClick={() => setTab("home")}>
          <div className="px-5 py-6 flex flex-col items-center gap-3">
            {me && <Avatar profile={me} size={64} />}
            <div className="text-white font-bold text-base">{me?.name}</div>
            <div className="text-white/50 text-xs">{me?.email}</div>
            <button onClick={() => supabase.auth.signOut().then(() => (location.href = "/auth"))}
              className="mt-6 text-xs text-red-400 hover:underline">Sair</button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 flex items-center justify-around bg-[#1C1C1C] border-t border-white/[0.08]">
        <NavBtn icon={<LayoutDashboard size={20} />} active={tab === "home" && view === "my"}
          onClick={() => { setView("my"); setTab("home"); }} />
        <NavBtn icon={<Camera size={20} />} active={view === "stories"} onClick={() => { setView("stories"); setTab("home"); }} />
        <NavBtn icon={<Sparkles size={20} />} active={view === "cleaning"} onClick={() => { setView("cleaning"); setTab("home"); }} />
        <NavBtn icon={<Users size={20} />} active={tab === "clients"} onClick={() => setTab("clients")} />
        <NavBtn icon={<Bell size={20} />} badge={unread} active={tab === "bell"} onClick={() => setTab("bell")} />
        <NavBtn icon={me ? <Avatar profile={me} size={22} /> : <User size={20} />} active={tab === "me"} onClick={() => setTab("me")} />
      </nav>
    </>
  );
}

function NavBtn({ icon, active, onClick, badge }: { icon: React.ReactNode; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick}
      className="relative flex items-center justify-center h-12 w-16 transition-colors"
      style={{ color: active ? "#C8D44E" : "rgba(255,255,255,0.4)" }}>
      {icon}
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-1 right-3 min-w-[14px] h-[14px] rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center px-1">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}