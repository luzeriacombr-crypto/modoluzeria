import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

function AuthPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) nav({ to: "/minhas-tarefas" });
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
          Acesse sua conta:
        </p>

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
        </form>
      </div>

      <div className="mt-8 flex items-center gap-2">
        <span className="text-white/40 text-[9px] uppercase tracking-wider">Desenvolvido por</span>
        <img src={luzeriaLogo} alt="Luzeria" style={{ height: 14, width: "auto" }} />
      </div>
    </div>
  );
}
