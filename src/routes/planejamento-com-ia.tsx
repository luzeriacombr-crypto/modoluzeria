import { useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, FileText, MessageSquareText, PenLine, CheckCircle2, Star, Lock } from "lucide-react";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import { LIME, BG_BLUE, BG_GRAY, Reveal } from "@/components/luzeria/salesPageBlocks";
import { TIER_COLOR, TIER_ICON } from "@/components/luzeria/AgencyLevelIcons";

// Fundo animado do hero — pontos derivando devagar, conectados por linhas
// quando próximos (lembra rede neural). Aprovado pelo Junior via mockup
// (duas opções testadas: essa "constelação" e uma "varredura HUD").
// Desenhado num <canvas> em vez de SVG/DOM por performance (dezenas de
// elementos animados por frame). Não anima se o usuário pediu menos
// movimento (prefers-reduced-motion) — desenha só 1 frame parado.
function ConstellationBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const PARTICLE_COUNT = 40;
    const LINK_DIST = 130;
    let width = 0;
    let height = 0;
    let particles: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    let raf = 0;

    function seed() {
      particles = Array.from({ length: PARTICLE_COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: 1 + Math.random() * 1.6,
      }));
    }

    function resize() {
      const parent = canvas!.parentElement;
      width = parent?.clientWidth ?? window.innerWidth;
      height = parent?.clientHeight ?? 480;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }
    resize();
    window.addEventListener("resize", resize);

    function drawFrame() {
      ctx!.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;
      }
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            const op = (1 - dist / LINK_DIST) * 0.22;
            ctx!.strokeStyle = `rgba(215,255,63,${op.toFixed(3)})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }
      for (const p of particles) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(215,255,63,0.55)";
        ctx!.fill();
      }
    }

    function loop() {
      drawFrame();
      raf = requestAnimationFrame(loop);
    }
    if (reduced) drawFrame();
    else raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("resize", resize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 w-full h-full" aria-hidden="true" />;
}

export const Route = createFileRoute("/planejamento-com-ia")({
  component: PlanejamentoComIaPage,
  head: () => ({
    meta: [
      { title: "Prévia de Planejamento com IA — Modo Criador" },
      { name: "description", content: "A novidade que lê o histórico do seu cliente e monta uma prévia completa do próximo mês — liberada a partir do nível Prata." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const HOW_IT_WORKS = [
  {
    icon: FileText,
    title: "Ela lê o que sua agência já sabe",
    desc: "Histórico de posts e reels do cliente, o último roteiro ou planejamento escrito, os arquivos de marca no Drive e os concorrentes que você informou na Ficha do Cliente.",
  },
  {
    icon: MessageSquareText,
    title: "Você pode colar o contexto da reunião",
    desc: "Teve uma call com o cliente essa semana? Cola as anotações (ou a transcrição inteira) na hora de gerar — isso pesa mais do que qualquer histórico antigo.",
  },
  {
    icon: Sparkles,
    title: "A IA monta de 4 a 12 sugestões completas",
    desc: "Cada uma já vem com o texto de produção pronto (roteiro de reel, slides de carrossel ou texto de post) e a legenda de publicação, separados — não é um resumo genérico.",
  },
  {
    icon: PenLine,
    title: "Você revisa, edita e decide o destino",
    desc: "Nada é salvo sozinho. Ajusta o que quiser e escolhe: salvar como Planejamento, ou já aprovar direto pros Roteiros de um mês específico.",
  },
];

function ExampleCard({ tag, title, brief, caption }: { tag: string; title: string; brief: string; caption: string }) {
  return (
    <div className="rounded-2xl p-5 border" style={{ background: BG_BLUE, borderColor: "rgba(255,255,255,0.08)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full" style={{ background: "rgba(215,255,63,0.14)", color: LIME }}>
          {tag}
        </span>
        <span className="text-[13.5px] font-black text-white">{title}</span>
      </div>
      <div className="mb-3.5">
        <div className="text-[10.5px] font-bold uppercase tracking-wide text-white/35 mb-1.5">Texto de produção (Briefing)</div>
        <p className="text-white/60 text-[12.5px] leading-relaxed whitespace-pre-line">{brief}</p>
      </div>
      <div>
        <div className="text-[10.5px] font-bold uppercase tracking-wide text-white/35 mb-1.5">Legenda a publicar</div>
        <p className="text-white/60 text-[12.5px] leading-relaxed whitespace-pre-line">{caption}</p>
      </div>
    </div>
  );
}

const ACCESS_STEPS = [
  "Abra a Ficha de um cliente e vá na aba “Roteiros & Planejamento”.",
  "Clique em “Gerar prévia de planejamento com IA”.",
  "Se teve reunião com o cliente recentemente, cola as anotações ou a transcrição no campo de contexto — é opcional, mas melhora bastante o resultado.",
  "Aguarde a geração (a IA pesquisa os concorrentes que você cadastrou, se houver algum).",
  "Revise cada sugestão, avalie com as estrelas, e escolha: “Salvar como Planejamento” ou “Aprovar e enviar pros Roteiros”.",
];

function PlanejamentoComIaPage() {
  const prataColor = TIER_COLOR["Prata"];
  const PrataIcon = TIER_ICON["Prata"];
  return (
    <div className="min-h-screen text-white" style={{ background: BG_BLUE, fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <header className="flex items-center justify-between px-5 sm:px-10 py-5 border-b border-white/10">
        <div className="flex items-center justify-between max-w-[720px] mx-auto w-full">
          <Link to="/"><ModoCriadorLogo variant="brand" className="h-6 w-auto" /></Link>
          <Link to="/minhas-tarefas" className="text-sm text-white/60 hover:text-white transition">← Voltar pro app</Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <ConstellationBackground />
        <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse 80% 60% at 50% 0%, rgba(215,255,63,0.12), transparent)` }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(180deg, ${BG_BLUE}00 0%, ${BG_BLUE}00 55%, ${BG_BLUE} 100%)` }} />
        <Reveal className="relative px-5 sm:px-10 max-w-[720px] mx-auto pt-16 pb-14 text-center">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full mb-6" style={{ background: LIME, color: BG_BLUE }}>
            <Sparkles size={12} /> Novidade
          </span>
          <h1 className="font-criador-serif normal-case text-4xl sm:text-6xl leading-[1.05] mb-5" style={{ textWrap: "balance" as any }}>
            Uma <span style={{ color: LIME }}>prévia de planejamento</span> inteira, pronta antes de você abrir a agenda.
          </h1>
          <p className="text-white/60 text-base max-w-md mx-auto leading-relaxed">
            A IA lê o histórico real do cliente, os arquivos de marca e os concorrentes, e monta um mês inteiro de posts e reels
            já com texto de produção e legenda prontos. Você só revisa.
          </p>
        </Reveal>
      </section>

      <section className="px-5 sm:px-10 max-w-[640px] mx-auto py-14">
        <div className="text-[11px] font-black uppercase tracking-wider text-white/40 mb-3">Como funciona</div>
        <h2 className="font-criador-serif normal-case text-2xl sm:text-3xl mb-10">Da agenda vazia ao mês planejado</h2>
        <style>{`
          @media (prefers-reduced-motion: no-preference) {
            @keyframes piaFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
            @keyframes piaPulse { 0%, 100% { box-shadow: 0 0 0 5px rgba(215,255,63,0.08); } 50% { box-shadow: 0 0 0 9px rgba(215,255,63,0.14); } }
            .pia-float-0 { animation: piaFloat 5.2s ease-in-out infinite; }
            .pia-float-1 { animation: piaFloat 6s ease-in-out infinite; animation-delay: -1.5s; }
            .pia-float-2 { animation: piaFloat 5.6s ease-in-out infinite; animation-delay: -3.2s; }
            .pia-float-3 { animation: piaFloat 6.4s ease-in-out infinite; animation-delay: -4.6s; }
            .pia-node { animation: piaPulse 3.6s ease-in-out infinite; }
          }
        `}</style>
        <div className="flex flex-col">
          {HOW_IT_WORKS.map((s, i) => (
            <div key={s.title} className="flex gap-4 sm:gap-5">
              <div className="flex flex-col items-center shrink-0">
                <div
                  className="pia-node w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(215,255,63,0.12)", color: LIME, boxShadow: "0 0 0 5px rgba(215,255,63,0.08)" }}
                >
                  <s.icon size={18} />
                </div>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="w-px flex-1 my-1" style={{ background: "linear-gradient(180deg, rgba(215,255,63,0.35), rgba(215,255,63,0.05))", minHeight: 36 }} />
                )}
              </div>
              <div className={`pb-10 pt-1.5 pia-float-${i % 4}`}>
                <div className="text-[13.5px] font-black mb-1.5">{s.title}</div>
                <div className="text-[12.5px] text-white/40 leading-relaxed max-w-[440px]">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ background: BG_GRAY }} className="border-y border-white/10">
        <div className="px-5 sm:px-10 max-w-[720px] mx-auto py-14">
          <div className="text-[11px] font-black uppercase tracking-wider text-white/40 mb-3">Veja na prática</div>
          <h2 className="font-criador-serif normal-case text-2xl sm:text-3xl mb-2">Um exemplo real, gerado de verdade</h2>
          <p className="text-white/40 text-[12.5px] mb-8">
            Recorte de uma prévia gerada pra um cliente real da Luzeria — nome da marca e produtos trocados por termos genéricos, só pra preservar a privacidade do cliente.
          </p>
          <div className="grid sm:grid-cols-2 gap-3.5">
            <ExampleCard
              tag="Post · Carrossel"
              title="A conversa antes de qualquer entrega"
              brief={`SLIDE 1: Antes de qualquer entrega sair daqui, existe uma conversa que faz toda diferença.
