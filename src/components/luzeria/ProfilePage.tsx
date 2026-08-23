import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Mail, Bell, Calendar, User, Lock, ShieldCheck, Shield, UserPlus, RefreshCw, MessageCircle, AtSign, Star, Bug, LogOut, CalendarClock, Sun, Moon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useMe, useApi, notificationPrefsQO, myCalendarConnectionQO, clientsQO } from "@/lib/luzeria/queries";
import { useTheme } from "@/lib/luzeria/theme-store";
import { withOAuthState } from "@/lib/luzeria/google-calendar-connect";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { AvatarEditor, showAvatarError, uploadAvatar } from "./AvatarEditor";
import { roleLabel } from "./Sidebar";
import { supabase } from "@/integrations/supabase/client";
import { clearOneSignalUserId } from "@/lib/luzeria/push-notifications";

export function ProfilePage() {
  const me = useMe().data;
  const { theme, setTheme } = useTheme();
  const { updateMyProfile, setMyNotificationPreferences, updateMyAccount, updateMyDefaultLanding } = useApi();
  const { data: prefs } = useQuery(notificationPrefsQO());
  const { data: clients = [] } = useQuery(clientsQO());
  const defaultLandingView = me?.defaultLanding?.view ?? "minhas-tarefas";
  const defaultLandingClientId = me?.defaultLanding?.clientId ?? "";
  const [color, setColor] = useState<string>(me?.color ?? "var(--lz-accent-ink)");
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
      <div className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: "var(--lz-accent-ink)" }}>
        Meu perfil
      </div>
      <h1 className="text-foreground text-[28px] md:text-[32px] font-bold tracking-tight">{me.name}</h1>
      <p className="text-foreground/50 text-sm mt-1 flex items-center gap-1.5">
        <Mail size={13} /> {me.email}
      </p>
      <span className="inline-block text-[10px] uppercase font-bold mt-3 px-2 py-0.5 rounded"
        style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
        {roleLabel(me.role)}
      </span>

      <div className="mt-8 bg-card rounded-lg p-6 md:p-8">
        <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/50 mb-5 text-center md:text-left">
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

      <div className="mt-8 flex items-center justify-end gap-3">
        <button
          onClick={save}
          disabled={!dirty || updateMyProfile.isPending || uploading}
          className="text-sm font-bold px-6 py-2.5 rounded-md transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          {updateMyProfile.isPending ? "Salvando…" : "Salvar alterações"}
        </button>
      </div>

      <p className="text-[11px] text-foreground/30 mt-4 text-center md:text-right">
        A foto é só visual. Para alterar nome, email ou senha, use a seção abaixo.
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

      <TwoFactorSection />

      <div className="mt-6 bg-card rounded-lg p-6 md:p-8">
        <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/50 mb-5">
          Aparência
        </div>
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">Tema do app</div>
            <div className="text-[11px] text-foreground/50 mt-1">Escolha como o Modo Criador aparece pra você — a preferência fica salva nesse aparelho.</div>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-foreground/[0.06] p-1 shrink-0">
            <button type="button" onClick={() => setTheme("dark")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${theme === "dark" ? "bg-[rgb(var(--lz-brand-rgb))] text-[#0D0D0D]" : "text-foreground/50 hover:text-foreground"}`}>
              <Moon size={13} /> Escuro
            </button>
            <button type="button" onClick={() => setTheme("light")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${theme === "light" ? "bg-[rgb(var(--lz-brand-rgb))] text-[#0D0D0D]" : "text-foreground/50 hover:text-foreground"}`}>
              <Sun size={13} /> Claro
            </button>
          </div>
        </div>
      </div>

      {!(me.disabledFeatures ?? []).includes("google_calendar") && (
        <div className="mt-6 bg-card rounded-lg p-6 md:p-8">
          <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/50 mb-5">
            Google Agenda
          </div>
          <GoogleCalendarSection />
        </div>
      )}

      <div className="mt-8 bg-card rounded-lg p-6 md:p-8">
        <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/50 mb-5">
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
        <div className="h-px bg-foreground/[0.06] my-4" />
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
        <div className="h-px bg-foreground/[0.06] my-4" />
        <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/30 mb-4">
          Avisos no celular (push)
        </div>
        <PrefRow
          icon={<UserPlus size={16} />}
          title="Atribuído a mim"
          description="Quando alguém te atribui a um post, reel ou atividade."
          value={prefs?.pushAssigned ?? true}
          disabled={!prefs || setMyNotificationPreferences.isPending}
          onChange={(v) => setMyNotificationPreferences.mutate(
            { data: { pushAssigned: v } },
            { onSuccess: () => toast.success("Preferência salva."),
              onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar") })}
        />
        <div className="h-px bg-foreground/[0.06] my-4" />
        <PrefRow
          icon={<RefreshCw size={16} />}
          title="Mudança de status"
          description="Quando o status de uma demanda sua muda."
          value={prefs?.pushStatus ?? true}
          disabled={!prefs || setMyNotificationPreferences.isPending}
          onChange={(v) => setMyNotificationPreferences.mutate(
            { data: { pushStatus: v } },
            { onSuccess: () => toast.success("Preferência salva."),
              onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar") })}
        />
        <div className="h-px bg-foreground/[0.06] my-4" />
        <PrefRow
          icon={<MessageCircle size={16} />}
          title="Comentário"
          description="Quando comentam num post, reel ou atividade sua."
          value={prefs?.pushComment ?? true}
          disabled={!prefs || setMyNotificationPreferences.isPending}
          onChange={(v) => setMyNotificationPreferences.mutate(
            { data: { pushComment: v } },
            { onSuccess: () => toast.success("Preferência salva."),
              onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar") })}
        />
        <div className="h-px bg-foreground/[0.06] my-4" />
        <PrefRow
          icon={<AtSign size={16} />}
          title="Menção"
          description="Quando alguém te menciona num comentário."
          value={prefs?.pushMention ?? true}
          disabled={!prefs || setMyNotificationPreferences.isPending}
          onChange={(v) => setMyNotificationPreferences.mutate(
            { data: { pushMention: v } },
            { onSuccess: () => toast.success("Preferência salva."),
              onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar") })}
        />
        <div className="h-px bg-foreground/[0.06] my-4" />
        <PrefRow
          icon={<Star size={16} />}
          title="Feedback de cliente"
          description="Quando um cliente deixa feedback num post ou reel."
          value={prefs?.pushClientFeedback ?? true}
          disabled={!prefs || setMyNotificationPreferences.isPending}
          onChange={(v) => setMyNotificationPreferences.mutate(
            { data: { pushClientFeedback: v } },
            { onSuccess: () => toast.success("Preferência salva."),
              onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar") })}
        />
        {me?.role === "master" && (
          <>
            <div className="h-px bg-foreground/[0.06] my-4" />
            <PrefRow
              icon={<Bug size={16} />}
              title="Chamados técnicos"
              description="Novos chamados de erro/dúvida da equipe, e atualizações dos que você reportou."
              value={prefs?.pushBugReport ?? true}
              disabled={!prefs || setMyNotificationPreferences.isPending}
              onChange={(v) => setMyNotificationPreferences.mutate(
                { data: { pushBugReport: v } },
                { onSuccess: () => toast.success("Preferência salva."),
                  onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar") })}
            />
          </>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-foreground/6">
        <div className="text-sm font-semibold text-foreground">Ao entrar, abrir em</div>
        <div className="text-[11px] text-foreground/50 mt-1 mb-3">Só pra você — não muda o que os outros da equipe veem.</div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={defaultLandingView}
            onChange={(e) => {
              const view = e.target.value;
              updateMyDefaultLanding.mutate(
                { data: { defaultLanding: view === "minhas-tarefas" ? null : { view, clientId: view === "cliente" ? (defaultLandingClientId || clients[0]?.id) : undefined } } },
                { onSuccess: () => toast.success("Preferência salva."), onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar") },
              );
            }}
            className="bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
          >
            <option value="minhas-tarefas">Minhas Demandas</option>
            <option value="admin">Dashboard</option>
            <option value="calendario">Calendário</option>
            <option value="cliente">Um cliente específico</option>
          </select>
          {defaultLandingView === "cliente" && (
            <select
              value={defaultLandingClientId}
              onChange={(e) => updateMyDefaultLanding.mutate(
                { data: { defaultLanding: { view: "cliente", clientId: e.target.value } } },
                { onSuccess: () => toast.success("Preferência salva."), onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar") },
              )}
              className="bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
            >
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-foreground/6 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-foreground">Tour guiado do app</div>
          <div className="text-[11px] text-foreground/50 mt-1">Refaça o passo a passo de boas-vindas quando quiser.</div>
        </div>
        <button
          onClick={() => window.dispatchEvent(new Event("lz:start-tour"))}
          className="text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-md text-black shrink-0"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
        >
          Refazer tour
        </button>
      </div>

      <div className="mt-6 pt-6 border-t border-foreground/6 flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-foreground">Sair da conta</div>
          <div className="text-[11px] text-foreground/50 mt-1">Encerra sua sessão neste dispositivo.</div>
        </div>
        <button
          onClick={async () => {
            await clearOneSignalUserId();
            await supabase.auth.signOut();
            location.href = "/auth";
          }}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-md text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
        >
          <LogOut size={13} /> Sair
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
        style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-[11px] text-foreground/50 mt-1">{description}</div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
          value ? "bg-[rgb(var(--lz-brand-rgb))]" : "bg-foreground/15"
        }`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-all ${
          value ? "left-[22px]" : "left-0.5"
        }`} />
      </button>
    </div>
  );
}

function GoogleCalendarSection() {
  const { data: conn, isLoading } = useQuery(myCalendarConnectionQO());
  const { getGoogleCalendarAuthUrl, disconnectGoogleCalendar, createCalendarEvent } = useApi();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  async function connect() {
    try {
      const { url } = await getGoogleCalendarAuthUrl.mutateAsync({ data: { redirectOrigin: window.location.origin } });
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

  function submitEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date || !time) return;
    createCalendarEvent.mutate(
      { data: { title: title.trim(), date, time } },
      {
        onSuccess: () => {
          toast.success("Compromisso criado na sua Google Agenda.");
          setTitle(""); setDate(""); setTime(""); setShowForm(false);
        },
        onError: (err: any) => toast.error(err?.message ?? "Erro ao criar compromisso."),
      },
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
            <CalendarClock size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">
              {conn?.connected ? "Conectado" : "Não conectado"}
            </div>
            <div className="text-[11px] text-foreground/50 mt-1">
              {conn?.connected
                ? `Conectado como ${conn.email}. Seus compromissos de hoje aparecem em Minhas Demandas.`
                : "Conecte sua Google Agenda pra ver seus compromissos de hoje em Minhas Demandas."}
            </div>
          </div>
        </div>
        {!isLoading && (
          <div className="flex items-center gap-2 shrink-0 sm:ml-0 ml-[52px]">
            {conn?.connected && (
              <button
                type="button"
                onClick={() => setShowForm((v) => !v)}
                className="text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-md text-black whitespace-nowrap"
                style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
              >
                Novo compromisso
              </button>
            )}
            <button
              type="button"
              onClick={conn?.connected ? disconnect : connect}
              disabled={getGoogleCalendarAuthUrl.isPending || disconnectGoogleCalendar.isPending}
              className={`text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-md disabled:opacity-50 whitespace-nowrap ${
                conn?.connected ? "border border-foreground/15 text-foreground/80 hover:text-foreground hover:border-foreground/30" : "text-black"
              }`}
              style={conn?.connected ? undefined : { backgroundColor: "rgb(var(--lz-brand-rgb))" }}
            >
              {conn?.connected ? "Desconectar" : "Conectar"}
            </button>
          </div>
        )}
      </div>

      {showForm && conn?.connected && (
        <form onSubmit={submitEvent} className="mt-5 pt-5 border-t border-foreground/6 flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[160px]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/50">Título</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
              placeholder="Reunião com cliente" className="lz-input mt-1.5" required />
          </label>
          <label>
            <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/50">Data</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="lz-input mt-1.5" required />
          </label>
          <label>
            <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/50">Horário</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="lz-input mt-1.5" required />
          </label>
          <button type="submit" disabled={createCalendarEvent.isPending}
            className="text-sm font-bold px-5 py-2.5 rounded-md disabled:opacity-40"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
            {createCalendarEvent.isPending ? "Salvando…" : "Salvar"}
          </button>
        </form>
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
    <form onSubmit={submit} className="mt-8 bg-card rounded-lg p-6 md:p-8 space-y-5">
      <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/50">
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
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          {loading ? "Salvando…" : "Salvar conta"}
        </button>
      </div>
      <p className="text-[11px] text-foreground/30">
        Ao alterar email ou senha você continua logado nesta sessão, mas use os novos dados no próximo login.
      </p>
    </form>
  );
}

function TwoFactorSection() {
  const [status, setStatus] = useState<"loading" | "off" | "on">("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) { setStatus("off"); return; }
    const verified = data.totp[0];
    setFactorId(verified?.id ?? null);
    setStatus(verified ? "on" : "off");
  }

  useEffect(() => { refresh(); }, []);

  async function startEnroll() {
    setBusy(true);
    try {
      // Clean up any unverified attempts left over from a previous try —
      // Supabase lets multiple TOTP factors coexist, but only one should
      // ever be "the" pending enrollment at a time. listFactors()'s totp[]
      // only ever contains verified factors, so unverified ones (if any)
      // must be found in the combined "all" list instead.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) {
        if (f.factor_type === "totp" && f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data: enrolled, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (error) throw error;
      setFactorId(enrolled.id);
      setQrCode(enrolled.totp.qr_code);
      setSecret(enrolled.totp.secret);
      setEnrolling(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao iniciar ativação");
    } finally { setBusy(false); }
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
      if (vErr) throw vErr;
      toast.success("Autenticação de dois fatores ativada.");
      setEnrolling(false); setCode(""); setQrCode(null); setSecret(null);
      setStatus("on");
    } catch (e: any) {
      toast.error(e?.message ?? "Código inválido, tenta de novo.");
    } finally { setBusy(false); }
  }

  function cancelEnroll() {
    if (factorId) supabase.auth.mfa.unenroll({ factorId });
    setEnrolling(false); setCode(""); setQrCode(null); setSecret(null); setFactorId(null);
  }

  async function disable() {
    if (!factorId) return;
    if (!(await requestConfirm("Desativar a autenticação de dois fatores? Você vai poder entrar só com a senha.", { danger: true }))) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success("Autenticação de dois fatores desativada.");
      setStatus("off"); setFactorId(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao desativar");
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-6 bg-card rounded-lg p-6 md:p-8">
      <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/50 mb-5">
        Autenticação de dois fatores
      </div>

      {!enrolling ? (
        <div className="flex items-start gap-4">
          <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
            {status === "on" ? <ShieldCheck size={16} /> : <Shield size={16} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">
              {status === "loading" ? "Carregando…" : status === "on" ? "Ativada" : "Desativada"}
            </div>
            <div className="text-[11px] text-foreground/50 mt-1">
              Pede um código do seu celular (Google Authenticator, Authy etc.) além da senha, toda vez que você entrar.
            </div>
          </div>
          {status === "on" ? (
            <button type="button" onClick={disable} disabled={busy}
              className="text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-md shrink-0 text-red-400 border border-red-400/30 hover:bg-red-400/10 disabled:opacity-50">
              Desativar
            </button>
          ) : status === "off" ? (
            <button type="button" onClick={startEnroll} disabled={busy}
              className="text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-md shrink-0 text-black disabled:opacity-50"
              style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}>
              Ativar
            </button>
          ) : null}
        </div>
      ) : (
        <form onSubmit={confirmEnroll} className="space-y-4">
          <p className="text-[13px] text-foreground/70">
            Escaneia esse QR code com o app autenticador (Google Authenticator, Authy, 1Password…) e digita o código de 6 dígitos que ele mostrar.
          </p>
          {qrCode && (
            <div className="bg-foreground rounded-lg p-4 w-fit">
              <img src={qrCode} alt="QR code do autenticador" width={160} height={160} />
            </div>
          )}
          {secret && (
            <p className="text-[11px] text-foreground/40">
              Não consegue escanear? Digita esse código manualmente no app: <span className="font-mono text-foreground/70">{secret}</span>
            </p>
          )}
          <input
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" placeholder="000000" maxLength={6}
            className="lz-input font-mono tracking-[0.3em] text-center w-40"
          />
          <div className="flex gap-3">
            <button type="submit" disabled={busy || code.length !== 6}
              className="text-sm font-bold px-6 py-2.5 rounded-md transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
              {busy ? "Confirmando…" : "Confirmar"}
            </button>
            <button type="button" onClick={cancelEnroll} disabled={busy}
              className="text-sm font-semibold px-6 py-2.5 rounded-md text-foreground/60 hover:text-foreground disabled:opacity-40">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function AccountField({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/50 inline-flex items-center gap-1.5">
        <span style={{ color: "var(--lz-accent-ink)" }}>{icon}</span> {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}