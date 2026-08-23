import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, ExternalLink, Users, DollarSign, CheckCircle2, Loader2 } from "lucide-react";
import {
  getMyAffiliateProgram,
  listAllAffiliateReferrals,
  markAffiliateCommissionAsPaid,
} from "@/lib/luzeria/promotion-affiliate.functions";

export function AffiliateProgramPanel({ isPlatformAdmin }: { isPlatformAdmin: boolean }) {
  return (
    <div className="space-y-8">
      <MyAffiliateCard />
      {isPlatformAdmin && <AdminAffiliateOverview />}
    </div>
  );
}

function MyAffiliateCard() {
  const [copied, setCopied] = useState(false);
  const { data: affiliate, isLoading } = useQuery({
    queryKey: ["myAffiliateProgram"],
    queryFn: () => getMyAffiliateProgram(),
  });

  const referralLink = affiliate ? `modocriador.com.br/assinar?affiliateCode=${affiliate.referralCode}` : "";

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-foreground/15 rounded-2xl p-8 backdrop-blur-sm">
      <h2 className="text-2xl font-black text-foreground">Programa de Afiliados</h2>
      <p className="text-sm text-foreground/50 mt-1 mb-6">
        Indique novas agências pro Modo Criador e ganhe 10% de comissão por 12 meses em cada venda.
      </p>

      {isLoading ? (
        <Loader2 className="animate-spin text-foreground/40" size={24} />
      ) : affiliate ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase text-foreground/40 mb-1">Seu link de indicação</p>
            <div className="flex items-center gap-2">
              <span className="flex-1 px-3 py-2 bg-foreground/[0.08] border border-foreground/10 rounded-lg text-foreground text-sm truncate">
                {referralLink}
              </span>
              <button
                onClick={copyLink}
                className="p-2 text-foreground/40 hover:text-foreground hover:bg-foreground/[0.12] rounded-lg transition"
                title="Copiar link"
              >
                <Copy size={16} />
              </button>
            </div>
            {copied && <p className="text-xs text-[var(--lz-accent-ink)] mt-1">Copiado!</p>}
          </div>
          <a
            href="/afiliado/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[rgb(var(--lz-brand-rgb))] to-[rgba(var(--lz-brand-rgb),0.8)] hover:opacity-90 rounded-xl font-bold text-[#0D0D0D] transition"
          >
            Ver dashboard completo
            <ExternalLink size={16} />
          </a>
        </div>
      ) : (
        <a
          href="/afiliar"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[rgb(var(--lz-brand-rgb))] to-[rgba(var(--lz-brand-rgb),0.8)] hover:opacity-90 rounded-xl font-bold text-[#0D0D0D] transition"
        >
          Quero ser afiliado
          <ExternalLink size={16} />
        </a>
      )}
    </div>
  );
}

function AdminAffiliateOverview() {
  const queryClient = useQueryClient();
  const { data: referrals, isLoading } = useQuery({
    queryKey: ["allAffiliateReferrals"],
    queryFn: () => listAllAffiliateReferrals(),
  });

  const payMutation = useMutation({
    mutationFn: useServerFn(markAffiliateCommissionAsPaid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allAffiliateReferrals"] });
      toast.success("Comissão marcada como paga.");
    },
    onError: (error: any) => toast.error(error?.message || "Erro ao marcar comissão."),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-foreground/40" size={32} />
      </div>
    );
  }

  const list = referrals ?? [];
  const totalCommission = list.reduce((sum: number, r: any) => sum + Number(r.commission_earned), 0);
  const pending = list.filter((r: any) => !r.commission_paid);
  const pendingCommission = pending.reduce((sum: number, r: any) => sum + Number(r.commission_earned), 0);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-foreground">Todas as indicações (todas as agências)</h3>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-card border border-foreground/7 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground/60 text-sm font-semibold">Indicações</span>
            <Users size={16} className="text-[var(--lz-accent-ink)]" />
          </div>
          <div className="text-2xl font-black text-foreground">{list.length}</div>
        </div>
        <div className="bg-card border border-foreground/7 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground/60 text-sm font-semibold">Comissão pendente</span>
            <DollarSign size={16} className="text-yellow-500" />
          </div>
          <div className="text-2xl font-black text-yellow-400">R$ {pendingCommission.toFixed(2)}</div>
        </div>
        <div className="bg-card border border-foreground/7 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground/60 text-sm font-semibold">Comissão total</span>
            <DollarSign size={16} className="text-green-500" />
          </div>
          <div className="text-2xl font-black text-foreground">R$ {totalCommission.toFixed(2)}</div>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-12 px-6 bg-foreground/[0.03] border border-foreground/10 rounded-2xl">
          <p className="text-foreground/50 text-sm">Nenhuma indicação ainda.</p>
        </div>
      ) : (
        <div className="bg-card border border-foreground/7 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-foreground/7">
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/60">Afiliado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/60">Agência</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/60">Indicado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/60">Comissão</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-foreground/60">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-foreground/60"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r: any) => (
                <tr key={r.id} className="border-b border-foreground/4 hover:bg-foreground/[0.02] transition">
                  <td className="px-4 py-3 text-sm text-foreground">{r.affiliate?.user?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-foreground/60">{r.affiliate?.org?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-foreground/60">{r.referred_user?.name || r.referred_user?.email || "—"}</td>
                  <td className="px-4 py-3 text-sm text-right text-green-400 font-semibold">
                    R$ {Number(r.commission_earned).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                        r.commission_paid ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                      }`}
                    >
                      {r.commission_paid ? "Pago" : "Pendente"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {!r.commission_paid && (
                      <button
                        onClick={() => payMutation.mutate({ data: { referralId: r.id } })}
                        disabled={payMutation.isPending}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-foreground/70 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition disabled:opacity-50"
                        title="Marcar como pago"
                      >
                        <CheckCircle2 size={14} />
                        Marcar pago
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
