import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Instagram, Target, UserPlus } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { inviteHouseMember, updateHouseSettings, type HouseSettings } from "@/lib/luzeria/house.functions";
import { getInstagramConnectionStatus, getInstagramConnectUrl } from "@/lib/luzeria/instagram.functions";
import type { Profile } from "@/lib/luzeria/types";

type Step = "equipe" | "metas" | "instagram";
const STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
  { id: "equipe", label: "Equipe", icon: <UserPlus size={14} /> },
  { id: "metas", label: "Metas", icon: <Target size={14} /> },
  { id: "instagram", label: "Instagram", icon: <Instagram size={14} /> },
];

// O passo de Instagram sai do app (OAuth) e volta — guarda onde parou pra
// reabrir no mesmo passo, e não do começo.
const STEP_KEY = "lz.houseOnboardingStep";

/** Configuração inicial da House, logo depois do primeiro acesso do dono:
 * convidar a pessoa da equipe, definir as metas mínimas e conectar o
 * Instagram da marca. Tudo pode ser pulado e feito depois. */
export function HouseOnboarding({ me, settings }: { me: Profile; settings: HouseSettings }) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("equipe");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STEP_KEY) as Step | null;
      if (saved && STEPS.some((s) => s.id === saved)) setStep(saved);
    } catch { /* noop */ }
  }, []);
  function go(next: Step) {
    try { localStorage.setItem(STEP_KEY, next); } catch { /* noop */ }
    setStep(next);
  }

  const saveSettings = useServerFn(updateHouseSettings);
  const finish = useMutation({
    mutationFn: () => saveSettings({ data: { onboardingCompleted: true } }),
    onSuccess: () => {
      try { localStorage.removeItem(STEP_KEY); } catch { /* noop */ }
      qc.invalidateQueries({ queryKey: ["house-settings"] });
      toast.success("Tudo pronto! Bem-vindo(a) à sua House.");
    },
    onError: (e: any) => toastFriendlyError(e, "Erro ao concluir"),
  });

  const firstName = me.name.split(" ")[0] || me.name;
  const stepIdx = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: "radial-gradient(circle at top, rgba(var(--lz-brand-light-rgb),0.07), transparent 60%), #0D0D0D" }}>
      <div className="w-full max-w-md bg-card rounded-2xl p-7 md:p-9"
        style={{ border: "1px solid rgba(var(--lz-brand-light-rgb),0.18)" }}>
        <div className="text-[10px] uppercase font-bold tracking-wider mb-2" style={{ color: "var(--lz-accent-ink)" }}>
          Configuração da House · {stepIdx + 1} de {STEPS.length}
        </div>
        <div className="flex gap-1.5 mb-6">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex-1 h-1 rounded-full"
              style={{ backgroundColor: i <= stepIdx ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 12%, transparent)" }} />
          ))}
        </div>

        {step === "equipe" && <TeamStep firstName={firstName} onNext={() => go("metas")} />}
        {step === "metas" && <GoalsStep settings={settings} onBack={() => go("equipe")} onNext={() => go("instagram")} />}
        {step === "instagram" && (
          <InstagramStep clientId={me.houseClientId ?? null} onBack={() => go("metas")}
            onFinish={() => finish.mutate()} finishing={finish.isPending} />
        )}
      </div>
    </div>
  );
}

function TeamStep({ firstName, onNext }: { firstName: string; onNext: () => void }) {
  const invite = useServerFn(inviteHouseMember);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [invited, setInvited] = useState<string[]>([]);
  const send = useMutation({
    mutationFn: () => invite({ data: { name: name.trim(), email: email.trim() } }),
    onSuccess: () => {
      toast.success(`Convite enviado pra ${email.trim()}.`);
      setInvited((l) => [...l, name.trim()]);
      setName(""); setEmail("");
    },
    onError: (e: any) => toastFriendlyError(e, "Erro ao convidar"),
  });
  const canSend = name.trim().length >= 2 && /\S+@\S+\.\S+/.test(email.trim());

  return (
    <>
      <h1 className="text-foreground text-[22px] font-bold leading-tight">Olá, {firstName}! Quem vai tocar o dia a dia?</h1>
      <p className="text-foreground/60 text-sm mt-1.5 mb-5">
        Convide a pessoa da equipe que vai executar e alimentar o sistema. Ela recebe um e-mail pra criar a própria senha.
      </p>
      <div className="space-y-2.5">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="lz-input w-full" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" type="email" className="lz-input w-full" />
        <button onClick={() => send.mutate()} disabled={!canSend || send.isPending}
          className="w-full rounded-md py-2.5 text-sm font-bold border border-foreground/15 text-foreground hover:bg-foreground/5 disabled:opacity-40 transition">
          {send.isPending ? "Enviando…" : "Enviar convite"}
        </button>
      </div>
      {invited.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {invited.map((n, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-foreground/70">
              <Check size={13} style={{ color: "var(--lz-accent-ink)" }} /> {n} convidado(a)
            </li>
          ))}
        </ul>
      )}
      <button onClick={onNext}
        className="mt-7 w-full rounded-md py-3 text-sm font-bold transition-opacity hover:opacity-90"
        style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
        {invited.length > 0 ? "Continuar" : "Pular por agora"}
      </button>
    </>
  );
}