SLIDE 2: A nossa equipe escuta rotina, objetivo e histórico de quem chega até nós.
SLIDE 3: Só depois dessa escuta a gente decide o que realmente faz sentido pro seu caso.
SLIDE 4: É esse cuidado que garante um atendimento pensado pra você, não pra qualquer pessoa.
SLIDE 5: Vem conversar com a nossa equipe.`}
              caption={`Antes de qualquer entrega sair daqui, tem uma conversa que muda tudo.
A gente escuta rotina, objetivo e histórico de quem chega até nós, e só depois disso decide o que faz mais sentido pro seu caso.
Vem conversar com a gente 👇`}
            />
            <ExampleCard
              tag="Reel · Direto pra câmera"
              title="Por que o prazo é mais curto"
              brief={`Toda semana alguém me pergunta por que o nosso produto tem prazo de validade mais curto que o de prateleira.
A resposta é simples: ele é feito na hora, sob medida pra você, sem os conservantes que garantem meses de estoque na gôndola.
Isso não é desvantagem, é consequência de ser fresco, feito com o ajuste certo pro seu caso e acompanhado de perto do início ao fim.
Ficou com alguma dúvida? Comenta aqui que a gente responde.`}
              caption={`Prazo de validade curto assusta, mas não é defeito.
É o preço de algo ser feito na hora, sem os conservantes que mantêm um produto de prateleira por meses.
Se ficou com dúvida, comenta aqui que a gente explica 🧴`}
            />
          </div>
          <p className="text-white/30 text-[11px] mt-4 flex items-center gap-1.5">
            <CheckCircle2 size={12} /> Cada geração real entrega entre 4 e 12 peças assim, mais um resumo da estratégia do mês.
          </p>
        </div>
      </section>

      <section className="px-5 sm:px-10 max-w-[720px] mx-auto py-14">
        <div className="text-[11px] font-black uppercase tracking-wider text-white/40 mb-3">Passo a passo</div>
        <h2 className="font-criador-serif normal-case text-2xl sm:text-3xl mb-8">Como acessar</h2>
        <div className="flex flex-col gap-3">
          {ACCESS_STEPS.map((s, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black" style={{ background: "rgba(215,255,63,0.14)", color: LIME }}>
                {i + 1}
              </span>
              <p className="text-white/60 text-[13px] leading-relaxed pt-0.5">{s}</p>
            </div>
          ))}
        </div>
        <Link
          to="/ajuda"
          search={{ tab: "tutoriais" } as any}
          className="inline-flex items-center gap-1.5 mt-6 text-[12.5px] font-bold hover:opacity-80 transition"
          style={{ color: LIME }}
        >
          Ver o tutorial completo na Central de Ajuda →
        </Link>
      </section>

      <section className="px-5 sm:px-10 max-w-[720px] mx-auto pb-16">
        <div className="rounded-3xl border p-7 sm:p-9 text-center" style={{ background: `linear-gradient(180deg, ${BG_GRAY}, ${BG_BLUE})`, borderColor: "rgba(255,255,255,0.14)" }}>
          <div className="w-[64px] h-[64px] rounded-[18px] flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `color-mix(in srgb, ${prataColor} 20%, transparent)`, color: prataColor }}>
            <PrataIcon size={32} />
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest mb-3" style={{ color: prataColor }}>
            <Lock size={11} /> Exclusiva a partir do nível Prata
          </div>
          <h2 className="font-criador-serif normal-case text-2xl sm:text-3xl mb-3">Essa novidade se desbloqueia com o uso</h2>
          <p className="text-white/50 text-[13.5px] max-w-md mx-auto leading-relaxed mb-6">
            A Prévia de Planejamento com IA é a primeira função exclusiva do Programa de Níveis. Toda agência que chega em{" "}
            <b className="text-white">Prata I</b> desbloqueia pra todos os clientes, automaticamente — sem pedir liberação pra ninguém.
          </p>
          <Link
            to="/programa-de-niveis"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-black transition hover:opacity-90"
            style={{ background: LIME, color: BG_BLUE }}
          >
            <Star size={14} /> Ver meu nível e como subir
          </Link>
        </div>
      </section>

      <footer className="px-5 sm:px-10 py-10 text-center text-white/30 text-xs">
        Modo <span className="font-criador-serif">Criador</span> — versão beta: quanto mais contexto (base de conhecimento, briefing do cliente), melhor o resultado.
      </footer>
    </div>
  );
}
