import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Gift, ArrowRight, Loader2 } from "lucide-react";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import { getPromotionCodeBySlug } from "@/lib/luzeria/promotion-affiliate.functions";

export function PromoPage({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const getPromotionCodeBySlugFn = useServerFn(getPromotionCodeBySlug);
  const [promo, setPromo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await getPromotionCodeBySlugFn({ data: { slug } });
        if (!data) {
          setError("Cupom não encontrado ou expirado");
          return;
        }
        setPromo(data);
      } catch (err) {
        setError("Erro ao carregar cupom");
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleSignup = () => {
    // Redirect to signup with promo code in URL
    navigate({
      to: "/assinar",
      search: { promoCode: promo?.code || "" },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0E23] to-[#151B2D] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-white/40" size={32} />
          <p className="text-white/60">Carregando cupom...</p>
        </div>
      </div>
    );
  }

  if (error || !promo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0E23] to-[#151B2D] flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center">
            <Gift size={48} className="mx-auto text-white/20 mb-4" />
            <h1 className="text-2xl font-black text-white mb-2">Cupom Inválido</h1>
            <p className="text-white/60 mb-6">
              {error || "Este cupom não existe ou expirou."}
            </p>
            <button
              onClick={() => navigate({ to: "/assinar" })}
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 rounded-lg text-white font-semibold transition"
            >
              Ver planos regulares
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E23] via-[#0F1425] to-[#1a2847] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
        <a href="/" className="text-sm text-white/60 hover:text-white transition">
          ← Voltar
        </a>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full">
          {/* Discount Badge */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[rgb(var(--lz-brand-rgb))] to-[rgba(var(--lz-brand-rgb),0.6)] rounded-2xl mb-4">
              <Gift size={40} className="text-white" />
            </div>

            <h1 className="text-4xl font-black text-white mb-2">
              {promo.discountPercent}% OFF
            </h1>
            <p className="text-lg text-white/70">
              {promo.name || "Promoção especial"}
            </p>
          </div>

          {/* Details Card */}
          <div className="bg-white/[0.05] backdrop-blur-sm border border-white/10 rounded-xl p-6 mb-6">
            {promo.description && (
              <p className="text-white/80 text-sm mb-4 leading-relaxed">
                {promo.description}
              </p>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Cupom:</span>
                <code className="bg-white/[0.08] px-3 py-1.5 rounded font-mono text-white font-semibold text-xs">
                  {promo.code}
                </code>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60">Desconto:</span>
                <span className="text-white font-semibold">{promo.discountPercent}% no primeiro mês</span>
              </div>

              {promo.validUntil && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Válido até:</span>
                  <span className="text-white font-semibold">
                    {new Date(promo.validUntil).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              )}

              {promo.maxUses && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Disponível:</span>
                  <span className="text-white font-semibold">
                    {promo.maxUses - promo.usedCount} de {promo.maxUses}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={handleSignup}
            className="w-full px-6 py-4 bg-gradient-to-r from-[rgb(var(--lz-brand-rgb))] to-[rgba(var(--lz-brand-rgb),0.8)] hover:opacity-90 rounded-lg text-white font-bold text-lg transition flex items-center justify-center gap-2 mb-3"
          >
            Aproveitar Oferta
            <ArrowRight size={20} />
          </button>

          <p className="text-center text-xs text-white/40">
            Crie sua conta grátis e receba o desconto automaticamente
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6 border-t border-white/5 text-xs text-white/30">
        <p>Modo Criador © 2026</p>
      </div>
    </div>
  );
}
