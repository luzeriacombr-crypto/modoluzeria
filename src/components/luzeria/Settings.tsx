import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, lazy, Suspense } from "react";
import { profilesQO, useApi, useMe, appSettingsQO, orgPlanStatusQO, plansQO } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "./Avatar";
import type { Role } from "@/lib/luzeria/types";
import { OPTIONAL_FEATURE_KEYS, OPTIONAL_FEATURE_LABEL, hasSetorPermission, SETOR_PERMISSION_KEYS, SETOR_PERMISSION_LABEL, type SetorPermissionKey, type Profile } from "@/lib/luzeria/types";
import { toast } from "sonner";
import { UserPlus, X, Settings as SettingsIcon, Star, Building2, Loader2 } from "lucide-react";
import { TeamMemberCard } from "./TeamMemberCard";

// Cada uma dessas só renderiza dentro de uma aba específica (nunca mais de
// uma por vez) — lazy pra quem abre Configurações não pagar o download/parse
// de todas as abas só pra ver "Equipe", que é a aba padrão.
const ReportsTab = lazy(() => import("./ReportsTab").then((m) => ({ default: m.ReportsTab })));
const DriveSettingsTab = lazy(() => import("./DriveSettingsTab").then((m) => ({ default: m.DriveSettingsTab })));
const MemberGoalsTab = lazy(() => import("./MemberGoalsTab").then((m) => ({ default: m.MemberGoalsTab })));
const AutomationsTab = lazy(() => import("./AutomationsTab").then((m) => ({ default: m.AutomationsTab })));
const UpdatesTab = lazy(() => import("./UpdatesTab").then((m) => ({ default: m.UpdatesTab })));
const PromotionCodesPanel = lazy(() => import("./PromotionCodesPanel").then((m) => ({ default: m.PromotionCodesPanel })));
const AffiliateProgramPanel = lazy(() => import("./AffiliateProgramPanel").then((m) => ({ default: m.AffiliateProgramPanel })));
const AgenciesBillingPanel = lazy(() => import("./AgenciesBillingPanel").then((m) => ({ default: m.AgenciesBillingPanel })));
const DemoRequestsPanel = lazy(() => import("./DemoRequestsPanel").then((m) => ({ default: m.DemoRequestsPanel })));
const SalesPageEditorTab = lazy(() => import("./SalesPageEditorTab").then((m) => ({ default: m.SalesPageEditorTab })));
const JourneyStagesTab = lazy(() => import("./JourneyStagesTab").then((m) => ({ default: m.JourneyStagesTab })));

function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="animate-spin text-white/30" size={22} />
    </div>
  );
}

type SettingsTab = "team" | "report" | "automations" | "general" | "subscription" | "updates" | "site" | "journey";
const VALID_TABS: SettingsTab[] = ["team", "report", "automations", "general", "subscription", "updates", "site", "journey"];

