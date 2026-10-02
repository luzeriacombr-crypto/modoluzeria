import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { KeyRound, ListChecks, Trash2, Mail, Briefcase, Camera } from "lucide-react";
import {
  WEEK_DAYS, WEEK_DAY_LABEL, defaultWorkSchedule, computeMonthlyHourlyCost,
  type Profile, type Role, type WorkSchedule,
} from "@/lib/luzeria/types";
import { useApi, useMe, memberPayQO, cargosQO, clientsQO } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { Avatar } from "./Avatar";
import { Modal } from "./Modals";
import { PasswordInput } from "./PasswordInput";
import { showAvatarError, uploadAvatar } from "./AvatarEditor";
import { ImageCropModal } from "./ImageCropModal";
import { InfoTip } from "./InfoTip";
import { glassCardStyle } from "@/lib/luzeria/utils";
import { isHouse } from "@/lib/luzeria/house";
import { requestConfirm } from "@/lib/luzeria/confirm-store";

const money = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ROLE_LABEL: Record<Role, string> = {
  master: "Adm Master",
  setor: "Adm Setor",
  member: "Membro",
};

// Cada Função com sua própria cor — antes as três usavam o mesmo verde da
// marca (só Membro ficava "apagado" por estar inativo), difícil de
// diferenciar o nível de acesso num olhar rápido pelo quadro. Auditoria
// visual + pedido do Junior (02/10).
const ROLE_COLOR: Record<Role, { bg: string; color: string }> = {
  member: { bg: "rgba(138,141,145,0.16)", color: "#C7C9CC" },
  setor: { bg: "rgba(74,158,255,0.16)", color: "#8FC2FF" },
  master: { bg: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" },
};

/** "6 anos, 11 meses e 12 dias" a partir da data de entrada (aaaa-mm-dd). */
export function tenureDetailed(joinedAt: string | null | undefined): string | null {
  if (!joinedAt) return null;
  const [y, m, d] = joinedAt.split("-").map(Number);
  if (!y || !m || !d) return null;
  const now = new Date();
  let years = now.getFullYear() - y;
  let months = now.getMonth() + 1 - m;
  let days = now.getDate() - d;
  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); // dias do mês anterior
  }
  if (months < 0) { years -= 1; months += 12; }
  if (years < 0) return null;
  const parts = [
    years ? `${years} ${years === 1 ? "ano" : "anos"}` : "",
    months ? `${months} ${months === 1 ? "mês" : "meses"}` : "",
    days ? `${days} ${days === 1 ? "dia" : "dias"}` : "",
  ].filter(Boolean);
  if (parts.length === 0) return "hoje é o primeiro dia";
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

/** "há 8 meses" / "há 1 ano e 2 meses" a partir da data de entrada. */
export function tenureLabel(joinedAt: string | null | undefined, house = false): string | null {
  if (!joinedAt) return null;
  const [y, m, d] = joinedAt.split("-").map(Number);
  const now = new Date();
  let months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (now.getDate() < d) months -= 1;
  if (months < 0) return null;
  if (months < 1) return "entrou este mês";
  const years = Math.floor(months / 12), rest = months % 12;
  const yp = years ? `${years} ${years === 1 ? "ano" : "anos"}` : "";
  const mp = rest ? `${rest} ${rest === 1 ? "mês" : "meses"}` : "";
  return `na ${house ? "house" : "agência"} há ${[yp, mp].filter(Boolean).join(" e ")}`;
}

const EASE = { transitionTimingFunction: "var(--ease-premium)" as const };

