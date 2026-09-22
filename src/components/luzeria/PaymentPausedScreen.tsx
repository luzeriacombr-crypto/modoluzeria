import { toast } from "sonner";
import { Sparkles, PauseCircle } from "lucide-react";
import { useApi } from "@/lib/luzeria/queries";
import { clearOneSignalUserId } from "@/lib/luzeria/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import type { Profile } from "@/lib/luzeria/types";

/** Tela de "conta pausada" — só aparece quando profiles.active=false E o
 * motivo foi a régua de cobrança (deactivation_reason='payment'), pra não
 * reaproveitar por engano a tela genérica de "aguardando aprovação" (que é
 * pra cadastro novo, mensagem completamente diferente). Mockup aprovado:
 * claude.ai/artifact/6zLgdSd2nA9qstYDeBZKiD. */
export function PaymentPausedScreen({ me }: { me: Profile }) {
  const { resumeFromPaymentPause } = useApi();
  const isMaster = me.role === "master";
  const isTrial = me.subscriptionStatus !== "past_due";

  function pay() {
    resumeFromPaymentPause.mutate({} as any, {
      onSuccess: (r: any) => {
        if (r?.invoiceUrl) {
          window.open(r.invoiceUrl, "_blank");
          toast.success("Fatura aberta em outra aba — assim que confirmar o pagamento, sua conta volta sozinha.");
        } else {
          toast.error("Não encontrei sua fatura — fala com a gente pelo WhatsApp.");
        }
      },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao abrir o pagamento."),
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full bg-card rounded-xl p-8 text-center" style={{ border: "1px solid rgba(var(--lz-brand-light-rgb),0.2)" }}>
        <div
          className="h-13 w-13 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ width: 52, height: 52, background: isTrial ? "rgba(var(--lz-brand-light-rgb),0.16)" : "rgba(240,118,90,0.16)", color: isTrial ? "var(--lz-accent-ink)" : "#F0765A" }}
        >
          {isTrial ? <Sparkles size={24} /> : <PauseCircle size={24} />}
        </div>
        <h1 className="text-foreground text-lg font-semibold mb-2">Conta pausada</h1>
        <p className="text-foreground/50 text-sm leading-relaxed mb-6">
          {isTrial
            ? "O período de teste e a tolerância de 7 dias terminaram. Assine um plano pra voltar a usar o Modo Criador — seus clientes e conteúdos continuam salvos, do jeitinho que você deixou."
            : "A fatura seguiu em aberto pelos 7 dias de tolerância. Regularize o pagamento pra voltar a usar o Modo Criador — nada foi perdido."}
        </p>
        {isMaster ? (
          <button
            onClick={pay}
            disabled={resumeFromPaymentPause.isPending}
            className="w-full font-bold uppercase text-sm px-5 py-3 rounded-md transition disabled:opacity-50 mb-3"
            style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
          >
            {resumeFromPaymentPause.isPending ? "Aguarde…" : isTrial ? "Escolher meu plano" : "Pagar agora"}
          </button>
        ) : (
          <p className="text-foreground/40 text-xs leading-relaxed mb-4">
            Só o Adm Master da sua agência pode reativar o pagamento — peça pra ele entrar e resolver por aqui.
          </p>
        )}
        <button
          onClick={async () => { await clearOneSignalUserId(); await supabase.auth.signOut(); window.location.href = "/auth"; }}
          className="text-xs text-foreground/50 hover:text-foreground transition"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
