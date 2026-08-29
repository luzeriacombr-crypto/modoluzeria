import { useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Star, MoreHorizontal, LayoutDashboard, ChevronDown, ChevronRight, Folder, BarChart2,
  Plus, Info, CircleHelp, CalendarDays, Instagram, Users, Wallet, UserCog, BookMarked,
  Settings2, X, ArrowUp, ArrowDown, RotateCcw, Handshake, IdCard, Trash2,
} from "lucide-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { clientsQO, useApi, useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { Avatar } from "./Avatar";
import { PRESET_COLORS, glassCardStyle, formatMonth } from "@/lib/luzeria/utils";
import { requestConfirm, requestPrompt } from "@/lib/luzeria/confirm-store";
import { toast } from "sonner";
import { hasSetorPermission, hasPermission, type Client } from "@/lib/luzeria/types";

export const DEFAULT_NAV_LABELS: Record<string, string> = {
  "minhas-demandas": "Minhas demandas", dashboard: "Dashboard", clientes: "Clientes",
  calendario: "Calendário", biblioteca: "Biblioteca",
  instagram: "Instagram", financeiro: "Plano e Cobrança", equipe: "Equipe", ajuda: "Ajuda",
  cobranca: "Plano e Cobrança", margem: "Margem por cliente", afiliados: "Afiliados", revenda: "Revenda",
  rotina: "Rotina", membros: "Membros", relatorio: "Relatório", jornada: "Jornada do cliente",
  vendas: "Vendas", lixeira: "Lixeira", pagamentos: "Pagamentos", cliente: "Visão Geral", "cliente-overview": "Visão Geral",
};

const CATEGORY_ORDER = ["Social Media", "Pack Digital", "Avulsos", "Ex-clientes"] as const;
const CATEGORY_COLOR: Record<string, string> = {
  "Social Media": "#5BA88A",
  "Pack Digital": "#5BA88A",
  "Avulsos": "rgb(var(--lz-brand-rgb))",
  "Ex-clientes": "#E76F51",
};

type CollapsedMeta = {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  kind: "button" | "flyout";
  onClick?: () => void;
};

