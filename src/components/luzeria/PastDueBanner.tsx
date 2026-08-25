import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertCircle, X } from "lucide-react";
import { orgPlanStatusQO } from "@/lib/luzeria/queries";

const DISMISS_KEY = "modocriador:past-due-banner-dismissed";

/** Shows up when the org's own Modo Criador subscription is past due
 * (Asaas PAYMENT_OVERDUE webhook) — only the master can act on it, so
 * only the master sees it. Today the only other signal is a small badge
 * tucked into Configurações › Plano e Cobrança, easy to miss. */
export function PastDueBanner({ isMaster }: { isMaster: boolean }) {
  const { data: status } = useQuery({ ...orgPlanStatusQO(), enabled: isMaster });
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");

  if (!isMaster || !status || dismissed) return null;
  if (status.subscriptionStatus !== "past_due") return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm" style={{ background: "#3D0F0F", color: "#FF9B9B" }}>
      <AlertCircle size={16} className="shrink-0" />
      <span className="flex-1 min-w-0">Você tem uma fatura em aberto do Modo Criador.</span>
      <button
        onClick={() => navigate({ to: "/configuracoes", search: { tab: "cobranca" } })}
        className="shrink-0 text-xs font-black uppercase tracking-wide px-3 py-1.5 rounded-full"
        style={{ background: "#FF9B9B", color: "#3D0F0F" }}
      >
        Ver cobrança
      </button>
      <button onClick={dismiss} title="Dispensar" className="shrink-0 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}
