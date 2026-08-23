import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { KeyRound, ListChecks, Trash2 } from "lucide-react";
import {
  WEEK_DAYS, WEEK_DAY_LABEL, defaultWorkSchedule, computeMonthlyHourlyCost,
  type Profile, type Role, type WorkSchedule,
} from "@/lib/luzeria/types";
import { useApi, useMe, memberPayQO, cargosQO, clientsQO } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { Avatar } from "./Avatar";
import { Modal } from "./Modals";
import { AvatarEditor, showAvatarError, uploadAvatar } from "./AvatarEditor";
import { InfoTip } from "./InfoTip";
import { glassCardStyle } from "@/lib/luzeria/utils";
import { requestConfirm } from "@/lib/luzeria/confirm-store";

const money = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ROLE_LABEL: Record<Role, string> = {
  master: "Adm Master",
  setor: "Adm Setor",
  member: "Membro",
};

const EASE = { transitionTimingFunction: "var(--ease-premium)" as const };

export function TeamMemberCard({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex flex-col items-center gap-2 p-4 rounded-xl hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 text-center"
        style={{ ...glassCardStyle(), ...EASE }}
      >
        <div className="relative">
          <Avatar profile={profile} size={56} />
          {!profile.active && (
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-card flex items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-foreground/30" />
            </span>
          )}
        </div>
        <div className="text-sm font-semibold text-foreground truncate w-full">{profile.name}</div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
          style={{
            backgroundColor: profile.active ? "rgba(var(--lz-brand-light-rgb),0.15)" : "color-mix(in srgb, var(--foreground) 6%, transparent)",
            color: profile.active ? "var(--lz-accent-ink)" : "color-mix(in srgb, var(--foreground) 40%, transparent)",
          }}
        >
          {ROLE_LABEL[profile.role]}
        </span>
      </button>
      {open && <TeamMemberModal profile={profile} onClose={() => setOpen(false)} />}
    </>
  );
}