export function Sidebar({
  collapsed,
  onOpenCustomFields,
  onCreateClient,
}: { collapsed?: boolean; onOpenCustomFields: (c: Client) => void; onCreateClient: (category?: string) => void }) {
  const me = useMe().data;
  const { data: clients = [], isLoading: clientsLoading, isError: clientsError } = useQuery(clientsQO());
  const [search, setSearch] = useState("");
  const [clientsOpen, setClientsOpen] = useState(true);
  const { selectedClientId } = useUI();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const routerSearch = useRouterState({ select: (s) => s.location.search as { tab?: string } });

  // Modo reduzido: só ícones, com tooltip do nome ao passar o mouse. Clientes
  // e os grupos com submenu (Visão Geral, Plano e Cobrança, Equipe) não cabem
  // como ícone sozinho — clicar neles abre um painel flutuante ao lado com o
  // mesmo conteúdo que apareceria expandido.
  const [openFlyout, setOpenFlyout] = useState<string | null>(null);
  const [flyoutAnchor, setFlyoutAnchor] = useState<DOMRect | null>(null);
  const flyoutPanelRef = useRef<HTMLDivElement | null>(null);
  const flyoutTriggerRef = useRef<HTMLButtonElement | null>(null);

  function toggleFlyout(id: string, el: HTMLButtonElement) {
    if (openFlyout === id) { setOpenFlyout(null); setFlyoutAnchor(null); return; }
    flyoutTriggerRef.current = el;
    setFlyoutAnchor(el.getBoundingClientRect());
    setOpenFlyout(id);
  }

  useEffect(() => {
    if (!openFlyout) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (flyoutPanelRef.current?.contains(t)) return;
      if (flyoutTriggerRef.current?.contains(t)) return;
      setOpenFlyout(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openFlyout]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setOpenFlyout(null); }, [pathname, routerSearch?.tab, collapsed]);

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
  const canTeam = isMaster || hasPermission(me, "manage_team");
  const canReport = isMaster || hasSetorPermission(me, "team_reports");
  const canJourney = isMaster || hasSetorPermission(me, "settings_journey");
  const canFinanceiro = isMaster || hasPermission(me, "view_financeiro");
  const canSales = !disabled.has("sales_pipeline") && hasPermission(me, "sales_pipeline");
  const rotinaEnabled = !disabled.has("rotina");
  const configTabActive = (tabId: string) => pathname === "/configuracoes" && routerSearch?.tab === tabId;
  const goToConfigTab = (tabId: string) => navigate({ to: "/configuracoes", search: { tab: tabId } });
  const [customizingNav, setCustomizingNav] = useState(false);
  const navLabels = me?.navLabels ?? {};
  const navOrder = me?.navOrder ?? {};
  const navLabel = (id: string, fallback: string) => navLabels[id] || fallback;
  function orderSection<T extends { id: string; label: string; node: React.ReactNode }>(sectionKey: string, items: T[]): T[] {
    const order = navOrder[sectionKey];
    if (!order || order.length === 0) return items;
    const byId = new Map(items.map((it) => [it.id, it]));
    const ordered = order.map((id) => byId.get(id)).filter((it): it is typeof items[number] => !!it);
    items.forEach((it) => { if (!order.includes(it.id)) ordered.push(it); });
    return ordered;
  }

  return (
    <aside data-tour="sidebar" className={`sidebar-gradient ${collapsed ? "w-[64px]" : "w-[240px]"} h-screen flex flex-col text-white shrink-0 overflow-hidden`}>
      {/* Logo — some no modo reduzido, a logo aparece no cabeçalho nesse caso (App.tsx) */}
      {!collapsed && (
        <div className="px-5 pt-5 pb-4">
          {me?.orgLogoUrl ? (
            <img src={me.orgLogoUrl} alt={me.orgName ?? "Logo"} className="block max-h-10 max-w-[170px] w-auto object-contain object-left" />
          ) : (
            <div className="text-white font-extrabold text-lg uppercase tracking-wide truncate" title={me?.orgName ?? ""}>
              {me?.orgName ?? "Modo Criador"}
            </div>
          )}
          <p className="text-white/90 text-[10px] font-light italic tracking-wide mt-1.5">
            {me?.orgTagline || "Gestão de conteúdo e criação"}
          </p>
        </div>
      )}
      <div className={collapsed ? "mx-3 h-px mt-5" : "mx-5 h-px"} style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.2)" }} />

      {/* Nav — single scrollable list so Clientes sits inline with everything else */}
      <div className={collapsed ? "px-2 pt-4 pb-3 flex-1 overflow-y-auto space-y-1.5 flex flex-col items-center" : "px-3 pt-4 pb-3 flex-1 overflow-y-auto space-y-0.5"}>
        {(() => {
          const clienteItems = orderSection("cliente", [
            ...(isAdmin ? [{ id: "cliente-overview", label: navLabel("cliente-overview", "Visão Geral"), node: <NavSubButton key="cliente-overview" label={navLabel("cliente-overview", "Visão Geral")} active={configTabActive("cliente")} onClick={() => goToConfigTab("cliente")} /> }] : []),
            ...(canJourney ? [{ id: "jornada", label: navLabel("jornada", "Jornada do cliente"), node: <NavSubButton key="jornada" label={navLabel("jornada", "Jornada do cliente")} active={configTabActive("journey")} onClick={() => goToConfigTab("journey")} /> }] : []),
            ...(canFinanceiro ? [{ id: "margem", label: navLabel("margem", "Margem por cliente"), node: <NavSubButton key="margem" label={navLabel("margem", "Margem por cliente")} active={configTabActive("margem")} onClick={() => goToConfigTab("margem")} /> }] : []),
            ...(canFinanceiro ? [{ id: "pagamentos", label: navLabel("pagamentos", "Pagamentos"), node: <NavSubButton key="pagamentos" label={navLabel("pagamentos", "Pagamentos")} active={configTabActive("pagamentos")} onClick={() => goToConfigTab("pagamentos")} /> }] : []),
          ]);

          const financeiroItems = canFinanceiro ? orderSection("financeiro", [
            { id: "cobranca", label: navLabel("cobranca", "Plano e Cobrança"), node: <NavSubButton key="cobranca" label={navLabel("cobranca", "Plano e Cobrança")} active={configTabActive("cobranca")} onClick={() => goToConfigTab("cobranca")} /> },
            { id: "afiliados", label: navLabel("afiliados", "Afiliados"), node: <NavSubButton key="afiliados" label={navLabel("afiliados", "Afiliados")} active={configTabActive("afiliados")} onClick={() => goToConfigTab("afiliados")} /> },
            { id: "revenda", label: navLabel("revenda", "Revenda"), node: <NavSubButton key="revenda" label={navLabel("revenda", "Revenda")} active={configTabActive("revenda")} onClick={() => goToConfigTab("revenda")} /> },
          ]) : [];

          const equipeItems = orderSection("equipe", [
            ...(rotinaEnabled ? [{ id: "rotina", label: navLabel("rotina", "Rotina"), node: <div key="rotina" data-tour="nav-rotina"><NavSubButton label={navLabel("rotina", "Rotina")} active={pathname === "/rotina"} onClick={() => navigate({ to: "/rotina" })} /></div> }] : []),
            ...(canTeam ? [{ id: "membros", label: navLabel("membros", "Membros"), node: <NavSubButton key="membros" label={navLabel("membros", "Membros")} active={configTabActive("team")} onClick={() => goToConfigTab("team")} /> }] : []),
            ...(canReport ? [{ id: "relatorio", label: navLabel("relatorio", "Relatório"), node: <NavSubButton key="relatorio" label={navLabel("relatorio", "Relatório")} active={configTabActive("report")} onClick={() => goToConfigTab("report")} /> }] : []),
          ]);

          const mainItems: { id: string; label: string; node: React.ReactNode; meta: CollapsedMeta }[] = orderSection("main", [
            { id: "minhas-demandas", label: navLabel("minhas-demandas", "Minhas demandas"), node: (
              <NavButton key="minhas-demandas" icon={<LayoutDashboard size={15} />} label={navLabel("minhas-demandas", "Minhas demandas")}
                active={pathname === "/minhas-tarefas"} onClick={() => navigate({ to: "/minhas-tarefas" })} />
            ), meta: { icon: <LayoutDashboard size={17} />, label: navLabel("minhas-demandas", "Minhas demandas"), active: pathname === "/minhas-tarefas", kind: "button", onClick: () => navigate({ to: "/minhas-tarefas" }) } },
            { id: "dashboard", label: navLabel("dashboard", "Dashboard"), node: (
              <NavButton key="dashboard" icon={<BarChart2 size={15} />} label={navLabel("dashboard", "Dashboard")}
                active={pathname === "/admin"} onClick={() => navigate({ to: "/admin" })} />
            ), meta: { icon: <BarChart2 size={17} />, label: navLabel("dashboard", "Dashboard"), active: pathname === "/admin", kind: "button", onClick: () => navigate({ to: "/admin" }) } },
            { id: "clientes", label: navLabel("clientes", "Clientes"), meta: { icon: <Users size={17} />, label: navLabel("clientes", "Clientes"), active: clientsActive, kind: "flyout" }, node: (
              <div key="clientes">
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
                    <span className="truncate">{navLabel("clientes", "Clientes")}</span>
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
                  <div className="mt-1">
                    <ClientesListBody
                      search={search} setSearch={setSearch} grouped={grouped} filtered={filtered}
                      isAdmin={isAdmin} allCategories={allCategories} pathname={pathname}
                      onCreateClient={onCreateClient} onOpenCustomFields={onOpenCustomFields}
                      loading={clientsLoading}
                      error={clientsError}
                    />
                  </div>
                )}
              </div>
            ) },
            ...(!disabled.has("calendar") ? [{ id: "calendario", label: navLabel("calendario", "Calendário"), meta: { icon: <CalendarDays size={17} />, label: navLabel("calendario", "Calendário"), active: pathname === "/calendario", kind: "button" as const, onClick: () => navigate({ to: "/calendario" }) }, node: (
              <div key="calendario" data-tour="nav-calendario">
                <NavButton icon={<CalendarDays size={15} />} label={navLabel("calendario", "Calendário")} active={pathname === "/calendario"} onClick={() => navigate({ to: "/calendario" })} />
              </div>
            ) }] : []),
            ...(!disabled.has("reference_library") ? [{ id: "biblioteca", label: navLabel("biblioteca", "Biblioteca"), meta: { icon: <BookMarked size={17} />, label: navLabel("biblioteca", "Biblioteca"), active: pathname === "/biblioteca", kind: "button" as const, onClick: () => navigate({ to: "/biblioteca" }) }, node: (
              <div key="biblioteca" data-tour="nav-biblioteca">
                <NavButton icon={<BookMarked size={15} />} label={navLabel("biblioteca", "Biblioteca")} active={pathname === "/biblioteca"} onClick={() => navigate({ to: "/biblioteca" })} />
              </div>
            ) }] : []),
            ...(isAdmin && !disabled.has("instagram") ? [{ id: "instagram", label: navLabel("instagram", "Instagram"), meta: { icon: <Instagram size={17} />, label: navLabel("instagram", "Instagram"), active: pathname === "/instagram", kind: "button" as const, onClick: () => navigate({ to: "/instagram" }) }, node: (
              <div key="instagram" data-tour="nav-instagram">
                <NavButton icon={<Instagram size={15} />} label={navLabel("instagram", "Instagram")} active={pathname === "/instagram"} onClick={() => navigate({ to: "/instagram" })} />
              </div>
            ) }] : []),
            ...(canSales ? [{ id: "vendas", label: navLabel("vendas", "Vendas"), meta: { icon: <Handshake size={17} />, label: navLabel("vendas", "Vendas"), active: pathname === "/vendas", kind: "button" as const, onClick: () => navigate({ to: "/vendas" }) }, node: (
              <div key="vendas" data-tour="nav-vendas">
                <NavButton icon={<Handshake size={15} />} label={navLabel("vendas", "Vendas")} active={pathname === "/vendas"} onClick={() => navigate({ to: "/vendas" })} />
              </div>
            ) }] : []),
            ...(isAdmin ? [{ id: "lixeira", label: navLabel("lixeira", "Lixeira"), meta: { icon: <Trash2 size={17} />, label: navLabel("lixeira", "Lixeira"), active: pathname === "/lixeira", kind: "button" as const, onClick: () => navigate({ to: "/lixeira" }) }, node: (
              <div key="lixeira" data-tour="nav-lixeira">
                <NavButton icon={<Trash2 size={15} />} label={navLabel("lixeira", "Lixeira")} active={pathname === "/lixeira"} onClick={() => navigate({ to: "/lixeira" })} />
              </div>
            ) }] : []),
            ...((isAdmin || canJourney || canFinanceiro) ? [{ id: "cliente", label: navLabel("cliente", "Visão Geral"), meta: { icon: <IdCard size={17} />, label: navLabel("cliente", "Visão Geral"), active: configTabActive("cliente") || configTabActive("journey") || configTabActive("margem") || configTabActive("pagamentos"), kind: "flyout" as const }, node: (
              <div key="cliente" data-tour="nav-cliente">
                <NavGroup icon={<IdCard size={15} />} label={navLabel("cliente", "Visão Geral")}
                  active={configTabActive("cliente") || configTabActive("journey") || configTabActive("margem") || configTabActive("pagamentos")}>
                  {clienteItems.map((it) => it.node)}
                </NavGroup>
              </div>
            ) }] : []),
            ...(canFinanceiro ? [{ id: "financeiro", label: navLabel("financeiro", "Plano e Cobrança"), meta: { icon: <Wallet size={17} />, label: navLabel("financeiro", "Plano e Cobrança"), active: configTabActive("cobranca") || configTabActive("afiliados") || configTabActive("revenda"), kind: "flyout" as const }, node: (
              <div key="financeiro" data-tour="nav-financeiro">
                <NavGroup icon={<Wallet size={15} />} label={navLabel("financeiro", "Plano e Cobrança")}
                  active={configTabActive("cobranca") || configTabActive("afiliados") || configTabActive("revenda")}>
                  {financeiroItems.map((it) => it.node)}
                </NavGroup>
              </div>
            ) }] : []),
            ...((canTeam || canReport || rotinaEnabled) ? [{ id: "equipe", label: navLabel("equipe", "Equipe"), meta: { icon: <UserCog size={17} />, label: navLabel("equipe", "Equipe"), active: configTabActive("team") || configTabActive("report") || pathname === "/rotina", kind: "flyout" as const }, node: (
              <div key="equipe" data-tour="nav-equipe">
                <NavGroup icon={<UserCog size={15} />} label={navLabel("equipe", "Equipe")}
                  active={configTabActive("team") || configTabActive("report") || pathname === "/rotina"}>
                  {equipeItems.map((it) => it.node)}
                </NavGroup>
              </div>
            ) }] : []),
            { id: "ajuda", label: navLabel("ajuda", "Ajuda"), meta: { icon: <CircleHelp size={17} />, label: navLabel("ajuda", "Ajuda"), active: pathname === "/ajuda", kind: "button", onClick: () => navigate({ to: "/ajuda" }) }, node: (
              <div key="ajuda" data-tour="nav-ajuda">
                <NavButton icon={<CircleHelp size={15} />} label={navLabel("ajuda", "Ajuda")} active={pathname === "/ajuda"} onClick={() => navigate({ to: "/ajuda" })} />
              </div>
            ) },
          ]);

          const groupItemsById: Record<string, React.ReactNode> = {
            cliente: clienteItems.map((it) => it.node),
            financeiro: financeiroItems.map((it) => it.node),
            equipe: equipeItems.map((it) => it.node),
          };
          const openItem = mainItems.find((it) => it.id === openFlyout);

          return (
            <>
              {mainItems.map((it) => collapsed ? (
                <CollapsedIconButton
                  key={it.id}
                  icon={it.meta.icon}
                  label={it.meta.label}
                  active={it.meta.active || openFlyout === it.id}
                  onClick={(el) => (it.meta.kind === "button" ? it.meta.onClick?.() : toggleFlyout(it.id, el))}
                />
              ) : it.node)}
              {isMaster && !collapsed && (
                <button
                  onClick={() => setCustomizingNav(true)}
                  className="w-full flex items-center gap-2.5 pl-3 pr-2 py-2 rounded-md text-xs text-white/35 hover:text-white/70 hover:bg-white/5 transition-colors mt-1"
                >
                  <Settings2 size={13} /> Personalizar menu
                </button>
              )}
              {customizingNav && (
                <NavCustomizeModal
                  onClose={() => setCustomizingNav(false)}
                  mainItems={mainItems}
                  financeiroItems={financeiroItems}
                  equipeItems={equipeItems}
                  navLabels={navLabels}
                  navOrder={navOrder}
                />
              )}
              {collapsed && openFlyout && flyoutAnchor && openItem && (
                <SidebarFlyout anchor={flyoutAnchor} title={openItem.label} panelRef={flyoutPanelRef}>
                  {openFlyout === "clientes" ? (
                    <ClientesListBody
                      search={search} setSearch={setSearch} grouped={grouped} filtered={filtered}
                      isAdmin={isAdmin} allCategories={allCategories} pathname={pathname}
                      onCreateClient={onCreateClient} onOpenCustomFields={onOpenCustomFields}
                      loading={clientsLoading}
                      error={clientsError}
                    />
                  ) : (
                    <div className="px-1 space-y-0.5">{groupItemsById[openFlyout]}</div>
                  )}
                </SidebarFlyout>
              )}
            </>
          );
        })()}
      </div>
    </aside>
  );
}

