import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Mail, Bell, Calendar, User, Lock, CalendarClock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMe, useApi, notificationPrefsQO, myCalendarConnectionQO } from "@/lib/luzeria/queries";
import { withOAuthState } from "@/lib/luzeria/google-calendar-connect";
import { AvatarEditor, ColorPicker, showAvatarError, uploadAvatar } from "./AvatarEditor";
import { roleLabel } from "./Sidebar";

export function ProfilePage() {
  const me = useMe().data;
  const { updateMyProfile, setMyNotificationPreferences, updateMyAccount } = useApi();
  const { data: prefs } = useQuery(notificationPrefsQO());
  const [color, setColor] = useState<string>(me?.color ?? "#C8D44E");
  const [avatarPath, setAvatarPath] = useState<string | null>(me?.avatarPath ?? null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(me?.avatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!me) return;
    setColor(me.color);
    setAvatarPath(me.avatarPath ?? null);
    setAvatarPreview(me.avatarUrl ?? null);
    setDirty(false);
  }, [me?.id, me?.color, me?.avatarUrl, me?.avatarPath]);

  if (!me) return null;
  const meUser = me;

  async function onPickFile(file: File) {
    setUploading(true);
    try {
      const path = await uploadAvatar(file, meUser.id);
      setAvatarPath(path);
      setAvatarPreview(URL.createObjectURL(file));
      setDirty(true);
    } catch (e) { showAvatarError(e); }
    finally { setUploading(false); }
  }

  function onRemovePhoto() {
    setAvatarPath(null);
    setAvatarPreview(null);
    setDirty(true);
  }

  function save() {
    updateMyProfile.mutate(
      { data: { color, avatarPath } },
      {
        onSuccess: () => { toast.success("Perfil atualizado."); setDirty(false); },
        onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
      },
    );
  }

  return (
    <div className="px-5 md:px-10 py-8 md:py-12 max-w-2xl mx-auto">
      <div className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: "#C8D44E" }}>
        Meu perfil
      </div>
      <h1 className="text-white text-[28px] md:text-[32px] font-bold tracking-tight">{me.name}</h1>
      <p className="text-white/50 text-sm mt-1 flex items-center gap-1.5">
        <Mail size={13} /> {me.email}
      </p>
      <span className="inline-block text-[10px] uppercase font-bold mt-3 px-2 py-0.5 rounded"
        style={{ backgroundColor: "rgba(200,212,78,0.15)", color: "#C8D44E" }}>
        {roleLabel(me.role)}
      </span>

      <div className="mt-8 bg-[#1C1C1C] rounded-lg p-6 md:p-8">
        <div className="text-[10px] uppercase font-bold tracking-wider text-white/50 mb-5 text-center md:text-left">
          Foto de perfil
        </div>
        <AvatarEditor
          me={meUser}
          draftColor={color}
          draftAvatarUrl={avatarPreview}
          uploading={uploading}
          onPickFile={onPickFile}
          onRemovePhoto={onRemovePhoto}
        />
      </div>

      <div className="mt-6 bg-[#1C1C1C] rounded-lg p-6 md:p-8">
        <div className="text-[10px] uppercase font-bold tracking-wider text-white/50 mb-5 text-center md:text-left">
          {avatarPreview ? "Cor de fallback" : "Cor do avatar"}
        </div>
        <ColorPicker
          value={color}
          onChange={(c) => { setColor(c); setDirty(true); }}
        />
      </div>

      <div className="mt-8 flex items-center justify-end gap-3">
        <button
          onClick={save}
          disabled={!dirty || updateMyProfile.isPending || uploading}
          className="text-sm font-bold px-6 py-2.5 rounded-md transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}
        >
          {updateMyProfile.isPending ? "Salvando…" : "Salvar alterações"}
        </button>
      </div>

      <p className="text-[11px] text-white/30 mt-4 text-center md:text-right">
        A foto e a cor são visuais. Para alterar nome, email ou senha, use a seção abaixo.
      </p>

      <AccountSection
        initialName={me.name}
        initialEmail={me.email}
        loading={updateMyAccount.isPending}
        onSave={(payload) =>
          updateMyAccount.mutate(
            { data: payload },
            {
              onSuccess: () => toast.success("Dados da conta atualizados."),
              onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar"),
            },
          )
        }
      />

      <div className="mt-8 bg-[#1C1C1C] rounded-lg p-6 md:p-8">
        <div className="text-[10px] uppercase font-bold tracking-wider text-white/50 mb-5">
          Notificações
        </div>
        <PrefRow
          icon={<Calendar size={16} />}
          title="Resumo diário"
          description="Receber uma notificação às 8h com a sua agenda do dia (demandas, stories, limpeza)."
          value={prefs?.dailyDigest ?? true}
          disabled={!prefs || setMyNotificationPreferences.isPending}
          onChange={(v) => setMyNotificationPreferences.mutate(
            { data: { dailyDigest: v } },
            { onSuccess: () => toast.success("Preferência salva."),
              onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar") })}
        />
        <div className="h-px bg-white/[0.06] my-4" />
        <PrefRow
          icon={<Bell size={16} />}
          title="Alertas de prazo"
          description="Receber avisos quando uma demandas sua vence amanhã, hoje ou está atrasada."
          value={prefs?.deadlineAlerts ?? true}
          disabled={!prefs || setMyNotificationPreferences.isPending}
          onChange={(v) => setMyNotificationPreferences.mutate(
            { data: { deadlineAlerts: v } },
            { onSuccess: () => toast.success("Preferência salva."),
              onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar") })}
        />
      </div>

      <div className="mt-8 bg-[#1C1C1C] rounded-lg p-6 md:p-8">
        <div className="text-[10px] uppercase font-bold tracking-wider text-white/50 mb-5">
          Google Agenda
        </div>
        <GoogleCalendarSection />
      </div>

      <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">Tour guiado do app</div>
          <div className="text-[11px] text-white/50 mt-1">Refaça o passo a passo de boas-vindas quando quiser.</div>
        </div>
        <button
          onClick={() => window.dispatchEvent(new Event("lz:start-tour"))}
          className="text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-md text-black shrink-0"
          style={{ backgroundColor: "#C8D44E" }}
        >
          Refazer tour
        </button>
      </div>
    </div>
  );
}

function PrefRow({ icon, title, description, value, disabled, onChange }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: "rgba(200,212,78,0.15)", color: "#C8D44E" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">{title}</div>
        <div className="text-[11px] text-white/50 mt-1">{description}</div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
          value ? "bg-[#C8D44E]" : "bg-white/15"
        }`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          value ? "translate-x-[22px]" : "translate-x-0.5"
        }`} />
      </button>
    </div>
  );
}

function GoogleCalendarSection() {
  const { data: conn, isLoading } = useQuery(myCalendarConnectionQO());
  const { getGoogleCalendarAuthUrl, disconnectGoogleCalendar } = useApi();

  async function connect() {
    try {
      const { url } = await getGoogleCalendarAuthUrl.mutateAsync({} as any);
      window.location.href = withOAuthState(url);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao iniciar conexão com o Google.");
    }
  }

  function disconnect() {
    disconnectGoogleCalendar.mutate({} as any, {
      onSuccess: () => toast.success("Google Agenda desconectada."),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao desconectar."),
    });
  }

  return (
    <div className="flex items-start gap-4">
      <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
        style={{ backgroundColor: "rgba(200,212,78,0.15)", color: "#C8D44E" }}>
        <CalendarClock size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white">
          {conn?.connected ? "Conectado" : "Não conectado"}
        </div>
        <div className="text-[11px] text-white/50 mt-1">
          {conn?.connected
            ? `Conectado como ${conn.email}. Seus compromissos de hoje aparecem em Minhas Tarefas.`
            : "Conecte sua Google Agenda pra ver seus compromissos de hoje em Minhas Tarefas."}
        </div>
      </div>
      {!isLoading && (
        <button
          type="button"
          onClick={conn?.connected ? disconnect : connect}
          disabled={getGoogleCalendarAuthUrl.isPending || disconnectGoogleCalendar.isPending}
          className={`shrink-0 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-md disabled:opacity-50 ${
            conn?.connected ? "border border-white/15 text-white/80 hover:text-white hover:border-white/30" : "text-black"
          }`}
          style={conn?.connected ? undefined : { backgroundColor: "#C8D44E" }}
        >
          {conn?.connected ? "Desconectar" : "Conectar"}
        </button>
      )}
    </div>
  );
}

function AccountSection({ initialName, initialEmail, loading, onSave }: {
  initialName: string;
  initialEmail: string;
  loading: boolean;
  onSave: (payload: { name?: string; email?: string; password?: string }) => void;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => { setName(initialName); }, [initialName]);
  useEffect(() => { setEmail(initialEmail); }, [initialEmail]);

  const nameChanged = name.trim() !== initialName && name.trim().length > 0;
  const emailChanged = email.trim() !== initialEmail && /\S+@\S+\.\S+/.test(email);
  const passwordSet = password.length > 0;
  const dirty = nameChanged || emailChanged || passwordSet;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (passwordSet) {
      if (password.length < 6) { toast.error("A senha precisa ter ao menos 6 caracteres."); return; }
      if (password !== confirm) { toast.error("As senhas não coincidem."); return; }
    }
    const payload: { name?: string; email?: string; password?: string } = {};
    if (nameChanged) payload.name = name.trim();
    if (emailChanged) payload.email = email.trim();
    if (passwordSet) payload.password = password;
    onSave(payload);
    setPassword(""); setConfirm("");
  }

  return (
    <form onSubmit={submit} className="mt-8 bg-[#1C1C1C] rounded-lg p-6 md:p-8 space-y-5">
      <div className="text-[10px] uppercase font-bold tracking-wider text-white/50">
        Dados da conta
      </div>
      <AccountField icon={<User size={14} />} label="Nome">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
          className="lz-input" placeholder="Seu nome" />
      </AccountField>
      <AccountField icon={<Mail size={14} />} label="Email (login)">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255}
          className="lz-input" placeholder="voce@luzeria.com.br" />
      </AccountField>
      <AccountField icon={<Lock size={14} />} label="Nova senha (opcional)">
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password" minLength={6}
          className="lz-input" placeholder="Mínimo 6 caracteres" />
      </AccountField>
      {passwordSet && (
        <AccountField icon={<Lock size={14} />} label="Confirmar nova senha">
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password" className="lz-input" placeholder="Repita a senha" />
        </AccountField>
      )}
      <div className="flex justify-end">
        <button type="submit" disabled={!dirty || loading}
          className="text-sm font-bold px-6 py-2.5 rounded-md transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}>
          {loading ? "Salvando…" : "Salvar conta"}
        </button>
      </div>
      <p className="text-[11px] text-white/30">
        Ao alterar email ou senha você continua logado nesta sessão, mas use os novos dados no próximo login.
      </p>
    </form>
  );
}

function AccountField({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase font-bold tracking-wider text-white/50 inline-flex items-center gap-1.5">
        <span style={{ color: "#C8D44E" }}>{icon}</span> {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}