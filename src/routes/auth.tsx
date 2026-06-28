import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import luzeriaLogo from "@/assets/luzeria-logo-light.png.asset.json";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) nav({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { name }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada. Você já está conectado.");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao autenticar");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] px-4">
      <Toaster theme="dark" position="bottom-right" />
      <div className="w-full max-w-sm bg-[#1A1A1A] rounded-xl p-8 shadow-2xl"
        style={{ border: "1px solid rgba(200,212,78,0.2)" }}>
        <div className="flex items-center justify-center mb-10">
          <img src={luzeriaLogo.url} alt="Luzeria" className="h-10 w-auto object-contain" />
        </div>
        <h1 className="text-white text-xl font-semibold text-center">
          {mode === "signin" ? "Acesse sua conta" : "Crie sua conta"}
        </h1>
        <p className="text-white/50 text-sm text-center mt-2 mb-7">Gestão de produção de conteúdo</p>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nome completo"
              className="w-full bg-white/[0.05] border border-white/10 rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E] placeholder:text-white/40 transition-colors" />
          )}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email"
            className="w-full bg-white/[0.05] border border-white/10 rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E] placeholder:text-white/40 transition-colors" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="Senha"
            className="w-full bg-white/[0.05] border border-white/10 rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E] placeholder:text-white/40 transition-colors" />
          <button type="submit" disabled={loading}
            className="lz-btn-primary w-full rounded-md py-2.5 mt-2 text-sm">
            {loading ? "..." : mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>
        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full mt-6 text-xs text-white/50 hover:text-white transition-colors">
          {mode === "signin" ? "Não tem conta? Cadastrar" : "Já tem conta? Entrar"}
        </button>
      </div>
    </div>
  );
}