/** Ícone sozinho do modo reduzido — mostra o nome num tooltip flutuante ao
 * passar o mouse (a sidebar tem overflow-hidden, então o tooltip precisa
 * escapar via portal pra não ficar cortado). */
function CollapsedIconButton({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: (el: HTMLButtonElement) => void;
}) {
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!hover) { setTipPos(null); return; }
    const r = ref.current?.getBoundingClientRect();
    if (r) setTipPos({ top: r.top + r.height / 2, left: r.right + 10 });
  }, [hover]);

  return (
    <div className="w-full flex justify-center">
      <button
        ref={ref}
        onClick={() => ref.current && onClick(ref.current)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={label}
        className="relative h-9 w-9 flex items-center justify-center rounded-md transition-colors"
        style={{
          backgroundColor: active ? "rgba(var(--lz-brand-light-rgb),0.14)" : "transparent",
          color: active ? "#FFFFFF" : "rgba(255,255,255,0.7)",
        }}
      >
        {active && <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }} />}
        <span className={active ? "text-[rgb(var(--lz-brand-rgb))]" : "text-white/60"}>{icon}</span>
      </button>
      {hover && tipPos && createPortal(
        <div
          style={{ position: "fixed", top: tipPos.top, left: tipPos.left, transform: "translateY(-50%)" }}
          className="z-[999] px-2.5 py-1.5 rounded-md bg-[#1C1C1C] border border-white/10 shadow-xl text-xs font-medium text-white whitespace-nowrap pointer-events-none"
        >
          {label}
        </div>,
        document.body,
      )}
    </div>
  );
}

