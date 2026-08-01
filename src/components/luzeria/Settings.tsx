import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { profilesQO, useApi, useMe, appSettingsQO } from "@/lib/luzeria/queries";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "./Avatar";
import type { Role } from "@/lib/luzeria/types";
import { roleLabel } from "./Sidebar";
import { useUI } from "@/lib/luzeria/ui-store";
import { toast } from "sonner";
import { UserPlus, X, Settings as SettingsIcon, Star, KeyRound, Building2 } from "lucide-react";
import { ReportsTab } from "./ReportsTab";
import { DriveSettingsTab } from "./DriveSettingsTab";
import { MemberGoalsTab } from "./MemberGoalsTab";
import { AutomationsTab } from "./AutomationsTab";

export function SettingsPage() {
  const me = useMe().data;
  const { data: profiles = [] } = useQuery(profilesQO());
  const { setUserRole, setUserActive, deleteUser, adminCreateUser, adminSendPasswordReset, createAgency } = useApi();
  const { setViewAs } = useUI();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [creatingAgency, setCreatingAgency] = useState(false);
  const [tab, setTab] = useState<"team" | "report" | "goals" | "drive" | "automations" | "general">("team");

  if (me?.role !== "master") {
    return <div className="p-10 text-white/60 text-sm">Acesso restrito ao Administrador Master.</div>;
  }

  const pending = profiles.filter((p) => !p.active);
  const active = profiles.filter((p) => p.active);

  const handleRemove = (id: string, name: string) => {
    if (!confirm(`Remover ${name}? Esta ação é permanente.`)) return;
    deleteUser.mutate({ data: { userId: id } }, {
      onSuccess: () => toast.success("Colaborador removido."),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
    });
  };

  const handleResetPassword = (id: string, name: string, email: string) => {
    if (!confirm(`Enviar link de redefinição de senha para ${name} (${email})?`)) return;
    adminSendPasswordReset.mutate({ data: { userId: id } }, {
      onSuccess: (res: any) => toast.success(`Email enviado para ${res?.email ?? email}.`),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao enviar email"),
    });
  };

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[32px] font-bold text-white tracking-tight">Configurações</h1>
          <p className="text-sm text-white/50 mt-2">
            {tab === "team"   ? "Gerencie acessos e funções da equipe." :
             tab === "goals"  ? "Defina a meta mensal de cada colaborador." :
             tab === "report" ? "Relatório consolidado de entregas." :
             tab === "drive"  ? "Integração com Google Drive." :
             tab === "automations" ? "Lembretes automáticos e jobs do sistema." :
             "Ajustes gerais da operação."}
          </p>
        </div>
        {tab === "team" && (
          <div className="flex items-center gap-2">
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
      </div>

      <div className="flex items-center gap-1 border-b border-white/10 mb-8">
        {[
          { id: "team", label: "Equipe" },
          { id: "goals", label: "Metas" },
          { id: "report", label: "Relatório" },
          { id: "drive", label: "Drive" },
          { id: "automations", label: "Automações" },
          { id: "general", label: "Geral" },
        ].map((t) => {
          const active = tab === (t.id as any);
          return (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors -mb-px border-b-2"
              style={{
                color: active ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.5)",
                borderColor: active ? "rgb(var(--lz-brand-rgb))" : "transparent",
              }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "general" ? <GeneralSettings /> :
       tab === "goals" ? <MemberGoalsTab /> :
       tab === "drive" ? <DriveSettingsTab /> :
       tab === "automations" ? <AutomationsTab /> :
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
      <div className="bg-[#1C1C1C] rounded-lg overflow-hidden">
        {active.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05] last:border-b-0">
            <Avatar profile={p} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{p.name}</div>
              <div className="text-[11px] text-white/40 truncate">{p.email}</div>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "rgb(var(--lz-brand-rgb))" }}>
              {roleLabel(p.role)}
            </span>
            <select value={p.role} disabled={p.id === me.id}
              onChange={(e) => setUserRole.mutate({ data: { userId: p.id, role: e.target.value as Role } })}
              className="bg-[#0D0D0D] border border-white/10 text-xs text-white rounded-md px-2 py-1 outline-none focus:border-[rgb(var(--lz-brand-rgb))] disabled:opacity-40">
              <option value="member">Membro</option>
              <option value="setor">Adm Setor</option>
              <option value="master">Adm Master</option>
            </select>
            <label className="flex items-center gap-1.5 text-[11px] text-white/60">
              <input type="checkbox" checked={p.active} disabled={p.id === me.id}
                onChange={(e) => setUserActive.mutate({ data: { userId: p.id, active: e.target.checked } })} />
              Ativo
            </label>
            <button onClick={() => { setViewAs(p.id); navigate({ to: "/minhas-tarefas" }); }}
              className="text-[11px] text-white/60 hover:text-[rgb(var(--lz-brand-rgb))] transition">Ver demandas</button>
            <button onClick={() => handleResetPassword(p.id, p.name, p.email)}
              disabled={adminSendPasswordReset.isPending}
              title="Enviar link de redefinição de senha por email"
              className="text-[11px] text-white/60 hover:text-[rgb(var(--lz-brand-rgb))] transition inline-flex items-center gap-1 disabled:opacity-40">
              <KeyRound size={12} /> Resetar senha
            </button>
            <button onClick={() => handleRemove(p.id, p.name)} disabled={p.id === me.id}
              className="text-[11px] text-white/40 hover:text-red-400 transition disabled:opacity-30 disabled:cursor-not-allowed">
              Remover
            </button>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-white/30 mt-4">
        Novos cadastros ficam pendentes até a aprovação de um Administrador Master. E-mails pré-cadastrados na equipe inicial entram já aprovados com a função correta.
      </p>

      <div className="mt-8 pt-6 border-t border-white/[0.06]">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[rgb(var(--lz-brand-rgb))] mb-4">
          Diferença entre funções
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#1C1C1C] rounded-lg p-4">
            <div className="text-xs font-semibold text-white mb-2">Adm Master</div>
            <div className="text-[11px] text-white/60 leading-relaxed">
              Acesso total. Gerencia equipe (aprovar, criar, remover), define metas, configura Drive,
              vê relatórios, dashboard completo e demandas de qualquer colaborador.
            </div>
          </div>
          <div className="bg-[#1C1C1C] rounded-lg p-4">
            <div className="text-xs font-semibold text-white mb-2">Adm Setor</div>
            <div className="text-[11px] text-white/60 leading-relaxed">
              Gestão operacional. Cria e edita clientes, posts, reels e avulsos, atribui responsáveis
              e acompanha o dashboard. Não gerencia equipe nem configurações sensíveis.
            </div>
          </div>
          <div className="bg-[#1C1C1C] rounded-lg p-4">
            <div className="text-xs font-semibold text-white mb-2">Membro</div>
            <div className="text-[11px] text-white/60 leading-relaxed">
              Executa as próprias demandas. Vê "Minhas Demandas", atualiza status, comenta, anexa
              arquivos e acompanha sua meta pessoal. Não edita clientes nem outros colaboradores.
            </div>
          </div>
        </div>
      </div>
        </>
      )}

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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-[#1A1A1A] rounded-xl p-7"
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-[#1A1A1A] rounded-xl p-7"
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
      {!me?.isPlatformAdmin && me?.orgId && (
        <OrgBrandingSection
          orgId={me.orgId}
          orgName={me.orgName ?? ""}
          orgTagline={me.orgTagline ?? ""}
          orgLogoUrl={me.orgLogoUrl ?? null}
          orgColorPrimary={me.orgColorPrimary ?? "#C8D44E"}
          orgColorPrimaryLight={me.orgColorPrimaryLight ?? "#C8D44E"}
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
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            settings.requireRatingOnFinalize ? "translate-x-[22px]" : "translate-x-0.5"}`} />
        </button>
      </div>

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

const MAX_LOGO_BYTES = 3 * 1024 * 1024;

const BRAND_PRESETS = [
  "#C8D44E", "#4A9EFF", "#FF8C42", "#FF6B6B", "#A855F7", "#10B981", "#EC4899", "#F5A623",
];
const BRAND_LIGHT_PRESETS = [
  "#C8D44E", "#8FD1FF", "#FFC08A", "#FFAFAF", "#D4AFFF", "#7EEAC4", "#FFAFDA", "#FFD98A",
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

function OrgBrandingSection({ orgId, orgName, orgTagline, orgLogoUrl, orgColorPrimary, orgColorPrimaryLight }: {
  orgId: string; orgName: string; orgTagline: string; orgLogoUrl: string | null;
  orgColorPrimary: string; orgColorPrimaryLight: string;
}) {
  const { updateMyOrg } = useApi();
  const [name, setName] = useState(orgName);
  const [tagline, setTagline] = useState(orgTagline);
  const [colorPrimary, setColorPrimary] = useState(orgColorPrimary);
  const [colorPrimaryLight, setColorPrimaryLight] = useState(orgColorPrimaryLight);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { setName(orgName); }, [orgName]);
  useEffect(() => { setTagline(orgTagline); }, [orgTagline]);
  useEffect(() => { setColorPrimary(orgColorPrimary); }, [orgColorPrimary]);
  useEffect(() => { setColorPrimaryLight(orgColorPrimaryLight); }, [orgColorPrimaryLight]);

  function save() {
    updateMyOrg.mutate({
      data: {
        name: name.trim(),
        tagline: tagline.trim() || null,
        colorPrimary: colorPrimary || null,
        colorPrimaryLight: colorPrimaryLight || null,
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

  return (
    <>
      <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3 flex items-center gap-1.5">
        <Star size={12} /> Marca da agência
      </h2>
      <div className="bg-[#1C1C1C] rounded-lg p-5 mb-8 space-y-4">
        <p className="text-[11px] text-white/50 leading-relaxed">
          Aparece no lugar de "Luzeria" na barra lateral e no título da aba, depois que sua equipe faz login.
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
        </div>

        <button onClick={save} disabled={updateMyOrg.isPending || !name.trim()}
          className="lz-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-50">
          {updateMyOrg.isPending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </>
  );
}