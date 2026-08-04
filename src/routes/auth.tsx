import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setOneSignalUserId } from "@/lib/luzeria/push-notifications";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ArrowLeft } from "lucide-react";
import luzeriaLogo from "@/assets/luzeria-logo-login.png";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/minhas-tarefas" });
  },
});

function FaviconMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 286 286" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <rect width="286" height="286" rx="60" fill="#CDFF00" />
      <rect x="25.5" y="68" width="235" height="149" rx="38" fill="#090E24" />
    </svg>
  );
}

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
      toast.error(err.message ?? "Erro ao autenticar");
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
          <div className="flex items-center gap-1.5">
            <FaviconMark size={16} />
            <span className="text-white text-sm font-semibold tracking-wide">MODO</span>
          </div>
          <div className="font-criador-serif text-[40px] leading-tight -mt-1" style={{ color: "#E2FF3E" }}>CRIADOR</div>
        </div>

        <p className="text-white text-xs uppercase tracking-widest text-center font-semibold mb-6">
          {mode === "login" ? "Acesse sua conta:" : "Redefinir senha:"}
        </p>

        {mode === "login" ? (
          <form onSubmit={submit} className="space-y-3">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email"
              className="w-full bg-white/10 border border-white/15 rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] placeholder:text-white/40 transition-colors" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Senha"
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