export function SettingsPage({ tab: tabParam, onTabChange }: { tab?: string; onTabChange: (tab: SettingsTab) => void }) {
  const me = useMe().data;
  const { data: profiles = [] } = useQuery(profilesQO());
  const { setUserActive, deleteUser, adminCreateUser, createAgency } = useApi();
  const [adding, setAdding] = useState(false);
  const [creatingAgency, setCreatingAgency] = useState(false);

  if (!me) return null;
  const isMaster = me.role === "master";
  const setorAllowedTabs: SettingsTab[] = [
    ...(hasSetorPermission(me, "settings_journey") ? (["journey"] as SettingsTab[]) : []),
    ...(hasSetorPermission(me, "team_reports") ? (["report"] as SettingsTab[]) : []),
  ];
  if (!isMaster && setorAllowedTabs.length === 0) {
    return <div className="p-10 text-white/60 text-sm">Acesso restrito ao Administrador Master.</div>;
  }
  const allowedTabs: SettingsTab[] = isMaster ? VALID_TABS : setorAllowedTabs;
  const tab: SettingsTab = (allowedTabs as string[]).includes(tabParam ?? "") ? (tabParam as SettingsTab) : allowedTabs[0];
  const setTab = onTabChange;

  const pending = profiles.filter((p) => !p.active);
  const active = profiles.filter((p) => p.active);

  const handleRemove = async (id: string, name: string) => {
    if (!(await requestConfirm(`Remover ${name}? Esta ação é permanente.`, { danger: true }))) return;
    deleteUser.mutate({ data: { userId: id } }, {
      onSuccess: () => toast.success("Colaborador removido."),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
    });
  };

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[32px] font-bold text-white tracking-tight">Configurações</h1>
          <p className="text-sm text-white/50 mt-2">
            {tab === "team"   ? "Gerencie acessos, funções e metas da equipe." :
             tab === "report" ? "Relatório consolidado de entregas." :
             tab === "automations" ? "Google Drive, lembretes automáticos e jobs do sistema." :
             tab === "subscription" ? "Seu plano, cobrança, cupons e programa de afiliados." :
             tab === "updates" ? "O que mudou no Modo Criador." :
             tab === "site" ? "Textos, imagens e cores do site de vendas (modocriador.com.br)." :
             tab === "journey" ? "Etapas do onboarding e da operação mensal, usadas pra avisar clientes no WhatsApp." :
             "Ajustes gerais da operação."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-white/10 mb-6 overflow-x-auto overflow-y-hidden" data-tour="settings-tabs">
        {[
          { id: "team", label: "Equipe" },
          { id: "report", label: "Relatório" },
          { id: "automations", label: "Automações" },
          { id: "journey", label: "Jornada do cliente" },
          { id: "subscription", label: "Financeiro" },
          { id: "updates", label: "Atualizações" },
          { id: "general", label: "Geral" },
          ...(me.isPlatformAdmin ? [{ id: "site", label: "Site" }] : []),
        ].filter((t) => allowedTabs.includes(t.id as SettingsTab)).map((t) => {
          const active = tab === (t.id as any);
          return (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className="shrink-0 whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors -mb-px border-b-2"
              style={{
                color: active ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.5)",
                borderColor: active ? "rgb(var(--lz-brand-rgb))" : "transparent",
              }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "team" && (
        <div className="flex items-center justify-end gap-2 mb-6">
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
       tab === "subscription" ? (
        <div className="space-y-10">
          <SubscriptionSettings />
          {me.isPlatformAdmin && (
            <div className="pt-2 border-t border-white/10">
              <AgenciesBillingPanel />
            </div>
          )}
          {me.isPlatformAdmin && (
            <div className="pt-2 border-t border-white/10">
              <DemoRequestsPanel />
            </div>
          )}
          <div className="pt-2 border-t border-white/10">
            <AffiliateProgramPanel isPlatformAdmin={!!me.isPlatformAdmin} />
          </div>
          {me.isPlatformAdmin && (
            <div className="pt-2 border-t border-white/10">
              <PromotionCodesPanel />
            </div>
          )}
        </div>
       ) :
       tab === "updates" ? <UpdatesTab /> :
       tab === "site" ? (me.isPlatformAdmin ? <SalesPageEditorTab /> : null) :
       tab === "journey" ? <JourneyStagesTab /> :
       tab === "automations" ? (
        <div className="space-y-10">
          {!(me.disabledFeatures ?? []).includes("drive") && (
            <div>
              <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3">Google Drive</h2>
              <DriveSettingsTab />
            </div>
          )}
          <div className="pt-2 border-t border-white/10">
            <AutomationsTab />
          </div>
        </div>
       ) :
       tab === "report" ? <ReportsTab /> : (
        <>
      {pending.length > 0 && (
        <>
          <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3">
            Aguardando aprovação <span className="text-[rgb(var(--lz-brand-rgb))]">({pending.length})</span>
          </h2>
          <div className="bg-[#1C1C1C] rounded-lg overflow-hidden mb-8">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05] last:border-b-0">
                <Avatar profile={p} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{p.name}</div>
                  <div className="text-[11px] text-white/40 truncate">{p.email}</div>
                </div>
                <button
                  onClick={() => setUserActive.mutate({ data: { userId: p.id, active: true } }, {
                    onSuccess: () => toast.success(`${p.name} aprovado.`),
                  })}
                  className="lz-btn-primary text-xs px-3 py-1.5 rounded-md">
                  Aprovar
                </button>
                <button
                  onClick={() => handleRemove(p.id, p.name)}
                  className="text-xs px-3 py-1.5 rounded-md border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition">
                  Recusar
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3">
        Equipe ativa <span className="text-white/30">({active.length})</span>
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 lz-stagger">
        {active.map((p) => <TeamMemberCard key={p.id} profile={p} />)}
      </div>

      <p className="text-[11px] text-white/30 mt-4">
        Clique num membro pra ver mais opções (resetar senha, ver demandas, ativo/inativo, remover). Novos cadastros ficam pendentes até a aprovação de um Administrador Master. E-mails pré-cadastrados na equipe inicial entram já aprovados com a função correta.
      </p>

      <div className="mt-10 pt-6 border-t border-white/[0.06]">
        <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-4">
          Metas da equipe
        </h2>
        <MemberGoalsTab />
      </div>

      <div className="mt-8 pt-6 border-t border-white/[0.06]">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[rgb(var(--lz-brand-rgb))] mb-4">
          Diferença entre funções
        </div>
        <TeamPermissionsPanel me={me} />
      </div>
        </>
      )}
      </Suspense>

      {adding && (
        <AddMemberModal
          loading={adminCreateUser.isPending}
          onClose={() => setAdding(false)}
          onSubmit={(payload) => {
            adminCreateUser.mutate({ data: payload }, {
              onSuccess: () => { toast.success(`${payload.name} adicionado.`); setAdding(false); },
              onError: (e: any) => toast.error(e?.message ?? "Erro ao adicionar membro"),
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
              onError: (e: any) => toast.error(e?.message ?? "Erro ao criar agência"),
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
        className="w-full max-w-sm bg-[#1A1A1A] rounded-xl p-7 lz-modal-in"
        style={{ border: "1px solid rgba(var(--lz-brand-light-rgb),0.2)" }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold">Adicionar membro</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition"><X size={18} /></button>
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
          <button type="submit" disabled={loading}
            className="lz-btn-primary w-full rounded-md py-2.5 mt-2 text-sm disabled:opacity-50">
            {loading ? "Criando…" : "Criar membro"}
          </button>
          <p className="text-[10px] text-white/40 text-center mt-2">
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
        className="w-full max-w-sm bg-[#1A1A1A] rounded-xl p-7 lz-modal-in"
        style={{ border: "1px solid rgba(var(--lz-brand-light-rgb),0.2)" }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold">Criar nova agência</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition"><X size={18} /></button>
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
          <p className="text-[10px] text-white/40 text-center mt-2">
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
      <span className="text-[10px] uppercase font-bold tracking-wider text-white/50">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function GeneralSettings() {
  const { data: settings } = useQuery(appSettingsQO());
  const { updateAppSettings } = useApi();
  const me = useMe().data;
  if (!settings) return <div className="text-white/40 text-sm">Carregando…</div>;

  const toggle = (next: boolean) =>
    updateAppSettings.mutate({ data: { requireRatingOnFinalize: next } }, {
      onSuccess: () => toast.success("Configuração salva."),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
    });

  return (
    <div className="max-w-2xl">
      {me?.orgId && (
        <OrgBrandingSection
          orgId={me.orgId}
          orgName={me.orgName ?? ""}
          orgTagline={me.orgTagline ?? ""}
          orgLogoUrl={me.orgLogoUrl ?? null}
          orgColorPrimary={me.orgColorPrimary ?? "#C8D44E"}
          orgColorPrimaryLight={me.orgColorPrimaryLight ?? "#C8D44E"}
          orgColorSidebar={me.orgColorSidebar ?? "#1A3A2E"}
          orgFeedPreviewImageUrl={me.orgFeedPreviewImageUrl ?? null}
          orgFaviconUrl={me.orgFaviconUrl ?? null}
        />
      )}

      <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3 flex items-center gap-1.5">
        <SettingsIcon size={12} /> Operação
      </h2>
      <div className="bg-[#1C1C1C] rounded-lg p-5 flex items-start gap-4">
        <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "rgb(var(--lz-brand-rgb))" }}>
          <Star size={16} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">Exigir avaliação ao finalizar</div>
          <div className="text-[11px] text-white/50 mt-1">
            Ao mudar status de uma tarefa para <span className="text-[rgb(var(--lz-brand-rgb))] font-semibold">Pronto para publicar</span>,
            o responsável é obrigado a dar uma nota de qualidade (1–5 estrelas).
          </div>
        </div>
        <button onClick={() => toggle(!settings.requireRatingOnFinalize)}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            settings.requireRatingOnFinalize ? "bg-[rgb(var(--lz-brand-rgb))]" : "bg-white/15"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            settings.requireRatingOnFinalize ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>

      <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3 mt-8 flex items-center gap-1.5">
        <SettingsIcon size={12} /> Recursos
      </h2>
      <FeatureTogglesSection disabledFeatures={me?.disabledFeatures ?? []} />

      <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3 mt-8 flex items-center gap-1.5">
        <SettingsIcon size={12} /> Ajuda
      </h2>
      <div className="bg-[#1C1C1C] rounded-lg p-5 flex items-center gap-4">
        <div className="flex-1">
          <div className="text-sm font-semibold text-white">Tour guiado do app</div>
          <div className="text-[11px] text-white/50 mt-1">
            Refaça o passo a passo de boas-vindas mostrando as principais áreas da plataforma.
          </div>
        </div>
        <button
          onClick={() => window.dispatchEvent(new Event("lz:start-tour"))}
          className="text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-md text-black"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
        >
          Refazer tour
        </button>
      </div>
    </div>
  );
}

function FeatureTogglesSection({ disabledFeatures }: { disabledFeatures: string[] }) {
  const { updateMyOrg } = useApi();
  const disabledSet = new Set(disabledFeatures);

  function toggle(key: string, hide: boolean) {
    const next = hide
      ? [...disabledSet, key]
      : [...disabledSet].filter((k) => k !== key);
    updateMyOrg.mutate({ data: { disabledFeatures: next } }, {
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
    });
  }

  return (
    <div className="bg-[#1C1C1C] rounded-lg divide-y divide-white/[0.06]">
      {OPTIONAL_FEATURE_KEYS.map((key) => {
        const meta = OPTIONAL_FEATURE_LABEL[key];
        const visible = !disabledSet.has(key);
        return (
          <div key={key} className="p-5 flex items-start gap-4">
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{meta.label}</div>
              <div className="text-[11px] text-white/50 mt-1">{meta.description}</div>
            </div>
            <button onClick={() => toggle(key, visible)}
              className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
                visible ? "bg-[rgb(var(--lz-brand-rgb))]" : "bg-white/15"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
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
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-[rgb(var(--lz-brand-rgb))]" : "bg-white/15"}`} />
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
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
    });
  }

  function toggleMembersEditorFormat(on: boolean) {
    updateMyOrg.mutate({ data: { membersCanSetEditorFormat: on } }, {
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
    });
  }

  return (
    <div>
      <div className="bg-[#1C1C1C] rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-white/40">
          <div className="flex-1">Capacidade</div>
          <div className="w-14 text-center shrink-0">Membro</div>
          <div className="w-14 text-center shrink-0">Setor</div>
          <div className="w-14 text-center shrink-0">Master</div>
        </div>
        {FIXED_CAPABILITIES.map((row) => (
          <div key={row.label} className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] last:border-b-0">
            <div className="flex-1 text-[12.5px] text-white/70">{row.label}</div>
            <CapabilityDot on={row.member} />
            <CapabilityDot on={row.setor} />
            <CapabilityDot on={row.master} />
          </div>
        ))}
        {SETOR_PERMISSION_KEYS.map((key) => {
          const meta = SETOR_PERMISSION_LABEL[key];
          const on = granted.has(key);
          return (
            <div key={key} className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] last:border-b-0">
              <div className="flex-1">
                <div className="text-[12.5px] text-white/70">{meta.label}</div>
                <div className="text-[10.5px] text-white/35 mt-0.5">{meta.description}</div>
              </div>
              <CapabilityDot on={false} />
              <div className="w-14 flex justify-center shrink-0">
                <button onClick={() => toggle(key, !on)}
                  className={`relative h-5 w-9 rounded-full transition-colors shrink-0 ${on ? "bg-[rgb(var(--lz-brand-rgb))]" : "bg-white/15"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
                </button>
              </div>
              <CapabilityDot on={true} />
            </div>
          );
        })}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] last:border-b-0">
          <div className="flex-1">
            <div className="text-[12.5px] text-white/70">Escolher editor e formato (posts/reels)</div>
            <div className="text-[10.5px] text-white/35 mt-0.5">Se atribuir como editor e definir o tipo de vídeo (reel) ou formato (post), sem precisar de um admin.</div>
          </div>
          <div className="w-14 flex justify-center shrink-0">
            <button onClick={() => toggleMembersEditorFormat(!membersEditorFormat)}
              className={`relative h-5 w-9 rounded-full transition-colors shrink-0 ${membersEditorFormat ? "bg-[rgb(var(--lz-brand-rgb))]" : "bg-white/15"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${membersEditorFormat ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </div>
          <CapabilityDot on={true} />
          <CapabilityDot on={true} />
        </div>
      </div>
      <p className="text-[11px] text-white/30 mt-3">
        O Adm Master sempre tem acesso total e não pode ser restringido. As permissões configuráveis acima valem pra
        todo mundo com a função Adm Setor nesta agência.
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
        <span className="h-8 w-8 rounded-md border border-white/10 shrink-0" style={{ backgroundColor: isValidHex(hexInput) ? hexInput : "transparent" }} />
        <input value={hexInput} onChange={(e) => setHexInput(e.target.value)}
          onBlur={() => { if (isValidHex(hexInput)) onChange(hexInput.trim()); else setHexInput(value); }}
          maxLength={7} className="lz-input font-mono" placeholder="#C8D44E" />
      </div>
    </Field>
  );
}

function UsageBar({ label, used, max, pct }: { label: string; used: number; max: number | null; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-white/60 mb-1">
        <span>{label}</span>
        <span>{used}{max != null ? ` / ${max}` : " (ilimitado)"}</span>
      </div>
      {max != null && (
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pct >= 100 ? "#FF6B6B" : "rgb(var(--lz-brand-rgb))" }} />
        </div>
      )}
    </div>
  );
}

function SubscriptionSettings() {
  const me = useMe().data;
  if (!me?.orgId) return <div className="text-white/40 text-sm">Carregando…</div>;
  return (
    <div className="max-w-2xl">
      <PlanUsageSection />
    </div>
  );
}

const SUBSCRIPTION_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active: { label: "Assinatura ativa", color: "#4ADE80" },
  past_due: { label: "Pagamento atrasado", color: "#FF6B6B" },
  canceled: { label: "Cancelada", color: "#FF6B6B" },
};

function PlanUsageSection() {
  const { data: status, isLoading } = useQuery(orgPlanStatusQO());
  const { data: plans } = useQuery(plansQO());
  const { updateMyOrg, subscribeToPlan } = useApi();
  const [taxId, setTaxId] = useState("");

  useEffect(() => { if (status?.taxId) setTaxId(status.taxId); }, [status?.taxId]);

  if (isLoading || !status) return null;

  const clientsPct = status.maxClients ? Math.min(100, Math.round((status.clientsUsed / status.maxClients) * 100)) : 0;
  const collabPct = status.maxCollaborators ? Math.min(100, Math.round((status.collaboratorsUsed / status.maxCollaborators) * 100)) : 0;
  const priceLabel = status.priceCents != null
    ? `R$ ${(status.priceCents / 100).toFixed(2).replace(".", ",")}/mês`
    : "Sob consulta";
  const trialDaysLeft = status.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(status.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : null;
  const statusInfo = SUBSCRIPTION_STATUS_LABEL[status.subscriptionStatus];

  function saveTaxId() {
    const digits = taxId.replace(/\D/g, "");
    updateMyOrg.mutate({ data: { taxId: digits || null } }, {
      onSuccess: () => toast.success("CNPJ/CPF salvo."),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
    });
  }

  function subscribe(planId: string) {
    subscribeToPlan.mutate({ data: { planId } }, {
      onSuccess: (r: any) => {
        toast.success("Assinatura criada! Abrindo a fatura para pagamento…");
        if (r?.invoiceUrl) window.open(r.invoiceUrl, "_blank");
      },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao assinar o plano."),
    });
  }

  return (
    <>
      <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3 flex items-center gap-1.5">
        <Star size={12} /> Seu plano
      </h2>
      <div className="bg-[#1C1C1C] rounded-lg p-5 mb-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-white">{status.planName}</div>
            <div className="text-[11px] text-white/50">{priceLabel}</div>
          </div>
          {status.subscriptionStatus === "trialing" && trialDaysLeft !== null ? (
            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded"
              style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "rgb(var(--lz-brand-rgb))" }}>
              {trialDaysLeft > 0 ? `${trialDaysLeft} dias de teste` : "Teste expirado"}
            </span>
          ) : statusInfo ? (
            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded"
              style={{ backgroundColor: `${statusInfo.color}26`, color: statusInfo.color }}>
              {statusInfo.label}
            </span>
          ) : null}
        </div>
        <UsageBar label="Clientes ativos" used={status.clientsUsed} max={status.maxClients} pct={clientsPct} />
        <UsageBar label="Colaboradores" used={status.collaboratorsUsed} max={status.maxCollaborators} pct={collabPct} />
      </div>

      <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3 flex items-center gap-1.5">
        <Star size={12} /> Assinatura e cobrança
      </h2>
      <div className="bg-[#1C1C1C] rounded-lg p-5 mb-8 space-y-4">
        <Field label="CNPJ ou CPF da agência (necessário para assinar um plano)">
          <div className="flex gap-2">
            <input value={taxId} onChange={(e) => setTaxId(e.target.value)} maxLength={18} className="lz-input"
              placeholder="Somente números" />
            <button onClick={saveTaxId} disabled={updateMyOrg.isPending}
              className="lz-btn-ghost text-xs px-4 py-2 rounded-md whitespace-nowrap disabled:opacity-50">
              {updateMyOrg.isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </Field>

        <div className="space-y-2 pt-2 border-t border-white/[0.06]">
          {(plans ?? []).map((plan) => (
            <div key={plan.id} className="flex items-center justify-between bg-black/20 rounded-md px-3 py-2.5">
              <div>
                <div className="text-sm text-white font-semibold">{plan.name}</div>
                <div className="text-[11px] text-white/50">
                  {plan.priceCents != null ? `R$ ${(plan.priceCents / 100).toFixed(2).replace(".", ",")}/mês` : "Sob consulta"}
                  {" · "}até {plan.maxClients} clientes · até {plan.maxCollaborators} colaboradores
                </div>
              </div>
              {plan.id === status.planId && status.hasAsaasSubscription ? (
                <span className="text-[10px] uppercase font-bold text-white/40 px-2">Plano atual</span>
              ) : plan.priceCents == null ? (
                <a href="https://wa.me/" target="_blank" rel="noreferrer"
                  className="lz-btn-ghost text-xs px-3 py-1.5 rounded-md whitespace-nowrap">Fale conosco</a>
              ) : (
                <button onClick={() => subscribe(plan.id)} disabled={subscribeToPlan.isPending}
                  className="lz-btn-primary text-xs px-3 py-1.5 rounded-md whitespace-nowrap disabled:opacity-50">
                  {subscribeToPlan.isPending ? "Aguarde…" : "Assinar"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function OrgBrandingSection({
  orgId, orgName, orgTagline, orgLogoUrl, orgColorPrimary, orgColorPrimaryLight, orgColorSidebar,
  orgFeedPreviewImageUrl, orgFaviconUrl,
}: {
  orgId: string; orgName: string; orgTagline: string; orgLogoUrl: string | null;
  orgColorPrimary: string; orgColorPrimaryLight: string; orgColorSidebar: string;
  orgFeedPreviewImageUrl: string | null; orgFaviconUrl: string | null;
}) {
  const { updateMyOrg } = useApi();
  const [name, setName] = useState(orgName);
  const [tagline, setTagline] = useState(orgTagline);
  const [colorPrimary, setColorPrimary] = useState(orgColorPrimary);
  const [colorPrimaryLight, setColorPrimaryLight] = useState(orgColorPrimaryLight);
  const [colorSidebar, setColorSidebar] = useState(orgColorSidebar);
  const [uploading, setUploading] = useState(false);
  const [uploadingPreview, setUploadingPreview] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  useEffect(() => { setName(orgName); }, [orgName]);
  useEffect(() => { setTagline(orgTagline); }, [orgTagline]);
  useEffect(() => { setColorPrimary(orgColorPrimary); }, [orgColorPrimary]);
  useEffect(() => { setColorPrimaryLight(orgColorPrimaryLight); }, [orgColorPrimaryLight]);
  useEffect(() => { setColorSidebar(orgColorSidebar); }, [orgColorSidebar]);

  function save() {
    updateMyOrg.mutate({
      data: {
        name: name.trim(),
        tagline: tagline.trim() || null,
        colorPrimary: colorPrimary || null,
        colorPrimaryLight: colorPrimaryLight || null,
        colorSidebar: colorSidebar || null,
      },
    }, {
      onSuccess: () => toast.success("Marca da agência atualizada."),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
    });
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
      toast.error(e?.message ?? "Erro ao enviar a logo.");
    } finally {
      setUploading(false);
    }
  }

  function removeLogo() {
    updateMyOrg.mutate({ data: { logoPath: null } }, {
      onSuccess: () => toast.success("Logo removida."),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
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
      toast.error(e?.message ?? "Erro ao enviar a imagem.");
    } finally {
      setUploadingPreview(false);
    }
  }

  function resetFeedPreviewImage() {
    updateMyOrg.mutate({ data: { feedPreviewImagePath: null } }, {
      onSuccess: () => toast.success("Voltou pra imagem padrão do Modo Criador."),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
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
      toast.error(e?.message ?? "Erro ao enviar o ícone.");
    } finally {
      setUploadingFavicon(false);
    }
  }

  function resetFavicon() {
    updateMyOrg.mutate({ data: { faviconPath: null } }, {
      onSuccess: () => toast.success("Voltou pro ícone padrão do Modo Criador."),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
    });
  }

  return (
    <>
      <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3 flex items-center gap-1.5">
        <Star size={12} /> Marca da agência
      </h2>
      <div className="bg-[#1C1C1C] rounded-lg p-5 mb-8 space-y-4">
        <p className="text-[11px] text-white/50 leading-relaxed">
          Aparece na barra lateral e no título da aba, depois que sua equipe faz login.
          A tela de login em si continua igual pra todas as agências.
        </p>

        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-md bg-black/30 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
            {orgLogoUrl ? (
              <img src={orgLogoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-[10px] text-white/30 text-center px-1">Sem logo</span>
            )}
          </div>
          <div className="flex gap-2">
            <label className="lz-btn-ghost text-xs px-4 py-2 rounded-md cursor-pointer disabled:opacity-50">
              {uploading ? "Enviando…" : "Enviar logo"}
              <input type="file" accept="image/*" className="hidden" onChange={pickLogo} disabled={uploading} />
            </label>
            {orgLogoUrl && (
              <button onClick={removeLogo} disabled={updateMyOrg.isPending}
                className="text-[11px] text-white/50 hover:text-red-400 transition disabled:opacity-50">
                Remover
              </button>
            )}
          </div>
        </div>

        <Field label="Nome da agência">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="lz-input" />
        </Field>
        <Field label="Slogan (opcional)">
          <input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={120} className="lz-input"
            placeholder="Ex: Conteúdo que conecta" />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/[0.06]">
          <ColorPickerField label="Cor principal" value={colorPrimary} onChange={setColorPrimary} presets={BRAND_PRESETS} />
          <ColorPickerField label="Cor clara (fundos suaves)" value={colorPrimaryLight} onChange={setColorPrimaryLight} presets={BRAND_LIGHT_PRESETS} />
          <ColorPickerField label="Cor da barra lateral" value={colorSidebar} onChange={setColorSidebar} presets={SIDEBAR_PRESETS} />
        </div>

        <button onClick={save} disabled={updateMyOrg.isPending || !name.trim()}
          className="lz-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-50">
          {updateMyOrg.isPending ? "Salvando…" : "Salvar"}
        </button>
      </div>

      <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3 flex items-center gap-1.5">
        <Star size={12} /> Preview de feed
      </h2>
      <div className="bg-[#1C1C1C] rounded-lg p-5 mb-8 space-y-4">
        <p className="text-[11px] text-white/50 leading-relaxed">
          Imagem que aparece quando você manda o link de preview do feed pro cliente (WhatsApp, etc).
          Por padrão é a imagem do Modo Criador — troque pra aparecer uma imagem da sua agência.
        </p>

        <div className="rounded-md overflow-hidden bg-black/30 border border-white/10 max-w-sm">
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
              className="text-[11px] text-white/50 hover:text-red-400 transition disabled:opacity-50">
              Voltar pra imagem padrão
            </button>
          )}
        </div>
        <p className="text-[11px] text-white/35">
          Tamanho recomendado: 1200 x 630px (formato horizontal) · até 3 MB.
        </p>
      </div>

      <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3 flex items-center gap-1.5">
        <Star size={12} /> Ícone (favicon)
      </h2>
      <div className="bg-[#1C1C1C] rounded-lg p-5 mb-8 space-y-4">
        <p className="text-[11px] text-white/50 leading-relaxed">
          Ícone que aparece na aba do navegador, e como ícone do app quando alguém adiciona o
          Modo Criador à tela inicial pelo iPhone. Por padrão é o ícone do Modo Criador.
        </p>

        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-md bg-black/30 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
            <img src={orgFaviconUrl ?? "/icon-192.png"} alt="Ícone" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="flex gap-2">
            <label className="lz-btn-ghost text-xs px-4 py-2 rounded-md cursor-pointer disabled:opacity-50">
              {uploadingFavicon ? "Enviando…" : "Enviar ícone"}
              <input type="file" accept="image/*" className="hidden" onChange={pickFavicon} disabled={uploadingFavicon} />
            </label>
            {orgFaviconUrl && (
              <button onClick={resetFavicon} disabled={updateMyOrg.isPending}
                className="text-[11px] text-white/50 hover:text-red-400 transition disabled:opacity-50">
                Voltar pro ícone padrão
              </button>
            )}
          </div>
        </div>
        <p className="text-[11px] text-white/35">
          Tamanho recomendado: 512 x 512px (PNG, quadrado, fundo sólido) · até 3 MB.
        </p>
      </div>
    </>
  );
}