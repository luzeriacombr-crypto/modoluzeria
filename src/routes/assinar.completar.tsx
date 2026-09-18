import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { completeGoogleSignup } from "@/lib/luzeria/signup.functions";
import { Check, Lock } from "lucide-react";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";

export const Route = createFileRoute("/assinar/completar")({
  component: CompleteGoogleSignupPage,
  ssr: false,
});

const PENDING_KEY = "modocriador:pending-google-signup";

const LIME = "#D7FF3F";

function CompleteGoogleSignupPage() {
  const complete = useServerFn(completeGoogleSignup);
  const ran = useRef(false);
  const [state, setState] = useState<"loading" | "error" | "done">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) {
        setError("Não encontramos os dados do seu cadastro. Volta pra tela anterior e tenta de novo.");
        setState("error");
        return;
      }
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        setError("Não foi possível confirmar seu login do Google. Tenta de novo.");
        setState("error");
        return;
      }
      try {
        const payload = JSON.parse(raw);
        await complete({ data: payload });
        sessionStorage.removeItem(PENDING_KEY);
        (window as any).fbq?.("track", "StartTrial", { value: 0.00, currency: "BRL" });
        setState("done");
      } catch (err: any) {
        setError(err?.message ?? "Não foi possível concluir seu cadastro. Tente novamente.");
        setState("error");
      }
    })();
  }, [complete]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#0A0E23", color: "#0A0E23" }}>
      <div className="mb-8"><ModoCriadorLogo variant="brand" className="h-6 w-auto" /></div>
      <div className="w-full max-w-md rounded-2xl p-8 text-center" style={{ background: "#F5F5F0" }}>
        {state === "loading" && (
          <p className="text-sm text-[#0A0E23]/70">Finalizando seu cadastro…</p>
        )}

        {state === "error" && (
          <>
            <p className="text-red-500 text-sm mb-4">{error}</p>
            <Link to="/assinar" className="font-bold uppercase text-sm px-5 py-3 rounded-full inline-block" style={{ background: LIME, color: "#0A0E23" }}>
              Voltar
            </Link>
          </>
        )}

        {state === "done" && (
          <>
            <div className="mb-3 flex justify-center">
              <span className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: LIME }}>
                <Check size={20} color="#0A0E23" strokeWidth={3} />
              </span>
            </div>
            <div className="font-bold text-lg mb-2">Cadastro criado!</div>
            <p className="text-[#0A0E23]/70 text-sm mb-4">
              Você já pode usar o Modo Criador por 30 dias sem cadastrar pagamento. Quando quiser, é só adicionar a forma de pagamento em Configurações.
            </p>
            <p>
              <Link to="/minhas-tarefas" className="text-sm underline text-[#0A0E23]/70">Ir pro Modo Criador →</Link>
            </p>
          </>
        )}

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#0A0E23]/45 pt-6">
          <Lock size={11} /> Ambiente seguro · Seus dados ficam protegidos
        </p>
      </div>
    </div>
  );
}
