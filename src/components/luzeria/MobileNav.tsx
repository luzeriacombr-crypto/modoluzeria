import { LayoutDashboard, Users, User, BarChart2, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef, useMemo } from "react";
import { useUI } from "@/lib/luzeria/ui-store";
import { useMe, clientsQO } from "@/lib/luzeria/queries";
import { Avatar } from "./Avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

const CATEGORY_ORDER = ["Social Media", "Pack Digital", "Avulsos", "Ex-clientes"] as const;
const CATEGORY_COLOR: Record<string, string> = {
  "Social Media": "#5BA88A",
  "Pack Digital": "#5BA88A",
  "Avulsos": "#C8D44E",
  "Ex-clientes": "#E76F51",
};

export function MobileNav() {
  const isMobile = useIsMobile();
  const { view, setView, selectClient } = useUI();
  const me = useMe().data;
  const { data: clients = [] } = useQuery(clientsQO());
  const [tab, setTab] = useState<"home" | "clients" | "me">("home");
  const sheetRef = useRef<HTMLDivElement>(null);

  const activeClients = useMemo(() => clients.filter((c) => !c.archived), [clients]);
  const grouped = useMemo(() => {
    const byCat = new Map<string, typeof activeClients>();
    for (const c of activeClients) {
      const cat = c.category || "Social Media";
      if (!byCat.has(cat)) byCat.set(cat, [] as any);
      byCat.get(cat)!.push(c);
    }
    for (const arr of byCat.values()) {
      arr.sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
    }
    const known = CATEGORY_ORDER.filter((k) => byCat.has(k)).map((k) => [k, byCat.get(k)!] as const);
    const extras = [...byCat.entries()].filter(([k]) => !(CATEGORY_ORDER as readonly string[]).includes(k));
    return [...known, ...extras] as Array<readonly [string, typeof activeClients]>;
  }, [activeClients]);

  useEffect(() => {
    if (view === "my" || view === "stories" || view === "cleaning" || view === "admin") setTab("home");
    if (view === "client") setTab("clients");
    if (view === "profile") setTab("me");
  }, [view]);

  if (!isMobile) return null;

  return (
    <>
      {tab === "clients" && view !== "client" && (
        <div className="fixed inset-0 z-40 bg-[#0D0D0D] pt-14 pb-20 flex flex-col">
          <div className="px-5 py-4 border-b border-white/[0.08] bg-[#0D0D0D] flex items-end justify-between shrink-0">
            <h2 className="text-lg font-bold text-white">Clientes</h2>
            <span className="text-xs text-white/40">{activeClients.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-6">
            {activeClients.length === 0 && (
              <p className="text-xs text-white/40 py-10 text-center">Sem clientes ainda.</p>
            )}
            {grouped.map(([cat, list]) => {
              const color = CATEGORY_COLOR[cat] ?? "#5BA88A";
              return (
                <section key={cat}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider"
                      style={{ color }}
                    >
                      {cat}
                    </span>
                    <span className="text-[10px] text-white/30">{list.length}</span>
                    <span
                      className="flex-1 h-px ml-1"
                      style={{ backgroundColor: `color-mix(in oklab, ${color} 25%, transparent)` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {list.map((c) => {
                      const cc = c.color || "#5BA88A";
                      return (
                        <button
                          key={c.id}
                          onClick={() => { selectClient(c.id); setTab("home"); }}
                          className="relative w-full flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left transition-transform active:scale-[0.98] min-w-0"
                          style={{
                            backgroundColor: `color-mix(in oklab, ${cc} 18%, transparent)`,
                            border: `1px solid color-mix(in oklab, ${cc} 35%, transparent)`,
                          }}
                        >
                          <Avatar name={c.name} color={cc} size={32} />
                          <span className="text-xs font-semibold text-white truncate flex-1 min-w-0">{c.name}</span>
                          {c.favorite && <Star size={11} className="text-[#C8D44E] fill-[#C8D44E] shrink-0 absolute top-1.5 right-1.5" />}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {tab === "me" && view !== "profile" && (
        <div className="fixed inset-0 z-40 bg-[#0D0D0D] pt-14 pb-20" onClick={() => setTab("home")}>
          <div className="px-5 py-6 flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {me && <Avatar profile={me} size={72} />}
            <div className="text-white font-bold text-base">{me?.name}</div>
            <div className="text-white/50 text-xs">{me?.email}</div>
            <button
              onClick={() => { setView("profile"); }}
              className="mt-6 px-5 py-2 rounded-md text-xs font-bold"
              style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}
            >Editar perfil</button>
            <button onClick={() => supabase.auth.signOut().then(() => (location.href = "/auth"))}
              className="mt-3 text-xs text-red-400 hover:underline">Sair</button>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 flex items-center justify-around bg-[#1C1C1C] border-t border-white/[0.08]">
        <NavBtn icon={<LayoutDashboard size={20} />} active={tab === "home" && view === "my"}
          onClick={() => { setView("my"); setTab("home"); }} />
        <NavBtn icon={<BarChart2 size={20} />} active={view === "admin"} onClick={() => { setView("admin"); setTab("home"); }} />
        <NavBtn icon={<Users size={20} />} active={tab === "clients"} onClick={() => setTab("clients")} />
        <NavBtn icon={me ? <Avatar profile={me} size={22} /> : <User size={20} />} active={tab === "me"} onClick={() => { setView("profile"); }} />
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