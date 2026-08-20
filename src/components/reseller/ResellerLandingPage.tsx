import { Palette, Boxes, Wallet, MessageCircle, ArrowRight, ExternalLink } from "lucide-react";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";

const WHATSAPP_HREF =
  "https://wa.me/5599991135486?text=" +
  encodeURIComponent("Oi! Vi a página de revenda white label do Modo Criador e quero saber mais.");

const STEPS = [
  {
    title: "Você fala com a gente",
    text: "Manda mensagem contando um pouco da sua agência. A gente combina o desconto de atacado e aprova sua conta como revendedora.",
  },
  {
    title: "Você cria as instâncias",
    text: "Sem esperar aprovação a cada cliente novo: você mesma cadastra cada instância, já com nome e marca do cliente final, direto do seu painel de revenda.",
  },
  {
    title: "Você entrega e cobra do seu jeito",
    text: "Cada cliente recebe o Modo Criador com a cara da sua agência. Você decide quanto cobra dele — a gente nunca aparece nem cobra o cliente final.",
  },
  {
    title: "Uma fatura só, por mês",
    text: "A gente cobra só de você, uma vez por mês, a soma do valor de atacado de todas as instâncias ativas. Cresce ou diminui junto com o número de clientes.",
  },
];

const BENEFITS = [
  {
    icon: Palette,
    title: "Marca própria em cada instância",
    text: "Logo, cores e nome da sua agência — o cliente final nunca vê o Modo Criador, vê a ferramenta com a cara de vocês.",
  },
  {
    icon: Boxes,
    title: "Você cria quando quiser",
    text: "Sem depender da gente pra cada cliente novo. O painel de revenda é seu: cadastra o cliente e a instância já nasce pronta.",
  },
  {
    icon: Wallet,
    title: "Preço de atacado fixo",
    text: "Você paga um valor fechado por instância, bem abaixo do preço de tabela. O que cobra do seu cliente é decisão sua.",
  },
];

export function ResellerLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0E23] to-[#151B2D] flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
        <a href="/" className="text-sm text-white/60 hover:text-white transition">← Voltar</a>
      </div>

      <div className="flex-1 px-4 py-14">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
              Revenda o Modo Criador com a sua marca
            </h1>
            <p className="text-lg md:text-xl text-white/70 max-w-xl mx-auto">
              Compre instâncias no atacado, entregue com a identidade da sua agência e revenda
              pros seus clientes pelo preço que você definir.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-16">
            {BENEFITS.map((b) => (
              <div key={b.title} className="bg-white/[0.05] backdrop-blur-sm border border-white/10 rounded-xl p-6 hover:bg-white/[0.08] transition">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-[rgb(var(--lz-brand-rgb))]/20 rounded-lg mb-3">
                  <b.icon size={22} className="text-[rgb(var(--lz-brand-rgb))]" />
                </div>
                <h3 className="font-bold text-white mb-1.5">{b.title}</h3>
                <p className="text-sm text-white/60">{b.text}</p>
              </div>
            ))}
          </div>

          <div className="mb-16">
            <h2 className="text-2xl font-black text-white text-center mb-8">Como funciona</h2>
            <div className="space-y-4">
              {STEPS.map((s, i) => (
                <div key={s.title} className="flex gap-4 bg-white/[0.04] border border-white/10 rounded-xl p-5">
                  <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm"
                    style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
                    {i + 1}
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-1">{s.title}</h3>
                    <p className="text-sm text-white/60">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/[0.05] border border-white/10 rounded-2xl p-6 md:p-8 mb-16">
            <h2 className="text-xl font-black text-white mb-4">O que você precisa saber</h2>
            <ul className="space-y-3 text-sm text-white/70">
              <li className="flex gap-2"><span className="text-[rgb(var(--lz-brand-rgb))] shrink-0">•</span>
                O que o cliente final paga é combinado entre você e ele — o Modo Criador não participa dessa cobrança nem aparece pra ele.</li>
              <li className="flex gap-2"><span className="text-[rgb(var(--lz-brand-rgb))] shrink-0">•</span>
                Você recebe uma fatura mensal única, com o valor de atacado somado de todas as instâncias ativas.</li>
              <li className="flex gap-2"><span className="text-[rgb(var(--lz-brand-rgb))] shrink-0">•</span>
                Cada instância já sai com Drive, branding e todas as funções do Modo Criador — o mesmo produto que sua agência já usa.</li>
              <li className="flex gap-2"><span className="text-[rgb(var(--lz-brand-rgb))] shrink-0">•</span>
                Não tem contrato de fidelidade nem número mínimo de instâncias pra começar.</li>
            </ul>
          </div>

          <div className="text-center">
            <p className="text-white/60 mb-4">Bora conversar sobre a sua revenda?</p>
            <a
              href={WHATSAPP_HREF}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg text-[#0D0D0D] transition hover:opacity-90"
              style={{ backgroundColor: "#25D366" }}
            >
              <MessageCircle size={20} /> Quero ser revendedor
              <ArrowRight size={18} />
            </a>
          </div>
        </div>
      </div>

      <div className="text-center py-6 border-t border-white/5 text-xs text-white/30">
        <p>Modo Criador © 2026</p>
      </div>
    </div>
  );
}
