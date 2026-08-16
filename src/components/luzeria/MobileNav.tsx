import { LayoutDashboard, Users, BarChart2, Star, Menu, X, CalendarDays, Sparkles, CircleHelp, Instagram, ChevronRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useMemo } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useUI } from "@/lib/luzeria/ui-store";
import { useMe, clientsQO } from "@/lib/luzeria/queries";
import { Avatar } from "./Avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { glassCardStyle } from "@/lib/luzeria/utils";

const CATEGORY_ORDER = ["Social Media", "Pack Digital", "Avulsos", "Ex-clientes"] as const;
const CATEGORY_COLOR: Record<string, string> = {
  "Social Media": "#5BA88A",
  "Pack Digital": "#5BA88A",
  "Avulsos": "rgb(var(--lz-brand-rgb))",
  "Ex-clientes": "#E76F51",
};

export function MobileNav() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const me = useMe().data;
  const { data: clients = [] } = useQuery(clientsQO());
  const [showClients, setShowClients] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const isAdmin = me?.role === "master" || me?.role === "setor";
  const disabledFeatures = new Set(me?.disabledFeatures ?? []);

  const isClientPath = pathname.startsWith("/cliente/");
  const tab = showClients ? "clients" : showMenu ? "menu" : "home";

  function closeAllSheets() {
    setShowClients(false);
    setShowMenu(false);
  }

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

  if (!isMobile) return null;

  return (
    <>
      {showClients && !isClientPath && (
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
                          onClick={() => { navigate({ to: "/cliente/$clientId", params: { clientId: c.id } }); setShowClients(false); }}
                          className="relative w-full flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left transition-transform active:scale-[0.98] min-w-0"
                          style={glassCardStyle()}
                        >
                          <Avatar name={c.name} color={cc} avatarUrl={c.photoUrl} size={32} />
                          <span className="text-xs font-semibold text-white truncate flex-1 min-w-0">{c.name}</span>
                          {c.favorite && <Star size={11} className="text-[rgb(var(--lz-brand-rgb))] fill-[rgb(var(--lz-brand-rgb))] shrink-0 absolute top-1.5 right-1.5" />}
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

      {showMenu && (
        <div className="fixed inset-0 z-40 bg-[#0D0D0D] pt-14 pb-20 flex flex-col" data-tour="mobile-menu-sheet">
          <div className="px-5 py-4 border-b border-white/[0.08] bg-[#0D0D0D] flex items-center justify-between shrink-0">
            <h2 className="text-lg font-bold text-white">Menu</h2>
            <button onClick={() => setShowMenu(false)} className="text-white/50 hover:text-white p-1" aria-label="Fechar">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-1.5">
            {!disabledFeatures.has("calendar") && (
              <MenuLink
                icon={<CalendarDays size={17} />}
                label="Calendário"
                dataTour="nav-calendario-mobile"
                onClick={() => { navigate({ to: "/calendario" }); closeAllSheets(); }}
              />
            )}
            {isAdmin && !disabledFeatures.has("instagram") && (
              <MenuLink
                icon={<Instagram size={17} />}
                label="Instagram"
                onClick={() => { navigate({ to: "/instagram" }); closeAllSheets(); }}
              />
            )}
            {!disabledFeatures.has("rotina") && (
              <MenuLink
                icon={<Sparkles size={17} />}
                label="Rotina"
                dataTour="nav-rotina-mobile"
                onClick={() => { navigate({ to: "/rotina" }); closeAllSheets(); }}
              />
            )}
            <MenuLink
              icon={<CircleHelp size={17} />}
              label="Ajuda"
              dataTour="nav-ajuda-mobile"
              onClick={() => { navigate({ to: "/ajuda" }); closeAllSheets(); }}
            />
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 flex items-center justify-around bg-[#1C1C1C]/85 backdrop-blur-xl border-t border-white/[0.08]" data-tour="mobile-bottom-nav">
        <NavBtn icon={<LayoutDashboard size={20} />} active={pathname === "/minhas-tarefas"}
          onClick={() => { navigate({ to: "/minhas-tarefas" }); closeAllSheets(); }} />
        <NavBtn icon={<BarChart2 size={20} />} active={pathname === "/admin"}
          onClick={() => { navigate({ to: "/admin" }); closeAllSheets(); }} />
        <NavBtn icon={<Users size={20} />} active={tab === "clients" || isClientPath}
          dataTour="mobile-clients-btn"
          onClick={() => { setShowClients((v) => !v); setShowMenu(false); }} />
        <NavBtn icon={<Menu size={20} />} active={tab === "menu"}
          dataTour="mobile-menu-btn"
          onClick={() => { setShowMenu((v) => !v); setShowClients(false); }} />
      </nav>
    </>
  );
}

function NavBtn({ icon, active, onClick, badge, dataTour }: { icon: React.ReactNode; active: boolean; onClick: () => void; badge?: number; dataTour?: string }) {
  return (
    <button onClick={onClick} data-tour={dataTour}
      className="relative flex items-center justify-center h-12 w-14 transition-colors"
      style={{ color: active ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.4)" }}>
      {icon}
      {badge !== undefined && badge > 0 && (
        <span className="absolute top-1 right-3 min-w-[14px] h-[14px] rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center px-1">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}

function MenuLink({ icon, label, onClick, dataTour }: { icon: React.ReactNode; label: string; onClick: () => void; dataTour?: string }) {
  return (
    <button onClick={onClick} data-tour={dataTour}
      className="w-full flex items-center justify-between gap-2 px-3 py-3 rounded-lg text-white/80 hover:bg-white/5 active:bg-white/5 transition-colors">
      <span className="flex items-center gap-3 text-sm font-medium">
        <span className="text-white/50">{icon}</span>
        {label}
      </span>
      <ChevronRight size={16} className="text-white/30" />
    </button>
  );
}