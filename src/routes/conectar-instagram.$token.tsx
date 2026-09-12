import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Instagram, User, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { publicInstagramConnectInfoQO } from "@/lib/luzeria/queries";
import { getPublicInstagramConnectUrl } from "@/lib/luzeria/instagram.functions";

export const Route = createFileRoute("/conectar-instagram/$token")({
  component: PublicInstagramConnectPage,
  loader: async ({ params, context }) => {
    try {
      return await (context as any).queryClient.fetchQuery(publicInstagramConnectInfoQO(params.token));
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => {
    const title = loaderData?.orgName ? `Conectar Instagram — ${loaderData.orgName}` : "Conectar Instagram";
    const description = loaderData?.orgName
      ? `Conecte sua conta do Instagram no app oficial da ${loaderData.orgName}.`
      : "Conecte sua conta do Instagram.";
    return {
      meta: [
        { title },
        { name: "robots", content: "noindex" },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:image", content: "https://www.modocriador.com.br/og-image.png" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: "https://www.modocriador.com.br/og-image.png" },
      ],
    };
  },
});

function PublicInstagramConnectPage() {
  const { token } = Route.useParams();
  const q = useQuery(publicInstagramConnectInfoQO(token));
  const getUrl = useServerFn(getPublicInstagramConnectUrl);
  const [connecting, setConnecting] = useState(false);

  if (q.isLoading) {
    return <Shell><div className="text-white/60 text-sm">Carregando…</div></Shell>;
  }
  if (!q.data) {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-white text-2xl font-bold mb-2">Link inválido</div>
          <div className="text-white/50 text-sm">Este link não existe. Peça um novo à sua agência.</div>
        </div>
      </Shell>
    );
  }

  const { status, expiresAt, clientName, orgName, orgLogoUrl } = q.data;
  const expired = status === "aguardando" && new Date(expiresAt).getTime() < Date.now();

  if (status === "conectado") {
    return (
      <Shell>
        <div className="rounded-xl p-8 text-center" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="size-12 rounded-full mx-auto mb-3 grid place-items-center" style={{ background: "rgba(34,197,94,0.15)" }}>
            <CheckCircle2 size={22} color="rgb(34,197,94)" />
          </div>
          <div className="text-white font-bold text-base mb-1">Instagram já conectado</div>
          <div className="text-white/50 text-sm">Pode fechar esta página, obrigado!</div>
        </div>
      </Shell>
    );
  }
  if (status === "cancelado" || expired) {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-white text-2xl font-bold mb-2">{expired ? "Link expirado" : "Link cancelado"}</div>
          <div className="text-white/50 text-sm">Peça um novo link à sua agência.</div>
        </div>
      </Shell>
    );
  }

  async function connect() {
    setConnecting(true);
    try {
      const r: any = await getUrl({ data: { token } });
      window.location.href = r.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível iniciar a conexão.");
      setConnecting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-6" style={{ background: "#0D0D0D" }}>
      <Toaster theme="dark" position="bottom-right" />
      <div className="max-w-md w-full">
        {orgLogoUrl && <img src={orgLogoUrl} alt={orgName} className="h-9 w-auto object-contain mb-6" />}
        <h1 className="text-white text-2xl font-bold mb-1">Conectar Instagram</h1>
        <p className="text-white/40 text-xs mb-8">{orgName} pede pra conectar o Instagram de {clientName}</p>

        <div className="rounded-xl p-5 sm:p-6 space-y-3" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-start gap-2 rounded-md px-3 py-2 text-[12px] leading-relaxed"
            style={{ backgroundColor: "rgba(240,180,60,0.1)", border: "1px solid rgba(240,180,60,0.3)", color: "rgba(255,255,255,0.8)" }}>
            <AlertTriangle size={13} className="shrink-0 mt-0.5" style={{ color: "#F0B43C" }} />
            <span>Abriu esse link direto pelo WhatsApp? Antes de continuar, toque nos <b className="text-white">••• (mais opções)</b>, embaixo, e escolha <b className="text-white">"Abrir no navegador"</b> — assim o Instagram abre certinho.</span>
          </div>
          <div className="flex items-start gap-2 rounded-md px-3 py-2 text-[12px] leading-relaxed"
            style={{ backgroundColor: "rgba(111,168,220,0.1)", border: "1px solid rgba(111,168,220,0.25)", color: "rgba(255,255,255,0.75)" }}>
            <User size={13} className="shrink-0 mt-0.5" style={{ color: "#6FA8DC" }} />
            <span>Faça login com a <b className="text-white">sua própria conta do Instagram</b> — não precisa passar a senha pra ninguém.</span>
          </div>
          <div className="flex items-start gap-2 rounded-md px-3 py-2 text-[12px] leading-relaxed"
            style={{ backgroundColor: "rgba(111,207,151,0.1)", border: "1px solid rgba(111,207,151,0.25)", color: "rgba(255,255,255,0.75)" }}>
            <CheckCircle2 size={13} className="shrink-0 mt-0.5" style={{ color: "#6FCF97" }} />
            <span><b className="text-white">Não precisa</b> de Página do Facebook vinculada — só a conta do Instagram já resolve.</span>
          </div>

          <button
            onClick={connect}
            disabled={connecting}
            className="w-full mt-2 py-3 rounded-md text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90 inline-flex items-center justify-center gap-2"
            style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
          >
            {connecting ? <Loader2 size={16} className="animate-spin" /> : <Instagram size={16} />}
            {connecting ? "Redirecionando…" : "Conectar Instagram"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center px-6" style={{ background: "#0D0D0D" }}>
      <div className="max-w-md w-full">{children}</div>
    </div>
  );
}
