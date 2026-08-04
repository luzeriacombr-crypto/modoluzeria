import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/mfa")({
  component: MfaChallengePage,
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    // Nothing to challenge (no 2FA enrolled, or already verified this session).
    if (!aal || aal.nextLevel !== "aal2" || aal.currentLevel === "aal2") {
      throw redirect({ to: "/minhas-tarefas" });
    }
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

function MfaChallengePage() {
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
      if (fErr) throw fErr;
      const factor = factors?.totp[0];
      if (!factor) throw new Error("Nenhum fator de autenticação encontrado.");
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
      if (vErr) throw vErr;
      nav({ to: "/minhas-tarefas" });
    } catch (err: any) {
      toast.error(err?.message ?? "Código inválido");
      setCode("");
    } finally { setLoading(false); }
  }

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/auth" });
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

        <p className="text-white text-xs uppercase tracking-widest text-center font-semibold mb-2">
          Verificação em duas etapas
        </p>
        <p className="text-white/60 text-xs text-center mb-6">
          Digita o código de 6 dígitos do seu app autenticador.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" autoFocus required placeholder="000000" maxLength={6}
            className="w-full bg-white/10 border border-white/15 rounded-md px-3 py-2.5 text-center font-mono text-lg tracking-[0.4em] text-white outline-none focus:border-[#CDFF00] focus:ring-1 focus:ring-[#CDFF00] placeholder:text-white/30 transition-colors" />
          <button type="submit" disabled={loading || code.length !== 6}
            className="w-full rounded-md py-2.5 mt-2 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: "#CDFF00", color: "#090E24" }}>
            {loading ? "..." : "Verificar"}
          </button>
          <button type="button" onClick={signOut}
            className="w-full text-center text-white/50 hover:text-white text-xs pt-1 transition-colors">
            Não é você? Sair
          </button>
        </form>
      </div>
    </div>
  );
}
