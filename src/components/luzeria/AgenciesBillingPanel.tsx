import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Receipt, Building2 } from "lucide-react";
import { orgsBillingQO } from "@/lib/luzeria/queries";
import { getOrgNextInvoice } from "@/lib/luzeria/api.functions";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  trialing: { label: "Em teste", color: "#4A9EFF" },
  active: { label: "Ativa", color: "#4ADE80" },
  past_due: { label: "Atrasada", color: "#FF6B6B" },
  canceled: { label: "Cancelada", color: "#9AA4B2" },
};

function daysUntil(iso: string) {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return diff;
}

export function AgenciesBillingPanel() {
  const { data: orgs = [], isLoading } = useQuery(orgsBillingQO());
  const [invoiceForId, setInvoiceForId] = useState<string | null>(null);

  const fetchInvoice = useMutation({
    mutationFn: useServerFn(getOrgNextInvoice),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-white/40" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Building2 size={16} className="text-[rgb(var(--lz-brand-rgb))]" />
        <h2 className="text-white font-semibold">Agências no Modo Criador</h2>
        <span className="text-white/40 text-sm">— {orgs.length}</span>
      </div>

      {orgs.length === 0 ? (
        <div className="text-center py-12 px-6 bg-white/[0.03] border border-white/10 rounded-2xl">
          <p className="text-white/50 text-sm">Nenhuma agência cadastrada.</p>
        </div>
      ) : (
        <div className="bg-[#161616] border border-white/[0.07] rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/60">Agência</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/60">Plano</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/60">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/60">Teste / cobrança</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-white/60">Clientes</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-white/60"></th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((o: any) => {
                const status = STATUS_LABEL[o.subscriptionStatus] ?? { label: o.subscriptionStatus, color: "#9AA4B2" };
                const trialDays = o.subscriptionStatus === "trialing" && o.trialEndsAt ? daysUntil(o.trialEndsAt) : null;
                const isFetchingThis = fetchInvoice.isPending && invoiceForId === o.id;
                const invoiceResult = invoiceForId === o.id ? fetchInvoice.data : undefined;
                const invoiceError = invoiceForId === o.id ? fetchInvoice.error : undefined;
                return (
                  <tr key={o.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 text-sm text-white font-medium">{o.name}</td>
                    <td className="px-4 py-3 text-sm text-white/70">
                      {o.planName}
                      {o.priceCents != null && (
                        <span className="text-white/40"> · R$ {(o.priceCents / 100).toFixed(2)}/mês</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold"
                        style={{ backgroundColor: `${status.color}22`, color: status.color }}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/60">
                      {trialDays != null
                        ? trialDays >= 0 ? `Teste acaba em ${trialDays}d` : `Teste expirou há ${-trialDays}d`
                        : o.hasAsaasSubscription
                          ? (
                            <div className="flex items-center gap-2">
                              {invoiceResult === undefined ? (
                                <button
                                  onClick={() => { setInvoiceForId(o.id); fetchInvoice.mutate({ data: { orgId: o.id } }); }}
                                  disabled={isFetchingThis}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-white/60 hover:text-white transition disabled:opacity-50"
                                >
                                  <Receipt size={12} />
                                  {isFetchingThis ? "Buscando…" : "Ver fatura"}
                                </button>
                              ) : invoiceError ? (
                                <span className="text-[11px] text-red-400">Erro ao buscar</span>
                              ) : invoiceResult === null ? (
                                <span className="text-[11px] text-white/40">Sem fatura pendente</span>
                              ) : (
                                <span className="text-[11px] text-white/80">
                                  Próxima: R$ {(invoiceResult.valueCents / 100).toFixed(2)}
                                </span>
                              )}
                            </div>
                          )
                          : <span className="text-white/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-white/70">{o.clientsUsed}</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
