import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, ExternalLink, DollarSign, Users, TrendingUp, Calendar, Loader2 } from "lucide-react";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import { getAffiliateStats, getAffiliateReferrals } from "@/lib/luzeria/promotion-affiliate.functions";

export function AffiliateDashboard() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState("");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["affiliateStats"],
    queryFn: () => getAffiliateStats(),
  });

  const { data: referrals, isLoading: referralsLoading } = useQuery({
    queryKey: ["affiliateReferrals"],
    queryFn: () => getAffiliateReferrals(),
  });

  const referralLink = stats
    ? `https://www.modocriador.com.br/afiliar?referral=${stats.referralCode || ""}`
    : "";

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center">
        <Loader2 className="animate-spin text-white/40" size={40} />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex flex-col items-center justify-center px-4">
        <h1 className="text-2xl font-bold text-white mb-2">Acesso não autorizado</h1>
        <p className="text-white/60 mb-6">Você precisa estar inscrito no programa de afiliado</p>
        <a
          href="/afiliar"
          className="px-6 py-2 bg-[rgb(var(--lz-brand-rgb))] hover:opacity-90 rounded-lg text-white font-semibold transition"
        >
          Inscrever-se agora
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white">
      {/* Header */}
      <div className="bg-[#161616] border-b border-white/[0.07] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
          <a
            href="/"
            className="text-sm text-white/60 hover:text-white transition"
          >
            ← Voltar
          </a>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-white mb-2">Dashboard de Afiliado</h1>
          <p className="text-white/60">Acompanhe suas vendas e comissões em tempo real</p>
        </div>

        {/* Referral Link Card */}
        <div className="bg-gradient-to-r from-[rgb(var(--lz-brand-rgb))]/20 to-transparent border border-[rgb(var(--lz-brand-rgb))]/30 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold text-white mb-4">Seu Link de Referência</h2>
          <div className="flex items-center gap-3">
            <input
              type="text"
              readOnly
              value={referralLink}
              className="flex-1 px-4 py-3 bg-white/[0.08] border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none"
            />
            <button
              onClick={() => copyToClipboard(referralLink, "link")}
              className="px-4 py-3 bg-white/10 hover:bg-white/15 rounded-lg transition flex items-center gap-2"
            >
              <Copy size={16} />
              {copied === "link" ? "Copiado!" : "Copiar"}
            </button>
          </div>
          <p className="text-xs text-white/50 mt-2">
            Compartilhe este link com amigos e ganhe 10% de comissão em cada venda
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {/* Total Commission */}
          <div className="bg-[#161616] border border-white/[0.07] rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/60 text-sm font-semibold">Comissão Total</span>
              <DollarSign size={18} className="text-[rgb(var(--lz-brand-rgb))]" />
            </div>
            <div className="text-3xl font-black text-white">
              R$ {stats.totalCommission.toFixed(2)}
            </div>
            <p className="text-xs text-white/40 mt-2">De todas as vendas</p>
          </div>

          {/* Pending Commission */}
          <div className="bg-[#161616] border border-white/[0.07] rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/60 text-sm font-semibold">Pendente</span>
              <TrendingUp size={18} className="text-yellow-500" />
            </div>
            <div className="text-3xl font-black text-yellow-400">
              R$ {stats.pendingCommission.toFixed(2)}
            </div>
            <p className="text-xs text-white/40 mt-2">A ser pago</p>
          </div>

          {/* Paid Commission */}
          <div className="bg-[#161616] border border-white/[0.07] rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/60 text-sm font-semibold">Pago</span>
              <DollarSign size={18} className="text-green-500" />
            </div>
            <div className="text-3xl font-black text-green-400">
              R$ {stats.paidCommission.toFixed(2)}
            </div>
            <p className="text-xs text-white/40 mt-2">Já recebido</p>
          </div>

          {/* Total Referrals */}
          <div className="bg-[#161616] border border-white/[0.07] rounded-xl p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/60 text-sm font-semibold">Indicações</span>
              <Users size={18} className="text-[rgb(var(--lz-brand-rgb))]" />
            </div>
            <div className="text-3xl font-black text-white">
              {stats.totalReferrals}
            </div>
            <p className="text-xs text-white/40 mt-2">Pessoas indicadas</p>
          </div>
        </div>

        {/* Referrals Table */}
        <div className="bg-[#161616] border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.07]">
            <h3 className="text-lg font-bold text-white">Suas Indicações</h3>
          </div>

          {referralsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-white/40" size={32} />
            </div>
          ) : referrals && referrals.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.07]">
                    <th className="text-left px-6 py-3 text-sm font-semibold text-white/60">
                      Nome/Email
                    </th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-white/60">
                      Data
                    </th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-white/60">
                      Comissão
                    </th>
                    <th className="text-center px-6 py-3 text-sm font-semibold text-white/60">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((referral: any) => (
                    <tr
                      key={referral.id}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition"
                    >
                      <td className="px-6 py-3 text-sm">
                        <div>
                          <p className="text-white font-medium">
                            {referral.referred_user?.name || "Sem nome"}
                          </p>
                          <p className="text-xs text-white/40">
                            {referral.referred_user?.email || ""}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-white/60">
                        {new Date(referral.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-6 py-3 text-sm text-right">
                        <span className="text-green-400 font-semibold">
                          R$ {referral.commission_earned.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-sm text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                            referral.commission_paid
                              ? "bg-green-500/20 text-green-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {referral.commission_paid ? "Pago" : "Pendente"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-white/60">
              <Users size={40} className="mx-auto mb-3 text-white/20" />
              <p>Nenhuma indicação ainda</p>
              <p className="text-sm mt-2">Comece a compartilhar seu link de referência</p>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="mt-12 bg-white/[0.03] border border-white/[0.07] rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4">Como Funciona</h3>
          <ul className="space-y-3 text-sm text-white/70">
            <li className="flex gap-3">
              <span className="text-[rgb(var(--lz-brand-rgb))] font-bold flex-shrink-0">1.</span>
              <span>Compartilhe seu link de referência com amigos e colegas</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[rgb(var(--lz-brand-rgb))] font-bold flex-shrink-0">2.</span>
              <span>Quando alguém se inscreve usando seu link, você recebe 10% de comissão</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[rgb(var(--lz-brand-rgb))] font-bold flex-shrink-0">3.</span>
              <span>A comissão é válida por 12 meses a partir da primeira assinatura</span>
            </li>
            <li className="flex gap-3">
              <span className="text-[rgb(var(--lz-brand-rgb))] font-bold flex-shrink-0">4.</span>
              <span>Você pode acompanhar todas as suas vendas aqui e receber pagamentos mensalmente</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
