import { useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search, MoreHorizontal, LayoutDashboard, ChevronDown, ChevronRight, Folder, BarChart2,
  Plus, Info, CircleHelp, Instagram, Users, Wallet, UserCog, BookMarked,
  Settings2, X, ArrowUp, ArrowDown, RotateCcw, Handshake, IdCard, Trash2, Images, MessageCircleHeart, BookOpenText,
} from "lucide-react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { clientsQO, clientCategoriesQO, useApi, useMe, myAgencyLevelInputsQO } from "@/lib/luzeria/queries";
import { computeAgencyPoints, getAgencyLevel, type AgencyLevelInput } from "@/lib/luzeria/agency-level";
import { TIER_COLOR, TIER_ICON, type AgencyTierName } from "./AgencyLevelIcons";
import { useUI } from "@/lib/luzeria/ui-store";
import { Avatar } from "./Avatar";
import { PRESET_COLORS, glassCardStyle } from "@/lib/luzeria/utils";
import { requestConfirm, requestPrompt } from "@/lib/luzeria/confirm-store";
import { reportAppError } from "@/lib/error-reporting";
import { toast } from "sonner";
import { hasSetorPermission, hasPermission, type Client } from "@/lib/luzeria/types";
import { isHouse, term } from "@/lib/luzeria/house";
import { useLogoOpticalBox, applyManualAdjust } from "@/lib/luzeria/logo-optical-center";
import { useLogoPreview } from "@/lib/luzeria/logo-preview-store";

