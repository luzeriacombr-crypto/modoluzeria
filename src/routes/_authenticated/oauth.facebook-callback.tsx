import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { exchangeFacebookCode, connectFacebookPage, type FacebookPageOption } from "@/lib/luzeria/facebook.functions";

export const Route = createFileRoute("/_authenticated/oauth/facebook-callback")({
  component: FacebookCallbackPage,
  ssr: false,
});

function FacebookCallbackPage() {
  const exchange = useServerFn(exchangeFacebookCode);
  const connectPage = useServerFn(connectFacebookPage);
  const [status, setStatus] = useState<"loading" | "choose" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [pages, setPages] = useState<FacebookPageOption[]>([]);
  const [connecting, setConnecting] = useState(false);

  async function finishConnect(page: FacebookPageOption, cId: string) {
    try {
      const r: any = await connectPage({ data: { clientId: cId, pageId: page.id, pageName: page.name, pageAccessToken: page.accessToken } });
      setStatus("success");
      setMessage(`Conectado como "${r.pageName}".`);
    } catch (e: any) {
      setStatus("error");
      setMessage(e?.message ?? "Falha ao conectar a Página do Facebook.");
    }
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");
    if (errorParam) {
      setStatus("error");
      setMessage("Autorização cancelada ou negada no Facebook.");
      return;
    }
    if (!code || !state) {
      setStatus("error");
      setMessage("Código de autorização ausente na URL.");
      return;
    }
    setClientId(state);
    exchange({ data: { code, clientId: state } })
      .then((r: any) => {
        const pagesFound: FacebookPageOption[] = r.pages;
        if (pagesFound.length === 1) {
          setConnecting(true);
          finishConnect(pagesFound[0], state).finally(() => setConnecting(false));
        } else {
          setPages(pagesFound);
          setStatus("choose");
        }
      })
      .catch((e: any) => {
        setStatus("error");
        setMessage(e?.message ?? "Falha ao conectar com o Facebook.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full bg-card rounded-xl p-8 text-center border border-foreground/10">
        {status === "loading" && (
          <p className="text-foreground/70 text-sm">Conectando ao Facebook…</p>
        )}
        {status === "choose" && (
          <>
            <p className="text-foreground font-semibold mb-1">Qual Página conectar?</p>
            <p className="text-foreground/50 text-xs mb-4">Sua conta administra mais de uma Página — escolha a do cliente.</p>
            <div className="space-y-2">
              {pages.map((p) => (
                <button
                  key={p.id}
                  disabled={connecting}
                  onClick={() => { setConnecting(true); finishConnect(p, clientId!).finally(() => setConnecting(false)); }}
                  className="w-full lz-btn-primary text-sm px-4 py-2.5 rounded-md disabled:opacity-50"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </>
        )}
        {status === "success" && (
          <>
            <p className="text-[var(--lz-accent-ink)] font-semibold mb-2">Facebook conectado!</p>
            <p className="text-foreground/60 text-sm">{message}</p>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-red-400 font-semibold mb-2">Não foi possível conectar</p>
            <p className="text-foreground/60 text-sm">{message}</p>
          </>
        )}
        {(status === "success" || status === "error") && (
          <a href={clientId ? `/cliente/${clientId}?tab=ficha` : "/minhas-tarefas"} className="lz-btn-primary inline-block mt-6 px-4 py-2 rounded-md text-sm">
            Voltar pro cliente
          </a>
        )}
      </div>
    </div>
  );
}