function TeamMemberModal({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const me = useMe().data;
  const { setUserRole, setUserActive, setExcludeFromRanking, deleteUser, adminSendPasswordReset, adminSetUserPassword, adminUpdateMemberAvatar, setMemberPay, setProfileCargos, setProfileClientAccess } = useApi();
  const { data: cargos = [] } = useQuery(cargosQO());
  const [selectedCargoIds, setSelectedCargoIds] = useState<string[]>(profile.cargoIds ?? []);
  useEffect(() => { setSelectedCargoIds(profile.cargoIds ?? []); }, [profile.cargoIds]);

  function toggleCargo(cargoId: string) {
    const next = selectedCargoIds.includes(cargoId)
      ? selectedCargoIds.filter((id) => id !== cargoId)
      : [...selectedCargoIds, cargoId];
    setSelectedCargoIds(next);
    setProfileCargos.mutate({ data: { profileId: profile.id, cargoIds: next } });
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
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar remuneração"),
    });
  }

  async function onPickFile(file: File) {
    setUploading(true);
    try {
      const path = await uploadAvatar(file, profile.id);
      setAvatarPreview(URL.createObjectURL(file));
      adminUpdateMemberAvatar.mutate({ data: { userId: profile.id, avatarPath: path } }, {
        onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar foto"),
      });
    } catch (e) { showAvatarError(e); }
    finally { setUploading(false); }
  }

  function onRemovePhoto() {
    setAvatarPreview(null);
    adminUpdateMemberAvatar.mutate({ data: { userId: profile.id, avatarPath: null } }, {
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover foto"),
    });
  }

  async function handleResetPassword() {
    if (!(await requestConfirm(`Enviar link de redefinição de senha para ${profile.name} (${profile.email})?`))) return;
    adminSendPasswordReset.mutate({ data: { userId: profile.id } }, {
      onSuccess: (res: any) => toast.success(`Email enviado para ${res?.email ?? profile.email}.`),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao enviar email"),
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
      onError: (e: any) => toast.error(e?.message ?? "Erro ao definir senha"),
    });
  }

  async function handleRemove() {
    if (!(await requestConfirm(`Remover ${profile.name}? Esta ação é permanente.`, { danger: true }))) return;
    deleteUser.mutate({ data: { userId: profile.id } }, {
      onSuccess: () => { toast.success("Colaborador removido."); onClose(); },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
    });
  }

  return (
    <Modal open onClose={onClose} title={profile.name} maxWidthClass="max-w-2xl">
      <div className="flex flex-col items-center gap-2 mb-5">
        <AvatarEditor
          me={profile}
          draftColor={profile.color}
          draftAvatarUrl={avatarPreview}
          uploading={uploading}
          onPickFile={onPickFile}
          onRemovePhoto={onRemovePhoto}
          size={72}
        />
        <div className="text-[11px] text-foreground/40 truncate">{profile.email}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Função</label>
            <select value={profile.role} disabled={isSelf}
              onChange={(e) => setUserRole.mutate({ data: { userId: profile.id, role: e.target.value as Role } })}
              className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] disabled:opacity-50 disabled:cursor-not-allowed">
              <option value="member">Membro</option>
              <option value="setor">Adm Setor</option>
              <option value="master">Adm Master</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground/70">
            <input type="checkbox" checked={profile.active} disabled={isSelf}
              onChange={(e) => setUserActive.mutate({ data: { userId: profile.id, active: e.target.checked } })} />
            Ativo
          </label>

          <label className="flex items-center gap-2 text-sm text-foreground/70" title="Não conta pontos no ranking de Top Membros">
            <input type="checkbox" checked={profile.excludeFromRanking ?? false}
              onChange={(e) => setExcludeFromRanking.mutate({ data: { userId: profile.id, excludeFromRanking: e.target.checked } })} />
            Excluir do ranking
          </label>
        </div>

        {cargos.length > 0 && (
          <div>
            <label className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">
              Cargos (pode ter mais de um)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {cargos.map((c) => {
                const on = selectedCargoIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCargo(c.id)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors border"
                    style={on
                      ? { backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)", borderColor: "rgb(var(--lz-brand-rgb))" }
                      : { color: "color-mix(in srgb, var(--foreground) 50%, transparent)", borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)" }}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 mt-4 border-t border-foreground/6">
        <label className="flex items-center gap-2 text-sm text-foreground/70 mb-2" title="Quando ligado, essa pessoa só enxerga (em qualquer lugar do app) os clientes marcados abaixo">
          <input type="checkbox" checked={clientRestricted} disabled={isSelf} onChange={toggleClientRestricted} />
          Restringir a clientes específicos
        </label>
        {clientRestricted && (
          <div>
            <input
              value={clientSearch} onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Buscar cliente..."
              disabled={isSelf}
              className="w-full bg-background border border-foreground/10 rounded-md px-3 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] mb-2 disabled:opacity-50"
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
              {allClients.length === 0 && <p className="text-[11px] text-foreground/30 px-1">Nenhum cliente cadastrado.</p>}
            </div>
            <p className="text-[10.5px] text-foreground/30 mt-1.5">
              {selectedClientIds.length === 0
                ? "Nenhum cliente selecionado — a pessoa não verá nenhum cliente."
                : `${selectedClientIds.length} cliente${selectedClientIds.length === 1 ? "" : "s"} liberado${selectedClientIds.length === 1 ? "" : "s"}.`}
            </p>
          </div>
        )}
      </div>

      <div className="pt-4 mt-4 border-t border-foreground/6">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-[10px] uppercase font-semibold tracking-wider text-foreground/40">Remuneração</span>
          <InfoTip text="Usado pra calcular o custo-hora dessa pessoa na Margem por cliente: salário mensal ÷ horas mensais estimadas da escala abaixo. Só master vê e edita isso." />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-6 gap-y-3">
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] text-foreground/50 mb-1">Salário mensal (R$)</label>
              <input type="number" min="0" step="0.01" value={salary} onChange={(e) => setSalary(e.target.value)}
                placeholder="Não definido"
                className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
            </div>
            <div className="text-[11px] text-foreground/50">
              Custo-hora estimado: <span className="text-foreground font-semibold">{money(previewHourlyCost)}</span>
            </div>
            <button onClick={savePay} disabled={setMemberPay.isPending}
              className="w-full rounded-md px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 pt-3 mt-3 border-t border-foreground/6">
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => { setViewAs(profile.id); onClose(); navigate({ to: "/minhas-tarefas" }); }}
            className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors text-left"
          ><ListChecks size={15} /> Ver demandas</button>
          <button
            onClick={handleResetPassword}
            disabled={adminSendPasswordReset.isPending}
            className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors text-left disabled:opacity-40"
          ><KeyRound size={15} /> Resetar senha (por e-mail)</button>
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => setShowPasswordField((v) => !v)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm text-foreground/70 hover:text-foreground hover:bg-foreground/5 transition-colors text-left"
          ><KeyRound size={15} /> Definir senha diretamente</button>
          {showPasswordField && (
            <div className="flex items-center gap-2 px-3 pb-1">
              <input
                type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nova senha (mín. 8 caracteres)"
                className="flex-1 bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
              />
              <button
                onClick={handleSetPassword}
                disabled={adminSetUserPassword.isPending}
                className="px-3 py-2 rounded-md text-sm font-semibold bg-[rgb(var(--lz-brand-rgb))] text-black disabled:opacity-40 shrink-0"
              >Salvar</button>
            </div>
          )}
          <button
            onClick={handleRemove}
            disabled={isSelf}
            className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm text-foreground/50 hover:text-red-400 hover:bg-red-500/10 transition-colors text-left disabled:opacity-30 disabled:cursor-not-allowed"
          ><Trash2 size={15} /> Remover</button>
        </div>
      </div>
    </Modal>
  );
}