/** Painel flutuante do modo reduzido, ancorado ao lado do ícone clicado —
 * usado pra "Clientes" e pros grupos com submenu (Visão Geral, Plano e
 * Cobrança, Equipe), que têm conteúdo demais pra caber num tooltip. */
function SidebarFlyout({ anchor, title, children, panelRef }: {
  anchor: DOMRect; title: string; children: React.ReactNode; panelRef: React.RefObject<HTMLDivElement | null>;
}) {
  const top = Math.min(anchor.top, Math.max(8, window.innerHeight - 420));
  const left = anchor.right + 10;
  return createPortal(
    <div
      ref={panelRef}
      style={{ position: "fixed", top, left, width: 260, maxHeight: "75vh" }}
      className="z-[999] rounded-lg bg-[#1C1C1C] border border-white/10 shadow-2xl overflow-y-auto py-2 lz-modal-in"
    >
      <div className="px-3 pb-2 mb-1 border-b border-white/10 text-[11px] font-bold uppercase tracking-wide text-white/50">{title}</div>
      {children}
    </div>,
    document.body,
  );
}

/** Busca + grupos por categoria + lista de clientes — conteúdo compartilhado
 * entre o modo expandido (inline, sob o botão "Clientes") e o painel
 * flutuante do modo reduzido. */