function GoalsStep({ settings, onBack, onNext }: { settings: HouseSettings; onBack: () => void; onNext: () => void }) {
  const qc = useQueryClient();
  const saveSettings = useServerFn(updateHouseSettings);
  const [stories, setStories] = useState(String(settings.storiesPerWorkday));
  const [posts, setPosts] = useState(String(settings.feedPostsPerWeek));
  const [deadline, setDeadline] = useState(String(settings.planningDeadlineDay));
  const save = useMutation({
    mutationFn: () => saveSettings({ data: {
      storiesPerWorkday: clampInt(stories, 0, 50),
      feedPostsPerWeek: clampInt(posts, 0, 50),
      planningDeadlineDay: clampInt(deadline, 1, 28),
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["house-settings"] }); onNext(); },
    onError: (e: any) => toastFriendlyError(e, "Erro ao salvar metas"),
  });

  return (
    <>
      <h1 className="text-foreground text-[22px] font-bold leading-tight">Metas mínimas</h1>
      <p className="text-foreground/60 text-sm mt-1.5 mb-5">
        O básico que precisa sair toda semana. Dá pra mudar quando quiser.
      </p>
      <div className="space-y-3">
        <GoalField label="Stories por dia útil" value={stories} onChange={setStories} min={0} max={50} />
        <GoalField label="Posts no feed por semana" value={posts} onChange={setPosts} min={0} max={50} />
        <GoalField label="Planejamento do mês seguinte pronto até o dia" value={deadline} onChange={setDeadline} min={1} max={28} />
      </div>
      <button onClick={() => save.mutate()} disabled={save.isPending}
        className="mt-7 w-full rounded-md py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
        {save.isPending ? "Salvando…" : "Salvar e continuar"}
      </button>
      <button onClick={onBack} className="mt-3 w-full text-xs text-foreground/50 hover:text-foreground transition">Voltar</button>
    </>
  );
}

function GoalField({ label, value, onChange, min, max }: {
  label: string; value: string; onChange: (v: string) => void; min: number; max: number;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg px-3.5 py-3"
      style={{ background: "color-mix(in srgb, var(--foreground) 4%, transparent)" }}>
      <span className="text-sm text-foreground/80">{label}</span>
      <input type="number" inputMode="numeric" min={min} max={max} value={value}
        onChange={(e) => onChange(e.target.value)} className="lz-input w-20 text-center" />
    </label>
  );
}

function clampInt(v: string, min: number, max: number) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

function InstagramStep({ clientId, onBack, onFinish, finishing }: {
  clientId: string | null; onBack: () => void; onFinish: () => void; finishing: boolean;
}) {
  const fetchStatus = useServerFn(getInstagramConnectionStatus);
  const fetchUrl = useServerFn(getInstagramConnectUrl);
  const { data: status } = useQuery({
    queryKey: ["instagram-status", clientId],
    queryFn: () => fetchStatus({ data: { clientId: clientId! } }),
    enabled: !!clientId,
  });
  const connect = useMutation({
    mutationFn: () => fetchUrl({ data: { clientId: clientId! } }),
    onSuccess: (r) => { window.location.href = r.url; },
    onError: (e: any) => toastFriendlyError(e, "Não foi possível abrir o Instagram"),
  });

  return (
    <>
      <h1 className="text-foreground text-[22px] font-bold leading-tight">Conecte o Instagram da marca</h1>
      <p className="text-foreground/60 text-sm mt-1.5 mb-5">
        Pra publicar e agendar posts direto daqui e acompanhar os números. Precisa ser uma conta profissional (comercial ou criador).
      </p>
      {status?.connected ? (
        <div className="flex items-center gap-2.5 rounded-lg px-3.5 py-3 text-sm text-foreground"
          style={{ background: "rgba(var(--lz-brand-rgb),0.08)", border: "1px solid rgba(var(--lz-brand-rgb),0.25)" }}>
          <Check size={16} style={{ color: "var(--lz-accent-ink)" }} />
          Conectado{status.igUsername ? ` como @${status.igUsername}` : ""}
        </div>
      ) : (
        <button onClick={() => connect.mutate()} disabled={!clientId || connect.isPending}
          className="w-full rounded-md py-2.5 text-sm font-bold border border-foreground/15 text-foreground hover:bg-foreground/5 disabled:opacity-40 transition inline-flex items-center justify-center gap-2">
          <Instagram size={15} /> {connect.isPending ? "Abrindo…" : "Conectar Instagram"}
        </button>
      )}
      <button onClick={onFinish} disabled={finishing}
        className="mt-7 w-full rounded-md py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
        {finishing ? "Concluindo…" : status?.connected ? "Concluir" : "Pular e concluir"}
      </button>
      <button onClick={onBack} className="mt-3 w-full text-xs text-foreground/50 hover:text-foreground transition">Voltar</button>
    </>
  );
}
