import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { orgPlanStatusQO } from "@/lib/luzeria/queries";

/** Mostra enquanto a agência estiver acima do limite de clientes do plano
 * (normalmente depois de uma importação por IA que trouxe mais gente do
 * que o plano permite) — sem bloquear nada, só avisando o prazo. Some
 * sozinho quando o prazo é limpo (getOrgPlanStatus faz isso assim que a
 * contagem volta a caber no plano). Não é dismissível de propósito — é um
 * estado real da conta, não uma novidade pra dispensar. */
export function ClientLimitGraceBanner({ isMaster }: { isMaster: boolean }) {
  const { data: status } = useQuery({ ...orgPlanStatusQO(), enabled: isMaster });
  const navigate = useNavigate();

  if (!isMaster || !status?.clientLimitGraceUntil) return null;

  const daysLeft = Math.ceil((new Date(status.clientLimitGraceUntil).getTime() - Date.now()) / 86_400_000);
  const dateLabel = new Date(status.clientLimitGraceUntil).toLocaleDateString("pt-BR");

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm" style={{ background: "#3D2A0A", color: "#FFD97E" }}>
      <AlertTriangle size={16} className="shrink-0" />
      <span className="flex-1 min-w-0">
        {daysLeft > 0
          ? <>Você tem mais clientes cadastrados do que seu plano permite — faça upgrade até <b>{dateLabel}</b> ({daysLeft} dia{daysLeft === 1 ? "" : "s"}).</>
          : <>Seu plano não cobre mais todos os clientes cadastrados desde <b>{dateLabel}</b> — faça upgrade pra regularizar.</>}
      </span>
      <button
        onClick={() => navigate({ to: "/configuracoes", search: { tab: "cobranca" } })}
        className="shrink-0 text-xs font-black uppercase tracking-wide px-3 py-1.5 rounded-full"
        style={{ background: "#FFD97E", color: "#3D2A0A" }}
      >
        Ver planos
      </button>
    </div>
  );
}