function ClientesListBody({ search, setSearch, grouped, filtered, isAdmin, allCategories, pathname, onCreateClient, onOpenCustomFields, loading, error }: {
  search: string; setSearch: (v: string) => void;
  grouped: Array<readonly [string, Client[]]>; filtered: Client[];
  isAdmin: boolean; allCategories: string[]; pathname: string;
  onCreateClient: (category?: string) => void; onOpenCustomFields: (c: Client) => void;
  loading?: boolean; error?: boolean;
}) {
  return (
    <>
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
      {/* Sem o gate de loading, a lista renderizava "Sem clientes ainda"
       * enquanto ainda estava carregando — quem entrava pela primeira vez
       * via um app que parecia vazio. */}
      {loading && filtered.length === 0 && (
        <div className="px-2 mt-2 space-y-1.5" aria-label="Carregando clientes">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2.5 px-1 py-2">
              <span className="h-[26px] w-[26px] rounded-full bg-white/[0.07] animate-pulse" />
              <span className="h-2.5 rounded bg-white/[0.07] animate-pulse" style={{ width: `${68 - i * 9}%` }} />
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="text-xs text-center mt-6 px-3" style={{ color: "#E76F51" }}>
          Não consegui carregar os clientes. Confira sua conexão.
        </div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-xs text-white/30 text-center mt-6 px-3">
          {search ? "Nenhum cliente encontrado." : "Nenhum cliente ainda. Use o + para criar o primeiro."}
        </div>
      )}
    </>
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

/** Renomear/reordenar os itens fixos do menu lateral — uma lista só, com
 * seção "Principal" e as duas seções internas (Financeiro/Equipe), cada
 * item com um campo de texto (renomear) e setas pra mover. Guarda em
 * orgs.nav_labels/nav_order via updateMyOrg (vale pra agência toda). */
function NavCustomizeModal({ onClose, mainItems, financeiroItems, equipeItems, navLabels, navOrder }: {
  onClose: () => void;
  mainItems: { id: string; label: string }[];
  financeiroItems: { id: string; label: string }[];
  equipeItems: { id: string; label: string }[];
  navLabels: Record<string, string>;
  navOrder: Record<string, string[]>;
}) {
  const { updateMyOrg } = useApi();
  const [labels, setLabels] = useState<Record<string, string>>(navLabels);
  const [order, setOrder] = useState<Record<string, string[]>>({
    main: navOrder.main?.length ? navOrder.main : mainItems.map((it) => it.id),
    financeiro: navOrder.financeiro?.length ? navOrder.financeiro : financeiroItems.map((it) => it.id),
    equipe: navOrder.equipe?.length ? navOrder.equipe : equipeItems.map((it) => it.id),
  });

  function orderedIds(section: string, fallbackItems: { id: string }[]) {
    const ids = order[section] ?? fallbackItems.map((it) => it.id);
    const known = new Set(fallbackItems.map((it) => it.id));
    const clean = ids.filter((id) => known.has(id));
    fallbackItems.forEach((it) => { if (!clean.includes(it.id)) clean.push(it.id); });
    return clean;
  }

  function move(section: string, fallbackItems: { id: string }[], id: string, dir: -1 | 1) {
    const ids = orderedIds(section, fallbackItems);
    const idx = ids.indexOf(id);
    const target = idx + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    setOrder((prev) => ({ ...prev, [section]: ids }));
  }

  function save() {
    const cleanLabels = Object.fromEntries(Object.entries(labels).filter(([, v]) => v && v.trim()));
    updateMyOrg.mutate(
      { data: { navLabels: cleanLabels, navOrder: order } },
      { onSuccess: () => { toast.success("Menu atualizado."); onClose(); } },
    );
  }

  function renderSection(title: string, section: string, fallbackItems: { id: string; label: string }[]) {
    if (fallbackItems.length === 0) return null;
    const labelById = new Map(fallbackItems.map((it) => [it.id, it.label]));
    const ids = orderedIds(section, fallbackItems);
    return (
      <div className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-wide text-white/30 mb-1.5">{title}</p>
        <div className="space-y-1.5">
          {ids.map((id, i) => (
            <div key={id} className="flex items-center gap-1.5">
              <input
                value={labels[id] ?? labelById.get(id) ?? ""}
                onChange={(e) => setLabels((prev) => ({ ...prev, [id]: e.target.value }))}
                className="flex-1 min-w-0 bg-[#0D0D0D] border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
              />
              {DEFAULT_NAV_LABELS[id] && labels[id] && labels[id] !== DEFAULT_NAV_LABELS[id] && (
                <button
                  onClick={() => setLabels((prev) => { const next = { ...prev }; delete next[id]; return next; })}
                  title="Restaurar nome padrão"
                  className="p-1.5 rounded text-white/30 hover:text-white shrink-0"
                ><RotateCcw size={12} /></button>
              )}
              <button onClick={() => move(section, fallbackItems, id, -1)} disabled={i === 0}
                className="p-1.5 rounded text-white/40 hover:text-white disabled:opacity-20 shrink-0"><ArrowUp size={12} /></button>
              <button onClick={() => move(section, fallbackItems, id, 1)} disabled={i === ids.length - 1}
                className="p-1.5 rounded text-white/40 hover:text-white disabled:opacity-20 shrink-0"><ArrowDown size={12} /></button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-[#1C1C1C] border border-white/10 rounded-2xl p-5 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-white">Personalizar menu</span>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>
        <p className="text-[11px] text-white/40 mb-4">Renomeie ou reordene qualquer item — vale pra toda a agência.</p>
        {renderSection("Principal", "main", mainItems)}
        {renderSection("Financeiro", "financeiro", financeiroItems)}
        {renderSection("Equipe", "equipe", equipeItems)}
        <button
          onClick={save}
          disabled={updateMyOrg.isPending}
          className="w-full mt-2 font-bold uppercase text-sm px-5 py-3 rounded-md transition disabled:opacity-40"
          style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          {updateMyOrg.isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
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
      {isOpen && <div className="mt-0.5 lz-stagger">{children}</div>}
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
      style={active ? glassCardStyle(true, "var(--sidebar)") : { background: "transparent", border: "1px solid transparent" }}
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

      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center opacity-40 group-hover:opacity-100 transition-opacity">
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
            // O aviso ficava FORA do onSuccess: falhando ou não, avisava
            // que tinha duplicado. Agora só fala depois de confirmar.
            duplicateMonth.mutate(
              { data: { clientId: client.id, fromKey: monthKey } },
              { onSuccess: () => toast.success(`Mês de ${formatMonth(monthKey)} duplicado.`) },
            );
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
