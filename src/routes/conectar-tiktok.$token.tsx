import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { Toaster } from "@/components/ui/sonner";
import { Music2, User, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { getPublicTikTokConnectInfo, getPublicTikTokConnectUrl } from "@/lib/luzeria/tiktok.functions";

// Página pública (sem login) pro CLIENTE conectar o próprio TikTok —
// mesmo desenho de /conectar-instagram/$token.
export const Route = createFileRoute("/conectar-tiktok/$token")({
  component: PublicTikTokConnectPage,
  head: () => ({
    meta: [
      { title: "Conectar TikTok" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Conecte sua conta do TikTok." },
    ],
  }),
});

function PublicTikTokConnectPage() {
  const { token } = Route.useParams();
  const getInfo = useServerFn(getPublicTikTokConnectInfo);
  const q = useQuery({ queryKey: ["public-tiktok-connect", token], queryFn: () => getInfo({ data: { token } }), retry: false });
  const getUrl = useServerFn(getPublicTikTokConnectUrl);
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
          <div className="text-white font-bold text-base mb-1">TikTok já conectado</div>
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
      toastFriendlyError(e, "Não foi possível iniciar a conexão.");
      setConnecting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-6" style={{ background: "#0D0D0D" }}>
      <Toaster theme="dark" position="bottom-right" />
      <div className="max-w-md w-full">
        {orgLogoUrl && <img src={orgLogoUrl} alt={orgName} className="h-9 w-auto object-contain mb-6" />}
        <h1 className="text-white text-2xl font-bold mb-1">Conectar TikTok</h1>
        <p className="text-white/40 text-xs mb-3">{orgName} pede pra conectar o TikTok de {clientName}</p>
        <div className="inline-flex items-center gap-1.5 text-[11px] text-white/40 mb-8">
          <ShieldCheck size={13} style={{ color: "#6FCF97" }} />
          <span>Login oficial do TikTok — sua senha não passa pelo Modo Criador nem pela agência.</span>
        </div>

        <div className="rounded-xl p-5 sm:p-6 space-y-3" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-start gap-2 rounded-md px-3 py-2 text-[12px] leading-relaxed"
            style={{ backgroundColor: "rgba(111,168,220,0.1)", border: "1px solid rgba(111,168,220,0.25)", color: "rgba(255,255,255,0.75)" }}>
            <User size={13} className="shrink-0 mt-0.5" style={{ color: "#6FA8DC" }} />
            <span>Entre com a <b className="text-white">sua própria conta do TikTok</b> e aceite as permissões — não precisa passar a senha pra ninguém.</span>
          </div>
          <div className="flex items-start gap-2 rounded-md px-3 py-2 text-[12px] leading-relaxed"
            style={{ backgroundColor: "rgba(111,207,151,0.1)", border: "1px solid rgba(111,207,151,0.25)", color: "rgba(255,255,255,0.75)" }}>
            <CheckCircle2 size={13} className="shrink-0 mt-0.5" style={{ color: "#6FCF97" }} />
            <span>Só lemos o nome e a foto da conta. Nada é publicado sem uma ação da agência.</span>
          </div>

          <button
            onClick={connect}
            disabled={connecting}
            className="w-full mt-2 py-3 rounded-md text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90 inline-flex items-center justify-center gap-2"
            style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
          >
            {connecting ? <Loader2 size={16} className="animate-spin" /> : <Music2 size={16} />}
            {connecting ? "Redirecionando…" : "Conectar TikTok"}
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
