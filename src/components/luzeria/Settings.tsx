import { useQuery } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { hexToRgbChannels, deriveSecondaryHex, contrastRatio, contrastLabel, applyAdvancedColorVars } from "@/lib/luzeria/utils";
import { profilesQO, useApi, useMe, appSettingsQO, orgPlanStatusQO, plansQO, cargosQO, myPendingInvoiceQO, myInvoiceHistoryQO, contentStatusesQO, clientCategoriesQO } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { useLogoPreview } from "@/lib/luzeria/logo-preview-store";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "./Avatar";
import type { Role } from "@/lib/luzeria/types";
import { OPTIONAL_FEATURE_KEYS, OPTIONAL_FEATURE_LABEL, hasSetorPermission, hasPermission, SETOR_PERMISSION_KEYS, SETOR_PERMISSION_LABEL, PERMISSION_KEYS, PERMISSION_LABEL, CUSTOMIZABLE_BUILTIN_STATUS_KEYS, PROTECTED_STATUS_KEYS, type SetorPermissionKey, type Profile, type BrandAdvancedColors } from "@/lib/luzeria/types";
import { toast } from "sonner";
import { isHouse, term, HOUSE_HIDDEN_FEATURES } from "@/lib/luzeria/house";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { UserPlus, X, Settings as SettingsIcon, Star, Building2, Loader2, Plus, Trash2, Archive, PlayCircle, ChevronDown, Users, UserCog, Rocket, Zap, Crown, FileDigit, ArrowRight, LayoutGrid, FileText, CheckCircle2, Tags, HelpCircle, Moon, Sun, ImagePlus, Palette, Eye, Sparkles, SlidersHorizontal, RotateCcw } from "lucide-react";
import { TeamMemberCard } from "./TeamMemberCard";
import { ContentStatusesSection } from "./ContentStatusesSection";
import { ClientCategoriesSection } from "./ClientCategoriesSection";
import { InstallAppTutorialModal } from "./InstallAppTutorialModal";

// Cada uma dessas só renderiza dentro de uma aba específica (nunca mais de
// uma por vez) — lazy pra quem abre Configurações não pagar o download/parse
// de todas as abas só pra ver "Equipe", que é a aba padrão.
const ReportsTab = lazy(() => import("./ReportsTab").then((m) => ({ default: m.ReportsTab })));
const IntegrationsTab = lazy(() => import("./IntegrationsTab").then((m) => ({ default: m.IntegrationsTab })));
const MemberGoalsTab = lazy(() => import("./MemberGoalsTab").then((m) => ({ default: m.MemberGoalsTab })));
const AutomationsTab = lazy(() => import("./AutomationsTab").then((m) => ({ default: m.AutomationsTab })));
const UpdatesTab = lazy(() => import("./UpdatesTab").then((m) => ({ default: m.UpdatesTab })));
const ReferralsTab = lazy(() => import("./ReferralsTab").then((m) => ({ default: m.ReferralsTab })));
const PromotionCodesPanel = lazy(() => import("./PromotionCodesPanel").then((m) => ({ default: m.PromotionCodesPanel })));
const AffiliateProgramPanel = lazy(() => import("./AffiliateProgramPanel").then((m) => ({ default: m.AffiliateProgramPanel })));
const ResellerPanel = lazy(() => import("./ResellerPanel").then((m) => ({ default: m.ResellerPanel })));
const AgenciesBillingPanel = lazy(() => import("./AgenciesBillingPanel").then((m) => ({ default: m.AgenciesBillingPanel })));
const PageActivityReportPanel = lazy(() => import("./PageActivityReportPanel").then((m) => ({ default: m.PageActivityReportPanel })));
const NewUserJourneyReportPanel = lazy(() => import("./NewUserJourneyReportPanel").then((m) => ({ default: m.NewUserJourneyReportPanel })));
const AiPlanningFeedbackPanel = lazy(() => import("./AiPlanningFeedbackPanel").then((m) => ({ default: m.AiPlanningFeedbackPanel })));
const ClientMarginPanel = lazy(() => import("./ClientMarginPanel").then((m) => ({ default: m.ClientMarginPanel })));
const DemoRequestsPanel = lazy(() => import("./DemoRequestsPanel").then((m) => ({ default: m.DemoRequestsPanel })));
const DailySplashSettingsPanel = lazy(() => import("./DailySplashSettingsPanel").then((m) => ({ default: m.DailySplashSettingsPanel })));
const MessagesPanel = lazy(() => import("./MessagesPanel").then((m) => ({ default: m.MessagesPanel })));
import { DeleteAccountSection } from "./DeleteAccountSection";
const SalesPageEditorTab = lazy(() => import("./SalesLandingEditorTab").then((m) => ({ default: m.SalesLandingEditorTab })));
const BlogAdminTab = lazy(() => import("./BlogAdminTab").then((m) => ({ default: m.BlogAdminTab })));
const EmailTemplatesPanel = lazy(() => import("./EmailTemplatesPanel").then((m) => ({ default: m.EmailTemplatesPanel })));
const JourneyStagesTab = lazy(() => import("./JourneyStagesTab").then((m) => ({ default: m.JourneyStagesTab })));
const ClientOperationsOverview = lazy(() => import("./ClientOperationsOverview").then((m) => ({ default: m.ClientOperationsOverview })));
const ProductionAuditTab = lazy(() => import("./ProductionAuditTab").then((m) => ({ default: m.ProductionAuditTab })));
const OrgKnowledgeSettings = lazy(() => import("./OrgKnowledgeSettings").then((m) => ({ default: m.OrgKnowledgeSettings })));

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="animate-spin text-foreground/30" size={22} />
    </div>
  );
}

type SettingsTab = "team" | "report" | "auditoria" | "automations" | "integrations" | "general" | "cobranca" | "margem" | "pagamentos" | "orcamentos" | "afiliados" | "revenda" | "indicacoes" | "plataforma" | "updates" | "site" | "blog" | "emails" | "journey" | "cliente" | "knowledge";
const VALID_TABS: SettingsTab[] = ["team", "report", "auditoria", "automations", "integrations", "general", "cobranca", "margem", "pagamentos", "orcamentos", "afiliados", "revenda", "indicacoes", "plataforma", "updates", "site", "blog", "emails", "journey", "cliente", "knowledge"];