export function TeamMemberCard({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  const house = isHouse(useMe().data);
  const { data: cargos = [] } = useQuery(cargosQO());
  const cargoNames = (profile.cargoIds ?? [])
    .map((id) => cargos.find((c) => c.id === id)?.name)
    .filter(Boolean)
    .join(", ");
  const roleStyle = ROLE_COLOR[profile.role];
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex flex-col gap-3.5 p-[18px] rounded-2xl border border-foreground/8 bg-card text-left hover:border-foreground/20 hover:-translate-y-0.5 transition-all duration-200"
        style={EASE}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="relative shrink-0">
            <Avatar profile={profile} size={48} />
            {!profile.active && (
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-card flex items-center justify-center">
                <span className="h-2 w-2 rounded-full bg-foreground/30" />
              </span>
            )}
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide"
            style={profile.active
              ? { backgroundColor: roleStyle.bg, color: roleStyle.color, boxShadow: `inset 0 0 0 1px ${roleStyle.color}33` }
              : { backgroundColor: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 40%, transparent)" }}
          >
            {ROLE_LABEL[profile.role]}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-bold text-foreground truncate">{profile.name}</div>
          <div className="text-[12px] text-foreground/40 truncate mt-0.5 flex items-center gap-1.5">
            <Briefcase size={11} className="shrink-0" />
            {cargoNames || "Sem cargo definido"}
          </div>
        </div>
        <div className="h-px bg-foreground/6" />
        <div className="text-[11px] text-foreground/35 group-hover:text-foreground/60 transition-colors">{tenureLabel(profile.joinedAt, house) ?? "Clique pra editar"}</div>
      </button>
      {open && <TeamMemberModal profile={profile} onClose={() => setOpen(false)} />}
    </>
  );
}

function TeamMemberModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const me = useMe().data;
  const house = isHouse(me);
  const { setUserRole, setUserActive, setExcludeFromRanking, setHideGoalsWidget, deleteUser, adminSendPasswordReset, adminResendWelcomeEmail, adminSetUserPassword, adminUpdateMemberAvatar, setMemberPay, setProfileCargos, setProfileClientAccess, setMemberJoinedAt } = useApi();
  const { data: cargos = [] } = useQuery(cargosQO());
  const [selectedCargoIds, setSelectedCargoIds] = useState<string[]>(profile.cargoIds ?? []);
  useEffect(() => { setSelectedCargoIds(profile.cargoIds ?? []); }, [profile.cargoIds]);

  // Um cargo só por pessoa na tela (pedido do Junior, 02/10) — escolher aqui
  // substitui qualquer outro que a pessoa já tivesse.
  function pickCargo(cargoId: string) {
    const next = cargoId ? [cargoId] : [];
    setSelectedCargoIds(next);
    setProfileCargos.mutate({ data: { profileId: profile.id, cargoIds: next } }, {
      onSuccess: () => toast.success("Cargo atualizado."),
    });
  }

  const { data: allClients = [] } = useQuery(clientsQO());
  const [clientRestricted, setClientRestricted] = useState(profile.clientAccessRestricted ?? false);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(profile.clientAccessIds ?? []);
  const [clientSearch, setClientSearch] = useState("");
  useEffect(() => {
    setClientRestricted(profile.clientAccessRestricted ?? false);
    setSelectedClientIds(profile.clientAccessIds ?? []);
  }, [profile.clientAccessRestricted, profile.clientAccessIds]);

  function saveClientAccess(restricted: boolean, clientIds: string[]) {
    setProfileClientAccess.mutate({ data: { profileId: profile.id, restricted, clientIds } });
  }
  function toggleClientRestricted() {
    const next = !clientRestricted;
    setClientRestricted(next);
    saveClientAccess(next, selectedClientIds);
  }
  function toggleClientAccess(clientId: string) {
    const next = selectedClientIds.includes(clientId)
      ? selectedClientIds.filter((id) => id !== clientId)
      : [...selectedClientIds, clientId];
    setSelectedClientIds(next);
    saveClientAccess(clientRestricted, next);
  }
  const { setViewAs } = useUI();
  const navigate = useNavigate();
  const isSelf = profile.id === me?.id;
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [showPasswordField, setShowPasswordField] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [joinedDraft, setJoinedDraft] = useState(profile.joinedAt ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const [newPassword, setNewPassword] = useState("");

  const { data: payList } = useQuery(memberPayQO());
  const pay = payList?.find((p) => p.userId === profile.id);
  const [salary, setSalary] = useState<string>("");
  const [schedule, setSchedule] = useState<WorkSchedule>(defaultWorkSchedule());
  useEffect(() => {
    setSalary(pay?.monthlySalary != null ? String(pay.monthlySalary) : "");
    setSchedule(pay?.workSchedule ?? defaultWorkSchedule());
  }, [pay?.monthlySalary, pay?.workSchedule]);
  const previewHourlyCost = computeMonthlyHourlyCost(salary.trim() ? Number(salary) : null, schedule);

  function savePay() {
    setMemberPay.mutate({
      data: { userId: profile.id, monthlySalary: salary.trim() ? Number(salary) : null, workSchedule: schedule },
    }, {
      onSuccess: () => toast.success("Remuneração salva."),
      onError: (e: any) => toastFriendlyError(e, "Erro ao salvar remuneração"),
    });
  }

  async function onPickFile(file: File) {
    setUploading(true);
    try {
      const path = await uploadAvatar(file, profile.id);
      setAvatarPreview(URL.createObjectURL(file));
      adminUpdateMemberAvatar.mutate({ data: { userId: profile.id, avatarPath: path } }, {
        onError: (e: any) => toastFriendlyError(e, "Erro ao salvar foto"),
      });
    } catch (e) { showAvatarError(e); }
    finally { setUploading(false); }
  }

  function onRemovePhoto() {
    setAvatarPreview(null);
    adminUpdateMemberAvatar.mutate({ data: { userId: profile.id, avatarPath: null } }, {
      onError: (e: any) => toastFriendlyError(e, "Erro ao remover foto"),
    });
  }

  async function handleResetPassword() {
    if (!(await requestConfirm(`Enviar link de redefinição de senha para ${profile.name} (${profile.email})?`))) return;
    adminSendPasswordReset.mutate({ data: { userId: profile.id } }, {
      onSuccess: (res: any) => toast.success(`Email enviado para ${res?.email ?? profile.email}.`),
      onError: (e: any) => toastFriendlyError(e, "Erro ao enviar email"),
    });
  }

  async function handleResendWelcomeEmail() {
    if (!(await requestConfirm(`Reenviar o e-mail de boas-vindas pra ${profile.name} (${profile.email})?`))) return;
    adminResendWelcomeEmail.mutate({ data: { userId: profile.id } }, {
      onSuccess: (res: any) => toast.success(`E-mail de boas-vindas reenviado pra ${res?.email ?? profile.email}.`),
      onError: (e: any) => toastFriendlyError(e, "Erro ao reenviar e-mail"),
    });
  }

  function handleSetPassword() {
    if (newPassword.length < 8) { toast.error("A senha precisa ter pelo menos 8 caracteres."); return; }
    adminSetUserPassword.mutate({ data: { userId: profile.id, password: newPassword } }, {
      onSuccess: () => {
        toast.success(`Senha de ${profile.name} atualizada.`);
        setNewPassword("");
        setShowPasswordField(false);
      },
      onError: (e: any) => toastFriendlyError(e, "Erro ao definir senha"),
    });
  }

  async function handleRemove() {
    if (!(await requestConfirm(`Remover ${profile.name}? Esta ação é permanente.`, { danger: true }))) return;
    deleteUser.mutate({ data: { userId: profile.id } }, {
      onSuccess: () => { toast.success("Colaborador removido."); onClose(); },
      onError: (e: any) => toastFriendlyError(e, "Erro ao remover"),
    });
  }

  const currentCargo = cargos.find((c) => c.id === selectedCargoIds[0]);
  const roleStyle = ROLE_COLOR[profile.role];
  const tenure = tenureLabel(profile.joinedAt, house);
  const card = "rounded-2xl border border-foreground/8 bg-foreground/[0.02] p-4";
  const label = "flex items-center gap-1 text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5";
  const field = "w-full bg-background border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <Modal open onClose={onClose} title="Perfil do membro" maxWidthClass="max-w-3xl">
      {/* Cabeçalho: foto + nome + função/cargo lado a lado */}
      <div className="flex items-center gap-4 mb-5">
        <div className="relative shrink-0 group">
          <Avatar profile={{ ...profile, avatarUrl: avatarPreview }} size={72} />
          <button type="button" aria-label="Alterar foto" onClick={() => fileRef.current?.click()}
            className="absolute inset-0 rounded-full flex items-center justify-center bg-black/55 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
            <Camera size={20} />
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) setCropFile(f); }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xl font-extrabold text-foreground truncate">{profile.name}</div>
          <div className="text-[12px] text-foreground/40 truncate">{profile.email}</div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide"
              style={{ backgroundColor: roleStyle.bg, color: roleStyle.color }}>{ROLE_LABEL[profile.role]}</span>
            {currentCargo && (
              <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground/55"><Briefcase size={11} /> {currentCargo.name}</span>
            )}
            {tenure && <span className="text-[12px] text-foreground/35">· {tenure}</span>}
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 text-[11.5px]">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="text-foreground/50 hover:text-foreground transition-colors">{uploading ? "Enviando…" : "Trocar foto"}</button>
          {avatarPreview && <button type="button" onClick={onRemovePhoto} className="text-foreground/35 hover:text-red-400 transition-colors">Remover foto</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <section className={card + " space-y-3.5"}>
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-foreground/55">Acesso e cargo</h3>
          <div>
            <label className={label}>
              Função
              <InfoTip text={`Membro: só vê e mexe no que for atribuído a ele. Adm Setor: pode ter permissões extras configuradas por cargo. Adm Master: acesso total à ${house ? "house" : "agência"}.`} />
            </label>
            <select data-tour="member-role-select" value={profile.role} disabled={isSelf}
              onChange={(e) => setUserRole.mutate({ data: { userId: profile.id, role: e.target.value as Role } }, {
                onSuccess: () => toast.success("Função atualizada."),
              })}
              className={field}>
              <option value="member">Membro</option>
              <option value="setor">Adm Setor</option>
              <option value="master">Adm Master</option>
            </select>
          </div>
          {cargos.length > 0 && (
            <div>
              <label className={label}>
                Cargo
                <InfoTip text="A função do dia a dia (Designer, Social Media...). Define permissões extras, ex: Financeiro enxerga a aba de cobrança." />
              </label>
              <select value={selectedCargoIds[0] ?? ""} onChange={(e) => pickCargo(e.target.value)} className={field}>
                <option value="">Sem cargo</option>
                {cargos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {selectedCargoIds.length > 1 && (
                <p className="text-[10.5px] text-foreground/35 mt-1">Essa pessoa tem {selectedCargoIds.length} cargos; escolher um aqui substitui os outros.</p>
              )}
            </div>
          )}
          {me?.role === "master" && (
            <div>
              <label className={label}>
                Entrou na {house ? "house" : "agência"} em
                <InfoTip text="Aparece no card da Equipe e, no dia em que a pessoa completa 1 ano (e a cada aniversário), ela recebe uma mensagem de agradecimento em Minhas Demandas." />
              </label>
              <input type="date" value={joinedDraft}
                onChange={(e) => setJoinedDraft(e.target.value)}
                onBlur={(e) => {
                  const v = e.target.value || null;
                  if (v === (profile.joinedAt ?? null)) return;
                  setMemberJoinedAt.mutate({ data: { userId: profile.id, joinedAt: v } }, { onSuccess: () => toast.success("Data de entrada salva.") });
                }}
                className={field} />
              {tenureDetailed(joinedDraft) && (
                <div className="mt-1.5 text-[12.5px] font-semibold" style={{ color: "var(--lz-accent-ink)" }}>
                  {tenureDetailed(joinedDraft)} de {house ? "house" : "agência"}
                </div>
              )}
            </div>
          )}
        </section>

        <section className={card + " space-y-1"}>
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-foreground/55 mb-2">Preferências</h3>
          <SwitchRow label="Ativo" hint="Desativado, a pessoa não consegue entrar." checked={profile.active} disabled={isSelf}
            onChange={(v) => setUserActive.mutate({ data: { userId: profile.id, active: v } }, { onSuccess: () => toast.success(v ? "Membro ativado." : "Membro desativado.") })} />
          <SwitchRow label="Excluir do ranking" hint="Não conta pontos no ranking de Top Membros." checked={profile.excludeFromRanking ?? false}
            onChange={(v) => setExcludeFromRanking.mutate({ data: { userId: profile.id, excludeFromRanking: v } })} />
          <SwitchRow label="Ocultar barra de metas" hint="Esconde 'Meta do mês' na home de Minhas Demandas dessa pessoa." checked={profile.hideGoalsWidget ?? false}
            onChange={(v) => setHideGoalsWidget.mutate({ data: { userId: profile.id, hideGoalsWidget: v } })} />
        </section>
      </div>

      <section className={card + " mt-3.5"}>
        <label className="flex items-center justify-between gap-3 cursor-pointer" title={house ? "Quando ligado, essa pessoa só enxerga as marcas marcadas abaixo" : "Quando ligado, essa pessoa só enxerga os clientes marcados abaixo"}>
          <div>
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-foreground/55">{house ? "Restringir a marcas específicas" : "Restringir a clientes específicos"}</h3>
            <p className="text-[11.5px] text-foreground/40 mt-0.5">{house ? "Ex.: só a Doctor Fit." : "A pessoa só vê (em qualquer lugar do app) os clientes marcados."}</p>
          </div>
          <Switch checked={clientRestricted} disabled={isSelf} onChange={toggleClientRestricted} />
        </label>
        {clientRestricted && (
          <div className="mt-3">
            <input
              value={clientSearch} onChange={(e) => setClientSearch(e.target.value)}
              placeholder={house ? "Buscar marca..." : "Buscar cliente..."}
              disabled={isSelf}
              className={field + " mb-2 !py-1.5 text-xs"}
            />
            <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1">
              {allClients
                .filter((c) => !clientSearch.trim() || c.name.toLowerCase().includes(clientSearch.trim().toLowerCase()))
                .map((c) => {
                  const on = selectedClientIds.includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-2 text-xs text-foreground/70 px-1 py-1 rounded hover:bg-foreground/5 cursor-pointer">
                      <input type="checkbox" checked={on} disabled={isSelf} onChange={() => toggleClientAccess(c.id)} />
                      <span className="truncate">{c.name}</span>
                    </label>
                  );
                })}
              {allClients.length === 0 && <p className="text-[11px] text-foreground/30 px-1">{house ? "Nenhuma marca cadastrada." : "Nenhum cliente cadastrado."}</p>}
            </div>
            <p className="text-[10.5px] text-foreground/30 mt-1.5">
              {selectedClientIds.length === 0
                ? (house ? "Nenhuma marca selecionada — a pessoa não verá nenhuma marca." : "Nenhum cliente selecionado — a pessoa não verá nenhum cliente.")
                : house
                  ? `${selectedClientIds.length} marca${selectedClientIds.length === 1 ? "" : "s"} liberada${selectedClientIds.length === 1 ? "" : "s"}.`
                  : `${selectedClientIds.length} cliente${selectedClientIds.length === 1 ? "" : "s"} liberado${selectedClientIds.length === 1 ? "" : "s"}.`}
            </p>
          </div>
        )}
      </section>

      <section className={card + " mt-3.5"}>
        <div className="flex items-center gap-1.5 mb-3">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-foreground/55">Remuneração</h3>
          <InfoTip text="Usado pra calcular o custo-hora dessa pessoa na Margem por cliente: salário mensal ÷ horas mensais estimadas da escala abaixo. Só master vê e edita isso." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-6 gap-y-3">
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] text-foreground/50 mb-1">Salário mensal (R$)</label>
              <input type="number" min="0" step="0.01" value={salary} onChange={(e) => setSalary(e.target.value)}
                placeholder="Não definido" className={field} />
            </div>
            <div className="text-[11px] text-foreground/50">
              Custo-hora estimado: <span className="text-foreground font-semibold">{money(previewHourlyCost)}</span>
            </div>
            <button onClick={savePay} disabled={setMemberPay.isPending}
              className="w-full rounded-lg px-3 py-2 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
              {setMemberPay.isPending ? "Salvando…" : "Salvar remuneração"}
            </button>
          </div>
          <div>
            <label className="block text-[11px] text-foreground/50 mb-1.5">Escala semanal</label>
            <div className="grid grid-cols-7 gap-1">
              {WEEK_DAYS.map((day) => (
                <div key={day} className="flex flex-col items-center gap-1">
                  <span className="text-[9px] text-foreground/40 font-semibold">{WEEK_DAY_LABEL[day]}</span>
                  <select
                    value={schedule[day]}
                    onChange={(e) => setSchedule((s) => ({ ...s, [day]: Number(e.target.value) as 0 | 1 | 2 }))}
                    title={schedule[day] === 2 ? "Período integral (8h)" : schedule[day] === 1 ? "Meio período (4h)" : "Não trabalha"}
                    className="w-full bg-background border border-foreground/10 rounded px-0.5 py-1.5 text-[10px] text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
                  >
                    <option value={0}>—</option>
                    <option value={1}>½</option>
                    <option value={2}>1</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Ações */}
      <div className="flex flex-wrap items-center gap-1.5 pt-4 mt-4 border-t border-foreground/6">
        <ActionBtn icon={<ListChecks size={14} />} onClick={() => { setViewAs(profile.id); onClose(); navigate({ to: "/minhas-tarefas" }); }}>Ver demandas</ActionBtn>
        <ActionBtn icon={<KeyRound size={14} />} onClick={handleResetPassword} disabled={adminSendPasswordReset.isPending}>Resetar senha</ActionBtn>
        <ActionBtn icon={<Mail size={14} />} onClick={handleResendWelcomeEmail} disabled={adminResendWelcomeEmail.isPending}>Reenviar boas-vindas</ActionBtn>
        <ActionBtn icon={<KeyRound size={14} />} onClick={() => setShowPasswordField((v) => !v)}>Definir senha</ActionBtn>
        <div className="flex-1" />
        <ActionBtn icon={<Trash2 size={14} />} onClick={handleRemove} disabled={isSelf} danger>Remover</ActionBtn>
      </div>
      {showPasswordField && (
        <div className="flex items-center gap-2 mt-2">
          <PasswordInput
            value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nova senha (mín. 8 caracteres)"
            wrapperClassName="relative flex-1"
            className={field}
          />
          <button onClick={handleSetPassword} disabled={adminSetUserPassword.isPending}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[rgb(var(--lz-brand-rgb))] text-black disabled:opacity-40 shrink-0">Salvar</button>
        </div>
      )}

      {cropFile && (
        <ImageCropModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onConfirm={(r) => { setCropFile(null); onPickFile(new File([r.blob], `avatar.${r.ext}`, { type: r.contentType })); }}
        />
      )}
    </Modal>
  );
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={(e) => { e.preventDefault(); onChange(!checked); }}
      className="relative h-[22px] w-10 shrink-0 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ background: checked ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 18%, transparent)" }}>
      <span className="absolute top-[2px] h-[18px] w-[18px] rounded-full bg-[#0D0D0D] transition-all" style={{ left: checked ? 20 : 2 }} />
    </button>
  );
}

function SwitchRow({ label, hint, checked, onChange, disabled }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-foreground/6 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        <div className="text-[11.5px] text-foreground/40">{hint}</div>
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function ActionBtn({ icon, children, onClick, disabled, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${danger ? "text-foreground/50 hover:text-red-400 hover:bg-red-500/10" : "text-foreground/65 hover:text-foreground hover:bg-foreground/5"}`}>
      {icon} {children}
    </button>
  );
}
