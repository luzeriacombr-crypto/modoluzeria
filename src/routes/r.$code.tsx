import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Gift, ArrowRight } from "lucide-react";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import { LIME, BG_BLUE, Reveal, POP, EASE } from "@/components/luzeria/salesPageBlocks";
import { getReferrerNameByCode } from "@/lib/luzeria/referrals.functions";

const SITE_URL = "https://www.modocriador.com.br";

// Link curto de indicação (modocriador.com.br/r/<code>) — antes disso era só
// um redirect direto pro cadastro; agora é uma telinha própria, com meta de
// compartilhamento própria (título/descrição com o presente), pra quem
// recebe o link no WhatsApp entender o ganho antes mesmo de clicar, e quem
// clica ver isso confirmado na tela antes de cair no formulário.
export const Route = createFileRoute("/r/$code")({
  component: ReferralInvitePage,
  loader: async ({ params }) => {
    const result = await getReferrerNameByCode({ data: { code: params.code } }).catch(() => ({ referrerName: null }));
    return { referrerName: result.referrerName };
  },
  head: ({ loaderData, params }) => {
    const referrerName = loaderData?.referrerName;
    const title = referrerName
      ? `🎁 ${referrerName} te convidou pro Modo Criador!`
      : "🎁 Você foi convidado pro Modo Criador!";
    const description = "Você ganhou 15 dias extras de teste grátis — 45 dias no total, em vez dos 30 de sempre. É só continuar seu cadastro.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:image", content: `${SITE_URL}/og-image.png` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: `${SITE_URL}/og-image.png` },
        { name: "robots", content: "noindex" },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/r/${params.code}` }],
    };
  },
});

function ReferralInvitePage() {
  const { referrerName } = Route.useLoaderData();
  const { code } = Route.useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: BG_BLUE, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`
        @keyframes referral-grid-drift { from { background-position: 0 0; } to { background-position: 64px 64px; } }
        .referral-grid {
          background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 32px 32px;
          animation: referral-grid-drift 18s linear infinite;
        }
        @keyframes gift-bounce {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-10px) rotate(4deg); }
        }
      `}</style>

      <header className="flex items-center justify-center px-5 sm:px-10 py-6">
        <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
      </header>

      <main className="relative flex-1 flex items-center justify-center overflow-hidden px-5 py-10">
        <div className="referral-grid pointer-events-none absolute inset-0" style={{ maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 30%, transparent 100%)" }} />
        <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full blur-[120px] opacity-[0.16]" style={{ background: LIME }} />

        <Reveal className="relative max-w-[440px] w-full text-center">
          <div className="text-[64px] leading-none mb-4" style={{ animation: "gift-bounce 2.4s ease-in-out infinite", display: "inline-block" }}>
            🎁
          </div>

          {referrerName && (
            <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: LIME }}>
              {referrerName} te indicou
            </div>
          )}

          <h1 className="font-criador-serif normal-case text-3xl sm:text-4xl leading-[1.1] mb-4" style={{ textWrap: "balance" as any }}>
            Você ganhou <span style={{ color: LIME }}>15 dias extras</span> de teste!
          </h1>

          <p className="text-white/60 text-[15px] leading-relaxed mb-8 max-w-[360px] mx-auto">
            Em vez dos 30 dias de sempre, seu teste no Modo Criador já começa com <b className="text-white">45 dias</b> —
            tempo de sobra pra organizar sua agência com calma.
          </p>

          <button
            onClick={() => navigate({ to: "/assinar", search: { refCode: code } })}
            className={`inline-flex items-center gap-2 px-8 py-4 rounded-full font-black uppercase text-sm ${POP}`}
            style={{ background: LIME, color: BG_BLUE, ...EASE }}
          >
            Continuar meu cadastro <ArrowRight size={17} />
          </button>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-white/35">
            <Gift size={13} />
            Sem cartão, sem compromisso pra começar.
          </div>
        </Reveal>
      </main>

      <footer className="px-5 py-8 text-center text-white/30 text-xs">
        Modo <span className="font-criador-serif">Criador</span> — desenvolvido pela Luzeria Estúdio.
      </footer>
    </div>
  );
}