export const DEFAULT_NAV_LABELS: Record<string, string> = {
  "minhas-demandas": "Minhas demandas", dashboard: "Dashboard", clientes: "Clientes",
  calendario: "Calendário", biblioteca: "Biblioteca",
  instagram: "Instagram", financeiro: "Financeiro", equipe: "Equipe", ajuda: "Ajuda",
  cobranca: "Meu plano", margem: "Margem por cliente", afiliados: "Afiliados", revenda: "Revenda", indicacoes: "Indique e ganhe",
  rotina: "Rotina", membros: "Membros", relatorio: "Relatório", "auditoria-producao": "Auditoria de Produção", jornada: "Jornada do cliente",
  vendas: "Vendas", lixeira: "Lixeira", pagamentos: "Entradas e saídas", resultado: "Resultado do mês", orcamentos: "Orçamentos", cliente: "Visão Geral", "cliente-overview": "Visão Geral",
  "selecao-de-fotos": "Seleção de Fotos",
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
  // 240 = w-[240px] da aside (só importa quando expandida, que é quando a
  // logo aparece); 20 = margem mínima de segurança dos dois lados; 130 =
  // teto de altura (rede de segurança pra logo enviada com proporção
  // muito vertical, ex: template de Stories — ver comentário no hook).
  const autoLogoBox = useLogoOpticalBox(me?.orgLogoUrl, 240, 20, 130);
  // Enquanto o Junior tá mexendo nas réguas de tamanho/posição em
  // Configurações, a prévia ao vivo (logo-preview-store) manda aqui — sem
  // ela (telas normais, ou saiu de Configurações), usa o valor salvo.
  const logoPreview = useLogoPreview();
  const logoSizeAdjustPx = logoPreview.sizeAdjustPx ?? me?.orgLogoSizeAdjustPx ?? 0;
  const logoPositionAdjustPx = logoPreview.positionAdjustPx ?? me?.orgLogoPositionAdjustPx ?? 0;
  const logoBox = applyManualAdjust(autoLogoBox, logoSizeAdjustPx, logoPositionAdjustPx);
  const { data: levelInputs } = useQuery({ ...myAgencyLevelInputsQO(), enabled: !!me && !(me?.disabledFeatures ?? []).includes("agency_levels") });
  const { data: clients = [], isLoading: clientsLoading, isError: clientsError, error: clientsErrObj } = useQuery(clientsQO());
  const { data: customCategories = [] } = useQuery(clientCategoriesQO());
  const { createClientCategory } = useApi();
  useEffect(() => {
    if (clientsError) reportAppError(clientsErrObj, { consulta: "listClients" });
  }, [clientsError, clientsErrObj]);

  async function handleCreateCategory() {
    const name = await requestPrompt("Nome da nova categoria:");
    if (!name?.trim()) return;
    createClientCategory.mutate({ data: { name: name.trim() } });
  }
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

  const house = isHouse(me);
  const grouped = useMemo(() => {
    // House: sem categorias nem pasta de avulsos — uma lista só de marcas.
    if (house) {
      // Principal primeiro, arquivadas por último (ainda aparecem pra poder desarquivar).
      const list = [...filtered]
        .sort((a, b) => Number(!!a.archived) - Number(!!b.archived)
          || Number(b.id === me?.houseClientId) - Number(a.id === me?.houseClientId)
          || a.name.localeCompare(b.name));
      return [["Marcas", list] as const] as Array<readonly [string, Client[]]>;
    }
    const byCat = new Map<string, Client[]>();
    for (const c of filtered) {
      const cat = c.category || "Social Media";
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat)!.push(c);
    }
    for (const arr of byCat.values()) {
      arr.sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));
    }
    // Always render Avulsos (even when empty) so admin can use the + button
    // — same reasoning pra categoria customizada recém-criada, sem cliente
    // nenhum ainda: precisa aparecer como pasta pra poder usar o +.
    const known = CATEGORY_ORDER
      .filter((k) => byCat.has(k) || k === "Avulsos")
      .map((k) => [k, byCat.get(k) ?? []] as const);
    const customKnown = customCategories
      .map((c) => c.name)
      .filter((n) => !(CATEGORY_ORDER as readonly string[]).includes(n))
      .map((n) => [n, byCat.get(n) ?? []] as const);
    const customNames = new Set(customCategories.map((c) => c.name));
    const extras = [...byCat.entries()].filter(([k]) => !(CATEGORY_ORDER as readonly string[]).includes(k) && !customNames.has(k));
    return [...known, ...customKnown, ...extras] as Array<readonly [string, Client[]]>;
  }, [filtered, customCategories, house, me?.houseClientId]);

  const allCategories = useMemo(() => {
    const set = new Set<string>(CATEGORY_ORDER);
    customCategories.forEach((c) => set.add(c.name));
    clients.forEach((c) => c.category && set.add(c.category));
    return [...set];
  }, [clients, customCategories]);

  const isAdmin = me?.role === "master" || me?.role === "setor";
  const isDemoReadOnly = !!me?.demoReadOnly && me?.role !== "master";
  const disabled = new Set(me?.disabledFeatures ?? []);
  const clientsActive = pathname.startsWith("/cliente/");
  const isMaster = me?.role === "master";
  const canTeam = isMaster || hasPermission(me, "manage_team");
  const canReport = isMaster || hasSetorPermission(me, "team_reports");
  const canJourney = isMaster || hasSetorPermission(me, "settings_journey");
  const canFinanceiro = isMaster || hasPermission(me, "view_financeiro");
  const canSales = !disabled.has("sales_pipeline") && hasPermission(me, "sales_pipeline");
  const canPhotoSelection = !disabled.has("photo_selection") && isAdmin;
  const rotinaEnabled = !disabled.has("rotina");
  const configTabActive = (tabId: string) => pathname === "/configuracoes" && routerSearch?.tab === tabId;
  const goToConfigTab = (tabId: string) => navigate({ to: "/configuracoes", search: { tab: tabId } });
  // Financeiro da agência ganhou página própria (/financeiro, Etapa 3).
  const financeTabActive = (aba: string) => pathname === "/financeiro" && ((routerSearch as { aba?: string })?.aba ?? "entradas") === aba;
  const goToFinance = (aba: string) => navigate({ to: "/financeiro", search: { aba } as any });
  const [customizingNav, setCustomizingNav] = useState(false);
  const navLabels = me?.navLabels ?? {};
  const navOrder = me?.navOrder ?? {};
  const navLabel = (id: string, fallback: string) => navLabels[id] || fallback;
  // House com uma marca só: "Marca" vira link direto, sem lista.
  const houseBrands = house ? clients.filter((c) => !c.archived && c.category !== "Ex-clientes") : [];
  const singleBrandId = house && houseBrands.length <= 1 ? (me?.houseClientId ?? houseBrands[0]?.id ?? null) : null;
  // House: a home é o "Meu dia" e a Rotina vira os checklists da função.
  const homePath = house ? "/meu-dia" : "/minhas-tarefas";
  const homeLabel = house ? navLabel("meu-dia", "Meu dia") : navLabel("minhas-demandas", "Minhas demandas");
  const rotinaLabel = house ? "Checklists" : "Rotina";
  const clientesLabel = navLabel("clientes", singleBrandId ? term(me, "Cliente") : term(me, "Clientes"));
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
        <div className="pt-5 pb-4">
          {me?.orgLogoUrl ? (
            // Tamanho/posição vêm do centro de massa real da arte (ver
            // useLogoOpticalBox) — não é só "encher a largura" com padding
            // simétrico, que pode parecer torto se a logo tiver algum
            // elemento (ícone, traço) que pesa visualmente mais pra um
            // lado. Uma logo quadrada fica proporcionalmente maior (e
            // empurra o menu um pouco pra baixo), intencional (pedido do
            // Junior). O slogan/selo abaixo usa o px-5 padrão da sidebar —
            // não precisam alinhar exatamente com a logo, que agora tem
            // posição própria calculada por imagem.
            <img
              src={me.orgLogoUrl}
              alt={me.orgName ?? "Logo"}
              className="block h-auto object-contain"
              style={{ width: logoBox.width, marginLeft: logoBox.marginLeft }}
            />
          ) : (
            <div className="px-5 text-white font-extrabold text-lg uppercase tracking-wide truncate" title={me?.orgName ?? ""}>
              {me?.orgName ?? "Modo Criador"}
            </div>
          )}
          <div className="px-5">
            {/* `??` (não `||`) de propósito: uma string vazia salva de propósito
             * (o master removeu o slogan em Configurações) precisa continuar
             * vazia — só null/undefined (nunca configurado) cai no padrão. */}
            {(me?.orgTagline ?? "Gestão de conteúdo e criação") && (
              <p className="text-white/90 text-[10px] font-light italic tracking-wide mt-1.5">
                {me?.orgTagline ?? "Gestão de conteúdo e criação"}
              </p>
            )}
            {levelInputs && !disabled.has("agency_levels") && <AgencyLevelSidebarBadge inputs={levelInputs} />}
            {isDemoReadOnly && (
              <span className="inline-block mt-2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.2)", color: "var(--lz-accent-ink)" }}>
                Demonstração — somente visualização
              </span>
            )}
          </div>
        </div>
      )}
      <div className={collapsed ? "mx-3 h-px mt-5" : "mx-5 h-px"} style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.2)" }} />

      {/* Nav — single scrollable list so Clientes sits inline with everything else */}
      <div className={collapsed ? "px-2 pt-4 pb-3 flex-1 overflow-y-auto space-y-1.5 flex flex-col items-center" : "px-3 pt-4 pb-3 flex-1 overflow-y-auto space-y-0.5"}>
        {(() => {
          const clienteItems = orderSection("cliente", [
            ...(isAdmin && !disabled.has("client_overview") ? [{ id: "cliente-overview", label: navLabel("cliente-overview", "Visão Geral"), node: <NavSubButton key="cliente-overview" label={navLabel("cliente-overview", "Visão Geral")} active={configTabActive("cliente")} onClick={() => goToConfigTab("cliente")} /> }] : []),
            ...(canJourney && !disabled.has("journey") ? [{ id: "jornada", label: navLabel("jornada", "Jornada do cliente"), node: <NavSubButton key="jornada" label={navLabel("jornada", "Jornada do cliente")} active={configTabActive("journey")} onClick={() => goToConfigTab("journey")} /> }] : []),
            ...(isAdmin && canFinanceiro && !disabled.has("margin") ? [{ id: "margem", label: navLabel("margem", "Margem por cliente"), node: <NavSubButton key="margem" label={navLabel("margem", "Margem por cliente")} active={configTabActive("margem")} onClick={() => goToConfigTab("margem")} /> }] : []),
          ]);

          // Afiliados e Revenda saíram do menu: as três entradas abriam a
          // mesma tela (a aba de cobrança renderiza todas as seções), então
          // eram três caminhos pro mesmo lugar. As seções continuam lá
          // dentro, e as URLs ?tab=afiliados / ?tab=revenda seguem válidas.
          // Entradas e saídas (pagamentos) morava em "Visão Geral" — pedido
          // do Junior (29/09) pra juntar tudo que é financeiro da agência
          // (plano, indicações, fluxo de caixa) num grupo só.
          const financeiroItems = canFinanceiro ? orderSection("financeiro", [
            // Plano e indicações são da assinatura da agência no Modo
            // Criador — só o master. Quem tem só o cargo Financeiro vê o
            // financeiro da agência (entradas/saídas e orçamentos).
            ...(isMaster ? [
              { id: "cobranca", label: navLabel("cobranca", "Meu plano"), node: <NavSubButton key="cobranca" label={navLabel("cobranca", "Meu plano")} active={configTabActive("cobranca")} onClick={() => goToConfigTab("cobranca")} /> },
              ...(!disabled.has("referrals") ? [{ id: "indicacoes", label: navLabel("indicacoes", "Indique e ganhe"), node: <NavSubButton key="indicacoes" label={navLabel("indicacoes", "Indique e ganhe")} active={configTabActive("indicacoes")} onClick={() => goToConfigTab("indicacoes")} /> }] : []),
            ] : []),
            // Toggle "Financeiro" em Configurações → Geral esconde o
            // financeiro da agência; Meu plano continua pro master.
            ...(!disabled.has("financeiro") ? [
            { id: "pagamentos", label: navLabel("pagamentos", "Entradas e saídas"), node: <NavSubButton key="pagamentos" label={navLabel("pagamentos", "Entradas e saídas")} active={financeTabActive("entradas")} onClick={() => goToFinance("entradas")} /> },
            { id: "resultado", label: navLabel("resultado", "Resultado do mês"), node: <NavSubButton key="resultado" label={navLabel("resultado", "Resultado do mês")} active={financeTabActive("resultado")} onClick={() => goToFinance("resultado")} /> },
            { id: "orcamentos", label: navLabel("orcamentos", "Orçamentos"), node: <NavSubButton key="orcamentos" label={navLabel("orcamentos", "Orçamentos")} active={financeTabActive("orcamentos")} onClick={() => goToFinance("orcamentos")} /> },
            ] : []),
          ]) : [];

          const equipeItems = orderSection("equipe", [
            ...(rotinaEnabled ? [{ id: "rotina", label: navLabel("rotina", rotinaLabel), node: <div key="rotina" data-tour="nav-rotina"><NavSubButton label={navLabel("rotina", rotinaLabel)} active={pathname === "/rotina"} onClick={() => navigate({ to: "/rotina" })} /></div> }] : []),
            ...(canTeam ? [{ id: "membros", label: navLabel("membros", "Membros"), node: <NavSubButton key="membros" label={navLabel("membros", "Membros")} active={configTabActive("team")} onClick={() => goToConfigTab("team")} /> }] : []),
            ...(canReport ? [{ id: "relatorio", label: navLabel("relatorio", "Relatório"), node: <NavSubButton key="relatorio" label={navLabel("relatorio", "Relatório")} active={configTabActive("report")} onClick={() => goToConfigTab("report")} /> }] : []),
            ...(canReport ? [{ id: "auditoria-producao", label: navLabel("auditoria-producao", "Auditoria de Produção"), node: <NavSubButton key="auditoria-producao" label={navLabel("auditoria-producao", "Auditoria de Produção")} active={configTabActive("auditoria")} onClick={() => goToConfigTab("auditoria")} /> }] : []),
          ]);

          const mainItems: { id: string; label: string; node: React.ReactNode; meta: CollapsedMeta }[] = orderSection("main", [
            { id: "minhas-demandas", label: homeLabel, node: (
              <NavButton key="minhas-demandas" icon={<LayoutDashboard size={15} />} label={homeLabel}
                active={pathname === homePath} onClick={() => navigate({ to: homePath })} />
            ), meta: { icon: <LayoutDashboard size={17} />, label: homeLabel, active: pathname === homePath, kind: "button", onClick: () => navigate({ to: homePath }) } },
            { id: "dashboard", label: navLabel("dashboard", "Dashboard"), node: (
              <NavButton key="dashboard" icon={<BarChart2 size={15} />} label={navLabel("dashboard", "Dashboard")}
                active={pathname === "/admin"} onClick={() => navigate({ to: "/admin" })} />
            ), meta: { icon: <BarChart2 size={17} />, label: navLabel("dashboard", "Dashboard"), active: pathname === "/admin", kind: "button", onClick: () => navigate({ to: "/admin" }) } },
            singleBrandId ? { id: "clientes", label: clientesLabel, meta: { icon: <Users size={17} />, label: clientesLabel, active: clientsActive, kind: "button" as const, onClick: () => navigate({ to: "/cliente/$clientId", params: { clientId: singleBrandId } }) }, node: (
              <div key="clientes" className="relative">
                <NavButton icon={<Users size={15} />} label={clientesLabel} active={clientsActive}
                  onClick={() => navigate({ to: "/cliente/$clientId", params: { clientId: singleBrandId } })} />
                {isMaster && (
                  <button onClick={() => onCreateClient()} title="Adicionar outra marca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-white/40 hover:text-[rgb(var(--lz-brand-rgb))] hover:bg-white/5">
                    <Plus size={13} />
                  </button>
                )}
              </div>
            ) } : { id: "clientes", label: clientesLabel, meta: { icon: <Users size={17} />, label: clientesLabel, active: clientsActive, kind: "flyout" }, node: (
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
                    <span className="truncate">{clientesLabel}</span>
                  </span>
                  <span className="flex items-center gap-0.5 shrink-0">
                    {isAdmin && (!house || isMaster) && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); onCreateClient(); }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); onCreateClient(); } }}
                        title={term(me, "novoCliente")}
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
                      onCreateClient={onCreateClient} onCreateCategory={handleCreateCategory} onOpenCustomFields={onOpenCustomFields}
                      loading={clientsLoading}
                      error={clientsError}
                      house={house}
                    />
                  </div>
                )}
              </div>
            ) },
            // House: leads que chegam pelo Instagram (lançados pelo "+ Lead").
            ...(house ? [{ id: "leads", label: navLabel("leads", "Leads"), meta: { icon: <MessageCircleHeart size={17} />, label: navLabel("leads", "Leads"), active: pathname === "/leads", kind: "button" as const, onClick: () => navigate({ to: "/leads" }) }, node: (
              <div key="leads">
                <NavButton icon={<MessageCircleHeart size={15} />} label={navLabel("leads", "Leads")} active={pathname === "/leads"} onClick={() => navigate({ to: "/leads" })} />
              </div>
            ) }] : []),
            ...(house ? [{ id: "playbook", label: navLabel("playbook", "Playbook"), meta: { icon: <BookOpenText size={17} />, label: navLabel("playbook", "Playbook"), active: pathname === "/playbook", kind: "button" as const, onClick: () => navigate({ to: "/playbook", search: {} as any }) }, node: (
              <div key="playbook">
                <NavButton icon={<BookOpenText size={15} />} label={navLabel("playbook", "Playbook")} active={pathname === "/playbook"} onClick={() => navigate({ to: "/playbook", search: {} as any })} />
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
            ...(canPhotoSelection ? [{ id: "selecao-de-fotos", label: navLabel("selecao-de-fotos", "Seleção de Fotos"), meta: { icon: <Images size={17} />, label: navLabel("selecao-de-fotos", "Seleção de Fotos"), active: pathname.startsWith("/selecao-de-fotos"), kind: "button" as const, onClick: () => navigate({ to: "/selecao-de-fotos" }) }, node: (
              <div key="selecao-de-fotos" data-tour="nav-selecao-de-fotos">
                <NavButton icon={<Images size={15} />} label={navLabel("selecao-de-fotos", "Seleção de Fotos")} active={pathname.startsWith("/selecao-de-fotos")} onClick={() => navigate({ to: "/selecao-de-fotos" })} />
              </div>
            ) }] : []),
            ...(isAdmin ? [{ id: "lixeira", label: navLabel("lixeira", "Lixeira"), meta: { icon: <Trash2 size={17} />, label: navLabel("lixeira", "Lixeira"), active: pathname === "/lixeira", kind: "button" as const, onClick: () => navigate({ to: "/lixeira" }) }, node: (
              <div key="lixeira" data-tour="nav-lixeira">
                <NavButton icon={<Trash2 size={15} />} label={navLabel("lixeira", "Lixeira")} active={pathname === "/lixeira"} onClick={() => navigate({ to: "/lixeira" })} />
              </div>
            ) }] : []),
            ...(clienteItems.length > 0 ? [{ id: "cliente", label: navLabel("cliente", "Visão Geral"), meta: { icon: <IdCard size={17} />, label: navLabel("cliente", "Visão Geral"), active: configTabActive("cliente") || configTabActive("journey") || configTabActive("margem"), kind: "flyout" as const }, node: (
              <div key="cliente" data-tour="nav-cliente">
                <NavGroup icon={<IdCard size={15} />} label={navLabel("cliente", "Visão Geral")}
                  active={configTabActive("cliente") || configTabActive("journey") || configTabActive("margem")}>
                  {clienteItems.map((it) => it.node)}
                </NavGroup>
              </div>
            ) }] : []),
            ...(financeiroItems.length > 0 ? [{ id: "financeiro", label: navLabel("financeiro", "Financeiro"), meta: { icon: <Wallet size={17} />, label: navLabel("financeiro", "Financeiro"), active: configTabActive("cobranca") || configTabActive("afiliados") || configTabActive("revenda") || configTabActive("indicacoes") || pathname === "/financeiro", kind: "flyout" as const }, node: (
              <div key="financeiro" data-tour="nav-financeiro">
                <NavGroup icon={<Wallet size={15} />} label={navLabel("financeiro", "Financeiro")}
                  active={configTabActive("cobranca") || configTabActive("afiliados") || configTabActive("revenda") || configTabActive("indicacoes") || pathname === "/financeiro"}>
                  {financeiroItems.map((it) => it.node)}
                </NavGroup>
              </div>
            ) }] : []),
            ...((canTeam || canReport || rotinaEnabled) ? [{ id: "equipe", label: navLabel("equipe", "Equipe"), meta: { icon: <UserCog size={17} />, label: navLabel("equipe", "Equipe"), active: configTabActive("team") || configTabActive("report") || configTabActive("auditoria") || pathname === "/rotina", kind: "flyout" as const }, node: (
              <div key="equipe" data-tour="nav-equipe">
                <NavGroup icon={<UserCog size={15} />} label={navLabel("equipe", "Equipe")}
                  active={configTabActive("team") || configTabActive("report") || configTabActive("auditoria") || pathname === "/rotina"}>
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
                      onCreateClient={onCreateClient} onCreateCategory={handleCreateCategory} onOpenCustomFields={onOpenCustomFields}
                      loading={clientsLoading}
                      error={clientsError}
                      house={house}
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
/** Selo de nível no topo da sidebar (perto do nome da agência, tipo
 * reputação do Mercado Livre) — clique abre um resumo rápido com a
 * pontuação e um link "Saiba mais" pra página completa, em vez de já
 * navegar direto (pedido do Junior). */
function AgencyLevelSidebarBadge({ inputs }: { inputs: AgencyLevelInput }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const points = computeAgencyPoints(inputs);
  const level = getAgencyLevel(points);
  const color = TIER_COLOR[level.tier as AgencyTierName] ?? "#9AA4B2";
  const Icon = TIER_ICON[level.tier as AgencyTierName];

  return (
    <div className="mt-2 inline-block">
      <button
        ref={btnRef}
        onClick={() => { setAnchor(btnRef.current?.getBoundingClientRect() ?? null); setOpen((v) => !v); }}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold transition hover:brightness-110"
        style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`, color }}
      >
        {Icon && <Icon size={11} />}
        Agência {level.label}
      </button>
      {open && anchor && createPortal(
        <div
          ref={panelRef}
          style={{ position: "fixed", top: anchor.bottom + 6, left: anchor.left, width: 240 }}
          className="z-[999] rounded-xl bg-[#1C1C1C] border border-white/10 shadow-2xl p-3.5 lz-modal-in"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>
              {Icon && <Icon size={16} />}
            </div>
            <div>
              <div className="text-white text-[13px] font-black">Agência {level.label}</div>
              <div className="text-white/40 text-[10.5px] tabular-nums">{points} pts</div>
            </div>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.1)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${level.progressPct}%`, background: color }} />
          </div>
          <div className="text-white/45 text-[11px] leading-relaxed mb-3">
            {level.pointsToNext != null
              ? `Faltam ${level.pointsToNext} pts pro próximo nível.`
              : "Nível máximo — sua agência é uma potência."}
            {" "}É o Programa de Níveis: quanto mais você usa o Modo Criador de verdade, mais sobe.
          </div>
          <Link
            to="/programa-de-niveis"
            className="text-[11px] font-bold hover:underline"
            style={{ color }}
            onClick={() => setOpen(false)}
          >
            Saiba mais →
          </Link>
        </div>,
        document.body,
      )}
    </div>
  );
}

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
function ClientesListBody({ search, setSearch, grouped, filtered, isAdmin, allCategories, pathname, onCreateClient, onCreateCategory, onOpenCustomFields, loading, error, house }: {
  search: string; setSearch: (v: string) => void;
  grouped: Array<readonly [string, Client[]]>; filtered: Client[];
  isAdmin: boolean; allCategories: string[]; pathname: string;
  onCreateClient: (category?: string) => void; onCreateCategory: () => void; onOpenCustomFields: (c: Client) => void;
  loading?: boolean; error?: boolean; house?: boolean;
}) {
  // House: lista simples de marcas, sem pasta/categoria.
  if (house) {
    const list = grouped[0]?.[1] ?? [];
    return (
      <div className="space-y-0.5">
        {list.map((c) => (
          <ClientRow key={c.id} client={c} active={pathname === `/cliente/${c.id}`}
            onOpenCustomFields={() => onOpenCustomFields(c)} canManage={isAdmin} categories={allCategories} />
        ))}
        {loading && list.length === 0 && <div className="px-3 py-2 text-xs text-white/30">Carregando…</div>}
        {error && <div className="text-xs text-center mt-3 px-3" style={{ color: "#E76F51" }}>Não consegui carregar as marcas.</div>}
      </div>
    );
  }
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
      {grouped.map(([cat, list]) =>
        // Avulsos virou uma página própria (/avulsos, com "projetos em
        // aberto"/"entregues" e seletor de mês) em vez de uma lista longa
        // aqui dentro — pedido do Junior (30/09). A pasta agora é um link
        // direto, não expande mais inline.
        cat === "Avulsos" ? (
          <AvulsosNavRow key={cat} count={list.length} onAdd={isAdmin ? () => onCreateClient(cat) : undefined} />
        ) : (
          <CategoryGroup
            key={cat}
            name={cat}
            color={CATEGORY_COLOR[cat] ?? "#5BA88A"}
            defaultOpen={false}
            forceOpen={search.trim().length > 0 || list.some((c) => pathname === `/cliente/${c.id}`)}
            count={list.length}
            onAdd={isAdmin && cat !== "Ex-clientes" ? () => onCreateClient(cat) : undefined}
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
          </CategoryGroup>
        ),
      )}
      {isAdmin && (
        <button
          onClick={onCreateCategory}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 mt-0.5 rounded-md text-[11px] font-semibold text-white/40 hover:text-white/80 hover:bg-white/5 transition"
        >
          <Plus size={12} /> Nova categoria
        </button>
      )}
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
  name, color, children, defaultOpen, forceOpen, count, onAdd,
}: {
  name: string; color: string; children: React.ReactNode;
  defaultOpen?: boolean; forceOpen?: boolean; count?: number; onAdd?: () => void;
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
            title="Novo cliente"
            className="p-1 rounded text-white/40 hover:text-[rgb(var(--lz-brand-rgb))] hover:bg-white/5">
            <Plus size={13} />
          </button>
        )}
      </div>
      {isOpen && <div className="mt-0.5 lz-stagger">{children}</div>}
    </div>
  );
}

/** Linha "Avulsos" dentro de Clientes — em vez de expandir uma lista
 * inline (como as outras categorias), leva direto pra página /avulsos. */
function AvulsosNavRow({ count, onAdd }: { count: number; onAdd?: () => void }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = pathname === "/avulsos";
  return (
    <button
      onClick={() => navigate({ to: "/avulsos" })}
      className="w-full flex items-center gap-1.5 px-2 py-1.5 mb-2 rounded-md transition-colors group"
      style={{ color: active ? "#FFFFFF" : "rgba(255,255,255,0.8)", background: active ? "rgba(var(--lz-brand-light-rgb),0.12)" : "transparent" }}
    >
      <ChevronRight size={12} className="text-white/40 shrink-0" />
      <Folder size={14} style={{ color: CATEGORY_COLOR["Avulsos"] }} className="shrink-0" />
      <span className="text-[12px] font-semibold tracking-tight truncate uppercase flex-1 text-left">Avulsos</span>
      <span className="text-[10px] text-white/40">{count}</span>
      {onAdd && (
        <span role="button" tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); e.preventDefault(); onAdd(); } }}
          title="Nova demanda avulsa"
          className="p-1 rounded text-white/40 hover:text-[rgb(var(--lz-brand-rgb))] hover:bg-white/5"
        >
          <Plus size={13} />
        </span>
      )}
    </button>
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
  const { updateClient, deleteClient } = useApi();
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
        className={`relative w-full flex items-center gap-2.5 pl-3 py-2 text-left ${canManage ? "pr-12" : "pr-8"}`}
      >
        <Avatar name={client.name} color={client.color} size={26} avatarUrl={client.photoUrl} />
        <span className="text-sm truncate text-white/90 flex-1">{client.name}</span>
      </Link>

      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center opacity-40 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); openFicha(client.id); }}
          title="Ficha do cliente"
          className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-[rgb(var(--lz-brand-rgb))]"
        >
          <Info size={13} />
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
