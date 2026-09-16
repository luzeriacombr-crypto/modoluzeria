import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Gift, X } from "lucide-react";
import { myReferralInfoQO } from "@/lib/luzeria/queries";

const DISMISS_KEY = "modocriador:referral-banner-dismissed";
const VIEW_COUNT_KEY = "modocriador:referral-banner-views";
/** Some sozinho depois de algumas exibições — quem se interessar já vai ter
 * clicado; quem não se interessou não precisa ver pra sempre. */
const MAX_VIEWS = 5;

/** Convite pro Programa de Indicação — mesmo padrão visual do
 * InstagramLiveBanner/DriveReconnectBanner. Some em 3 situações: passou do
 * limite de exibições, a agência já indicou alguém (não precisa mais
 * convidar quem já topou), ou a pessoa dispensou manualmente. */
export function ReferralAnnouncementBanner({ isAdmin }: { isAdmin: boolean }) {
  const { data } = useQuery({ ...myReferralInfoQO(), enabled: isAdmin });
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");
  const [viewCount, setViewCount] = useState(() => Number(localStorage.getItem(VIEW_COUNT_KEY) ?? "0"));
  const navigate = useNavigate();

  const hasReferred = (data?.referrals?.length ?? 0) > 0;
  const shouldShow = isAdmin && !dismissed && !hasReferred && viewCount < MAX_VIEWS;

  useEffect(() => {
    if (!shouldShow) return;
    localStorage.setItem(VIEW_COUNT_KEY, String(viewCount + 1));
    setViewCount((v) => v + 1);
    // Conta uma exibição só na montagem, não a cada re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow]);

  if (!shouldShow) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-white" style={{ background: "rgba(200,212,78,0.14)", borderBottom: "1px solid rgba(200,212,78,0.3)" }}>
      <Gift size={16} className="shrink-0" style={{ color: "#C8D44E" }} />
      <button
        onClick={() => navigate({ to: "/configuracoes", search: { tab: "indicacoes" } })}
        className="flex-1 min-w-0 text-left hover:underline"
      >
        Indique uma agência e ganhe <b className="font-semibold">1 mês grátis</b> — ela ainda leva 15 dias extras de teste.
      </button>
      <button onClick={dismiss} title="Dispensar" className="shrink-0 opacity-80 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}
