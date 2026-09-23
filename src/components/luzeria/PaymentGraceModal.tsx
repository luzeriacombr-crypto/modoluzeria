import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { Sparkles, Clock3 } from "lucide-react";
import { orgPlanStatusQO, myPendingInvoiceQO, useApi } from "@/lib/luzeria/queries";

const SHOWN_KEY_PREFIX = "modocriador:payment-grace-shown:";
const todayKey = () => SHOWN_KEY_PREFIX + new Date().toISOString().slice(0, 10);

/** Régua de cobrança (mockup aprovado: claude.ai/artifact/6zLgdSd2nA9qstYDeBZKiD).
 * Só o master vê e só ele pode agir — mesma regra do TrialEndingBanner e do
 * PastDueBanner, que continuam cobrindo o resto do dia depois que esse popup
 * é fechado uma vez (ele só aparece na primeira abertura do app de cada dia,
 * via localStorage — não sessionStorage, porque "por dia" precisa sobreviver
 * a fechar e abrir o navegador de novo no mesmo dia). */
export function PaymentGraceModal({ isMaster }: { isMaster: boolean }) {
  const { data: status } = useQuery({ ...orgPlanStatusQO(), enabled: isMaster });
  const { subscribeToPlan } = useApi();
  const qc = useQueryClient();
  const [dismissedToday, setDismissedToday] = useState(false);

  const graceActive = isMaster && !!status?.paymentGraceStartedAt;
  const situation: "trial" | "overdue" = status?.subscriptionStatus === "past_due" ? "overdue" : "trial";

  const { data: invoice } = useQuery({
    ...myPendingInvoiceQO(),
    enabled: graceActive && situation === "overdue",
  });

  useEffect(() => {
    if (!graceActive) return;
    try {
      if (localStorage.getItem(todayKey()) === "1") setDismissedToday(true);
    } catch {
      // localStorage indisponível (aba anônima etc.) — só mostra sempre, sem travar a tela.
    }
  }, [graceActive]);

  if (!graceActive || dismissedToday || !status?.paymentGraceStartedAt) return null;

  const startedAt = new Date(status.paymentGraceStartedAt).getTime();
  const daysSince = (Date.now() - startedAt) / 86_400_000;
  const daysLeft = Math.max(0, Math.ceil(7 - daysSince));
  const pct = Math.max(4, Math.min(100, (daysLeft / 7) * 100));

  function dismiss() {
    try { localStorage.setItem(todayKey(), "1"); } catch {}
    setDismissedToday(true);
  }

  function primaryAction() {
    if (situation === "trial") {
      subscribeToPlan.mutate({ data: { planId: status!.planId } }, {
        onSuccess: (r: any) => {
          toast.success("Quase lá! Abrindo a página de pagamento…");
          if (r?.invoiceUrl) window.open(r.invoiceUrl, "_blank");
          dismiss();
        },
        onError: (e: any) => toastFriendlyError(e, "Erro ao configurar o pagamento."),
      });
    } else if (invoice?.invoiceUrl) {
      window.open(invoice.invoiceUrl, "_blank");
      dismiss();
    } else {
      toast.error("Não encontrei sua fatura em aberto — fala com a gente pelo chat de ajuda.");
    }
  }

  const isTrial = situation === "trial";
  const accent = isTrial ? "rgb(var(--lz-brand-rgb))" : "#F0B84A";
  const accentSoft = isTrial ? "rgba(var(--lz-brand-light-rgb),0.16)" : "rgba(240,184,74,0.16)";

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ background: "rgba(6,8,20,0.68)" }}>
      <div className="w-full max-w-[400px] rounded-[20px] p-6 shadow-2xl" style={{ background: "#151A38", border: "1px solid rgba(255,255,255,0.09)" }}>
        <div className="h-11 w-11 rounded-[13px] flex items-center justify-center mb-3.5" style={{ background: accentSoft, color: accent }}>
          {isTrial ? <Sparkles size={20} /> : <Clock3 size={20} />}
        </div>
        <h3 className="text-white text-[19px] font-semibold mb-2 tracking-tight">
          {isTrial ? "Seu teste chegou ao fim!" : "Sua fatura está em aberto"}
        </h3>
        <p className="text-white/60 text-[13.5px] leading-relaxed mb-3.5">
          {isTrial
            ? "Esperamos que esses dias tenham mostrado como o Modo Criador facilita a rotina da sua agência. Pra continuar sem interromper nada, escolha um plano — leva menos de 1 minuto."
            : "A cobrança do seu plano ainda não foi confirmada — pode ter sido o cartão, um boleto vencido ou só um esquecimento. Sem problema, dá pra resolver rapidinho."}
        </p>
        <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: isTrial ? "linear-gradient(90deg,#C8D44E,#8FE3B0)" : "linear-gradient(90deg,#F0B84A,#F0765A)" }} />
        </div>
        <div className="flex justify-between text-[11px] mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
          <span>
            {isTrial ? "Sua conta continua ativa por mais " : "Você tem mais "}
            <b className="text-white">{daysLeft} dia{daysLeft === 1 ? "" : "s"}</b>
            {isTrial ? "" : " pra regularizar"}
          </span>
        </div>
        <button
          onClick={primaryAction}
          disabled={subscribeToPlan.isPending}
          className="block w-full text-center font-bold text-sm py-3.5 rounded-[11px] mb-2 transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ background: accent, color: "#0D0D0D" }}
        >
          {subscribeToPlan.isPending ? "Aguarde…" : isTrial ? "Escolher meu plano →" : "Pagar agora →"}
        </button>
        <button
          onClick={() => { if (!isTrial) qc.invalidateQueries({ queryKey: ["org-plan-status"] }); dismiss(); }}
          className="block w-full text-center text-[12.5px] font-semibold py-1.5 text-white/55 hover:text-white transition-colors"
        >
          {isTrial ? "Continuar explorando por hoje" : "Já paguei, verificar de novo"}
        </button>
        <div className="text-[10.5px] text-center mt-2.5 leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
          Depois desse prazo, sua conta fica pausada até {isTrial ? "você assinar" : "o pagamento ser confirmado"} — nenhum dado é apagado.
        </div>
      </div>
    </div>
  );
}
