import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Users, TrendingUp, DollarSign, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import { createAffiliateProgram, getMyAffiliateProgram } from "@/lib/luzeria/promotion-affiliate.functions";
import { useQuery } from "@tanstack/react-query";

export function AffiliatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"info" | "form" | "success">("info");
  const [formData, setFormData] = useState({
    referralCode: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: existingAffiliate } = useQuery({
    queryKey: ["myAffiliateProgram"],
    queryFn: async () => {
      try {
        return await getMyAffiliateProgram();
      } catch {
        return null;
      }
    },
  });

  if (existingAffiliate) {
    return <AffiliateExistingPanel affiliate={existingAffiliate} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await createAffiliateProgram({
        referralCode: formData.referralCode.trim(),
      });
      setStep("success");
    } catch (err: any) {
      setError(err.message || "Erro ao criar programa de afiliado");
    } finally {
      setLoading(false);
    }
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0E23] to-[#151B2D] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
        </div>

        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="max-w-md w-full text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full mb-6">
              <TrendingUp size={32} className="text-white" />
            </div>

            <h1 className="text-3xl font-black text-white mb-2">Bem-vindo ao programa!</h1>
            <p className="text-white/70 mb-8">
              Sua inscrição foi aprovada. Comece a ganhar comissões compartilhando seu link de referência.
            </p>

            <button
              onClick={() => navigate({ to: "/afiliado/dashboard" })}
              className="w-full px-6 py-4 bg-gradient-to-r from-[rgb(var(--lz-brand-rgb))] to-[rgba(var(--lz-brand-rgb),0.8)] hover:opacity-90 rounded-lg text-white font-bold transition flex items-center justify-center gap-2"
            >
              Ver meu Dashboard
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E23] to-[#151B2D] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
        <a href="/" className="text-sm text-white/60 hover:text-white transition">
          ← Voltar
        </a>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-2xl w-full">
          {step === "info" ? (
            <>
              {/* Hero */}
              <div className="text-center mb-12">
                <h1 className="text-4xl font-black text-white mb-3">Ganhe com suas Indicações</h1>
                <p className="text-xl text-white/70">
                  Indique Modo Criador e receba 10% de comissão em cada venda durante o primeiro ano
                </p>
              </div>

              {/* Benefits Grid */}
              <div className="grid md:grid-cols-3 gap-4 mb-12">
                <div className="bg-white/[0.05] backdrop-blur-sm border border-white/10 rounded-xl p-6 text-center hover:bg-white/[0.08] transition">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-[rgb(var(--lz-brand-rgb))]/20 rounded-lg mb-3">
                    <Users size={24} className="text-[rgb(var(--lz-brand-rgb))]" />
                  </div>
                  <h3 className="font-bold text-white mb-2">Indique Amigos</h3>
                  <p className="text-sm text-white/60">
                    Compartilhe seu link único com agências e criadores
                  </p>
                </div>

                <div className="bg-white/[0.05] backdrop-blur-sm border border-white/10 rounded-xl p-6 text-center hover:bg-white/[0.08] transition">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-[rgb(var(--lz-brand-rgb))]/20 rounded-lg mb-3">
                    <TrendingUp size={24} className="text-[rgb(var(--lz-brand-rgb))]" />
                  </div>
                  <h3 className="font-bold text-white mb-2">Acompanhe Vendas</h3>
                  <p className="text-sm text-white/60">
                    Dashboard em tempo real com todas suas indicações
                  </p>
                </div>

                <div className="bg-white/[0.05] backdrop-blur-sm border border-white/10 rounded-xl p-6 text-center hover:bg-white/[0.08] transition">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-[rgb(var(--lz-brand-rgb))]/20 rounded-lg mb-3">
                    <DollarSign size={24} className="text-[rgb(var(--lz-brand-rgb))]" />
                  </div>
                  <h3 className="font-bold text-white mb-2">Ganhe Comissões</h3>
                  <p className="text-sm text-white/60">
                    Receba 10% de comissão por 12 meses de cada venda
                  </p>
                </div>
              </div>

              {/* CTA */}
              <div className="text-center">
                <button
                  onClick={() => setStep("form")}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[rgb(var(--lz-brand-rgb))] to-[rgba(var(--lz-brand-rgb),0.8)] hover:opacity-90 rounded-lg text-white font-bold text-lg transition"
                >
                  Começar Agora
                  <ArrowRight size={20} />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Form */}
              <div className="max-w-md mx-auto">
                <h2 className="text-3xl font-black text-white mb-2">Criar sua Conta</h2>
                <p className="text-white/60 mb-8">
                  Escolha um código único para seu link de referência
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      Código de Referência
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-white/60">modocriador.com.br/</span>
                      <input
                        type="text"
                        placeholder="seu-codigo"
                        value={formData.referralCode}
                        onChange={(e) =>
                          setFormData({
                            referralCode: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                          })
                        }
                        className="flex-1 px-4 py-2 bg-white/[0.08] border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 focus:bg-white/[0.12] transition"
                        required
                        minLength={3}
                        maxLength={30}
                      />
                    </div>
                    <p className="text-xs text-white/40 mt-2">
                      Apenas letras minúsculas, números e hífen
                    </p>
                  </div>

                  {error && (
                    <div className="flex gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !formData.referralCode.trim()}
                    className="w-full px-6 py-3 bg-gradient-to-r from-[rgb(var(--lz-brand-rgb))] to-[rgba(var(--lz-brand-rgb),0.8)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold transition flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        Criar Conta de Afiliado
                        <ArrowRight size={20} />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep("info")}
                    className="w-full px-6 py-3 bg-white/[0.08] hover:bg-white/[0.12] rounded-lg text-white font-semibold transition"
                  >
                    Voltar
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6 border-t border-white/5 text-xs text-white/30">
        <p>Modo Criador © 2026</p>
      </div>
    </div>
  );
}

function AffiliateExistingPanel({ affiliate }: { affiliate: any }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E23] to-[#151B2D] flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          <div className="bg-white/[0.05] backdrop-blur-sm border border-white/10 rounded-xl p-8 text-center">
            <h2 className="text-2xl font-black text-white mb-2">
              Você já tem uma conta!
            </h2>
            <p className="text-white/70 mb-6">
              Você já está inscrito no programa de afiliado da Modo Criador.
            </p>

            <a
              href="/afiliado/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[rgb(var(--lz-brand-rgb))] to-[rgba(var(--lz-brand-rgb),0.8)] hover:opacity-90 rounded-lg text-white font-bold transition"
            >
              Ver Dashboard
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
