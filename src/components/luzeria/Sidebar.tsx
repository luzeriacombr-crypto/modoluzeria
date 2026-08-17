import { useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Star, MoreHorizontal, LayoutDashboard, ChevronDown, ChevronRight, Folder, BarChart2,
  Plus, Sparkles, Info, CircleHelp, CalendarDays, Instagram, Users, LayoutGrid, Wallet, UserCog, Cog,
} from "lucide-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { clientsQO, useApi, useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { Avatar } from "./Avatar";
import { PRESET_COLORS, glassCardStyle } from "@/lib/luzeria/utils";
import { requestConfirm, requestPrompt } from "@/lib/luzeria/confirm-store";
import { toast } from "sonner";
import { hasSetorPermission, type Client } from "@/lib/luzeria/types";

const CATEGORY_ORDER = ["Social Media", "Pack Digital", "Avulsos", "Ex-clientes"] as const;
const CATEGORY_COLOR: Record<string, string> = {
  "Social Media": "#5BA88A",
  "Pack Digital": "#5BA88A",
  "Avulsos": "rgb(var(--lz-brand-rgb))",
  "Ex-clientes": "#E76F51",
};

export function Sidebar({
  onOpenCustomFields,
  onCreateClient,
}: { onOpenCustomFields: (c: Client) => void; onCreateClient: (category?: string) => void }) {
  const me = useMe().data;
  const { data: clients = [] } = useQuery(clientsQO());
  const [search, setSearch] = useState("");
  const [clientsOpen, setClientsOpen] = useState(true);
  const { selectedClientId } = useUI();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const routerSearch = useRouterState({ select: (s) => s.location.search as { tab?: string } });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clients.filter((c) => !term || c.name.toLowerCase().includes(term));
  }, [clients, search]);

  const grouped = useMemo(() => {
    const byCat = new Map<string, Client[]>();
    for (const c of filtered) {
      const cat = c.category || "Social Media";
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(c);
    }
    for (const arr of byCat.values()) {
      arr.sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
    }
    // Always render Avulsos (even when empty) so admin can use the + button.
    const known = CATEGORY_ORDER
      .filter((k) => byCat.has(k) || k === "Avulsos")
      .map((k) => [k, byCat.get(k) ?? []] as const);
    const extras = [...byCat.entries()].filter(([k]) => !(CATEGORY_ORDER as readonly string[]).includes(k));
    return [...known, ...extras] as Array<readonly [string, Client[]]>;
  }, [filtered]);

  const allCategories = useMemo(() => {
    const set = new Set<string>(CATEGORY_ORDER);
    clients.forEach((c) => c.category && set.add(c.category));
    return [...set];
  }, [clients]);

  const isAdmin = me?.role === "master" || me?.role === "setor";
  const disabled = new Set(me?.disabledFeatures ?? []);
  const clientsActive = pathname.startsWith("/cliente/");
  const isMaster = me?.role === "master";
  const canTeam = isMaster;
  const canReport = isMaster || hasSetorPermission(me, "team_reports");
  const canJourney = isMaster || hasSetorPermission(me, "settings_journey");
  const canFinanceiro = isMaster;
  const canAutomations = isMaster;
  const configTabActive = (tabId: string) => pathname === "/configuracoes" && routerSearch?.tab === tabId;
  const goToConfigTab = (tabId: string) => navigate({ to: "/configuracoes", search: { tab: tabId } });

  return (
    <aside data-tour="sidebar" className="sidebar-gradient w-[240px] h-screen flex flex-col text-white shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        {me?.orgLogoUrl ? (
          <img src={me.orgLogoUrl} alt={me.orgName ?? "Logo"} className="max-h-7 max-w-[170px]" />
        ) : (
          <div className="text-white font-extrabold text-lg uppercase tracking-wide truncate" title={me?.orgName ?? ""}>
            {me?.orgName ?? "Modo Criador"}
          </div>
        )}
        <p className="text-white/90 text-[10px] font-light italic tracking-wide mt-2">
          {me?.orgTagline || "Gestão de conteúdo e criação"}
        </p>
      </div>
      <div className="mx-5 h-px" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.2)" }} />

      {/* Nav — single scrollable list so Clientes sits inline with everything else */}
      <div className="px-3 pt-4 pb-3 flex-1 overflow-y-auto space-y-0.5">
        <NavButton
          icon={<LayoutDashboard size={15} />}
          label="Minhas demandas"
          active={pathname === "/minhas-tarefas"}
          onClick={() => navigate({ to: "/minhas-tarefas" })}
        />
        <NavButton
          icon={<BarChart2 size={15} />}
          label="Dashboard"
          active={pathname === "/admin"}
          onClick={() => navigate({ to: "/admin" })}
        />

        {/* Clientes */}
        <div>
          <button
            onClick={() => setClientsOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-2 pl-3 pr-2 py-2 rounded-md transition-colors text-sm relative"
            style={{
              backgroundColor: clientsActive ? "rgba(var(--lz-brand-light-rgb),0.12)" : "transparent",
              color: clientsActive ? "#FFFFFF" : "rgba(255,255,255,0.7)",
            }}
          >
            {clientsActive && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }} />}
            <span className="flex items-center gap-2.5 min-w-0">
              <Users size={15} className={clientsActive ? "text-[rgb(var(--lz-brand-rgb))] shrink-0" : "text-white/60 shrink-0"} />
              <span className="truncate">Clientes</span>
            </span>
            <span className="flex items-center gap-0.5 shrink-0">
              {isAdmin && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onCreateClient(); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); onCreateClient(); } }}
                  title="Novo cliente"
                  className="p-1 rounded text-white/40 hover:text-[rgb(var(--lz-brand-rgb))] hover:bg-white/5"
                >
                  <Plus size={13} />
                </span>
              )}
              {clientsOpen ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
            </span>
          </button>
          {clientsOpen && (
            <div className="mt-1 ml-[26px] pl-2 border-l border-white/10">
              <div className="px-1 pb-2">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/5">
                  <Search size={13} className="text-white/40" />
                  <input
                    value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="bg-transparent text-xs flex-1 outline-none placeholder:text-white/30 text-white"
                  />
                </div>
              </div>
              {grouped.map(([cat, list]) => (
                <CategoryGroup
                  key={cat}
                  name={cat}
                  color={CATEGORY_COLOR[cat] ?? "#5BA88A"}
                  defaultOpen={cat !== "Ex-clientes"}
                  forceOpen={search.trim().length > 0}
                  count={list.length}
                  onAdd={isAdmin && cat !== "Ex-clientes" ? () => onCreateClient(cat) : undefined}
                  addTitle={cat === "Avulsos" ? "Nova demanda avulsa" : "Novo cliente"}
                >
                  {list.map((c) => (
                    <ClientRow
                      key={c.id}
                      client={c}
                      active={pathname === `/cliente/${c.id}`}
                      onOpenCustomFields={() => onOpenCustomFields(c)}
                      canManage={isAdmin}
                      categories={allCategories}
                    />
                  ))}
                  {cat === "Avulsos" && list.length === 0 && (
                    <div className="px-3 py-2 text-[11px] text-white/30">
                      {isAdmin ? "Nenhuma demanda avulsa. Use o + para criar." : "Sem demandas avulsas."}
                    </div>
                  )}
                </CategoryGroup>
              ))}
              {filtered.length === 0 && (
                <div className="text-xs text-white/30 text-center mt-6 px-3">
                  {search ? "Nenhum cliente encontrado." : "Sem clientes ainda."}
                </div>
              )}
            </div>
          )}
        </div>

        {!disabled.has("calendar") && (
          <div data-tour="nav-calendario">
            <NavButton
              icon={<CalendarDays size={15} />}
              label="Calendário"
              active={pathname === "/calendario"}
              onClick={() => navigate({ to: "/calendario" })}
            />
          </div>
        )}
        {isAdmin && !disabled.has("client_overview") && (
          <NavButton
            icon={<LayoutGrid size={15} />}
            label="Visão Geral"
            active={pathname === "/visao-geral"}
            onClick={() => navigate({ to: "/visao-geral" })}
          />
        )}
        {isAdmin && !disabled.has("instagram") && (
          <NavButton
            icon={<Instagram size={15} />}
            label="Instagram"
            active={pathname === "/instagram"}
            onClick={() => navigate({ to: "/instagram" })}
          />
        )}
        {canFinanceiro && (
          <NavButton
            icon={<Wallet size={15} />}
            label="Financeiro"
            active={configTabActive("subscription")}
            onClick={() => goToConfigTab("subscription")}
          />
        )}
        {(canTeam || canReport || canJourney) && (
          <NavGroup
            icon={<UserCog size={15} />}
            label="Equipe"
            active={configTabActive("team") || configTabActive("report") || configTabActive("journey")}
          >
            {canTeam && (
              <NavSubButton label="Membros" active={configTabActive("team")} onClick={() => goToConfigTab("team")} />
            )}
            {canReport && (
              <NavSubButton label="Relatório" active={configTabActive("report")} onClick={() => goToConfigTab("report")} />
            )}
            {canJourney && (
              <NavSubButton label="Jornada do cliente" active={configTabActive("journey")} onClick={() => goToConfigTab("journey")} />
            )}
          </NavGroup>
        )}
        {canAutomations && (
          <NavButton
            icon={<Cog size={15} />}
            label="Automações"
            active={configTabActive("automations")}
            onClick={() => goToConfigTab("automations")}
          />
        )}
        {!disabled.has("rotina") && (
          <div data-tour="nav-rotina">
            <NavButton
              icon={<Sparkles size={15} />}
              label="Rotina"
              active={pathname === "/rotina"}
              onClick={() => navigate({ to: "/rotina" })}
            />
          </div>
        )}
        <div data-tour="nav-ajuda">
          <NavButton
            icon={<CircleHelp size={15} />}
            label="Ajuda"
            active={pathname === "/ajuda"}
            onClick={() => navigate({ to: "/ajuda" })}
          />
        </div>
      </div>
    </aside>
  );
}