export function SettingsPage({ tab: tabParam, onTabChange }: { tab?: string; onTabChange: (tab: SettingsTab) => void }) {
  const me = useMe().data;
  const { data: profiles = [] } = useQuery(profilesQO());
  const { deleteUser, adminCreateUser, createAgency } = useApi();
  const [adding, setAdding] = useState(false);
  const [creatingAgency, setCreatingAgency] = useState(false);
  // Ponte entre os cartões clicáveis de AgenciesBillingPanel ("quem falta")
  // e a campanha pronta correspondente em MessagesPanel, logo abaixo.
  const [activationPreset, setActivationPreset] = useState<"noClients" | "fewClients" | "noTeam" | null>(null);

  if (!me) return null;
  const isMaster = me.role === "master";
  const isAdmin = isMaster || me.role === "setor";
  const setorAllowedTabs: SettingsTab[] = [
    // "O que mudou no produto" é informativo, sem nada sensível — todo
    // mundo vê, até quem é só "member" e não tem nenhuma permissão de
    // setor (antes essas pessoas nem conseguiam abrir Configurações).
    "updates",
    ...(hasSetorPermission(me, "settings_journey") ? (["journey", "cliente"] as SettingsTab[]) : []),
    ...(hasSetorPermission(me, "team_reports") ? (["report", "auditoria"] as SettingsTab[]) : []),
    ...(hasPermission(me, "view_financeiro") ? (["cobranca", "margem", "pagamentos", "orcamentos", "cliente"] as SettingsTab[]) : []),
    ...(hasPermission(me, "manage_team") ? (["team"] as SettingsTab[]) : []),
    // Estas duas permissões apareciam no editor de cargos com rótulo e
    // descrição, mas nunca eram conferidas em lugar nenhum: o master
    // marcava, salvava, e nada mudava. Agora valem de verdade.
    ...(hasPermission(me, "manage_automations") ? (["automations", "integrations"] as SettingsTab[]) : []),
    ...(hasPermission(me, "view_client_overview") ? (["cliente"] as SettingsTab[]) : []),
    ...(isAdmin ? (["cliente"] as SettingsTab[]) : []),
  ];
  // Pedido do Junior: "Afiliados" e "Revenda" ficam escondidas de verdade
  // por enquanto (só "Indique e ganhe" está disponível) — nem a aba
  // aparece, nem ?tab=afiliados/revenda na URL funciona (cai no padrão).
  // Os componentes continuam intactos, só filtrados daqui — reativar depois
  // é só tirar essa linha.
  const HIDDEN_TABS: SettingsTab[] = [
    "afiliados", "revenda",
    // House: sem jornada/margem/visão geral de clientes, pagamentos por
    // cliente nem indicação entre agências.
    ...(isHouse(me) ? (["indicacoes", "margem", "journey", "cliente", "pagamentos"] as SettingsTab[]) : []),
  ];
  const allowedTabs: SettingsTab[] = (isMaster ? VALID_TABS : setorAllowedTabs).filter((t) => !HIDDEN_TABS.includes(t));
  // Pedido do Junior: "Plataforma" só existe pra ele (isPlatformAdmin), e é
  // a aba que ele mais usa no dia a dia — clicar na engrenagem sem escolher
  // aba nenhuma (search vazio) cai direto nela pra ele, em vez de "Equipe"
  // (que continua sendo o padrão pra qualquer outra agência master).
  const defaultTab: SettingsTab = me.isPlatformAdmin ? "plataforma" : allowedTabs[0];
  const tab: SettingsTab = (allowedTabs as string[]).includes(tabParam ?? "") ? (tabParam as SettingsTab) : defaultTab;
  const setTab = onTabChange;

  const pending = profiles.filter((p) => !p.active);
  const active = profiles.filter((p) => p.active);

  const handleRemove = async (id: string, name: string) => {
    if (!(await requestConfirm(`Remover ${name}? Esta ação é permanente.`, { danger: true }))) return;
    deleteUser.mutate({ data: { userId: id } }, {
      onSuccess: () => toast.success("Colaborador removido."),
      onError: (e: any) => toastFriendlyError(e, "Erro ao remover"),
    });
  };

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-10 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[32px] font-bold text-foreground tracking-tight">Configurações</h1>
          <p className="text-sm text-foreground/50 mt-2">
            {tab === "team" || tab === "report" || tab === "auditoria" ? "Gerencie acessos, funções, metas e o relatório da equipe." :
             tab === "integrations" ? "Conecte o Google Drive da agência, a sua Google Agenda e acompanhe o Instagram de cada cliente." :
             tab === "automations" ? "Lembretes automáticos e rotinas que o sistema executa sozinho." :
             tab === "cobranca" || tab === "afiliados" || tab === "revenda" || tab === "indicacoes" || tab === "pagamentos" || tab === "orcamentos" ? "Seu plano, indicações e o financeiro da agência." :
             tab === "plataforma" ? "Todas as agências do Modo Criador, mensagens de ativação e pedidos de demonstração." :
             tab === "cliente" || tab === "margem" || tab === "journey" ? "Visão geral, jornada e margem de cada cliente." :
             tab === "updates" ? "O que mudou no Modo Criador." :
             tab === "site" ? "Textos, imagens e cores do site de vendas (modocriador.com.br)." :
             tab === "blog" ? "Escreva e edite os artigos do blog (modocriador.com.br/blog)." :
             tab === "emails" ? "Como os e-mails automáticos chegam pras agências, os textos de cada um e a entrega." :
             tab === "knowledge" ? "Texto e arquivos que ensinam a IA como sua agência cria conteúdo." :
             "Ajustes gerais da operação."}
          </p>
        </div>
      </div>

      {(() => {
        const tabItems = [
          // Pedido do Junior: "Plataforma" é só dele (isPlatformAdmin) e é a
          // aba que ele mais usa — fica em primeiro lugar pra facilitar,
          // igual o comportamento padrão de "cair direto nela" acima.
          ...(me.isPlatformAdmin ? [{ id: "plataforma", label: "Plataforma" }] : []),
          { id: "team", label: "Equipe" },
          { id: "integrations", label: "Integrações" },
          { id: "automations", label: "Automações" },
          { id: "cliente", label: "Clientes" },
          { id: "cobranca", label: "Financeiro" },
          { id: "updates", label: "Atualizações" },
          { id: "general", label: "Geral" },
          { id: "knowledge", label: "Base de conhecimento" },
          ...(me.isPlatformAdmin ? [{ id: "site", label: "Site" }, { id: "blog", label: "Blog" }, { id: "emails", label: "E-mails" }] : []),
        ].filter((t) => allowedTabs.includes(t.id as SettingsTab));
        const isActive = (id: string) =>
          tab === (id as any) ||
          (id === "team" && (tab === "report" || tab === "auditoria")) ||
          (id === "cliente" && (tab === "margem" || tab === "journey")) ||
          (id === "cobranca" && (tab === "afiliados" || tab === "revenda" || tab === "indicacoes" || tab === "pagamentos" || tab === "orcamentos"));
        const current = tabItems.find((t) => isActive(t.id))?.id ?? tabItems[0]?.id;
        return (
          <>
            {/* Celular: caixa de seleção em vez de abas roláveis */}
            <div className="md:hidden mb-6" data-tour="settings-tabs-mobile">
              <select id="settings-tab-select" aria-label="Seção de configurações" value={current}
                onChange={(e) => setTab(e.target.value as any)}
                className="w-full rounded-md border border-foreground/15 bg-card text-foreground text-sm font-bold uppercase tracking-wider px-4 py-3">
                {tabItems.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div className="hidden md:flex items-center gap-1 border-b border-foreground/10 mb-6 overflow-x-auto overflow-y-hidden" data-tour="settings-tabs">
              {tabItems.map((t) => {
                const active = isActive(t.id);
                return (
                  <button key={t.id} onClick={() => setTab(t.id as any)}
                    className="shrink-0 whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors -mb-px border-b-2"
                    style={{
                      color: active ? "var(--foreground)" : "color-mix(in srgb, var(--foreground) 50%, transparent)",
                      borderColor: active ? "rgb(var(--lz-brand-rgb))" : "transparent",
                    }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </>
        );
      })()}

      {tab === "team" && (
        <div className="flex items-center justify-end gap-2 mb-6" data-tour="team-tab">
          {me.isPlatformAdmin && (
            <button onClick={() => setCreatingAgency(true)}
              className="lz-btn-ghost text-xs px-4 py-2.5 rounded-md inline-flex items-center gap-2">
              <Building2 size={14} /> Criar nova agência
            </button>
          )}
          <button onClick={() => setAdding(true)}
            className="lz-btn-primary text-xs px-4 py-2.5 rounded-md inline-flex items-center gap-2">
            <UserPlus size={14} /> Adicionar membro
          </button>
        </div>
      )}

      <Suspense fallback={<TabLoadingFallback />}>
      {tab === "general" ? <GeneralSettings /> :
       tab === "cobranca" || tab === "afiliados" || tab === "revenda" || tab === "indicacoes" || tab === "pagamentos" || tab === "orcamentos" ? (
        <div>
          {/* Auditoria de UX (2.2 / "afiliados vs indicações confusos"):
              antes disso as 3 sub-seções (Afiliados, Revenda, Indique e
              ganhe) não tinham nenhuma aba clicável — só eram alcançáveis
              editando a URL na mão (?tab=afiliados etc), então na prática
              ninguém fora do próprio time via essas telas. Agora têm abas
              de verdade, com 1 frase explicando o público de cada uma
              (pra não confundir "indicar outra agência" com "ser afiliado").
              "Entradas e saídas" (pagamentos) morava dentro de "Clientes" —
              pedido do Junior (29/09) pra juntar tudo que é financeiro da
              agência (plano, indicações, fluxo de caixa) numa aba só.
              "Orçamentos" (30/09): catálogo de produtos + propostas em PDF. */}
          {/* Entradas e saídas e Orçamentos ganharam página própria
              (/financeiro, Etapa 3 — 30/09). Links antigos pra essas abas, e
              quem tem só o cargo Financeiro (não vê plano/indicações),
              caem lá. Aqui ficam só plano e indicações do Modo Criador. */}
          {(tab === "pagamentos" || tab === "orcamentos" || !isMaster) && (
            <Navigate to="/financeiro" search={{ aba: tab === "orcamentos" ? "orcamentos" : "entradas" }} replace />
          )}
          {isMaster && (
            <div className="flex items-center gap-1 mb-6 -mt-2 flex-wrap">
              <SubTabPill active={tab === "cobranca"} onClick={() => setTab("cobranca")} label="Meu plano" />
              {!isHouse(me) && <SubTabPill active={tab === "indicacoes"} onClick={() => setTab("indicacoes")} label="Indique e ganhe" />}
            </div>
          )}

          {tab === "afiliados" ? (
            <div className="space-y-3">
              <p className="text-xs text-foreground/40">Pra parceiros externos (agências de marketing, consultores) que indicam o Modo Criador e ganham comissão em dinheiro — não confundir com "Indique e ganhe", que é entre agências já clientes.</p>
              <AffiliateProgramPanel isPlatformAdmin={me.isPlatformAdmin} />
            </div>
          ) : tab === "revenda" ? (
            <ResellerPanel />
          ) : tab === "indicacoes" ? (
            <div className="space-y-3">
              <p className="text-xs text-foreground/40">Pra agências que já são clientes do Modo Criador: indique outra agência e ambas ganham um mês grátis.</p>
              <ReferralsTab />
            </div>
          ) : tab === "pagamentos" || tab === "orcamentos" || !isMaster ? null : (
            <div className="space-y-10">
              <PlanCardSection />
              <div className="pt-2 border-t border-foreground/10">
                <BillingSection />
              </div>
              {!me.isPlatformAdmin && (
                <div className="pt-2 border-t border-foreground/10">
                  <DeleteAccountSection />
                </div>
              )}
            </div>
          )}
        </div>
       ) :
       tab === "plataforma" ? (me.isPlatformAdmin ? (
        <div className="space-y-10">
          <AgenciesBillingPanel onOpenActivationPreset={setActivationPreset} />
          <div className="pt-2 border-t border-foreground/10">
            <MessagesPanel openPreset={activationPreset} onConsumeOpenPreset={() => setActivationPreset(null)} />
          </div>
          <div className="pt-2 border-t border-foreground/10">
            <DemoRequestsPanel />
          </div>
          <div className="pt-2 border-t border-foreground/10">
            <PromotionCodesPanel />
          </div>
          <div className="pt-2 border-t border-foreground/10">
            <NewUserJourneyReportPanel />
          </div>
          <div className="pt-2 border-t border-foreground/10">
            <PageActivityReportPanel />
          </div>
          <div className="pt-2 border-t border-foreground/10">
            <AiPlanningFeedbackPanel />
          </div>
          <div className="pt-2 border-t border-foreground/10">
            <DailySplashSettingsPanel />
          </div>
        </div>
       ) : null) :
       tab === "cliente" || tab === "margem" || tab === "journey" ? (
        <ClienteTab
          initialSub={tab === "margem" ? "margem" : tab === "journey" ? "jornada" : "overview"}
          canJourney={hasSetorPermission(me, "settings_journey")}
          // Margem usa custo-hora derivado do salário da equipe — o servidor
          // só libera pra master/setor (is_admin). Sem o isAdmin aqui, quem
          // tinha só o cargo Financeiro via a aba e recebia erro.
          canMargem={isAdmin && hasPermission(me, "view_financeiro")}
          isAdmin={isAdmin}
        />
       ) :
       tab === "updates" ? <UpdatesTab /> :
       tab === "site" ? (me.isPlatformAdmin ? <SalesPageEditorTab /> : null) :
       tab === "blog" ? (me.isPlatformAdmin ? <BlogAdminTab /> : null) :
       tab === "emails" ? (me.isPlatformAdmin ? <EmailTemplatesPanel /> : null) :
       tab === "integrations" ? <IntegrationsTab disabledFeatures={me.disabledFeatures ?? []} /> :
       tab === "automations" ? <AutomationsTab /> :
       tab === "knowledge" ? <OrgKnowledgeSettings /> :
       tab === "team" || tab === "report" || tab === "auditoria" ? (
        <>
      {(allowedTabs.includes("report") || allowedTabs.includes("auditoria")) && (
        <div className="flex items-center gap-1 mb-6 -mt-2">
          {[
            { id: "team" as const, label: "Equipe" },
            ...(allowedTabs.includes("report") ? [{ id: "report" as const, label: "Relatório" }] : []),
            ...(allowedTabs.includes("auditoria") ? [{ id: "auditoria" as const, label: "Auditoria de Produção" }] : []),
          ].map((s) => (
            <SubTabPill key={s.id} active={tab === s.id} onClick={() => setTab(s.id)} label={s.label} />
          ))}
        </div>
      )}
      {tab === "report" ? <ReportsTab /> : tab === "auditoria" ? <ProductionAuditTab /> : (
        <>
      {pending.length > 0 && (
        <>
          <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-1">
            Cadastros travados <span className="text-[var(--lz-accent-ink)]">({pending.length})</span>
          </h2>
          <p className="text-[11px] text-foreground/40 mb-3">
            Não são pedidos pra entrar na sua equipe — são pessoas de fora que começaram a assinar o Modo Criador (login com Google) e não terminaram o cadastro da agência delas. Só remova; não há como "aprovar" certo aqui.
          </p>
          <div className="bg-card rounded-lg overflow-hidden mb-8">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-4 border-b border-foreground/5 last:border-b-0">
                <Avatar profile={p} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{p.name}</div>
                  <div className="text-[11px] text-foreground/40 truncate">{p.email}</div>
                </div>
                <button
                  onClick={() => handleRemove(p.id, p.name)}
                  className="text-xs px-3 py-1.5 rounded-md border border-foreground/10 text-foreground/70 hover:text-foreground hover:border-foreground/30 transition">
                  Remover
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3">
        Equipe ativa <span className="text-foreground/30">({active.length})</span>
      </h2>
      <div data-tour="team-active-list" className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 lz-stagger">
        {active.map((p) => <TeamMemberCard key={p.id} profile={p} />)}
      </div>

      <p className="text-[11px] text-foreground/30 mt-4">
        Clique num membro pra ver mais opções (resetar senha, ver demandas, ativo/inativo, remover). Novos cadastros ficam pendentes até a aprovação de um Administrador Master. E-mails pré-cadastrados na equipe inicial entram já aprovados com a função correta.
      </p>

      <div className="mt-10 pt-6 border-t border-foreground/6">
        <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-4">
          Metas da equipe
        </h2>
        <MemberGoalsTab />
      </div>

      <div className="mt-8 pt-6 border-t border-foreground/6">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--lz-accent-ink)] mb-4">
          Diferença entre funções
        </div>
        <TeamPermissionsPanel me={me} />
      </div>

      <div className="mt-8 pt-6 border-t border-foreground/6">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--lz-accent-ink)] mb-4">
          Cargos
        </div>
        <CargosPanel />
      </div>
        </>
      )}
        </>
       ) : null}
      </Suspense>

      {adding && (
        <AddMemberModal
          loading={adminCreateUser.isPending}
          onClose={() => setAdding(false)}
          onSubmit={(payload) => {
            adminCreateUser.mutate({ data: payload }, {
              onSuccess: () => { toast.success(`${payload.name} adicionado.`); setAdding(false); },
              onError: (e: any) => toastFriendlyError(e, "Erro ao adicionar membro"),
            });
          }}
        />
      )}

      {creatingAgency && (
        <CreateAgencyModal
          loading={createAgency.isPending}
          onClose={() => setCreatingAgency(false)}
          onSubmit={(payload) => {
            createAgency.mutate({ data: payload }, {
              onSuccess: () => { toast.success(`Agência "${payload.orgName}" criada.`); setCreatingAgency(false); },
              onError: (e: any) => toastFriendlyError(e, "Erro ao criar agência"),
            });
          }}
        />
      )}
    </div>
  );
}

function AddMemberModal({ onClose, onSubmit, loading }: {
  onClose: () => void;
  loading: boolean;
  onSubmit: (d: { name: string; email: string; password: string; role: Role }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("member");
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 lz-overlay-in"
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-card rounded-xl p-7 lz-modal-in max-h-[85vh] overflow-y-auto"
        style={{ border: "1px solid rgba(var(--lz-brand-light-rgb),0.2)" }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-foreground font-semibold">Adicionar membro</h2>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground transition"><X size={18} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, email, password, role }); }} className="space-y-3">
          <Field label="Nome">
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80}
              className="lz-input" placeholder="Nome do colaborador" />
          </Field>
          <Field label="Email (login)">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="lz-input" placeholder="email@luzeria.com.br" />
          </Field>
          <p className="text-[10px] text-foreground/40 -mt-2">
            Use o email dessa pessoa, não compartilhe um login entre vários — assim as métricas
            de produtividade (Top Membros, etc) ficam certas para cada um.
          </p>
          <Field label="Senha provisória">
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="lz-input" placeholder="Mínimo 6 caracteres" />
          </Field>
          <Field label="Função">
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="lz-input">
              <option value="member">Membro</option>
              <option value="setor">Adm Setor</option>
              <option value="master">Adm Master</option>
            </select>
          </Field>
          <p className="text-[10px] text-foreground/40 -mt-2">
            Membro: só vê e mexe no que for atribuído a ele. Adm Setor: pode ganhar permissões
            extras por cargo. Adm Master: acesso total à agência.
          </p>
          <button type="submit" disabled={loading}
            className="lz-btn-primary w-full rounded-md py-2.5 mt-2 text-sm disabled:opacity-50">
            {loading ? "Criando…" : "Criar membro"}
          </button>
          <p className="text-[10px] text-foreground/40 text-center mt-2">
            O membro já entra ativo. Compartilhe email e senha para o primeiro acesso.
          </p>
        </form>
      </div>
    </div>
  );
}

function CreateAgencyModal({ onClose, onSubmit, loading }: {
  onClose: () => void;
  loading: boolean;
  onSubmit: (d: { orgName: string; name: string; email: string; password: string }) => void;
}) {
  const [orgName, setOrgName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 lz-overlay-in"
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-card rounded-xl p-7 lz-modal-in max-h-[85vh] overflow-y-auto"
        style={{ border: "1px solid rgba(var(--lz-brand-light-rgb),0.2)" }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-foreground font-semibold">Criar nova agência</h2>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground transition"><X size={18} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ orgName, name, email, password }); }} className="space-y-3">
          <Field label="Nome da agência">
            <input value={orgName} onChange={(e) => setOrgName(e.target.value)} required maxLength={80}
              className="lz-input" placeholder="Ex: Agência Teste" />
          </Field>
          <Field label="Nome do responsável">
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80}
              className="lz-input" placeholder="Nome de quem vai administrar" />
          </Field>
          <Field label="Email (login)">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="lz-input" placeholder="email@agencia.com.br" />
          </Field>
          <Field label="Senha provisória">
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="lz-input" placeholder="Mínimo 6 caracteres" />
          </Field>
          <button type="submit" disabled={loading}
            className="lz-btn-primary w-full rounded-md py-2.5 mt-2 text-sm disabled:opacity-50">
            {loading ? "Criando…" : "Criar agência"}
          </button>
          <p className="text-[10px] text-foreground/40 text-center mt-2">
            Cria uma organização isolada com esse email como Adm Master dela — sem acesso aos dados da Luzeria.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/50">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const DEFAULT_CONTRACT_TEMPLATE =
`**CONTRATO DE PRESTAÇÃO DE SERVIÇOS**

**CONTRATANTE:** {cliente}, inscrito(a) sob o CNPJ/CPF {cnpj_cpf}, com endereço em {endereco}, neste ato representado(a) por **{responsavel}**, CPF {responsavel_cpf}.

**CONTRATADA:** {agencia}.

### CLÁUSULA PRIMEIRA — DO OBJETO
Prestação de serviços de gestão de redes sociais e produção de conteúdo, sendo **{qtd_posts}** posts e **{qtd_reels}** vídeos/reels por mês, conforme escopo acordado entre as partes.

### CLÁUSULA SEGUNDA — DO VALOR E FORMA DE PAGAMENTO
O valor deste contrato é de **{valor}** mensais, com vigência de **{duracao_meses}** a contar de **{inicio_contrato}**, e vencimento mensal no dia **{vencimento}**.

Este contrato é válido a partir da assinatura eletrônica abaixo, feita pelo(a) responsável indicado(a) acima.`;

