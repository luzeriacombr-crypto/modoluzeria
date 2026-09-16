import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import { LIME, BG_BLUE, BG_GRAY, BG_WHITE, Reveal } from "@/components/luzeria/salesPageBlocks";

export const Route = createFileRoute("/programa-de-indicacao")({
  component: ReferralProgramPage,
  head: () => ({
    meta: [
      { title: "Indique e Ganhe — Modo Criador" },
      { name: "description", content: "Indique outra agência pro Modo Criador: você ganha 1 mês grátis, ela ganha 15 dias extras de teste." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Timeline() {
  const items = [
    { label: "Indicação confirmada", title: "+1 mês entra no seu saldo", desc: "Aparece no seu histórico de indicações, com data e nome da agência indicada.", done: true },
    { label: "Próxima cobrança", title: "1 mês do saldo é consumido", desc: "Se você tiver saldo disponível, aquele ciclo de cobrança é automaticamente pulado.", done: true },
    { label: "Se você cancelar antes da confirmação", title: "O crédito fica pendente, não se perde", desc: "Ele só é liberado quando sua assinatura for reativada e a indicação cumprir as regras acima.", done: false },
  ];
  return (
    <div className="relative pl-7">
      <div className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-white/10" />
      <div className="space-y-7">
        {items.map((it, i) => (
          <div key={i} className="relative">
            <div
              className="absolute -left-7 top-1 w-2.5 h-2.5 rounded-full border-2"
              style={{ background: it.done ? LIME : BG_BLUE, borderColor: it.done ? LIME : "rgba(255,255,255,0.3)" }}
            />
            <div className="text-[11px] font-black uppercase tracking-wider text-white/40 mb-0.5">{it.label}</div>
            <div className="text-[15px] font-bold text-white mb-1">{it.title}</div>
            <div className="text-[13.5px] text-white/55 leading-relaxed">{it.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReferralProgramPage() {
  return (
    <div className="min-h-screen text-white" style={{ background: BG_BLUE, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <header className="flex items-center justify-between px-5 sm:px-10 py-5 border-b border-white/10">
        <div className="flex items-center justify-between max-w-[720px] mx-auto w-full">
          <Link to="/"><ModoCriadorLogo variant="brand" className="h-6 w-auto" /></Link>
          <Link to="/assinar" className="text-sm text-white/60 hover:text-white transition">← Voltar</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <style>{`
          @keyframes referral-grid-drift { from { background-position: 0 0; } to { background-position: 64px 64px; } }
          .referral-tech-grid {
            background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
            background-size: 32px 32px;
            animation: referral-grid-drift 18s linear infinite;
          }
        `}</style>
        <div
          className="referral-tech-grid pointer-events-none absolute inset-0"
          style={{ maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black 40%, transparent 100%)", WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black 40%, transparent 100%)" }}
        />
        <div className="pointer-events-none absolute -top-40 -right-24 w-[420px] h-[420px] rounded-full blur-[110px] opacity-[0.14]" style={{ background: "#4A6BFF" }} />
        <div className="pointer-events-none absolute -bottom-32 -left-24 w-[360px] h-[360px] rounded-full blur-[120px] opacity-[0.08]" style={{ background: LIME }} />

        <Reveal className="relative px-5 sm:px-10 max-w-[720px] mx-auto pt-16 pb-14 text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full mb-6" style={{ background: LIME, color: BG_BLUE }}>
            Programa de indicação
          </span>
          <h1 className="font-criador-serif normal-case text-4xl sm:text-6xl leading-[1.05] mb-5" style={{ textWrap: "balance" as any }}>
            Indique uma agência.<br />Ganhem os dois.
          </h1>
          <p className="text-white/60 text-base max-w-md mx-auto leading-relaxed">
            Toda vez que uma agência amiga assina o Modo Criador pelo seu link, vocês dois saem
            ganhando — sem letra miúda escondida. Veja como funciona.
          </p>
        </Reveal>
      </section>

      {/* O que cada lado ganha */}
      <section className="px-5 sm:px-10 max-w-[720px] mx-auto py-14">
        <div className="text-[11px] font-black uppercase tracking-wider text-white/40 mb-3">O que cada lado ganha</div>
        <h2 className="font-criador-serif normal-case text-2xl sm:text-3xl mb-2">Um benefício pra cada um</h2>
        <p className="text-white/55 text-sm max-w-md mb-8">O crédito é automático — nem você, nem seu amigo precisam pedir nada pra ninguém.</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="border border-white/10 rounded-2xl p-6 bg-white/[0.03]">
            <div className="text-xs font-bold uppercase tracking-wide text-white/45 mb-3">Quem indica</div>
            <div className="text-4xl font-black mb-2">1 mês <span className="text-base font-bold text-white/50">grátis</span></div>
            <p className="text-[13.5px] text-white/55 leading-relaxed mb-4">
              Por indicação confirmada — vira saldo na sua conta, aplicado automaticamente na próxima cobrança.
            </p>
            <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: LIME }}>
              <Check size={13} /> Até 3 meses acumulados
            </div>
          </div>
          <div className="border border-white/10 rounded-2xl p-6 bg-white/[0.03]">
            <div className="text-xs font-bold uppercase tracking-wide text-white/45 mb-3">Quem é indicado</div>
            <div className="text-4xl font-black mb-2">+15 dias <span className="text-base font-bold text-white/50">de teste</span></div>
            <p className="text-[13.5px] text-white/55 leading-relaxed mb-4">
              Em vez dos 30 dias padrão, seu amigo começa com <b className="text-white">45 dias</b> pra testar o Modo Criador com calma.
            </p>
            <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: LIME }}>
              <Check size={13} /> Aplicado na hora do cadastro
            </div>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section style={{ background: BG_GRAY }} className="border-y border-white/10">
        <div className="px-5 sm:px-10 max-w-[720px] mx-auto py-14">
          <div className="text-[11px] font-black uppercase tracking-wider text-white/40 mb-3">Do link até o crédito</div>
          <h2 className="font-criador-serif normal-case text-2xl sm:text-3xl mb-8">Como funciona, passo a passo</h2>
          <div className="divide-y divide-white/[0.06]">
            {[
              { n: "01", title: "Você compartilha seu link", desc: "Manda o link ou o código de indicação pra outra agência — WhatsApp, e-mail, onde for mais fácil." },
              { n: "02", title: "Seu amigo se cadastra com +15 dias de bônus", desc: "Ao criar a conta pelo seu link, o teste dele já nasce com 45 dias em vez de 30." },
              { n: "03", title: "Ele monta a agência dele dentro do trial", desc: "Pra indicação valer, dentro do período de teste ele precisa cadastrar pelo menos 1 cliente e adicionar pelo menos 1 membro da equipe." },
            ].map((s) => (
              <div key={s.n} className="flex gap-4 py-5">
                <div className="shrink-0 w-9 h-9 rounded-full border border-white/15 flex items-center justify-center text-xs font-black text-white/50">{s.n}</div>
                <div>
                  <div className="text-[15px] font-bold text-white mb-1">{s.title}</div>
                  <div className="text-[13.5px] text-white/55 leading-relaxed max-w-md">{s.desc}</div>
                </div>
              </div>
            ))}
            <div className="flex gap-4 py-5">
              <div className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: LIME, color: BG_BLUE }}>
                <Check size={16} strokeWidth={3} />
              </div>
              <div>
                <div className="text-[15px] font-bold text-white mb-1">Ele vira assinante e o seu mês é liberado</div>
                <div className="text-[13.5px] text-white/55 leading-relaxed max-w-md mb-2">
                  Depois que o teste dele vira assinatura paga de verdade — primeira cobrança confirmada —
                  e ele segue ativo por 60 dias, seu mês grátis é confirmado automaticamente.
                </div>
                <span className="inline-block text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full" style={{ color: LIME, background: "rgba(215,255,63,0.1)" }}>
                  Isso evita indicação fake que cancela em seguida
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Checklist */}
      <section className="px-5 sm:px-10 max-w-[720px] mx-auto py-14">
        <div className="text-[11px] font-black uppercase tracking-wider text-white/40 mb-3">Pra indicação valer</div>
        <h2 className="font-criador-serif normal-case text-2xl sm:text-3xl mb-2">Checklist rápido</h2>
        <p className="text-white/55 text-sm max-w-md mb-8">
          Se algum desses pontos não acontecer dentro do trial, a indicação simplesmente não conta —
          mas o cadastro do seu amigo continua normal, sem prejuízo pra ele.
        </p>
        <div className="border border-white/10 rounded-2xl bg-white/[0.03] divide-y divide-white/[0.06] px-6">
          {[
            <>Cadastro feito <b className="text-white">pelo link ou código</b> de indicação.</>,
            <><b className="text-white">E-mail novo no Modo Criador</b> — se o e-mail já existir, como dono ou membro de qualquer agência, o bônus não é aplicado.</>,
            <><b className="text-white">Pelo menos 1 cliente</b> cadastrado na agência dele, ainda dentro do trial.</>,
            <><b className="text-white">Pelo menos 1 membro da equipe</b> adicionado, ainda dentro do trial.</>,
            <>Assinatura paga confirmada e <b className="text-white">60 dias seguidos como cliente ativo</b> depois da primeira cobrança.</>,
          ].map((text, i) => (
            <div key={i} className="flex gap-3 py-4">
              <div className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5" style={{ background: "rgba(215,255,63,0.14)" }}>
                <Check size={11} strokeWidth={3} style={{ color: LIME }} />
              </div>
              <div className="text-[14.5px] text-white/75 leading-relaxed">{text}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Saldo / timeline */}
      <section style={{ background: BG_GRAY }} className="border-y border-white/10">
        <div className="px-5 sm:px-10 max-w-[720px] mx-auto py-14">
          <div className="text-[11px] font-black uppercase tracking-wider text-white/40 mb-3">Transparência total</div>
          <h2 className="font-criador-serif normal-case text-2xl sm:text-3xl mb-2">Seu saldo de meses grátis</h2>
          <p className="text-white/55 text-sm max-w-md mb-8">
            O crédito não é um desconto aplicado na hora — ele vira um saldo dentro da sua conta,
            com histórico completo de cada indicação.
          </p>
          <Timeline />
        </div>
      </section>

      {/* Regulamento */}
      <section className="px-5 sm:px-10 max-w-[720px] mx-auto py-14">
        <h2 className="text-xl font-black text-white mb-1">Regulamento</h2>
        <p className="text-white/40 text-xs mb-8">Última atualização: setembro de 2026</p>
        <ol className="space-y-5">
          {[
            "O Programa de Indicação é válido para qualquer agência com conta ativa no Modo Criador, que pode gerar seu próprio link/código de indicação em Configurações.",
            <>O bônus de <b className="text-white/90">+15 dias de teste</b> é aplicado automaticamente no momento do cadastro do indicado, desde que feito através do link ou código de indicação.</>,
            "Antes de aplicar o bônus de trial, verificamos se o e-mail usado no cadastro já existe no sistema — como dono de agência ou como membro de qualquer agência. Se já existir, o bônus não é concedido, mas o cadastro segue normalmente.",
            "Para a indicação valer, dentro do período de teste do indicado, a agência dele precisa ter pelo menos 1 cliente e pelo menos 1 membro da equipe cadastrados. Sem isso, a indicação não gera crédito.",
            <>O crédito de <b className="text-white/90">1 mês grátis</b> para quem indicou só é confirmado depois que o indicado passar do trial, tiver a primeira cobrança de assinatura confirmada, e permanecer como cliente pagante ativo por <b className="text-white/90">60 dias corridos</b>.</>,
            <>Cada agência pode acumular no máximo <b className="text-white/90">3 meses grátis</b> de saldo por vez, vindos de indicações diferentes.</>,
            "O crédito é aplicado como saldo interno na conta de quem indicou, consumido automaticamente (1 mês por ciclo) na cobrança mensal seguinte, e não pode ser convertido em dinheiro, transferido para outra conta ou usado como desconto parcial.",
            "Se a assinatura de quem indicou for cancelada antes da confirmação do crédito, o crédito não é perdido — ele fica pendente e é liberado quando a assinatura for reativada, respeitando as regras acima.",
            "A Luzeria Estúdio pode alterar ou encerrar o Programa de Indicação a qualquer momento, sem afetar créditos já confirmados.",
          ].map((text, i) => (
            <li key={i} className="flex gap-3 text-[13.5px] text-white/60 leading-relaxed">
              <span className="shrink-0 w-5 h-5 rounded border flex items-center justify-center text-[11px] font-black mt-0.5" style={{ color: LIME, borderColor: "rgba(215,255,63,0.35)" }}>
                {i + 1}
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section style={{ background: BG_WHITE, color: BG_BLUE }} className="border-t border-black/10">
        <Reveal className="px-5 sm:px-10 max-w-[560px] mx-auto py-16 text-center">
          <h2 className="font-criador-serif normal-case text-2xl sm:text-3xl mb-3">Quer começar a indicar?</h2>
          <p className="text-[#0A0E23]/60 text-sm mb-8">Seu link de indicação já está pronto em Configurações.</p>
          <Link
            to="/assinar"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-black uppercase text-sm transition-transform hover:scale-[1.03]"
            style={{ background: BG_BLUE, color: "#fff" }}
          >
            Ver meu link de indicação
          </Link>
        </Reveal>
      </section>

      <footer className="px-5 sm:px-10 py-10 text-center text-white/30 text-xs">
        Modo <span className="font-criador-serif">Criador</span> — desenvolvido pela Luzeria Estúdio.
      </footer>
    </div>
  );
}
