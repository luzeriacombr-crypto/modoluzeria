import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { completeGoogleCalendarConnect } from "@/lib/luzeria/calendar.functions";

export const Route = createFileRoute("/_authenticated/oauth/google-calendar-callback")({
  component: GoogleCalendarCallbackPage,
  ssr: false,
});

function GoogleCalendarCallbackPage() {
  const complete = useServerFn(completeGoogleCalendarConnect);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const errorParam = url.searchParams.get("error");
    const returnedState = url.searchParams.get("state");
    const expectedState = sessionStorage.getItem("lz_gcal_oauth_state");
    sessionStorage.removeItem("lz_gcal_oauth_state");

    if (errorParam) {
      setStatus("error");
      setMessage("Autorização cancelada ou negada no Google.");
      return;
    }
    if (!code) {
      setStatus("error");
      setMessage("Código de autorização ausente na URL.");
      return;
    }
    if (!expectedState || returnedState !== expectedState) {
      setStatus("error");
      setMessage("Falha de verificação de segurança. Tente conectar de novo.");
      return;
    }
    complete({ data: { code, redirectOrigin: url.origin } })
      .then((r: any) => {
        setStatus("success");
        setMessage(r?.email ? `Conectado como ${r.email}.` : "Google Agenda conectada com sucesso.");
      })
      .catch((e: any) => {
        setStatus("error");
        setMessage(e?.message ?? "Falha ao conectar com o Google Agenda.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] p-6">
      <div className="max-w-sm w-full bg-[#1A1A1A] rounded-xl p-8 text-center border border-white/10">
        {status === "loading" && (
          <p className="text-white/70 text-sm">Conectando ao Google Agenda…</p>
        )}
        {status === "success" && (
          <>
            <p className="text-[rgb(var(--lz-brand-rgb))] font-semibold mb-2">Agenda conectada!</p>
            <p className="text-white/60 text-sm">{message}</p>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-red-400 font-semibold mb-2">Não foi possível conectar</p>
            <p className="text-white/60 text-sm">{message}</p>
          </>
        )}
        <a href="/perfil" className="lz-btn-primary inline-block mt-6 px-4 py-2 rounded-md text-sm">
          Voltar ao Perfil
        </a>
      </div>
    </div>
  );
}
