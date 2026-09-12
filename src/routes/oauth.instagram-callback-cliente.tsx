import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { completePublicInstagramConnect } from "@/lib/luzeria/instagram.functions";

// Callback público do fluxo de autoconexão do cliente — redirect_uri
// separada da usada pelo fluxo admin (`/oauth/instagram-callback`),
// cadastrada à parte na Meta for Developers. Aqui `state` é o token do
// pedido (instagram_connect_requests), não um clientId, já que quem
// completa esse fluxo não tem sessão nenhuma no Modo Criador.
export const Route = createFileRoute("/oauth/instagram-callback-cliente")({
  component: InstagramCallbackClientePage,
  ssr: false,
});

function InstagramCallbackClientePage() {
  const complete = useServerFn(completePublicInstagramConnect);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");
    if (errorParam) {
      setStatus("error");
      setMessage("Autorização cancelada ou negada no Instagram.");
      return;
    }
    if (!code || !state) {
      setStatus("error");
      setMessage("Código de autorização ausente na URL.");
      return;
    }
    complete({ data: { code, token: state } })
      .then((r: any) => {
        setStatus("success");
        setMessage(r.igUsername ? `Conectado como @${r.igUsername}.` : "Instagram conectado com sucesso.");
      })
      .catch((e: any) => {
        setStatus("error");
        setMessage(e?.message ?? "Falha ao conectar com o Instagram.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6" style={{ background: "#0D0D0D" }}>
      <div className="max-w-sm w-full rounded-xl p-8 text-center" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" }}>
        {status === "loading" && (
          <p className="text-white/70 text-sm">Conectando ao Instagram…</p>
        )}
        {status === "success" && (
          <>
            <p className="text-[var(--lz-accent-ink)] font-semibold mb-2">Instagram conectado!</p>
            <p className="text-white/60 text-sm mb-4">{message}</p>
            <p className="text-white/40 text-xs">Você já pode fechar esta página.</p>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-red-400 font-semibold mb-2">Não foi possível conectar</p>
            <p className="text-white/60 text-sm">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
