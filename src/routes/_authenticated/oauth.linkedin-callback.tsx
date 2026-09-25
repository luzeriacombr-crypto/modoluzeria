import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { exchangeLinkedInCode, connectLinkedInOrganization, type LinkedInOrgOption } from "@/lib/luzeria/linkedin.functions";

export const Route = createFileRoute("/_authenticated/oauth/linkedin-callback")({
  component: LinkedInCallbackPage,
  ssr: false,
});

type ExchangeResult = {
  organizations: LinkedInOrgOption[];
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string | null;
  refreshTokenExpiresAt: string | null;
  scopes: string | null;
};

function LinkedInCallbackPage() {
  const exchange = useServerFn(exchangeLinkedInCode);
  const connectOrg = useServerFn(connectLinkedInOrganization);
  const [status, setStatus] = useState<"loading" | "choose" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [result, setResult] = useState<ExchangeResult | null>(null);
  const [connecting, setConnecting] = useState(false);

  async function finishConnect(org: LinkedInOrgOption, r: ExchangeResult, cId: string) {
    try {
      await connectOrg({
        data: {
          clientId: cId,
          organizationUrn: org.urn,
          organizationName: org.name,
          accessToken: r.accessToken,
          accessTokenExpiresAt: r.accessTokenExpiresAt,
          refreshToken: r.refreshToken,
          refreshTokenExpiresAt: r.refreshTokenExpiresAt,
          scopes: r.scopes,
        },
      });
      setStatus("success");
      setMessage(`Conectado como "${org.name}".`);
    } catch (e: any) {
      setStatus("error");
      setMessage(e?.message ?? "Falha ao conectar a Página do LinkedIn.");
    }
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errorParam = url.searchParams.get("error");
    if (errorParam) {
      setStatus("error");
      setMessage("Autorização cancelada ou negada no LinkedIn.");
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
        if (r.organizations.length === 0) {
          setStatus("error");
          setMessage("Essa conta do LinkedIn não administra nenhuma Página (ou a permissão de administrar Páginas ainda não foi concedida ao app). Conecte com a conta que gerencia a Página do cliente.");
          return;
        }
        if (r.organizations.length === 1) {
          setConnecting(true);
          finishConnect(r.organizations[0], r, state).finally(() => setConnecting(false));
        } else {
          setResult(r);
          setStatus("choose");
        }
      })
      .catch((e: any) => {
        setStatus("error");
        setMessage(e?.message ?? "Falha ao conectar com o LinkedIn.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full bg-card rounded-xl p-8 text-center border border-foreground/10">
        {status === "loading" && (
          <p className="text-foreground/70 text-sm">Conectando ao LinkedIn…</p>
        )}
        {status === "choose" && result && (
          <>
            <p className="text-foreground font-semibold mb-1">Qual Página conectar?</p>
            <p className="text-foreground/50 text-xs mb-4">Sua conta administra mais de uma Página — escolha a do cliente.</p>
            <div className="space-y-2">
              {result.organizations.map((org) => (
                <button
                  key={org.urn}
                  disabled={connecting}
                  onClick={() => { setConnecting(true); finishConnect(org, result, clientId!).finally(() => setConnecting(false)); }}
                  className="w-full lz-btn-primary text-sm px-4 py-2.5 rounded-md disabled:opacity-50"
                >
                  {org.name}
                </button>
              ))}
            </div>
          </>
        )}
        {status === "success" && (
          <>
            <p className="text-[var(--lz-accent-ink)] font-semibold mb-2">LinkedIn conectado!</p>
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
