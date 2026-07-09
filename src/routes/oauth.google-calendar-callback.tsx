import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { exchangeGoogleCalendarCode } from "@/lib/luzeria/calendar.functions";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import luzeriaLogo from "@/assets/luzeria-logo-login.png";

export const Route = createFileRoute("/oauth/google-calendar-callback")({
  component: GoogleCalendarCallbackPage,
  ssr: false,
});

function GoogleCalendarCallbackPage() {
  const nav = useNavigate();
  const exchange = useServerFn(exchangeGoogleCalendarCode);
  const [status, setStatus] = useState<"working" | "done">("working");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const error = params.get("error");
      const returnedState = params.get("state");
      const expectedState = sessionStorage.getItem("lz_gcal_oauth_state");
      sessionStorage.removeItem("lz_gcal_oauth_state");

      if (error) {
        toast.error("Conexão com o Google Agenda cancelada.");
      } else if (!code) {
        toast.error("Link de retorno do Google inválido.");
      } else if (!expectedState || returnedState !== expectedState) {
        toast.error("Falha de verificação de segurança. Tente conectar de novo.");
      } else {
        try {
          const res = await exchange({ data: { code } });
          toast.success(res.email ? `Google Agenda conectada: ${res.email}` : "Google Agenda conectada.");
        } catch (err: any) {
          toast.error(err?.message ?? "Erro ao conectar com o Google Agenda.");
        }
      }
      setStatus("done");
      nav({ to: "/perfil" });
    })();
  }, [exchange, nav]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <Toaster theme="dark" position="bottom-right" />
      <img src={luzeriaLogo} alt="Luzeria" className="h-10 w-auto object-contain mb-6" />
      <p className="text-white/60 text-sm">
        {status === "working" ? "Conectando sua Google Agenda…" : "Redirecionando…"}
      </p>
    </div>
  );
}
