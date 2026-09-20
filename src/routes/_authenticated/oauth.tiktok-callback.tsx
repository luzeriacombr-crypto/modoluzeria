import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { connectTikTok } from "@/lib/luzeria/tiktok.functions";

export const Route = createFileRoute("/_authenticated/oauth/tiktok-callback")({
  component: TikTokCallbackPage,
  ssr: false,
});

function TikTokCallbackPage() {
  const connect = useServerFn(connectTikTok);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  // O código OAuth só vale uma vez: evita trocar duas vezes (ex.: StrictMode).
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");
    if (errorParam) {
      setStatus("error");
      setMessage("Autorização cancelada ou negada no TikTok.");
      return;
    }
    if (!code || !state) {
      setStatus("error");
      setMessage("Código de autorização ausente na URL.");
      return;
    }
    setClientId(state);
    connect({ data: { code, clientId: state } })
      .then((r: any) => {
        setStatus("success");
        setMessage(r.displayName ? `Conectado como "${r.displayName}".` : "Conta conectada.");
      })
      .catch((e: any) => {
        setStatus("error");
        setMessage(e?.message ?? "Falha ao conectar com o TikTok.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full bg-card rounded-xl p-8 text-center border border-foreground/10">
        {status === "loading" && <p className="text-foreground/70 text-sm">Conectando ao TikTok…</p>}
        {status === "success" && (
          <>
            <p className="text-[var(--lz-accent-ink)] font-semibold mb-2">TikTok conectado!</p>
            <p className="text-foreground/60 text-sm">{message}</p>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-red-400 font-semibold mb-2">Não foi possível conectar</p>
            <p className="text-foreground/60 text-sm">{message}</p>
          </>
        )}
        {status !== "loading" && (
          <a href={clientId ? `/cliente/${clientId}?tab=ficha` : "/minhas-tarefas"} className="lz-btn-primary inline-block mt-6 px-4 py-2 rounded-md text-sm">
            Voltar pro cliente
          </a>
        )}
      </div>
    </div>
  );
}
