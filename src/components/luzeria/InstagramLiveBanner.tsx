import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Instagram, X } from "lucide-react";
import { hasUsedInstagramPublishQO } from "@/lib/luzeria/queries";

const DISMISS_KEY = "modocriador:instagram-live-banner-dismissed";
const VIEW_COUNT_KEY = "modocriador:instagram-live-banner-views";
/** Some sozinho depois de 3 exibições — não precisa continuar avisando
 * quem já viu e não se interessou. */
const MAX_VIEWS = 3;
/** Se ninguém dispensar nem bater o limite de views, some sozinho depois
 * dessa data — pra não virar lixo permanente de UI. */
const SHOW_UNTIL = new Date("2026-10-15");

const IG_GRADIENT = "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)";

/** Avisa admins (setor + master) que a publicação no Instagram saiu do modo
 * restrito a testadores — App Review da Meta aprovado em 2026-09-02. Só
 * quem administra clientes decide usar a função, então só eles veem.
 *
 * Some em 3 situações: passou de 3 exibições, a agência já testou/publicou/
 * programou algo pelo Instagram (não precisa mais do aviso), ou passou da
 * data de corte. */
export function InstagramLiveBanner({ isAdmin }: { isAdmin: boolean }) {
  const { data: hasUsed, isLoading: hasUsedLoading } = useQuery({ ...hasUsedInstagramPublishQO(), enabled: isAdmin });
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");
  const [viewCount, setViewCount] = useState(() => Number(localStorage.getItem(VIEW_COUNT_KEY) ?? "0"));
  const navigate = useNavigate();

  const shouldShow =
    isAdmin && !dismissed && !hasUsedLoading && !hasUsed && viewCount < MAX_VIEWS && Date.now() <= SHOW_UNTIL.getTime();

  useEffect(() => {
    if (!shouldShow) return;
    localStorage.setItem(VIEW_COUNT_KEY, String(viewCount + 1));
    setViewCount((v) => v + 1);
    // Conta uma exibição só na montagem (uma "entrada" = uma visualização),
    // não a cada re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow]);

  if (!shouldShow) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-white" style={{ background: IG_GRADIENT }}>
      <Instagram size={16} className="shrink-0" />
      <button
        onClick={() => navigate({ to: "/configuracoes", search: { tab: "updates" } })}
        className="flex-1 min-w-0 text-left font-semibold hover:underline"
      >
        Novidade! Publique no Instagram direto do Modo Criador!
      </button>
      <button onClick={dismiss} title="Dispensar" className="shrink-0 opacity-80 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}
