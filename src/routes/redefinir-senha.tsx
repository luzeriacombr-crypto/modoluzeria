import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ArrowLeft } from "lucide-react";
import luzeriaLogo from "@/assets/luzeria-logo-login.png";

export const Route = createFileRoute("/redefinir-senha")({
  component: ResetPasswordPage,
  ssr: false,
});

function FaviconMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 286 286" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <rect width="286" height="286" rx="60" fill="#CDFF00" />
      <rect x="25.5" y="68" width="235" height="149" rx="38" fill="#090E24" />
    </svg>
  );
}

function ResetPasswordPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Clicking the recovery link lands here with a token in the URL —
    // supabase-js parses it automatically and fires PASSWORD_RECOVERY once
    // the session from that token is set up.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não são iguais");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao redefinir a senha");
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

        {done ? (
          <div className="text-center space-y-4">
            <p className="text-white text-sm">Senha redefinida! Já pode entrar com a nova senha.</p>
            <button onClick={() => nav({ to: "/auth" })}
              className="w-full rounded-md py-2.5 text-sm font-bold transition-opacity hover:opacity-90"
              style={{ background: "#CDFF00", color: "#090E24" }}>
              Ir pro login
            </button>
          </div>
        ) : !ready ? (
          <p className="text-white/60 text-xs text-center">
            Abra essa página pelo link do e-mail de redefinição de senha.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-white text-xs uppercase tracking-widest text-center font-semibold mb-3">
              Crie sua nova senha:
            </p>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Nova senha"
              className="w-full bg-white/10 border border-white/15 rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] placeholder:text-white/40 transition-colors" />
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} placeholder="Confirme a nova senha"
              className="w-full bg-white/10 border border-white/15 rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] placeholder:text-white/40 transition-colors" />
            <button type="submit" disabled={loading}
              className="w-full rounded-md py-2.5 mt-2 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "#CDFF00", color: "#090E24" }}>
              {loading ? "..." : "Salvar nova senha"}
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