function ContractTemplateForm({ template, isMaster }: { template: string | null; isMaster: boolean }) {
  const api = useApi();
  const [value, setValue] = useState(template ?? DEFAULT_CONTRACT_TEMPLATE);
  useEffect(() => setValue(template ?? DEFAULT_CONTRACT_TEMPLATE), [template]);
  if (!isMaster) return null;
  const inp = "w-full bg-card border border-foreground/8 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))] transition-colors";
  return (
    <div className="bg-card rounded-lg p-5">
      <div className="text-sm font-semibold text-foreground mb-1">Modelo de contrato</div>
      <p className="text-[11px] text-foreground/50 mb-2 leading-relaxed">
        Usado quando você gera um contrato pra um cliente assinar. Use{" "}
        <code className="text-foreground/60">{"{cliente}"}</code>,{" "}
        <code className="text-foreground/60">{"{cnpj_cpf}"}</code>,{" "}
        <code className="text-foreground/60">{"{endereco}"}</code>,{" "}
        <code className="text-foreground/60">{"{responsavel}"}</code>,{" "}
        <code className="text-foreground/60">{"{responsavel_cpf}"}</code>,{" "}
        <code className="text-foreground/60">{"{agencia}"}</code>,{" "}
        <code className="text-foreground/60">{"{valor}"}</code>,{" "}
        <code className="text-foreground/60">{"{vencimento}"}</code>,{" "}
        <code className="text-foreground/60">{"{qtd_posts}"}</code>,{" "}
        <code className="text-foreground/60">{"{qtd_reels}"}</code>,{" "}
        <code className="text-foreground/60">{"{inicio_contrato}"}</code> e{" "}
        <code className="text-foreground/60">{"{duracao_meses}"}</code> onde quiser. Os 4 últimos você
        preenche na hora de gerar (mudam a cada contrato); o resto vem do cadastro do cliente. Os dados
        fixos da sua agência (CNPJ, endereço, quem assina por vocês) você pode digitar direto no texto —
        não muda de cliente pra cliente. Também dá pra usar{" "}
        <code className="text-foreground/60">**negrito**</code> e{" "}
        <code className="text-foreground/60">### Título da cláusula</code> pra formatar.
      </p>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} rows={12} className={inp + " resize-none font-mono text-xs"} />
      <div className="flex items-center justify-end gap-2 mt-2">
        <button onClick={() => setValue(DEFAULT_CONTRACT_TEMPLATE)} className="text-xs text-foreground/40 hover:text-foreground transition">
          Restaurar padrão
        </button>
        <button
          onClick={() => api.setContractTemplate.mutate({ data: { template: value } }, { onSuccess: () => toast.success("Modelo salvo.") })}
          disabled={api.setContractTemplate.isPending || !value.trim()}
          className="shrink-0 rounded-md px-4 py-2 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          {api.setContractTemplate.isPending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}

/** Cabeçalho clicável que recolhe/expande uma seção inteira de Configurações
 * > Geral. Existe porque a aba crescia demais (7 seções empilhadas) e quem só
 * queria mexer em uma coisa (normalmente Recursos) tinha que rolar por tudo
 * — as seções de "configura uma vez e esquece" (Contrato, Status, Categorias)
 * começam fechadas, mostrando um resumo no próprio cabeçalho. */
function CollapsibleSection({ icon: Icon, title, badge, defaultOpen, accent, children }: {
  icon: React.ComponentType<{ size?: number }>;
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  accent?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="bg-card rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0"
          style={accent
            ? { backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }
            : { backgroundColor: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 50%, transparent)" }}>
          <Icon size={13} />
        </div>
        <span className="flex-1 text-sm font-semibold text-foreground truncate">{title}</span>
        {badge && <span className="text-[10.5px] font-semibold text-foreground/40 shrink-0 hidden sm:block">{badge}</span>}
        <ChevronDown size={14} className={`text-foreground/40 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-foreground/6">
          {children}
        </div>
      )}
    </div>
  );
}

function GeneralSettings() {
  const { data: settings } = useQuery(appSettingsQO());
  const { updateAppSettings, updateMyOrg } = useApi();
  const me = useMe().data;
  const { data: statusRows = [] } = useQuery(contentStatusesQO());
  const { data: categoryRows = [] } = useQuery(clientCategoriesQO());
  if (!settings) return <div className="text-foreground/40 text-sm">Carregando…</div>;
  const isMaster = me?.role === "master";
  // Só o que a própria org desligou — os módulos que a House esconde não
  // são toggle (não aparecem aqui nem são gravados de volta).
  const disabledFeatures = (me?.orgDisabledFeatures ?? me?.disabledFeatures ?? [])
    .filter((k) => (OPTIONAL_FEATURE_KEYS as readonly string[]).includes(k) && !(isHouse(me) && (HOUSE_HIDDEN_FEATURES as readonly string[]).includes(k)));
  const statusCount = CUSTOMIZABLE_BUILTIN_STATUS_KEYS.length + PROTECTED_STATUS_KEYS.length + statusRows.filter((r) => r.isCustom).length;
  const categoryCount = 2 + categoryRows.length;

  const toggle = (next: boolean) =>
    updateAppSettings.mutate({ data: { requireRatingOnFinalize: next } }, {
      onSuccess: () => toast.success("Configuração salva."),
      onError: (e: any) => toastFriendlyError(e, "Erro ao salvar"),
    });

  const toggleFinalizadosSeparateTab = (next: boolean) =>
    updateMyOrg.mutate({ data: { finalizadosSeparateTab: next } }, {
      onSuccess: () => toast.success("Configuração salva."),
      onError: (e: any) => toastFriendlyError(e, "Erro ao salvar"),
    });

  return (
    <div className="max-w-2xl space-y-3">
      {me?.orgId && (
        <CollapsibleSection icon={Star} title={`Marca ${term(me, "daAgencia")}`} defaultOpen accent
          badge={
            <span className="flex items-center gap-2">
              <span className="flex gap-0.5">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: me.orgColorPrimary ?? "#C8D44E" }} />
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: me.orgColorSidebar ?? "#1A3A2E" }} />
              </span>
              Personalizada
            </span>
          }
        >
          <OrgBrandingSection
            orgId={me.orgId}
            orgName={me.orgName ?? ""}
            orgTagline={me.orgTagline ?? null}
            orgLogoUrl={me.orgLogoUrl ?? null}
            orgLogoUrlLight={me.orgLogoUrlLight ?? null}
            orgLogoSizeAdjustPx={me.orgLogoSizeAdjustPx ?? 0}
            orgLogoPositionAdjustPx={me.orgLogoPositionAdjustPx ?? 0}
            orgColorPrimary={me.orgColorPrimary ?? "#C8D44E"}
            orgColorPrimaryLight={me.orgColorPrimaryLight ?? "#C8D44E"}
            orgColorSidebar={me.orgColorSidebar ?? "#1A3A2E"}
            orgColorAccentLight={me.orgColorAccentLight ?? null}
            orgFeedPreviewImageUrl={me.orgFeedPreviewImageUrl ?? null}
            orgPlanejamentoCoverImageUrl={me.orgPlanejamentoCoverImageUrl ?? null}
            orgFaviconUrl={me.orgFaviconUrl ?? null}
            borderRadius={me.borderRadius ?? 12}
            heroGradientFrom={me.heroGradientFrom ?? null}
            heroGradientTo={me.heroGradientTo ?? null}
            brandAdvancedColors={me.brandAdvancedColors ?? {}}
          />
        </CollapsibleSection>
      )}

      <CollapsibleSection icon={SettingsIcon} title="Operação"
        badge={settings.requireRatingOnFinalize ? "Avaliação obrigatória: ligada" : "Avaliação obrigatória: desligada"}>
        <div className="space-y-3">
          <div className="flex items-start gap-4">
            <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
              <Star size={16} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">Exigir avaliação ao finalizar</div>
              <div className="text-[11px] text-foreground/50 mt-1">
                Ao mudar status de uma tarefa para <span className="text-[var(--lz-accent-ink)] font-semibold">Pronto para publicar</span>,
                o responsável é obrigado a dar uma nota de qualidade (1–5 estrelas).
              </div>
            </div>
            <button onClick={() => toggle(!settings.requireRatingOnFinalize)}
              className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
                settings.requireRatingOnFinalize ? "bg-[rgb(var(--lz-brand-rgb))]" : "bg-foreground/15"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-all ${
                settings.requireRatingOnFinalize ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>

          {isMaster && (
            <div className="flex items-start gap-4 pt-3 border-t border-foreground/6">
              <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
                <Archive size={16} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">"Finalizados" em aba separada</div>
                <div className="text-[11px] text-foreground/50 mt-1">
                  Por padrão, um post/reel publicado continua na aba de origem (Posts/Reels), só com uma fita
                  "Publicado" na miniatura. Ligue aqui se preferir o jeito antigo: publicado sai da aba principal e
                  vai pra uma aba "Finalizados" separada.
                </div>
              </div>
              <button onClick={() => toggleFinalizadosSeparateTab(!me?.finalizadosSeparateTab)}
                className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
                  me?.finalizadosSeparateTab ? "bg-[rgb(var(--lz-brand-rgb))]" : "bg-foreground/15"}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-all ${
                  me?.finalizadosSeparateTab ? "left-[22px]" : "left-0.5"}`} />
              </button>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {isMaster && (
        <>
          {!isHouse(me) && (
            <CollapsibleSection icon={FileText} title="Contrato"
              badge={me?.contractTemplate?.trim() ? "Modelo configurado" : "Nenhum modelo definido"}>
              <ContractTemplateForm template={me?.contractTemplate ?? null} isMaster={isMaster} />
            </CollapsibleSection>
          )}

          <CollapsibleSection icon={CheckCircle2} title="Status" badge={`${statusCount} configurados`}>
            <ContentStatusesSection />
          </CollapsibleSection>

          {!isHouse(me) && (
            <CollapsibleSection icon={Tags} title="Categorias de clientes" badge={`${categoryCount} categorias`}>
              <ClientCategoriesSection />
            </CollapsibleSection>
          )}
        </>
      )}

      <CollapsibleSection icon={LayoutGrid} title="Recursos" defaultOpen accent
        badge={disabledFeatures.length > 0 ? `${disabledFeatures.length} desativado${disabledFeatures.length > 1 ? "s" : ""}` : "Tudo ativado"}>
        <FeatureTogglesSection disabledFeatures={disabledFeatures} hiddenKeys={isHouse(me) ? HOUSE_HIDDEN_FEATURES : []} />
      </CollapsibleSection>

      <CollapsibleSection icon={HelpCircle} title="Ajuda" badge="Tour guiado">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">Tour guiado do app</div>
            <div className="text-[11px] text-foreground/50 mt-1">
              Refaça o passo a passo de boas-vindas mostrando as principais áreas da plataforma.
            </div>
          </div>
          <button
            onClick={() => window.dispatchEvent(new Event("lz:start-tour"))}
            className="text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-md text-black shrink-0"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
          >
            Refazer tour
          </button>
        </div>
      </CollapsibleSection>
    </div>
  );
}

function FeatureTogglesSection({ disabledFeatures, hiddenKeys }: { disabledFeatures: string[]; hiddenKeys: readonly string[] }) {
  const { updateMyOrg } = useApi();
  const disabledSet = new Set(disabledFeatures);

  function toggle(key: string, hide: boolean) {
    const next = hide
      ? [...disabledSet, key]
      : [...disabledSet].filter((k) => k !== key);
    updateMyOrg.mutate({ data: { disabledFeatures: next } }, {
      onError: (e: any) => toastFriendlyError(e, "Erro ao salvar"),
    });
  }

  return (
    <div className="bg-card rounded-lg divide-y divide-white/[0.06]">
      {OPTIONAL_FEATURE_KEYS.filter((key) => !hiddenKeys.includes(key)).map((key) => {
        const meta = OPTIONAL_FEATURE_LABEL[key];
        const visible = !disabledSet.has(key);
        return (
          <div key={key} className="p-5 flex items-start gap-4">
            <div className="flex-1">
              <div className="text-sm font-semibold text-foreground">{meta.label}</div>
              <div className="text-[11px] text-foreground/50 mt-1">{meta.description}</div>
            </div>
            <button onClick={() => toggle(key, visible)}
              className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
                visible ? "bg-[rgb(var(--lz-brand-rgb))]" : "bg-foreground/15"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-all ${
                visible ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

type FixedCapabilityRow = { label: string; member: boolean; setor: boolean; master: boolean };

const FIXED_CAPABILITIES: FixedCapabilityRow[] = [
  { label: "Executar as próprias demandas, comentar, anexar arquivos", member: true, setor: true, master: true },
  { label: "Criar e editar clientes, posts, reels e avulsos", member: false, setor: true, master: true },
  { label: "Excluir clientes", member: false, setor: true, master: true },
  { label: "Gerenciar equipe (aprovar, criar, remover, redefinir senha)", member: false, setor: false, master: true },
  { label: "Configurações avançadas (Financeiro, Geral, Automações)", member: false, setor: false, master: true },
];

function CapabilityDot({ on }: { on: boolean }) {
  return (
    <div className="w-14 flex justify-center shrink-0">
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-[rgb(var(--lz-brand-rgb))]" : "bg-foreground/15"}`} />
    </div>
  );
}

/** Master-only view of Configurações > Equipe: a comparison table of what
 * each role does today, plus toggles for the handful of setor capabilities
 * this org's Master can grant/revoke. Master itself is always fixed/full
 * access — only setor is configurable, and only for the ~4 capabilities
 * that are already safe to gate server-side (see SETOR_PERMISSION_KEYS). */
function TeamPermissionsPanel({ me }: { me: Profile }) {
  const { updateSetorPermissions, updateMyOrg } = useApi();
  const granted = new Set(me.setorPermissions ?? []);
  const membersEditorFormat = me.membersCanSetEditorFormat ?? false;

  function toggle(key: SetorPermissionKey, on: boolean) {
    const next = on ? [...granted, key] : [...granted].filter((k) => k !== key);
    updateSetorPermissions.mutate({ data: { permissions: next } }, {
      onSuccess: () => toast.success("Permissões atualizadas."),
      onError: (e: any) => toastFriendlyError(e, "Erro ao salvar"),
    });
  }

  function toggleMembersEditorFormat(on: boolean) {
    updateMyOrg.mutate({ data: { membersCanSetEditorFormat: on } }, {
      onError: (e: any) => toastFriendlyError(e, "Erro ao salvar"),
    });
  }

  return (
    <div>
      <div className="bg-card rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-foreground/6 text-[10px] font-bold uppercase tracking-wider text-foreground/40">
          <div className="flex-1">Capacidade</div>
          <div className="w-14 text-center shrink-0">Membro</div>
          <div className="w-14 text-center shrink-0">Setor</div>
          <div className="w-14 text-center shrink-0">Master</div>
        </div>
        {FIXED_CAPABILITIES.map((row) => (
          <div key={row.label} className="flex items-center gap-3 px-5 py-3 border-b border-foreground/6 last:border-b-0">
            <div className="flex-1 text-[12.5px] text-foreground/70">{row.label}</div>
            <CapabilityDot on={row.member} />
            <CapabilityDot on={row.setor} />
            <CapabilityDot on={row.master} />
          </div>
        ))}
        {SETOR_PERMISSION_KEYS.map((key) => {
          const meta = SETOR_PERMISSION_LABEL[key];
          const on = granted.has(key);
          return (
            <div key={key} className="flex items-center gap-3 px-5 py-3 border-b border-foreground/6 last:border-b-0">
              <div className="flex-1">
                <div className="text-[12.5px] text-foreground/70">{meta.label}</div>
                <div className="text-[10.5px] text-foreground/35 mt-0.5">{meta.description}</div>
              </div>
              <CapabilityDot on={false} />
              <div className="w-14 flex justify-center shrink-0">
                <button onClick={() => toggle(key, !on)}
                  className={`relative h-5 w-9 rounded-full transition-colors shrink-0 ${on ? "bg-[rgb(var(--lz-brand-rgb))]" : "bg-foreground/15"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
                </button>
              </div>
              <CapabilityDot on={true} />
            </div>
          );
        })}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-foreground/6 last:border-b-0">
          <div className="flex-1">
            <div className="text-[12.5px] text-foreground/70">Escolher editor e formato (posts/reels)</div>
            <div className="text-[10.5px] text-foreground/35 mt-0.5">Se atribuir como editor e definir o tipo de vídeo (reel) ou formato (post), sem precisar de um admin.</div>
          </div>
          <div className="w-14 flex justify-center shrink-0">
            <button onClick={() => toggleMembersEditorFormat(!membersEditorFormat)}
              className={`relative h-5 w-9 rounded-full transition-colors shrink-0 ${membersEditorFormat ? "bg-[rgb(var(--lz-brand-rgb))]" : "bg-foreground/15"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-foreground transition-all ${membersEditorFormat ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </div>
          <CapabilityDot on={true} />
          <CapabilityDot on={true} />
        </div>
      </div>
      <p className="text-[11px] text-foreground/30 mt-3">
        O Adm Master sempre tem acesso total e não pode ser restringido. As permissões configuráveis acima valem pra
        todo mundo com a função Adm Setor nesta agência.
      </p>
    </div>
  );
}

/** Cargos são atômicos e combináveis (uma pessoa pode ter vários ao mesmo
 * tempo, ex: Editor + Videomaker) — cada cargo aqui é um cartão com nome
 * editável e uma grade de permissões próprias, além do que a função
 * (Membro/Setor/Master) já libera. */
function CargosPanel() {
  const { upsertCargo, deleteCargo } = useApi();
  const { data: cargos = [], isLoading } = useQuery(cargosQO());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  function createCargo() {
    if (!newName.trim()) return;
    upsertCargo.mutate({ data: { name: newName.trim(), permissions: [] } }, {
      onSuccess: () => { setNewName(""); setCreating(false); },
    });
  }

  async function handleDelete(id: string, name: string) {
    if (!(await requestConfirm(`Apagar o cargo "${name}"? Quem tiver esse cargo perde as permissões dele.`, { danger: true }))) return;
    deleteCargo.mutate({ data: { id } });
  }

  function togglePermission(cargo: { id: string; name: string; permissions: string[] }, key: string) {
    const next = cargo.permissions.includes(key)
      ? cargo.permissions.filter((k) => k !== key)
      : [...cargo.permissions, key];
    upsertCargo.mutate({ data: { id: cargo.id, name: cargo.name, permissions: next as any } });
  }

  if (isLoading) return <Loader2 className="animate-spin text-foreground/40" size={20} />;

  return (
    <div className="space-y-3">
      {cargos.map((c) => (
        <div key={c.id} className="bg-card rounded-lg p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-sm font-semibold text-foreground">{c.name}</span>
            <button onClick={() => handleDelete(c.id, c.name)} className="text-foreground/30 hover:text-red-400 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PERMISSION_KEYS.map((key) => {
              const on = c.permissions.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => togglePermission(c, key)}
                  title={PERMISSION_LABEL[key].description}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors border"
                  style={on
                    ? { backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)", borderColor: "rgb(var(--lz-brand-rgb))" }
                    : { color: "color-mix(in srgb, var(--foreground) 50%, transparent)", borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)" }}
                >
                  {PERMISSION_LABEL[key].label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {creating ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") createCargo(); if (e.key === "Escape") setCreating(false); }}
            placeholder="Nome do cargo" maxLength={60}
            className="flex-1 bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
          />
          <button onClick={createCargo} disabled={upsertCargo.isPending || !newName.trim()}
            className="px-3 py-2 rounded-md text-sm font-semibold bg-[rgb(var(--lz-brand-rgb))] text-black disabled:opacity-40 shrink-0">
            Criar
          </button>
          <button onClick={() => setCreating(false)} className="text-foreground/40 hover:text-foreground p-2"><X size={16} /></button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-md border border-foreground/15 text-foreground/60 hover:text-foreground transition-colors"
        >
          <Plus size={12} /> Novo cargo
        </button>
      )}
      <p className="text-[11px] text-foreground/30 mt-1">
        Cada pessoa pode ter mais de um cargo ao mesmo tempo (atribua em Equipe, no perfil de cada um).
      </p>
    </div>
  );
}

const MAX_LOGO_BYTES = 3 * 1024 * 1024;

const BRAND_PRESETS = [
  "#C8D44E", "#4A9EFF", "#FF8C42", "#FF6B6B", "#A855F7", "#10B981", "#EC4899", "#F5A623",
];
const BRAND_LIGHT_PRESETS = [
  "#C8D44E", "#8FD1FF", "#FFC08A", "#FFAFAF", "#D4AFFF", "#7EEAC4", "#FFAFDA", "#FFD98A",
];
const SIDEBAR_PRESETS = [
  "#1A3A2E", "#1A2E3A", "#2E1A3A", "#3A2E1A", "#1A1A1A", "#3A1A1A", "#0D2B4A", "#2A1E1E",
];

function isValidHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v.trim());
}

/** Reproduz o escurecimento automático que os gráficos aplicam sozinhos no
 * modo claro (color-mix 55% com preto) — usado só pra mostrar, no campo de
 * "Cor de destaque", qual seria o valor "Automático" caso a agência nunca
 * tenha escolhido um. */
function darkenHex(hex: string, ratio: number): string {
  if (!isValidHex(hex)) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c * ratio).toString(16).padStart(2, "0");
  return `#${mix(r)}${mix(g)}${mix(b)}`;
}

/** Fundo e texto do botão primário (modo avançado) formam um par — nunca
 * faz sentido salvar só um lado customizado (a cor automática do outro lado
 * pode ficar ilegível contra o valor escolhido). Se só um foi mexido,
 * completa o outro com o padrão automático desse tema antes de salvar. */
function normalizeButtonPairs(colors: BrandAdvancedColors, brandColor: string): BrandAdvancedColors {
  const pair = colors.buttonBg || colors.buttonText;
  if (!pair) return colors;
  const fill = (theme: "light" | "dark") => {
    const bg = colors.buttonBg?.[theme];
    const text = colors.buttonText?.[theme];
    if (!bg && !text) return { bg, text };
    return { bg: bg ?? brandColor, text: text ?? "#0D0D0D" };
  };
  const light = fill("light");
  const dark = fill("dark");
  return {
    ...colors,
    buttonBg: { light: light.bg, dark: dark.bg },
    buttonText: { light: light.text, dark: dark.text },
  };
}

function ColorPickerField({ label, value, onChange, presets }: {
  label: string; value: string; onChange: (hex: string) => void; presets: string[];
}) {
  const [hexInput, setHexInput] = useState(value);
  useEffect(() => { setHexInput(value); }, [value]);

  return (
    <Field label={label}>
      <div className="flex items-center gap-2 mb-2">
        {presets.map((p) => (
          <button key={p} type="button" onClick={() => onChange(p)}
            className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
            style={{ backgroundColor: p, borderColor: value.toLowerCase() === p.toLowerCase() ? "#ffffff" : "transparent" }}
            title={p} />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input type="color" value={isValidHex(hexInput) ? hexInput : value}
          onChange={(e) => { setHexInput(e.target.value); onChange(e.target.value); }}
          className="lz-color-swatch h-8 w-8 rounded-md border border-foreground/10 shrink-0"
          title="Escolher na roda de cores" />
        <input value={hexInput} onChange={(e) => setHexInput(e.target.value)}
          onBlur={() => { if (isValidHex(hexInput)) onChange(hexInput.trim()); else setHexInput(value); }}
          maxLength={7} className="lz-input font-mono" placeholder="#C8D44E" />
      </div>
    </Field>
  );
}

function HeroColorField({ label, value, fallback, onChange }: {
  label: string; value: string | null; fallback: string; onChange: (hex: string | null) => void;
}) {
  const effective = value ?? fallback;
  const [hexInput, setHexInput] = useState(effective);
  useEffect(() => { setHexInput(effective); }, [effective]);

  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={isValidHex(hexInput) ? hexInput : effective}
          onChange={(e) => { setHexInput(e.target.value); onChange(e.target.value); }}
          className="lz-color-swatch h-8 w-8 rounded-md border border-foreground/10 shrink-0"
          title="Escolher na roda de cores" />
        <input value={hexInput} onChange={(e) => setHexInput(e.target.value)}
          onBlur={() => { if (isValidHex(hexInput)) onChange(hexInput.trim()); else setHexInput(effective); }}
          maxLength={7} className="lz-input font-mono" placeholder={fallback} />
        {value != null && (
          <button type="button" onClick={() => onChange(null)}
            className="text-[10px] text-foreground/40 hover:text-foreground transition shrink-0 whitespace-nowrap">
            Automático
          </button>
        )}
      </div>
    </Field>
  );
}

/** Superfícies fixas de cada tema (não editáveis) usadas como fundo de
 * referência nos previews e no cálculo de contraste do modo avançado. */
const THEME_SURFACE = {
  light: { background: "#F7F7F5", card: "#FFFFFF" },
  dark: { background: "#0D0D0D", card: "#1C1C1C" },
} as const;

function ContrastNote({ ratio }: { ratio: number }) {
  const { text, level } = contrastLabel(ratio);
  const color = level === "bom" ? "#4ADE80" : level === "aceitavel" ? "#FBBF24" : "#FF6B6B";
  return <span className="text-[10px] font-semibold" style={{ color }}>{text}</span>;
}

/** Um seletor de cor do modo avançado: mesma UX do HeroColorField (nulo =
 * automático, "Automático" reseta), com um preview real da amostra de texto
 * (ou o próprio swatch) sobre a superfície do tema e, quando `contrastWith`
 * é passado, a taxa de contraste WCAG contra ela — só um aviso, nunca
 * bloqueia a escolha. */
function AdvColorField({ label, value, fallback, onChange, contrastWith, sampleBg, sampleText }: {
  label: string; value: string | null | undefined; fallback: string; onChange: (hex: string | null) => void;
  contrastWith?: string; sampleBg: string; sampleText?: string;
}) {
  const effective = value ?? fallback;
  const [hexInput, setHexInput] = useState(effective);
  useEffect(() => { setHexInput(effective); }, [effective]);
  const ratio = contrastWith ? contrastRatio(effective, contrastWith) : null;

  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={isValidHex(hexInput) ? hexInput : effective}
          onChange={(e) => { setHexInput(e.target.value); onChange(e.target.value); }}
          className="lz-color-swatch h-8 w-8 rounded-md border border-foreground/10 shrink-0"
          title="Escolher na roda de cores" />
        <input value={hexInput} onChange={(e) => setHexInput(e.target.value)}
          onBlur={() => { if (isValidHex(hexInput)) onChange(hexInput.trim()); else setHexInput(effective); }}
          maxLength={7} className="lz-input font-mono" placeholder={fallback} />
        {value != null && (
          <button type="button" onClick={() => onChange(null)}
            className="text-[10px] text-foreground/40 hover:text-foreground transition shrink-0 whitespace-nowrap">
            Automático
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5" style={{ backgroundColor: sampleBg }}>
        <span className="text-[11px] font-semibold truncate" style={{ color: sampleText ?? effective }}>
          Aa Exemplo de texto
        </span>
        {ratio != null && <ContrastNote ratio={ratio} />}
      </div>
    </Field>
  );
}

type AdvPair = { light?: string | null; dark?: string | null } | undefined;

/** Categoria de texto do modo avançado (título/corpo/secundário): um par
 * claro/escuro, cada um com preview real sobre o card do próprio tema e
 * aviso de contraste contra esse mesmo card. */
function AdvancedTextGroup({ title, description, value, onChange, fallbackLight, fallbackDark }: {
  title: string; description: string; value: AdvPair; onChange: (next: AdvPair) => void;
  fallbackLight: string; fallbackDark: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-foreground/70 mb-0.5">{title}</div>
      <p className="text-[10.5px] text-foreground/35 mb-2">{description}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AdvColorField label="Tema claro" value={value?.light} fallback={fallbackLight}
          onChange={(hex) => onChange({ ...value, light: hex })}
          sampleBg={THEME_SURFACE.light.card} contrastWith={THEME_SURFACE.light.card} />
        <AdvColorField label="Tema escuro" value={value?.dark} fallback={fallbackDark}
          onChange={(hex) => onChange({ ...value, dark: hex })}
          sampleBg={THEME_SURFACE.dark.card} contrastWith={THEME_SURFACE.dark.card} />
      </div>
    </div>
  );
}

/** Fundo + texto do botão primário: sempre um par (nunca escolher um lado
 * sem o outro — daí os dois campos ficarem lado a lado com UM preview de
 * botão real e UMA taxa de contraste entre eles, por tema). */
function AdvancedButtonGroup({ value, onChange, brandColor }: {
  value: BrandAdvancedColors; onChange: (next: BrandAdvancedColors) => void; brandColor: string;
}) {
  function renderTheme(theme: "light" | "dark") {
    const bg = value.buttonBg?.[theme] ?? brandColor;
    const text = value.buttonText?.[theme] ?? "#0D0D0D";
    const ratio = contrastRatio(bg, text);
    return (
      <div className="rounded-lg p-3" style={{ backgroundColor: THEME_SURFACE[theme].background }}>
        <div className="text-[10px] uppercase tracking-wide text-foreground/40 mb-2">Tema {theme === "light" ? "claro" : "escuro"}</div>
        <div className="grid grid-cols-2 gap-3">
          <AdvColorField label="Fundo" value={value.buttonBg?.[theme]} fallback={brandColor}
            onChange={(hex) => onChange({ ...value, buttonBg: { ...value.buttonBg, [theme]: hex } })}
            sampleBg={THEME_SURFACE[theme].card} />
          <AdvColorField label="Texto" value={value.buttonText?.[theme]} fallback="#0D0D0D"
            onChange={(hex) => onChange({ ...value, buttonText: { ...value.buttonText, [theme]: hex } })}
            sampleBg={THEME_SURFACE[theme].card} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="inline-block text-[10.5px] font-extrabold px-3 py-1.5 rounded-md" style={{ backgroundColor: bg, color: text }}>
            Botão principal
          </span>
          <ContrastNote ratio={ratio} />
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-[11px] font-semibold text-foreground/70 mb-0.5">Botões</div>
      <p className="text-[10.5px] text-foreground/35 mb-2">Fundo e texto do botão principal — sempre juntos, pra nunca ficar ilegível.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {renderTheme("light")}
        {renderTheme("dark")}
      </div>
    </div>
  );
}

/** Destaque (accent ink): badges, ícones ativos, selo de nível. */
function AdvancedAccentGroup({ value, onChange, brandColor }: {
  value: AdvPair; onChange: (next: AdvPair) => void; brandColor: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-foreground/70 mb-0.5">Destaque</div>
      <p className="text-[10.5px] text-foreground/35 mb-2">Badges, ícones ativos e selo de nível.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AdvColorField label="Tema claro" value={value?.light} fallback={darkenHex(brandColor, 0.55)}
          onChange={(hex) => onChange({ ...value, light: hex })}
          sampleBg={THEME_SURFACE.light.card} contrastWith={THEME_SURFACE.light.card} />
        <AdvColorField label="Tema escuro" value={value?.dark} fallback={brandColor}
          onChange={(hex) => onChange({ ...value, dark: hex })}
          sampleBg={THEME_SURFACE.dark.card} contrastWith={THEME_SURFACE.dark.card} />
      </div>
    </div>
  );
}

/** Degradê do cabeçalho do Dashboard — decorativo (não é par cor+texto),
 * por isso sem aviso de contraste, só o preview do degradê em si. */
function AdvancedHeroGroup({ heroA, heroB, onChangeA, onChangeB, fallbackA, fallbackB }: {
  heroA: AdvPair; heroB: AdvPair; onChangeA: (next: AdvPair) => void; onChangeB: (next: AdvPair) => void;
  fallbackA: string; fallbackB: string;
}) {
  function renderTheme(theme: "light" | "dark") {
    const a = heroA?.[theme] ?? fallbackA;
    const b = heroB?.[theme] ?? fallbackB;
    const aRgb = hexToRgbChannels(a) ?? "200, 212, 78";
    const bRgb = hexToRgbChannels(b) ?? "17, 31, 92";
    return (
      <div className="rounded-lg p-3" style={{ backgroundColor: THEME_SURFACE[theme].background }}>
        <div className="text-[10px] uppercase tracking-wide text-foreground/40 mb-2">Tema {theme === "light" ? "claro" : "escuro"}</div>
        <div className="grid grid-cols-2 gap-3">
          <AdvColorField label="Cor 1" value={heroA?.[theme]} fallback={fallbackA}
            onChange={(hex) => onChangeA({ ...heroA, [theme]: hex })} sampleBg={THEME_SURFACE[theme].card} />
          <AdvColorField label="Cor 2" value={heroB?.[theme]} fallback={fallbackB}
            onChange={(hex) => onChangeB({ ...heroB, [theme]: hex })} sampleBg={THEME_SURFACE[theme].card} />
        </div>
        <div className="mt-2 h-10 rounded-md overflow-hidden" style={{
          background: `radial-gradient(120% 140% at 0% 0%, rgba(${aRgb},0.35) 0%, transparent 70%), `
            + `radial-gradient(80% 120% at 100% 100%, rgba(${bRgb},0.45) 0%, transparent 65%), ${THEME_SURFACE[theme].card}`,
        }} />
      </div>
    );
  }
  return (
    <div>
      <div className="text-[11px] font-semibold text-foreground/70 mb-0.5">Cabeçalho</div>
      <p className="text-[10.5px] text-foreground/35 mb-2">Degradê do cabeçalho do Dashboard, por tema.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {renderTheme("light")}
        {renderTheme("dark")}
      </div>
    </div>
  );
}

const SUBSCRIPTION_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active: { label: "Assinatura ativa", color: "#4ADE80" },
  past_due: { label: "Pagamento atrasado", color: "#FF6B6B" },
  canceled: { label: "Cancelada", color: "#FF6B6B" },
};

const INVOICE_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendente", color: "#FFD97E" },
  RECEIVED: { label: "Pago", color: "#4ADE80" },
  CONFIRMED: { label: "Pago", color: "#4ADE80" },
  RECEIVED_IN_CASH: { label: "Pago", color: "#4ADE80" },
  OVERDUE: { label: "Atrasado", color: "#FF6B6B" },
  REFUNDED: { label: "Reembolsado", color: "#7EB3FF" },
  REFUND_REQUESTED: { label: "Reembolso solicitado", color: "#7EB3FF" },
};

/** "Seu plano" — plano atual + uso (clientes/colaboradores). */
function PlanCardSection() {
  const { data: status, isLoading } = useQuery(orgPlanStatusQO());
  if (isLoading || !status) return null;

  const clientsPct = status.maxClients ? Math.min(100, Math.round((status.clientsUsed / status.maxClients) * 100)) : 0;
  const collabPct = status.maxCollaborators ? Math.min(100, Math.round((status.collaboratorsUsed / status.maxCollaborators) * 100)) : 0;
  const me = useMe().data;
  const monthly = status.monthlyCents ?? status.priceCents;
  const priceLabel = monthly != null
    ? `R$ ${(monthly / 100).toFixed(2).replace(".", ",")}/mês`
    : "Sob consulta";
  const trialDaysLeft = status.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(status.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : null;
  const statusInfo = SUBSCRIPTION_STATUS_LABEL[status.subscriptionStatus];

  return (
    <div className="max-w-2xl">
      <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
        <Star size={12} /> Seu plano
      </h2>
      <div className="rounded-xl p-5 mb-8 space-y-5" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--card) 100%, transparent), rgba(var(--lz-brand-rgb),0.06))", border: "1px solid rgba(var(--lz-brand-rgb),0.16)" }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, rgb(var(--lz-brand-rgb)), color-mix(in srgb, rgb(var(--lz-brand-rgb)) 70%, black))" }}>
              <Rocket size={20} color="#0D0D0D" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold text-foreground truncate">{status.planName}</div>
              <div className="text-[11px] text-foreground/50">{priceLabel}</div>
              {status.isHousePlan && status.extraBrands > 0 && (
                <div className="text-[11px] text-foreground/40">
                  Inclui {status.extraBrands} marca{status.extraBrands > 1 ? "s" : ""} adiciona{status.extraBrands > 1 ? "is" : "l"} × {formatBRL(status.extraBrandCents)}
                </div>
              )}
            </div>
          </div>
          {status.subscriptionStatus === "trialing" && trialDaysLeft !== null ? (
            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded whitespace-nowrap shrink-0"
              style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
              {trialDaysLeft > 0 ? `${trialDaysLeft} dias de teste` : "Teste expirado"}
            </span>
          ) : statusInfo ? (
            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded whitespace-nowrap shrink-0"
              style={{ backgroundColor: `${statusInfo.color}26`, color: statusInfo.color }}>
              {statusInfo.label}
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <UsageTile icon={<Users size={15} />} label={`${term(me, "Clientes")} ativ${isHouse(me) ? "as" : "os"}`} used={status.clientsUsed} max={status.maxClients} pct={clientsPct} />
          <UsageTile icon={<UserCog size={15} />} label="Colaboradores" used={status.collaboratorsUsed} max={status.maxCollaborators} pct={collabPct} />
        </div>
      </div>
    </div>
  );
}

/** Cartão de uso (clientes/colaboradores) — número grande + barrinha, com
 * ícone pra dar mais identidade visual do que só texto (pedido do Junior:
 * "Meu plano" parecia sem graça). */
function UsageTile({ icon, label, used, max, pct }: { icon: React.ReactNode; label: string; used: number; max: number | null; pct: number }) {
  const nearLimit = max != null && pct >= 90;
  return (
    <div className="rounded-lg p-3.5" style={{ background: "color-mix(in srgb, var(--foreground) 4%, transparent)" }}>
      <div className="flex items-center gap-1.5 text-[11px] text-foreground/50 mb-2">
        <span style={{ color: "var(--lz-accent-ink)" }}>{icon}</span> {label}
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-xl font-extrabold text-foreground tabular-nums">{used}</span>
        <span className="text-xs text-foreground/40">{max != null ? `/ ${max}` : "ilimitado"}</span>
      </div>
      {max != null && (
        <div className="h-1.5 rounded-full bg-foreground/[0.08] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: nearLimit ? "#FF6B6B" : "rgb(var(--lz-brand-rgb))" }} />
        </div>
      )}
    </div>
  );
}

function formatBRL(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

/** "Cobrança" — CNPJ/CPF e upgrade de plano. */
function BillingSection() {
  const { data: status, isLoading } = useQuery(orgPlanStatusQO());
  const { data: plans } = useQuery(plansQO());
  const me = useMe().data;
  const { data: pendingInvoice } = useQuery({ ...myPendingInvoiceQO(), enabled: me?.role === "master" });
  const { data: invoiceHistory } = useQuery({ ...myInvoiceHistoryQO(), enabled: me?.role === "master" && !!status?.hasAsaasSubscription });
  const [showHistory, setShowHistory] = useState(false);
  const { updateMyOrg, subscribeToPlan, cancelMySubscription, resendPendingInvoiceEmail } = useApi();
  const [taxId, setTaxId] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => { if (status?.taxId) setTaxId(status.taxId); }, [status?.taxId]);

  if (isLoading || !status) return null;
  // A Luzeria recebe todos os planos (painel de agências); aqui só os do tipo da conta.
  const shownPlans = (plans ?? []).filter((p) => p.accountType === (status.isHousePlan ? "house" : "agency"));

  function saveTaxId() {
    const digits = taxId.replace(/\D/g, "");
    updateMyOrg.mutate({ data: { taxId: digits || null } }, {
      onSuccess: () => toast.success("CNPJ/CPF salvo."),
      onError: (e: any) => toastFriendlyError(e, "Erro ao salvar"),
    });
  }

  async function subscribe(planId: string) {
    const stillInTrial = status?.subscriptionStatus === "trialing" && status?.trialEndsAt && new Date(status.trialEndsAt) > new Date();
    const trialEndLabel = stillInTrial ? new Date(status!.trialEndsAt as string).toLocaleDateString("pt-BR") : null;
    const confirmMsg = trialEndLabel
      ? `Isso gera sua fatura de pagamento, com vencimento só no fim do seu teste grátis (${trialEndLabel}). Confirma?`
      : "Isso gera sua fatura de pagamento agora. Confirma?";
    if (!(await requestConfirm(confirmMsg))) return;
    subscribeToPlan.mutate({ data: { planId } }, {
      onSuccess: (r: any) => {
        toast.success("Assinatura criada! Abrindo a fatura para pagamento…");
        if (r?.invoiceUrl) window.open(r.invoiceUrl, "_blank");
      },
      onError: (e: any) => toastFriendlyError(e, "Erro ao assinar o plano."),
    });
  }

  function resendInvoice() {
    resendPendingInvoiceEmail.mutate({} as any, {
      onSuccess: () => toast.success("Fatura reenviada pro seu e-mail de login."),
      onError: (e: any) => toastFriendlyError(e, "Erro ao reenviar a fatura."),
    });
  }

  function confirmCancel() {
    cancelMySubscription.mutate({ data: { reason: cancelReason.trim() || undefined } }, {
      onSuccess: () => {
        toast.success("Assinatura cancelada — você não será cobrado de novo.");
        setShowCancelForm(false);
        setCancelReason("");
      },
    });
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
        <Star size={12} /> Assinatura e cobrança
      </h2>
      <div className="bg-card rounded-lg p-5 mb-8 space-y-4">
        {me?.role === "master" && status.hasAsaasSubscription && status.subscriptionStatus !== "active" && pendingInvoice && (
          <div className="rounded-lg p-4" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)" }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-bold text-foreground">
                  Fatura em aberto — R$ {(pendingInvoice.valueCents / 100).toFixed(2).replace(".", ",")}
                </div>
                <div className="text-[11px] text-foreground/50 mt-0.5">
                  {pendingInvoice.dueDate
                    ? <>Vencimento: {new Date(pendingInvoice.dueDate + "T12:00:00").toLocaleDateString("pt-BR")} · pague por PIX, boleto ou cartão</>
                    : "Pague por PIX, boleto ou cartão."}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={resendInvoice} disabled={resendPendingInvoiceEmail.isPending}
                  className="lz-btn-ghost text-xs px-3 py-2 rounded-md whitespace-nowrap disabled:opacity-50">
                  {resendPendingInvoiceEmail.isPending ? "Enviando…" : "Reenviar por e-mail"}
                </button>
                {pendingInvoice.bankSlipUrl && (
                  <a href={pendingInvoice.bankSlipUrl} target="_blank" rel="noreferrer"
                    className="lz-btn-ghost text-xs px-3 py-2 rounded-md whitespace-nowrap">
                    Baixar boleto
                  </a>
                )}
                {pendingInvoice.invoiceUrl && (
                  <a href={pendingInvoice.invoiceUrl} target="_blank" rel="noreferrer"
                    className="text-xs font-bold px-3 py-2 rounded-md whitespace-nowrap"
                    style={{ backgroundColor: "#f87171", color: "#1A0D0D" }}>
                    Ver fatura e pagar
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="rounded-lg p-4 flex items-start gap-3" style={{ background: "color-mix(in srgb, var(--foreground) 4%, transparent)" }}>
          <div className="h-8 w-8 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
            <FileDigit size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/40 mb-1.5">CNPJ ou CPF {isHouse(me) ? "da empresa" : "da agência"}</div>
            <div className="flex gap-2">
              <input value={taxId} onChange={(e) => setTaxId(e.target.value)} maxLength={18} className="lz-input"
                placeholder="Somente números — necessário pra assinar um plano" />
              <button onClick={saveTaxId} disabled={updateMyOrg.isPending}
                className="lz-btn-ghost text-xs px-4 py-2 rounded-md whitespace-nowrap disabled:opacity-50">
                {updateMyOrg.isPending ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-foreground/6">
          <div className="flex items-center gap-1.5 text-sm font-bold text-foreground mb-1">
            <Rocket size={14} style={{ color: "var(--lz-accent-ink)" }} /> {status.isHousePlan ? "Planos da House" : "Quer fazer upgrade?"}
          </div>
          <p className="text-[11px] text-foreground/40 mb-3">
            {status.isHousePlan
              ? `Cada marca além da principal soma ${formatBRL(status.extraBrandCents)}/mês à assinatura.`
              : "Mais espaço pra clientes e colaboradores, sempre que sua agência crescer."}
          </p>
          <div className="space-y-2">
            {shownPlans.map((plan, i) => {
              const isCurrent = plan.id === status.planId && status.hasAsaasSubscription;
              const TierIcon = i === 0 ? Zap : i === shownPlans.length - 1 ? Crown : Rocket;
              return (
                <div key={plan.id} className="flex items-center gap-3 rounded-lg px-3.5 py-3 transition-colors"
                  style={isCurrent
                    ? { background: "rgba(var(--lz-brand-rgb),0.06)", border: "1px solid rgba(var(--lz-brand-rgb),0.25)" }
                    : { background: "color-mix(in srgb, var(--foreground) 4%, transparent)", border: "1px solid transparent" }}>
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
                    <TierIcon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-foreground font-semibold">{plan.name}</span>
                      {isCurrent && (
                        <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
                          Atual
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-foreground/50 flex items-center gap-1 flex-wrap">
                      {plan.priceCents != null ? `R$ ${(plan.priceCents / 100).toFixed(2).replace(".", ",")}/mês` : "Sob consulta"}
                      <span className="text-foreground/25">·</span>
                      {status.isHousePlan ? (
                        <>{plan.features?.ai_planning ? "com planejamento por IA" : "sem IA"}</>
                      ) : (
                        <><Users size={11} className="inline" /> até {plan.maxClients} clientes</>
                      )}
                      <span className="text-foreground/25">·</span>
                      <UserCog size={11} className="inline" /> até {plan.maxCollaborators}
                    </div>
                  </div>
                  {isCurrent ? null : plan.priceCents == null ? (
                    <a href="https://wa.me/" target="_blank" rel="noreferrer"
                      className="lz-btn-ghost text-xs px-3 py-1.5 rounded-md whitespace-nowrap shrink-0">Fale conosco</a>
                  ) : (
                    <button onClick={() => subscribe(plan.id)} disabled={subscribeToPlan.isPending}
                      className="lz-btn-primary text-xs px-3 py-1.5 rounded-md whitespace-nowrap shrink-0 disabled:opacity-50 inline-flex items-center gap-1">
                      {subscribeToPlan.isPending ? "Aguarde…" : <>Assinar <ArrowRight size={12} /></>}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {me?.role === "master" && status.hasAsaasSubscription && (invoiceHistory?.length ?? 0) > 0 && (
          <div className="pt-3 border-t border-foreground/6">
            <button onClick={() => setShowHistory((v) => !v)} className="text-xs font-semibold text-foreground/60 hover:text-foreground flex items-center gap-1">
              Histórico de faturas <ChevronDown size={13} className="transition-transform" style={{ transform: showHistory ? "rotate(180deg)" : "rotate(0deg)" }} />
            </button>
            {showHistory && (
              <div className="mt-2.5 space-y-1.5">
                {invoiceHistory!.map((inv) => {
                  const info = INVOICE_STATUS_LABEL[inv.status] ?? { label: inv.status, color: "var(--foreground)" };
                  const link = inv.receiptUrl ?? inv.invoiceUrl;
                  return (
                    <div key={inv.id} className="flex items-center justify-between gap-3 bg-black/20 rounded-md px-3 py-2">
                      <div className="text-xs text-foreground/70">
                        {inv.paymentDate
                          ? new Date(inv.paymentDate + "T12:00:00").toLocaleDateString("pt-BR")
                          : inv.dueDate ? `Venc. ${new Date(inv.dueDate + "T12:00:00").toLocaleDateString("pt-BR")}` : "—"}
                        {" · "}R$ {(inv.valueCents / 100).toFixed(2).replace(".", ",")}
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-[10px] font-bold uppercase" style={{ color: info.color }}>{info.label}</span>
                        {link && (
                          <a href={link} target="_blank" rel="noreferrer" className="text-[11px] text-foreground/50 hover:text-foreground underline">
                            Ver
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {me?.role === "master" && status.hasAsaasSubscription && status.subscriptionStatus !== "canceled" && (
          <div className="pt-3 border-t border-foreground/6">
            {!showCancelForm ? (
              <button onClick={() => setShowCancelForm(true)} className="text-xs text-red-400/70 hover:text-red-400">
                Cancelar assinatura
              </button>
            ) : (
              <div className="rounded-lg p-3" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.18)" }}>
                <p className="text-xs text-foreground/70 mb-2.5">
                  Isso cancela a cobrança recorrente na Asaas — sua agência e seus dados continuam aqui, só sem assinatura ativa. Você pode assinar de novo quando quiser.
                </p>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Por que está cancelando? (opcional, nos ajuda a melhorar)"
                  rows={2}
                  className="lz-input w-full resize-none mb-2.5"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowCancelForm(false)} className="text-xs text-foreground/50 hover:text-foreground px-2 py-1.5">
                    Voltar
                  </button>
                  <button
                    onClick={confirmCancel}
                    disabled={cancelMySubscription.isPending}
                    className="text-xs font-bold px-3 py-1.5 rounded-md disabled:opacity-50"
                    style={{ backgroundColor: "#f87171", color: "#1A0D0D" }}
                  >
                    {cancelMySubscription.isPending ? "Cancelando…" : "Confirmar cancelamento"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SubTabPill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition-colors"
      style={{
        backgroundColor: active ? "rgba(var(--lz-brand-light-rgb),0.15)" : "transparent",
        color: active ? "var(--lz-accent-ink)" : "color-mix(in srgb, var(--foreground) 50%, transparent)",
      }}>
      {label}
    </button>
  );
}

function ClienteTab({ initialSub, canJourney, canMargem, isAdmin }: {
  initialSub: "overview" | "jornada" | "margem"; canJourney: boolean; canMargem: boolean; isAdmin: boolean;
}) {
  const subs = [
    ...(isAdmin ? [{ id: "overview" as const, label: "Visão Geral" }] : []),
    ...(canJourney ? [{ id: "jornada" as const, label: "Jornada" }] : []),
    ...(canMargem ? [{ id: "margem" as const, label: "Margem" }] : []),
  ];
  const [sub, setSub] = useState<"overview" | "jornada" | "margem">(
    subs.some((s) => s.id === initialSub) ? initialSub : (subs[0]?.id ?? "overview"),
  );
  return (
    <div>
      <div className="flex items-center gap-1 mb-6 -mt-2">
        {subs.map((s) => <SubTabPill key={s.id} active={sub === s.id} onClick={() => setSub(s.id)} label={s.label} />)}
      </div>
      {sub === "overview" ? <ClientOperationsOverview /> :
       sub === "jornada" ? <JourneyStagesTab /> :
       sub === "margem" ? <ClientMarginPanel /> : null}
    </div>
  );
}

function OrgBrandingSection({
  orgId, orgName, orgTagline, orgLogoUrl, orgLogoUrlLight, orgLogoSizeAdjustPx, orgLogoPositionAdjustPx, orgColorPrimary, orgColorPrimaryLight, orgColorSidebar,
  orgColorAccentLight, orgFeedPreviewImageUrl, orgPlanejamentoCoverImageUrl, orgFaviconUrl, borderRadius, heroGradientFrom, heroGradientTo,
  brandAdvancedColors,
}: {
  orgId: string; orgName: string; orgTagline: string | null; orgLogoUrl: string | null; orgLogoUrlLight: string | null;
  orgLogoSizeAdjustPx: number; orgLogoPositionAdjustPx: number;
  orgColorPrimary: string; orgColorPrimaryLight: string; orgColorSidebar: string; orgColorAccentLight: string | null;
  orgFeedPreviewImageUrl: string | null; orgPlanejamentoCoverImageUrl: string | null; orgFaviconUrl: string | null; borderRadius: number;
  heroGradientFrom: string | null; heroGradientTo: string | null;
  brandAdvancedColors: BrandAdvancedColors;
}) {
  const { updateMyOrg } = useApi();
  const [name, setName] = useState(orgName);
  // "" (string vazia, salva de propósito) e null (nunca configurado) são
  // estados diferentes — só assim dá pra remover o slogan de verdade em vez
  // de só voltar pro nome genérico "Gestão de conteúdo e criação" (pedido
  // de usabilidade real, veio de feedback numa call). O checkbox abaixo
  // decide qual dos dois vai ser salvo quando o campo estiver vazio.
  const [tagline, setTagline] = useState(orgTagline ?? "");
  const [hideTagline, setHideTagline] = useState(orgTagline === "");
  const [logoSizeAdjustPx, setLogoSizeAdjustPx] = useState(orgLogoSizeAdjustPx);
  const [logoPositionAdjustPx, setLogoPositionAdjustPx] = useState(orgLogoPositionAdjustPx);
  const { setLogoPreview, clearLogoPreview } = useLogoPreview();
  // Prévia ao vivo direto na sidebar de verdade (pedido do Junior) — manda
  // pra store compartilhada a cada mudança de régua, e limpa ao sair da tela
  // (senão a sidebar ficaria "presa" mostrando um ajuste não salvo pra
  // sempre). Também limpa se a logo dessa agência não tem URL (nada a
  // pré-visualizar).
  useEffect(() => {
    if (!orgLogoUrl) return;
    setLogoPreview(logoSizeAdjustPx, logoPositionAdjustPx);
    return () => clearLogoPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoSizeAdjustPx, logoPositionAdjustPx, orgLogoUrl]);
  const [colorPrimary, setColorPrimary] = useState(orgColorPrimary);
  const [colorPrimaryLight, setColorPrimaryLight] = useState(orgColorPrimaryLight);
  const [colorSidebar, setColorSidebar] = useState(orgColorSidebar);
  const [colorAccentLight, setColorAccentLight] = useState(orgColorAccentLight);
  const [radius, setRadius] = useState(borderRadius);
  const [heroFrom, setHeroFrom] = useState(heroGradientFrom);
  const [heroTo, setHeroTo] = useState(heroGradientTo);
  const [advColors, setAdvColors] = useState<BrandAdvancedColors>(brandAdvancedColors);
  // Começa aberto se a agência já tinha algum override salvo (senão ela
  // "perderia" a customização de vista toda vez que reabrisse Configurações).
  const [advancedMode, setAdvancedMode] = useState(() => Object.keys(brandAdvancedColors).length > 0);
  const [uploading, setUploading] = useState(false);
  const [uploadingLight, setUploadingLight] = useState(false);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [uploadingPlanejamentoCover, setUploadingPlanejamentoCover] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [showInstallTutorial, setShowInstallTutorial] = useState(false);

  useEffect(() => { setName(orgName); }, [orgName]);
  useEffect(() => { setTagline(orgTagline ?? ""); setHideTagline(orgTagline === ""); }, [orgTagline]);
  useEffect(() => { setLogoSizeAdjustPx(orgLogoSizeAdjustPx); }, [orgLogoSizeAdjustPx]);
  useEffect(() => { setLogoPositionAdjustPx(orgLogoPositionAdjustPx); }, [orgLogoPositionAdjustPx]);
  useEffect(() => { setColorPrimary(orgColorPrimary); }, [orgColorPrimary]);
  useEffect(() => { setColorPrimaryLight(orgColorPrimaryLight); }, [orgColorPrimaryLight]);
  useEffect(() => { setColorSidebar(orgColorSidebar); }, [orgColorSidebar]);
  useEffect(() => { setColorAccentLight(orgColorAccentLight); }, [orgColorAccentLight]);
  useEffect(() => { setRadius(borderRadius); }, [borderRadius]);
  useEffect(() => { setHeroFrom(heroGradientFrom); }, [heroGradientFrom]);
  useEffect(() => { setHeroTo(heroGradientTo); }, [heroGradientTo]);
  useEffect(() => { setAdvColors(brandAdvancedColors); }, [brandAdvancedColors]);

  // Pré-visualização ao vivo: enquanto essa seção está aberta, a barra
  // lateral e o resto da UI de verdade (não uma maquete à parte) refletem
  // as cores sendo digitadas aqui, antes de salvar — dá pra julgar
  // contraste na prática. Mesma fórmula que App.tsx usa a partir do valor
  // salvo; aqui aplicamos a partir do estado local (ainda não salvo).
  useEffect(() => {
    const root = document.documentElement.style;
    const primary = colorPrimary ? hexToRgbChannels(colorPrimary) : null;
    const lightHex = colorPrimaryLight && colorPrimaryLight !== "#C8D44E"
      ? colorPrimaryLight
      : colorPrimary ? deriveSecondaryHex(colorPrimary) : null;
    const light = lightHex ? hexToRgbChannels(lightHex) : null;
    const sidebar = colorSidebar ? hexToRgbChannels(colorSidebar) : null;
    const accentLight = colorAccentLight ? hexToRgbChannels(colorAccentLight) : null;
    if (primary) root.setProperty("--lz-brand-rgb", primary);
    if (light) root.setProperty("--lz-brand-light-rgb", light);
    if (sidebar) root.setProperty("--lz-sidebar-rgb", sidebar);
    if (accentLight) root.setProperty("--lz-accent-ink-override", `rgb(${accentLight})`);
    else root.removeProperty("--lz-accent-ink-override");
    applyAdvancedColorVars(root, advColors);
  }, [colorPrimary, colorPrimaryLight, colorSidebar, colorAccentLight, advColors]);

  // Guarda sempre os valores REALMENTE salvos (as props), pra restaurar
  // certo ao sair da seção sem salvar — sem isso, quem só desse uma olhada
  // nas cores e trocasse de aba ficaria com a UI inteira na cor "abandonada".
  // É uma ref (não state) porque só é lida no cleanup do efeito de
  // desmontagem abaixo, que roda com um closure "congelado" no momento do
  // mount — sem a ref, ele restauraria pra cor salva de quando a tela abriu,
  // não pra mais recente (ex: depois de um Salvar bem-sucedido).
  const savedColorsRef = useRef({ orgColorPrimary, orgColorPrimaryLight, orgColorSidebar, orgColorAccentLight, brandAdvancedColors });
  useEffect(() => {
    savedColorsRef.current = { orgColorPrimary, orgColorPrimaryLight, orgColorSidebar, orgColorAccentLight, brandAdvancedColors };
  }, [orgColorPrimary, orgColorPrimaryLight, orgColorSidebar, orgColorAccentLight, brandAdvancedColors]);

  useEffect(() => {
    return () => {
      const { orgColorPrimary, orgColorPrimaryLight, orgColorSidebar, orgColorAccentLight, brandAdvancedColors } = savedColorsRef.current;
      const root = document.documentElement.style;
      applyAdvancedColorVars(root, brandAdvancedColors);
      const primary = orgColorPrimary ? hexToRgbChannels(orgColorPrimary) : null;
      const lightHex = orgColorPrimaryLight && orgColorPrimaryLight !== "#C8D44E"
        ? orgColorPrimaryLight
        : orgColorPrimary ? deriveSecondaryHex(orgColorPrimary) : null;
      const light = lightHex ? hexToRgbChannels(lightHex) : null;
      const sidebar = orgColorSidebar ? hexToRgbChannels(orgColorSidebar) : null;
      const accentLight = orgColorAccentLight ? hexToRgbChannels(orgColorAccentLight) : null;
      if (primary) root.setProperty("--lz-brand-rgb", primary); else root.removeProperty("--lz-brand-rgb");
      if (light) root.setProperty("--lz-brand-light-rgb", light); else root.removeProperty("--lz-brand-light-rgb");
      if (sidebar) root.setProperty("--lz-sidebar-rgb", sidebar); else root.removeProperty("--lz-sidebar-rgb");
      if (accentLight) root.setProperty("--lz-accent-ink-override", `rgb(${accentLight})`); else root.removeProperty("--lz-accent-ink-override");
    };
  }, []);

  function save() {
    updateMyOrg.mutate({
      data: {
        name: name.trim(),
        tagline: hideTagline ? "" : (tagline.trim() || null),
        logoSizeAdjustPx,
        logoPositionAdjustPx,
        colorPrimary: colorPrimary || null,
        colorPrimaryLight: colorPrimaryLight || null,
        colorSidebar: colorSidebar || null,
        colorAccentLight: colorAccentLight || null,
        borderRadius: radius,
        heroGradientFrom: heroFrom || null,
        heroGradientTo: heroTo || null,
        // Botão fundo+texto é sempre um par — se a agência só mexeu num
        // lado, completa o outro com o padrão automático antes de salvar,
        // pra nunca guardar uma combinação pela metade (uma cor de propósito
        // + a antiga cor automática do outro lado, ilegível por acidente).
        brandAdvancedColors: normalizeButtonPairs(advColors, colorPrimary),
      },
    }, {
      onSuccess: () => toast.success("Marca da agência atualizada."),
      onError: (e: any) => toastFriendlyError(e, "Erro ao salvar"),
    });
  }

  function restoreAdvancedColors() {
    setAdvColors({});
  }

  async function pickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Escolha um arquivo de imagem."); return; }
    if (file.size > MAX_LOGO_BYTES) { toast.error("Imagem muito grande (máximo 3 MB)."); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `org-logos/${orgId}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type, upsert: true,
      });
      if (upErr) throw upErr;
      await updateMyOrg.mutateAsync({ data: { logoPath: path } });
      toast.success("Logo atualizada.");
    } catch (e: any) {
      toastFriendlyError(e, "Erro ao enviar a logo.");
    } finally {
      setUploading(false);
    }
  }

  function removeLogo() {
    updateMyOrg.mutate({ data: { logoPath: null } }, {
      onSuccess: () => toast.success("Logo removida."),
      onError: (e: any) => toastFriendlyError(e, "Erro ao remover"),
    });
  }

  async function pickLogoLight(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Escolha um arquivo de imagem."); return; }
    if (file.size > MAX_LOGO_BYTES) { toast.error("Imagem muito grande (máximo 3 MB)."); return; }
    setUploadingLight(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `org-logos/${orgId}/logo-light-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type, upsert: true,
      });
      if (upErr) throw upErr;
      await updateMyOrg.mutateAsync({ data: { logoPathLight: path } });
      toast.success("Logo do modo claro atualizada.");
    } catch (e: any) {
      toastFriendlyError(e, "Erro ao enviar a logo.");
    } finally {
      setUploadingLight(false);
    }
  }

  function removeLogoLight() {
    updateMyOrg.mutate({ data: { logoPathLight: null } }, {
      onSuccess: () => toast.success("Logo do modo claro removida — volta a usar a mesma dos dois temas."),
      onError: (e: any) => toastFriendlyError(e, "Erro ao remover"),
    });
  }

  async function pickFeedPreviewImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Escolha um arquivo de imagem."); return; }
    if (file.size > MAX_LOGO_BYTES) { toast.error("Imagem muito grande (máximo 3 MB)."); return; }
    setUploadingPreview(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `org-feed-preview/${orgId}/preview-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type, upsert: true,
      });
      if (upErr) throw upErr;
      await updateMyOrg.mutateAsync({ data: { feedPreviewImagePath: path } });
      toast.success("Imagem de preview atualizada.");
    } catch (e: any) {
      toastFriendlyError(e, "Erro ao enviar a imagem.");
    } finally {
      setUploadingPreview(false);
    }
  }

  function resetFeedPreviewImage() {
    updateMyOrg.mutate({ data: { feedPreviewImagePath: null } }, {
      onSuccess: () => toast.success("Voltou pra imagem padrão do Modo Criador."),
      onError: (e: any) => toastFriendlyError(e, "Erro ao remover"),
    });
  }

  async function pickPlanejamentoCoverImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Escolha um arquivo de imagem."); return; }
    if (file.size > MAX_LOGO_BYTES) { toast.error("Imagem muito grande (máximo 3 MB)."); return; }
    setUploadingPlanejamentoCover(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `org-planejamento-cover/${orgId}/cover-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type, upsert: true,
      });
      if (upErr) throw upErr;
      await updateMyOrg.mutateAsync({ data: { planejamentoCoverImagePath: path } });
      toast.success("Imagem de capa atualizada.");
    } catch (e: any) {
      toastFriendlyError(e, "Erro ao enviar a imagem.");
    } finally {
      setUploadingPlanejamentoCover(false);
    }
  }

  function resetPlanejamentoCoverImage() {
    updateMyOrg.mutate({ data: { planejamentoCoverImagePath: null } }, {
      onSuccess: () => toast.success("Voltou pra imagem padrão do Modo Criador."),
      onError: (e: any) => toastFriendlyError(e, "Erro ao remover"),
    });
  }

  async function pickFavicon(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Escolha um arquivo de imagem."); return; }
    if (file.size > MAX_LOGO_BYTES) { toast.error("Imagem muito grande (máximo 3 MB)."); return; }
    setUploadingFavicon(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `org-favicon/${orgId}/favicon-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type, upsert: true,
      });
      if (upErr) throw upErr;
      await updateMyOrg.mutateAsync({ data: { faviconPath: path } });
      toast.success("Ícone atualizado.");
    } catch (e: any) {
      toastFriendlyError(e, "Erro ao enviar o ícone.");
    } finally {
      setUploadingFavicon(false);
    }
  }

  function resetFavicon() {
    updateMyOrg.mutate({ data: { faviconPath: null } }, {
      onSuccess: () => toast.success("Voltou pro ícone padrão do Modo Criador."),
      onError: (e: any) => toastFriendlyError(e, "Erro ao remover"),
    });
  }

  const effectiveLight = colorPrimaryLight && colorPrimaryLight !== "#C8D44E" ? colorPrimaryLight : deriveSecondaryHex(colorPrimary);
  const effectiveAccentInk = colorAccentLight || darkenHex(colorPrimary || "#C8D44E", 0.55);
  const previewOuterRadius = Math.round(radius * 1.3);
  const previewInnerRadius = Math.max(6, Math.round(radius * 0.6));
  // Mesma receita do degradê real do cabeçalho do Dashboard (AdminDashboard.tsx):
  // dois halos radiais suaves (nunca uma cor sólida por trás do texto) sobre
  // a base card→background — é assim que o texto continua legível mesmo
  // quando uma das cores é bem escura (a cor da barra lateral, por exemplo).
  const heroARgb = hexToRgbChannels(heroFrom || effectiveLight) ?? "200, 212, 78";
  const heroBRgb = hexToRgbChannels(heroTo || colorSidebar) ?? "26, 58, 46";

  return (
    <>
      <div className="space-y-4" data-tour="org-branding">
        <p className="text-[11px] text-foreground/50 leading-relaxed">
          Aparece na barra lateral e no título da aba, depois que sua equipe faz login.
          A tela de login em si continua igual pra todas as agências.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl p-4 bg-black/20 space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-foreground/40">
              <Moon size={11} /> Logo · modo escuro
            </div>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl bg-black/40 border border-foreground/10 flex items-center justify-center overflow-hidden shrink-0">
                {orgLogoUrl ? (
                  <img src={orgLogoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <ImagePlus size={18} className="text-foreground/20" />
                )}
              </div>
              <div className="flex flex-col items-start gap-1.5">
                <label className="lz-btn-ghost text-xs px-4 py-2 rounded-md cursor-pointer disabled:opacity-50">
                  {uploading ? "Enviando…" : "Enviar logo"}
                  <input type="file" accept="image/*" className="hidden" onChange={pickLogo} disabled={uploading} />
                </label>
                {orgLogoUrl && (
                  <button onClick={removeLogo} disabled={updateMyOrg.isPending}
                    className="text-[11px] text-foreground/50 hover:text-red-400 transition disabled:opacity-50">
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-xl p-4 bg-black/20 space-y-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-foreground/40">
              <Sun size={11} /> Logo · modo claro <span className="text-foreground/25 font-semibold normal-case tracking-normal">(opcional)</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl bg-white border border-foreground/10 flex items-center justify-center overflow-hidden shrink-0">
                {orgLogoUrlLight ? (
                  <img src={orgLogoUrlLight} alt="Logo (claro)" className="max-h-full max-w-full object-contain" />
                ) : (
                  <ImagePlus size={18} className="text-black/20" />
                )}
              </div>
              <div className="flex flex-col items-start gap-1.5">
                <label className="lz-btn-ghost text-xs px-4 py-2 rounded-md cursor-pointer disabled:opacity-50">
                  {uploadingLight ? "Enviando…" : "Enviar logo"}
                  <input type="file" accept="image/*" className="hidden" onChange={pickLogoLight} disabled={uploadingLight} />
                </label>
                {orgLogoUrlLight && (
                  <button onClick={removeLogoLight} disabled={updateMyOrg.isPending}
                    className="text-[11px] text-foreground/50 hover:text-red-400 transition disabled:opacity-50">
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        <p className="text-[10.5px] text-foreground/35 leading-relaxed -mt-1">
          Se a sua logo não fica boa no fundo branco do modo claro (por ser branca, ou muito clara), envie uma
          segunda versão aqui — só pra esse tema. Se não enviar, o app usa a mesma logo nos dois.
        </p>

        {orgLogoUrl && (
          <div className="rounded-xl p-4 bg-black/20 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[11px] uppercase tracking-wide text-foreground/40 font-semibold">Ajuste fino da logo na barra lateral</div>
              {(logoSizeAdjustPx !== 0 || logoPositionAdjustPx !== 0) && (
                <button onClick={() => { setLogoSizeAdjustPx(0); setLogoPositionAdjustPx(0); }} className="text-[11px] text-foreground/50 hover:text-foreground transition shrink-0">
                  Restaurar automático
                </button>
              )}
            </div>
            <p className="text-[10.5px] text-foreground/35 leading-relaxed -mt-2">
              A gente já calcula um tamanho e posição automáticos pra cada logo. Se ainda não ficar do jeito que você
              acha bonito, arraste — é ao vivo, dá pra ver a mudança na barra lateral à esquerda agora mesmo. Clique
              em Salvar lá embaixo quando ficar bom.
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10.5px] text-foreground/50">Tamanho</label>
                <span className="text-[10.5px] text-foreground/40 tabular-nums">
                  {logoSizeAdjustPx === 0 ? "automático" : logoSizeAdjustPx > 0 ? `−${logoSizeAdjustPx}px` : `+${-logoSizeAdjustPx}px`}
                </span>
              </div>
              <input
                type="range" min={-40} max={150} step={1} value={logoSizeAdjustPx}
                onChange={(e) => setLogoSizeAdjustPx(parseInt(e.target.value, 10))}
                className="w-full accent-[rgb(var(--lz-brand-rgb))]"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10.5px] text-foreground/50">Posição (esquerda ↔ direita)</label>
                <span className="text-[10.5px] text-foreground/40 tabular-nums">
                  {logoPositionAdjustPx === 0 ? "automático" : logoPositionAdjustPx > 0 ? `${logoPositionAdjustPx}px → direita` : `${-logoPositionAdjustPx}px → esquerda`}
                </span>
              </div>
              <input
                type="range" min={-60} max={60} step={1} value={logoPositionAdjustPx}
                onChange={(e) => setLogoPositionAdjustPx(parseInt(e.target.value, 10))}
                className="w-full accent-[rgb(var(--lz-brand-rgb))]"
              />
            </div>
          </div>
        )}

        <div className="rounded-xl p-4 bg-black/20 space-y-4">
          <Field label="Nome da agência">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="lz-input" />
          </Field>
          <Field label="Slogan (opcional)">
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={120} disabled={hideTagline}
              className="lz-input disabled:opacity-40" placeholder="Ex: Conteúdo que conecta" />
            <label className="flex items-center gap-2 mt-2 text-xs text-foreground/50 cursor-pointer">
              <input type="checkbox" checked={hideTagline} onChange={(e) => setHideTagline(e.target.checked)} />
              Não mostrar nenhum slogan (fica só o nome da agência, sem o texto padrão)
            </label>
          </Field>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase font-bold tracking-wider text-foreground/40">
            <Palette size={11} /> Identidade visual
          </div>
          <div className="rounded-xl p-4 bg-black/20 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ColorPickerField label="Cor principal" value={colorPrimary} onChange={setColorPrimary} presets={BRAND_PRESETS} />
            <ColorPickerField label="Cor clara (fundos suaves)" value={colorPrimaryLight} onChange={setColorPrimaryLight} presets={BRAND_LIGHT_PRESETS} />
            <ColorPickerField label="Cor da barra lateral" value={colorSidebar} onChange={setColorSidebar} presets={SIDEBAR_PRESETS} />
            <HeroColorField label="Cor de destaque nos gráficos" value={colorAccentLight} fallback={darkenHex(colorPrimary, 0.55)} onChange={setColorAccentLight} />
          </div>
          <p className="text-[11px] text-foreground/35 mt-3 leading-relaxed">
            No modo claro, o gráfico do Dashboard e a linha de "Como estou indo?" escurecem a cor principal sozinhos
            pra manter contraste no fundo claro — a "Cor de destaque" acima escolhe a sua própria cor pra isso, se preferir.
          </p>
        </div>

        <div className="rounded-xl p-4 bg-black/20 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={advancedMode} onChange={(e) => setAdvancedMode(e.target.checked)} />
              <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-foreground/60 font-semibold">
                <SlidersHorizontal size={12} /> Modo avançado
              </span>
            </label>
            {Object.keys(advColors).length > 0 && (
              <button type="button" onClick={restoreAdvancedColors}
                className="flex items-center gap-1 text-[10px] text-foreground/40 hover:text-foreground transition">
                <RotateCcw size={10} /> Restaurar cores originais
              </button>
            )}
          </div>
          {advancedMode && (
            <div className="space-y-5">
              <p className="text-[11px] text-foreground/40 leading-relaxed">
                Escolha cores específicas por tema pra título, corpo de texto, botões, destaque e cabeçalho.
                Deixe em branco ("Automático") pra continuar usando o cálculo automático — que já garante contraste
                mínimo sozinho. Aqui a escolha é sua: o aviso de contraste é só um alerta, nunca impede salvar.
              </p>

              <AdvancedTextGroup title="Título" description="Texto principal (nomes, cabeçalhos de card)."
                value={advColors.textTitle} onChange={(v) => setAdvColors((p) => ({ ...p, textTitle: v }))}
                fallbackLight="#16171B" fallbackDark="#FFFFFF" />
              <AdvancedTextGroup title="Corpo" description="Texto de conteúdo dentro dos cards."
                value={advColors.textBody} onChange={(v) => setAdvColors((p) => ({ ...p, textBody: v }))}
                fallbackLight="#16171B" fallbackDark="#FFFFFF" />
              <AdvancedTextGroup title="Secundário / esmaecido" description="Legendas, datas, texto de apoio."
                value={advColors.textMuted} onChange={(v) => setAdvColors((p) => ({ ...p, textMuted: v }))}
                fallbackLight="#7B7C7D" fallbackDark="#868686" />

              <AdvancedButtonGroup value={advColors} onChange={setAdvColors} brandColor={colorPrimary} />

              <AdvancedAccentGroup value={advColors.accentInk} onChange={(v) => setAdvColors((p) => ({ ...p, accentInk: v }))}
                brandColor={colorPrimary} />

              <AdvancedHeroGroup heroA={advColors.heroA} heroB={advColors.heroB}
                onChangeA={(v) => setAdvColors((p) => ({ ...p, heroA: v }))}
                onChangeB={(v) => setAdvColors((p) => ({ ...p, heroB: v }))}
                fallbackA={colorPrimaryLight} fallbackB={colorSidebar} />
            </div>
          )}
        </div>

        {/* Pré-visualização ao vivo — logo depois das cores (é ali que a
            pessoa começa a mexer) e "grudada" (sticky) enquanto rola pelos
            campos de cantos/degradê abaixo, pra nunca sumir de tela bem na
            hora que mais importa. Reproduz a MESMA receita visual do
            cabeçalho real do Dashboard, não um degradê inventado. */}
        <div className="sticky top-16 z-20">
          <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/40 mb-2 flex items-center gap-1.5">
            <Eye size={11} /> Pré-visualização ao vivo
          </div>
          <div className="rounded-2xl p-3 shadow-lg shadow-black/20" style={{ background: "color-mix(in srgb, var(--foreground) 4%, transparent)" }}>
            <div className="flex overflow-hidden border border-foreground/10" style={{ borderRadius: previewOuterRadius }}>
              <div className="w-16 shrink-0 flex flex-col items-center gap-2.5 py-3" style={{ backgroundColor: colorSidebar || "#1A3A2E" }}>
                <div className="h-6 w-6 flex items-center justify-center font-serif font-bold text-[10px] text-white"
                  style={{ borderRadius: previewInnerRadius, backgroundColor: "rgba(255,255,255,0.12)" }}>
                  {(name || "L").trim().charAt(0).toUpperCase()}
                </div>
                <span className="w-5 h-[3px] rounded-full" style={{ backgroundColor: colorPrimary || "#C8D44E" }} />
                <span className="w-5 h-[3px] rounded-full bg-white/20" />
              </div>
              <div className="relative overflow-hidden flex-1 p-3"
                style={{
                  background:
                    `radial-gradient(120% 140% at 0% 0%, rgba(${heroARgb},0.18) 0%, color-mix(in srgb, rgb(${heroARgb}) 10%, transparent) 35%, transparent 70%), ` +
                    `radial-gradient(80% 120% at 100% 100%, color-mix(in srgb, color-mix(in srgb, rgb(${heroBRgb}) 40%, var(--background)) 55%, transparent) 0%, transparent 65%), ` +
                    "linear-gradient(180deg, var(--card) 0%, var(--background) 100%)",
                }}>
                <div className="pointer-events-none absolute -top-6 -left-6 h-14 w-14 rounded-full opacity-30 blur-2xl" style={{ background: `rgb(${heroARgb})` }} />
                <div className="pointer-events-none absolute -bottom-8 right-2 h-16 w-16 rounded-full opacity-25 blur-2xl" style={{ background: `rgb(${heroBRgb})` }} />
                <div className="relative">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8.5px] font-bold uppercase tracking-wider"
                    style={{ backgroundColor: `color-mix(in srgb, ${effectiveLight} 15%, transparent)`, color: effectiveAccentInk }}>
                    <Sparkles size={9} /> Dashboard
                  </span>
                  <div className="mt-1.5 text-foreground font-bold text-[15px] tracking-tight">ENTREGAS</div>
                  <div className="mt-0.5 italic text-foreground/60 text-[10px]">Bom ritmo, vamos fechar o mês com tudo!</div>
                  <span className="mt-2 inline-block text-[10.5px] font-extrabold px-3 py-1.5"
                    style={{ borderRadius: previewInnerRadius, backgroundColor: colorPrimary || "#C8D44E", color: "#0D0D0D" }}>
                    Botão principal
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl p-4 bg-black/20 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[11px] uppercase tracking-wide text-foreground/40 font-semibold">Cantos dos cards e painéis</label>
            <span className="text-xs font-bold" style={{ color: "var(--lz-accent-ink)" }}>{radius}px</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-foreground/30 shrink-0">Retos</span>
            <input
              type="range" min={0} max={24} step={2} value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="flex-1 accent-[rgb(var(--lz-brand-rgb))]"
            />
            <span className="text-[10px] text-foreground/30 shrink-0">Arredondados</span>
          </div>
        </div>

        <div className="rounded-xl p-4 bg-black/20 space-y-3">
          <label className="block text-[11px] uppercase tracking-wide text-foreground/40 font-semibold">
            Degradê do cabeçalho do Dashboard
          </label>
          <p className="text-[11px] text-foreground/40">
            Por padrão usa a cor clara e a cor da barra lateral. Escolha as suas se quiser outra combinação.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <HeroColorField label="Cor 1" value={heroFrom} fallback={colorPrimaryLight} onChange={setHeroFrom} />
            <HeroColorField label="Cor 2" value={heroTo} fallback={colorSidebar} onChange={setHeroTo} />
          </div>
        </div>

        <button onClick={save} disabled={updateMyOrg.isPending || !name.trim()}
          className="lz-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-50">
          {updateMyOrg.isPending ? "Salvando…" : "Salvar"}
        </button>
      </div>

      <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 mt-8 flex items-center gap-1.5">
        <Star size={12} /> Preview de feed
      </h2>
      <div className="bg-card rounded-lg p-5 mb-8 space-y-4">
        <p className="text-[11px] text-foreground/50 leading-relaxed">
          Imagem que aparece quando você manda o link de preview do feed pro cliente (WhatsApp, etc).
          Por padrão é a imagem do Modo Criador — troque pra aparecer uma imagem da sua agência.
        </p>

        <div className="rounded-md overflow-hidden bg-black/30 border border-foreground/10 max-w-sm">
          <img
            src={orgFeedPreviewImageUrl ?? "/og-preview.jpg"}
            alt="Preview do feed"
            className="w-full aspect-[936/438] object-cover"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="lz-btn-ghost text-xs px-4 py-2 rounded-md cursor-pointer disabled:opacity-50">
            {uploadingPreview ? "Enviando…" : "Enviar imagem"}
            <input type="file" accept="image/*" className="hidden" onChange={pickFeedPreviewImage} disabled={uploadingPreview} />
          </label>
          {orgFeedPreviewImageUrl && (
            <button onClick={resetFeedPreviewImage} disabled={updateMyOrg.isPending}
              className="text-[11px] text-foreground/50 hover:text-red-400 transition disabled:opacity-50">
              Voltar pra imagem padrão
            </button>
          )}
        </div>
        <p className="text-[11px] text-foreground/35">
          Tamanho recomendado: 1200 x 630px (formato horizontal) · até 3 MB.
        </p>
      </div>

      <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
        <Star size={12} /> Capa do link de planejamento
      </h2>
      <div className="bg-card rounded-lg p-5 mb-8 space-y-4">
        <p className="text-[11px] text-foreground/50 leading-relaxed">
          Imagem que aparece quando você manda o link de roteiros/planejamento pro cliente (WhatsApp, etc).
          Por padrão é a imagem do Modo Criador — troque pra aparecer uma imagem da sua agência.
        </p>

        <div className="rounded-md overflow-hidden bg-black/30 border border-foreground/10 max-w-sm">
          <img
            src={orgPlanejamentoCoverImageUrl ?? "/og-preview.jpg"}
            alt="Capa do link de planejamento"
            className="w-full aspect-[936/438] object-cover"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="lz-btn-ghost text-xs px-4 py-2 rounded-md cursor-pointer disabled:opacity-50">
            {uploadingPlanejamentoCover ? "Enviando…" : "Enviar imagem"}
            <input type="file" accept="image/*" className="hidden" onChange={pickPlanejamentoCoverImage} disabled={uploadingPlanejamentoCover} />
          </label>
          {orgPlanejamentoCoverImageUrl && (
            <button onClick={resetPlanejamentoCoverImage} disabled={updateMyOrg.isPending}
              className="text-[11px] text-foreground/50 hover:text-red-400 transition disabled:opacity-50">
              Voltar pra imagem padrão
            </button>
          )}
        </div>
        <p className="text-[11px] text-foreground/35">
          Tamanho recomendado: 1200 x 630px (formato horizontal) · até 3 MB.
        </p>
      </div>

      <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
        <Star size={12} /> Ícone (favicon)
      </h2>
      <div className="bg-card rounded-lg p-5 mb-8 space-y-4">
        <p className="text-[11px] text-foreground/50 leading-relaxed">
          Ícone que aparece na aba do navegador, e como ícone do app quando alguém adiciona o
          Modo Criador à tela inicial pelo iPhone. Por padrão é o ícone do Modo Criador.
        </p>

        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-md bg-black/30 border border-foreground/10 flex items-center justify-center overflow-hidden shrink-0">
            <img src={orgFaviconUrl ?? "/icon-192.png"} alt="Ícone" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex gap-2">
            <label className="lz-btn-ghost text-xs px-4 py-2 rounded-md cursor-pointer disabled:opacity-50">
              {uploadingFavicon ? "Enviando…" : "Enviar ícone"}
              <input type="file" accept="image/*" className="hidden" onChange={pickFavicon} disabled={uploadingFavicon} />
            </label>
            {orgFaviconUrl && (
              <button onClick={resetFavicon} disabled={updateMyOrg.isPending}
                className="text-[11px] text-foreground/50 hover:text-red-400 transition disabled:opacity-50">
                Voltar pro ícone padrão
              </button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-foreground/35">
          Tamanho recomendado: 512 x 512px (PNG, quadrado, fundo sólido) · até 3 MB.
        </p>
        <button
          type="button"
          onClick={() => setShowInstallTutorial(true)}
          className="w-full flex items-center gap-4 rounded-xl p-4 text-left transition hover:brightness-110"
          style={{ background: "linear-gradient(135deg, rgba(var(--lz-brand-rgb),0.18), rgba(var(--lz-brand-rgb),0.05))", border: "1px solid rgba(var(--lz-brand-rgb),0.3)" }}
        >
          <img src="/tutorials/app-icon-preview.png" alt="" className="h-14 w-14 rounded-xl shrink-0 shadow-lg" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-foreground">Que tal transformar sua agência num "app" no celular?</div>
            <div className="text-[11px] text-foreground/60 mt-0.5">Com o ícone acima configurado, fica igualzinho um app de verdade. Veja como, em 1 minuto.</div>
          </div>
          <div className="shrink-0 h-10 w-10 rounded-full flex items-center justify-center"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
            <PlayCircle size={20} />
          </div>
        </button>
      </div>
      {showInstallTutorial && <InstallAppTutorialModal onClose={() => setShowInstallTutorial(false)} />}
    </>
  );
}