import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, X } from "lucide-react";
import { orgPlanStatusQO, useApi } from "@/lib/luzeria/queries";

const DISMISS_KEY = "modocriador:trial-banner-dismissed";

/** Shows up only on the trial's last day (or after it's expired) when the
 * org still hasn't added a payment method — nudges the master to run
 * subscribeToPlan (already used by the "Assinar" button in Configurações)
 * before access could be interrupted. Only the master can act on it, so
 * only the master sees it. */
export function TrialEndingBanner({ isMaster }: { isMaster: boolean }) {
  const { data: status } = useQuery({ ...orgPlanStatusQO(), enabled: isMaster });
  const { subscribeToPlan } = useApi();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");

  if (!isMaster || !status || dismissed) return null;
  if (status.subscriptionStatus !== "trialing" || status.hasAsaasSubscription) return null;

  const daysLeft = status.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(status.trialEndsAt).getTime() - Date.now()) / 86_400_000))
    : null;
  if (daysLeft === null || daysLeft > 1) return null;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  function addPayment() {
    subscribeToPlan.mutate({ data: { planId: status!.planId } }, {
      onSuccess: (r: any) => {
        toast.success("Quase lá! Abrindo a página de pagamento…");
        if (r?.invoiceUrl) window.open(r.invoiceUrl, "_blank");
      },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao configurar o pagamento."),
    });
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm" style={{ background: "#3D2A0A", color: "#FFD97E" }}>
      <AlertTriangle size={16} className="shrink-0" />
      <span className="flex-1 min-w-0">
        {daysLeft === 0
          ? "Seu teste grátis acabou! Adicione uma forma de pagamento pra continuar usando o Modo Criador sem interrupção."
          : "Hoje é o último dia do seu teste grátis! Adicione uma forma de pagamento pra não perder o acesso."}
      </span>
      <button
        onClick={addPayment}
        disabled={subscribeToPlan.isPending}
        className="shrink-0 text-xs font-black uppercase tracking-wide px-3 py-1.5 rounded-full disabled:opacity-50"
        style={{ background: "#FFD97E", color: "#3D2A0A" }}
      >
        {subscribeToPlan.isPending ? "Aguarde…" : "Adicionar pagamento"}
      </button>
      <button onClick={dismiss} title="Dispensar" className="shrink-0 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}
