import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setOneSignalUserId } from "@/lib/luzeria/push-notifications";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ArrowLeft } from "lucide-react";
import luzeriaLogo from "@/assets/luzeria-logo-login.png";
import { PasswordInput } from "@/components/luzeria/PasswordInput";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/minhas-tarefas" });
  },
});

function GoogleMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.5 0-14 4.2-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.5 34.9 26.9 36 24 36c-5.3 0-9.7-3.1-11.3-8l-6.5 5C9.9 39.7 16.4 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.5 5.5C39.9 37.4 44 31.5 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // Aviso fixo (em vez de toast) pros casos de e-mail não confirmado / link vencido:
  // a pessoa precisa de um botão pra reenviar, não só de uma mensagem que some.
  const [notice, setNotice] = useState<{ kind: "unconfirmed" | "expired"; text: string } | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    // Link de confirmação vencido ou já usado volta pra cá com o erro na URL.
    const hash = window.location.hash;
    if (hash.includes("error_code=") || hash.includes("error=access_denied")) {
      setNotice({
        kind: "expired",
        text: "O link de confirmação venceu ou já foi aberto (alguns e-mails abrem o link sozinhos ao chegar). Digite seu e-mail abaixo e peça um novo.",
      });
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function resendConfirmation() {
    if (!email.trim()) { toast.error("Digite seu e-mail no campo acima primeiro."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup", email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw error;
      setResendIn(60);
      toast.success("Enviamos um novo e-mail de confirmação. Confira também o spam.");
    } catch (err: any) {
      toast.error(/rate|seconds/i.test(err?.message ?? "") ? "Aguarde um minuto antes de pedir outro e-mail." : (err?.message ?? "Não consegui reenviar o e-mail."));
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) {
        // A client-side nav (below) never remounts __root.tsx, so this is
        // the only place a fresh login on an already-open tab re-identifies
        // the device to OneSignal — without it, the device can stay tagged
        // as whoever was logged in before, and keep getting their pushes.
        setOneSignalUserId(s.user.id);
        nav({ to: "/minhas-tarefas" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (err?.code === "email_not_confirmed" || /not confirmed/i.test(msg)) {
        setNotice({ kind: "unconfirmed", text: "Você ainda não confirmou seu e-mail. Abra o e-mail que enviamos no cadastro e clique no link — ou peça um novo abaixo." });
      } else if (/invalid login credentials/i.test(msg)) {
        toast.error("E-mail ou senha incorretos.");
      } else {
        toast.error(msg || "Erro ao autenticar");
      }
    } finally { setLoading(false); }
  }

  async function signInWithGoogle() {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/minhas-tarefas` },
      });
      if (error) throw error;
      // On success the browser navigates away to Google immediately — no
      // local state to update, loading stays true until the redirect happens.
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao entrar com o Google");
      setLoading(false);
    }
  }

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      // Always show the same message, whether or not the e-mail exists —
      // avoids leaking which e-mails have an account.
      toast.success("Se esse e-mail tiver uma conta, enviamos um link de redefinição.");
      setMode("login");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao enviar o link de redefinição");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative"
      style={{ background: "linear-gradient(to bottom left, #090E24, #111F5C)" }}>
      <Toaster theme="dark" position="bottom-right" />
      <Link to="/" className="absolute top-5 left-5 flex items-center gap-1.5 text-white/60 hover:text-white text-xs font-semibold transition-colors">
        <ArrowLeft size={14} /> Home
      </Link>
      <div className="w-full max-w-sm rounded-2xl p-8 shadow-2xl" style={{ background: "#16215C" }}>
        <div className="flex flex-col items-center mb-7">
          <ModoCriadorLogo variant="brand" className="h-12 w-auto" />
        </div>

        <p className="text-white text-xs uppercase tracking-widest text-center font-semibold mb-6">
          {mode === "login" ? "Acesse sua conta:" : "Redefinir senha:"}
        </p>

        {mode === "login" ? (
          <form onSubmit={submit} className="space-y-3">
            {notice && (
              <div className="rounded-md p-3 text-xs leading-relaxed mb-1" style={{ background: "rgba(226,255,62,0.10)", border: "1px solid rgba(226,255,62,0.35)", color: "rgba(255,255,255,0.88)" }}>
                <p>{notice.text}</p>
                <button type="button" onClick={resendConfirmation} disabled={loading || resendIn > 0}
                  className="mt-2 font-bold underline underline-offset-2 disabled:opacity-50 disabled:no-underline" style={{ color: "#E2FF3E" }}>
                  {resendIn > 0 ? `Novo e-mail em ${resendIn}s` : "Reenviar e-mail de confirmação"}
                </button>
              </div>
            )}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email"
              className="w-full bg-white/10 border border-white/15 rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] placeholder:text-white/40 transition-colors" />
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Senha"
              toggleClassName="text-white/40 hover:text-white/70"
              className="w-full bg-white/10 border border-white/15 rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] placeholder:text-white/40 transition-colors" />
            <button type="submit" disabled={loading}
              className="w-full rounded-md py-2.5 mt-2 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "#CDFF00", color: "#090E24" }}>
              {loading ? "..." : "Entrar"}
            </button>
            <button type="button" onClick={() => setMode("forgot")}
              className="w-full text-center text-white/50 hover:text-white text-xs pt-1 transition-colors">
              Esqueci minha senha
            </button>

            <div className="flex items-center gap-3 pt-1">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-white/30 text-[10px] uppercase tracking-wider">ou</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button type="button" onClick={signInWithGoogle} disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-md py-2.5 text-sm font-semibold bg-white text-[#090E24] transition-opacity hover:opacity-90 disabled:opacity-50">
              <GoogleMark size={16} />
              Entrar com Google
            </button>
          </form>
        ) : (
          <form onSubmit={submitForgot} className="space-y-3">
            <p className="text-white/60 text-xs text-center -mt-2 mb-1">
              Informe seu e-mail de cadastro e enviaremos um link pra você criar uma nova senha.
            </p>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email"
              className="w-full bg-white/10 border border-white/15 rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] placeholder:text-white/40 transition-colors" />
            <button type="submit" disabled={loading}
              className="w-full rounded-md py-2.5 mt-2 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "#CDFF00", color: "#090E24" }}>
              {loading ? "..." : "Enviar link"}
            </button>
            <button type="button" onClick={() => setMode("login")}
              className="w-full text-center text-white/50 hover:text-white text-xs pt-1 transition-colors">
              Voltar pro login
            </button>
          </form>
        )}
      </div>

      <div className="mt-8 flex items-center gap-2">
        <span className="text-white/40 text-[9px] uppercase tracking-wider">Desenvolvido por</span>
        <img src={luzeriaLogo} alt="Luzeria" style={{ height: 14, width: "auto" }} />
      </div>
    </div>
  );
}