function NavButton({ icon, label, active, onClick, badge, disabled, title }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: number;
  disabled?: boolean; title?: string;
}) {
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} title={title}
      className="w-full flex items-center justify-between gap-2 pl-3 pr-2 py-2 rounded-md transition-colors text-sm relative disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        backgroundColor: active ? "rgba(var(--lz-brand-light-rgb),0.12)" : "transparent",
        color: active ? "#FFFFFF" : "rgba(255,255,255,0.7)",
      }}>
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }} />}
      <span className="flex items-center gap-2.5">
        <span className={active ? "text-[rgb(var(--lz-brand-rgb))]" : "text-white/60"}>{icon}</span>
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[10px] font-bold px-1.5 rounded" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>{badge}</span>
      )}
    </button>
  );
}

function NavGroup({ icon, label, active, children }: {
  icon: React.ReactNode; label: string; active: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(active);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 pl-3 pr-2 py-2 rounded-md transition-colors text-sm relative"
        style={{
          backgroundColor: active ? "rgba(var(--lz-brand-light-rgb),0.12)" : "transparent",
          color: active ? "#FFFFFF" : "rgba(255,255,255,0.7)",
        }}>
        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }} />}
        <span className="flex items-center gap-2.5">
          <span className={active ? "text-[rgb(var(--lz-brand-rgb))]" : "text-white/60"}>{icon}</span>
          {label}
        </span>
        {open ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
      </button>
      {open && <div className="mt-0.5 ml-[26px] pl-2 border-l border-white/10 space-y-0.5">{children}</div>}
    </div>
  );
}

function NavSubButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors truncate"
      style={{ color: active ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.6)" }}>
      {label}
    </button>
  );
}

function CategoryGroup({
  name, color, children, defaultOpen, forceOpen, count, onAdd, addTitle,
}: {
  name: string; color: string; children: React.ReactNode;
  defaultOpen?: boolean; forceOpen?: boolean; count?: number; onAdd?: () => void; addTitle?: string;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  const isOpen = forceOpen || open;
  const displayCount = count ?? (Array.isArray(children) ? (children as any[]).length : 1);
  return (
    <div className="mb-2">
      <div className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-white/80 hover:bg-white/5 transition-colors group">
        <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          {isOpen
            ? <ChevronDown size={12} className="text-white/40 shrink-0" />
            : <ChevronRight size={12} className="text-white/40 shrink-0" />}
          <Folder size={14} style={{ color }} className="shrink-0" />
          <span className="text-[12px] font-semibold tracking-tight truncate uppercase">{name}</span>
          <span className="text-[10px] text-white/40">{displayCount}</span>
        </button>
        {onAdd && (
          <button onClick={(e) => { e.stopPropagation(); onAdd(); }}
            title={addTitle ?? "Novo cliente"}
            className="p-1 rounded text-white/40 hover:text-[rgb(var(--lz-brand-rgb))] hover:bg-white/5">
            <Plus size={13} />
          </button>
        )}
      </div>
      {isOpen && <div className="mt-0.5">{children}</div>}
    </div>
  );
}

function ClientRow({ client, active, onOpenCustomFields, canManage, categories }: {
  client: Client; active: boolean; onOpenCustomFields: () => void; canManage: boolean;
  categories: string[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const { updateClient, deleteClient, duplicateMonth } = useApi();
  const openFicha = useUI((s) => s.openFicha);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) { setMoveOpen(false); return; }
    function place() {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      const menuW = 220;
      const vw = window.innerWidth;
      let left = r.right + 6;
      if (left + menuW > vw - 8) left = Math.max(8, r.left - menuW - 6);
      const top = Math.min(r.top, window.innerHeight - 360);
      setMenuPos({ top: Math.max(8, top), left });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [menuOpen]);

  const monthKey = useUI((s) => s.selectedMonthKey);

  return (
    <div ref={ref}
      className="group relative rounded-lg transition-[border-color] mx-1 overflow-hidden"
      style={active ? glassCardStyle(true) : { background: "transparent", border: "1px solid transparent" }}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }} />}
      {/* Hover wash — a separate layer since an active row's background above
       * is a gradient (can't just toggle backgroundColor on hover). */}
      <div className="absolute inset-0 bg-white/[0.045] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      <Link
        to="/cliente/$clientId"
        params={{ clientId: client.id }}
        preload="intent"
        className="relative w-full flex items-center gap-2.5 pl-3 pr-9 py-2 text-left"
      >
        <Avatar name={client.name} color={client.color} size={26} avatarUrl={client.photoUrl} />
        <span className="text-sm truncate text-white/90 flex-1">{client.name}</span>
        {client.favorite && <Star size={12} className="text-[rgb(var(--lz-brand-rgb))] fill-[rgb(var(--lz-brand-rgb))]" />}
      </Link>

      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); openFicha(client.id); }}
          title="Ficha do cliente"
          className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-[rgb(var(--lz-brand-rgb))]"
        >
          <Info size={13} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); updateClient.mutate({ data: { id: client.id, patch: { favorite: !client.favorite } } }); }}
          className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white">
          <Star size={13} className={client.favorite ? "fill-[rgb(var(--lz-brand-rgb))] text-[rgb(var(--lz-brand-rgb))]" : ""} />
        </button>
        {canManage && (
          <button ref={btnRef} onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white">
            <MoreHorizontal size={14} />
          </button>
        )}
      </div>

      {menuOpen && menuPos && createPortal(
        <div ref={menuRef}
          style={{ position: "fixed", top: menuPos.top, left: menuPos.left, width: 220 }}
          className="z-[1000] rounded-md bg-[#1C1C1C] border border-white/10 shadow-2xl py-1 max-h-[80vh] overflow-y-auto">
          <MenuItem onClick={async () => {
            setMenuOpen(false);
            const name = (await requestPrompt("Novo nome", client.name))?.trim();
            if (name) updateClient.mutate({ data: { id: client.id, patch: { name } } });
          }}>Renomear</MenuItem>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMoveOpen((o) => !o); }}
              className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/5 transition-colors flex items-center justify-between"
            >
              <span>Mover para categoria</span>
              <ChevronRight size={12} className="text-white/40" />
            </button>
            {moveOpen && (
              <div className="mt-1 ml-2 rounded-md bg-[#141414] border border-white/10 py-1">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      updateClient.mutate({ data: { id: client.id, patch: { category: cat } } });
                      setMoveOpen(false); setMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/5 transition-colors flex items-center justify-between"
                  >
                    <span>{cat}</span>
                    {client.category === cat && <span className="text-[rgb(var(--lz-brand-rgb))]">●</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="px-3 py-2">
            <div className="text-[10px] uppercase text-white/40 mb-1.5">Cor</div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button key={c} onClick={() => updateClient.mutate({ data: { id: client.id, patch: { color: c } } })}
                  className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: client.color === c ? "rgb(var(--lz-brand-rgb))" : "transparent" }} />
              ))}
            </div>
            <div className="text-[10px] uppercase text-white/40 mt-3 mb-1">Inicial / Emoji</div>
            <input
              defaultValue={client.icon ?? ""}
              placeholder="(automático)"
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== (client.icon ?? null))
                  updateClient.mutate({ data: { id: client.id, patch: { icon: v } } });
              }}
              className="w-full text-xs bg-[#0D0D0D] border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
              maxLength={2}
            />
          </div>
          <MenuItem onClick={() => {
            duplicateMonth.mutate({ data: { clientId: client.id, fromKey: monthKey } });
            toast.success("Mês duplicado");
            setMenuOpen(false);
          }}>Duplicar mês</MenuItem>
          <MenuItem onClick={() => { onOpenCustomFields(); setMenuOpen(false); }}>Campos personalizados</MenuItem>
          <MenuItem onClick={() => {
            updateClient.mutate({ data: { id: client.id, patch: { archived: !client.archived } } });
            setMenuOpen(false);
          }}>{client.archived ? "Desarquivar" : "Arquivar"}</MenuItem>
          <div className="h-px bg-white/10 my-1" />
          <MenuItem destructive onClick={async () => {
            setMenuOpen(false);
            if (await requestConfirm(`Excluir "${client.name}" e todo seu histórico?`, { danger: true })) {
              deleteClient.mutate({ data: { id: client.id } });
            }
          }}>Excluir</MenuItem>
        </div>,
        document.body
      )}
    </div>
  );
}

function MenuItem({ children, onClick, destructive }: { children: React.ReactNode; onClick: () => void; destructive?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2 text-xs transition-colors ${destructive ? "text-red-400 hover:bg-red-500/10" : "text-white/80 hover:bg-white/5"}`}>
      {children}
    </button>
  );
}

export function roleLabel(r: string) {
  if (r === "master") return "Master";
  if (r === "setor") return "Adm Setor";
  return "Membro";
}