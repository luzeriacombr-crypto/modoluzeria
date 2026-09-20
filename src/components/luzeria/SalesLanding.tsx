// Seções novas da página de vendas (hero com prints reais, números da
// plataforma, antes/depois, funções por área, IA de planejamento). Layout
// aprovado pelo Junior via mockup. Os prints são da conta demo (nomes e
// rostos fictícios) — nunca colocar aqui print de cliente real.
import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X, ArrowRight, Link2, HardDrive, Clock, Send, Sparkles, LayoutGrid, CalendarDays, Zap, FileText, Image as ImageIcon,
  UserPlus, BarChart3, Wallet, Trophy, Upload, MessageCircle, Check,
} from "lucide-react";
import { getPublicSalesStats } from "@/lib/luzeria/sales-stats.functions";
import { ConstellationBackground } from "./ConstellationBackground";
import { LIME, BG_BLUE, BG_GRAY, BG_WHITE, Reveal } from "./salesPageBlocks";
import boardImg from "@/assets/sales/board.webp";
import approvalImg from "@/assets/sales/aprovacao-mobile.webp";
import dashboardImg from "@/assets/sales/dashboard.webp";
import calendarImg from "@/assets/sales/calendario.webp";
import rankingImg from "@/assets/sales/ranking.webp";
import publishImg from "@/assets/sales/publicar.webp";

const SERIF = "font-criador-serif normal-case";

function Eyebrow({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <p className="text-[11px] font-black uppercase tracking-[0.14em] mb-3.5" style={{ color: dark ? "rgba(10,14,35,0.5)" : "rgba(255,255,255,0.45)" }}>
      {children}
    </p>
  );
}

/* ============ molduras ============ */

function BrowserFrame({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`rounded-2xl overflow-hidden border ${className}`}
      style={{ background: "#0E1220", borderColor: "rgba(255,255,255,0.1)", boxShadow: "0 40px 90px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)" }}>
      <div className="flex gap-1.5 px-3.5 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}>
        <i className="w-2.5 h-2.5 rounded-full bg-white/20" /><i className="w-2.5 h-2.5 rounded-full bg-white/20" /><i className="w-2.5 h-2.5 rounded-full bg-white/20" />
      </div>
      <img src={src} alt={alt} loading="lazy" className="block w-full h-auto" />
    </div>
  );
}

function PhoneFrame({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative rounded-[2.4rem] p-[7px] ${className}`}
      style={{ background: "linear-gradient(160deg,#262A3F,#0B0E1E)", boxShadow: "0 40px 80px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.12)" }}>
      <div className="absolute left-1/2 -translate-x-1/2 top-[13px] h-[14px] w-[64px] rounded-full bg-black z-10 opacity-80" />
      <img src={src} alt={alt} loading="lazy" className="block w-full h-auto rounded-[1.9rem]" />
    </div>
  );
}

/* ============ hero ============ */

export function SalesHero({ onCta }: { onCta: () => void }) {
  return (
    <section className="relative overflow-hidden"
      style={{ background: `radial-gradient(ellipse 70% 60% at 75% 10%, rgba(74,158,255,0.18), transparent), radial-gradient(ellipse 60% 50% at 10% 0%, rgba(215,255,63,0.1), transparent), ${BG_BLUE}` }}>
      <div className="absolute inset-0 pointer-events-none"><ConstellationBackground count={38} alpha={0.75} /></div>
      <div className="relative max-w-[1100px] mx-auto px-5 sm:px-10 pt-10 pb-20 lg:pt-16 lg:pb-24 grid lg:grid-cols-[1.02fr_1fr] gap-12 items-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full text-[12.5px] font-semibold mb-5"
            style={{ border: "1px solid rgba(215,255,63,0.35)", background: "rgba(215,255,63,0.08)", color: "rgba(255,255,255,0.85)" }}>
            <b className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: LIME, color: BG_BLUE }}>Novo</b>
            Planejamento mensal com IA
          </div>
          <h1 className="font-black uppercase leading-[1.02] tracking-[-0.03em] text-[clamp(36px,5.6vw,64px)]">
            Pare de perder cliente por falta de organização.
            <span className={`block mt-1.5 ${SERIF}`} style={{ color: LIME, fontWeight: 400, fontStyle: "italic", textTransform: "none", letterSpacing: "-0.01em" }}>
              Entregue mais, com menos correria.
            </span>
          </h1>
          <p className="text-white/65 text-lg max-w-[520px] mt-5 mb-7 leading-relaxed">
            Calendário, aprovação do cliente, publicação no Instagram, equipe e IA num lugar só — sem planilha, sem arquivo perdido no WhatsApp.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={onCta} className="inline-flex items-center gap-2 font-black text-sm px-6 py-3.5 rounded-full transition hover:-translate-y-0.5" style={{ background: LIME, color: BG_BLUE }}>
              Testar 30 dias grátis <ArrowRight size={16} />
            </button>
            <a href="#funcoes" className="inline-flex items-center font-bold text-sm px-6 py-3.5 rounded-full border transition hover:bg-white/5" style={{ borderColor: "rgba(255,255,255,0.25)" }}>
              Ver o que tem dentro
            </a>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 text-[12.5px] text-white/45">
            {["Sem cartão", "Cancele quando quiser", "Suporte em português"].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5"><Check size={12} style={{ color: LIME }} strokeWidth={3} />{t}</span>
            ))}
          </div>
        </Reveal>

        <Reveal className="relative pt-4 pb-2">
          <BrowserFrame src={boardImg} alt="Board de posts de um cliente no Modo Criador" />
          <div className="lz-float-b absolute -top-4 -right-1 sm:-right-4 bg-white text-[#0A0E23] rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 text-xs shadow-2xl">
            <span className="w-8 h-8 rounded-[10px] flex items-center justify-center font-black text-sm" style={{ background: "#E7F9D6", color: "#2E7D32" }}>✓</span>
            <span><b className="block font-extrabold">Post aprovado</b><span className="text-[#0A0E23]/55 text-[11px]">Cliente aprovou em um toque</span></span>
          </div>
          <div className="lz-float-a hidden sm:flex absolute -bottom-3 -left-4 lg:-left-8 bg-white text-[#0A0E23] rounded-2xl px-3.5 py-2.5 items-center gap-2.5 text-xs shadow-2xl">
            <span className="w-8 h-8 rounded-[10px] flex items-center justify-center font-black text-sm" style={{ background: "#EDE7FF", color: "#6D3FE0" }}>✨</span>
            <span><b className="block font-extrabold">Planejamento pronto</b><span className="text-[#0A0E23]/55 text-[11px]">A IA montou a prévia de outubro</span></span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============ números reais ============ */

const FALLBACK_STATS = { clients: 230, deliveries: 1365 };

export function SalesNumbers() {
  const { data } = useQuery({ queryKey: ["sales-stats"], queryFn: () => getPublicSalesStats(), staleTime: 60 * 60_000, retry: false });
  const s = data ?? FALLBACK_STATS;
  const roundedDeliveries = Math.max(100, Math.floor(s.deliveries / 100) * 100);
  const fmt = (n: number) => n.toLocaleString("pt-BR");
  const items = [
    { value: fmt(s.clients), label: "clientes organizados na plataforma" },
    { value: `+${fmt(roundedDeliveries)}`, label: "posts, reels e stories entregues" },
    { value: "30 dias", label: "de teste grátis, sem cartão" },
  ];
  return (
    <section style={{ background: BG_WHITE, color: BG_BLUE }} className="border-b border-black/10">
      <div className="max-w-[1100px] mx-auto px-5 sm:px-10 grid grid-cols-1 sm:grid-cols-3">
        {items.map((it, i) => (
          <div key={it.label} className={`py-8 sm:px-6 text-center sm:text-left ${i > 0 ? "border-t sm:border-t-0 sm:border-l" : ""}`} style={{ borderColor: "rgba(10,14,35,0.12)" }}>
            <div className={`${SERIF} text-[clamp(40px,5vw,58px)] leading-none`} style={{ fontStyle: "italic", letterSpacing: "-0.02em" }}>{it.value}</div>
            <div className="mt-2 text-[13.5px] font-medium" style={{ color: "rgba(10,14,35,0.62)" }}>{it.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============ antes / depois ============ */

const BEFORE_AFTER: { icon: ReactNode; before: string; title: string; desc: string }[] = [
  { icon: <Link2 size={20} />, before: "Cliente some por dias sem aprovar o post", title: "Link de aprovação bonito", desc: "Ele vê o post como vai ficar no Instagram e aprova em um toque, sem login." },
  { icon: <HardDrive size={20} />, before: "Arquivo perdido no meio do WhatsApp", title: "Tudo no Google Drive da agência", desc: "Cada arquivo salvo e organizado por cliente e por mês, automaticamente." },
  { icon: <Clock size={20} />, before: "Ninguém sabe quem faz o quê nem o prazo", title: "Responsável e prazo em cada entrega", desc: "Com aviso no celular pra equipe não deixar nada escapar." },
  { icon: <Send size={20} />, before: "Postar é lembrar, abrir o Instagram e subir na mão", title: "Publica sozinho depois da aprovação", desc: "Pela API oficial da Meta — sem abrir o Instagram nem outro app de agendamento." },
  { icon: <Sparkles size={20} />, before: "Planejar o mês de cada cliente leva dias", title: "A IA monta a prévia do mês", desc: "Usando o histórico, a marca e os concorrentes de cada cliente." },
];

export function SalesBeforeAfter() {
  return (
    <section style={{ background: BG_WHITE, color: BG_BLUE }}>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-10 py-20">
        <Reveal className="max-w-[680px] mb-11">
          <Eyebrow dark>O antes e o depois</Eyebrow>
          <h2 className={`${SERIF} text-[clamp(32px,4.6vw,52px)] leading-[1.05]`} style={{ fontStyle: "italic" }}>Se você se reconheceu em algum desses, é pra você.</h2>
        </Reveal>
        <div className="flex flex-col gap-3">
          {BEFORE_AFTER.map((r) => (
            <Reveal key={r.title} className="grid md:grid-cols-[minmax(0,0.72fr)_auto_minmax(0,1.28fr)] items-center gap-2.5 md:gap-4">
              <div className="flex items-center gap-3 rounded-xl px-4 py-3.5" style={{ background: "rgba(10,14,35,0.05)" }}>
                <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(255,107,107,0.16)", color: "#E5484D" }}><X size={13} strokeWidth={3} /></span>
                <span className="text-[14.5px] font-medium leading-snug" style={{ color: "rgba(10,14,35,0.55)" }}>{r.before}</span>
              </div>
              <ArrowRight size={18} className="hidden md:block" style={{ color: "rgba(10,14,35,0.35)" }} />
              <div className="flex items-center gap-4 rounded-2xl px-5 py-5" style={{ background: BG_BLUE, color: "#fff", boxShadow: "0 18px 40px -22px rgba(10,14,35,0.55)" }}>
                <span className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(215,255,63,0.14)", color: LIME }}>{r.icon}</span>
                <div>
                  <div className="font-extrabold text-[16.5px] leading-tight" style={{ color: LIME }}>{r.title}</div>
                  <div className="text-[13.5px] mt-1 leading-snug text-white/65">{r.desc}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ funções por área ============ */

type Feat = { icon: ReactNode; title: string; desc: string; chip?: string };

function AiOutputCard() {
  return (
    <div className="rounded-2xl p-5 border" style={{ background: "#0E1220", borderColor: "rgba(255,255,255,0.1)", boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}>
      <div className="text-xs text-white/55 pb-3.5 mb-3.5 border-b border-white/10 leading-relaxed">
        <b style={{ color: LIME }}>Resumo da estratégia:</b> mantém o eixo de preço justo com acompanhamento especializado, evita repetir temas recentes e amarra as datas do mês a um serviço real.
      </div>
      {[
        { tag: "Post · Carrossel", title: "A conversa antes de qualquer entrega", brief: "SLIDE 1: Antes de qualquer entrega sair daqui, existe uma conversa que faz toda diferença.\nSLIDE 2: A nossa equipe escuta rotina, objetivo e histórico de quem chega até nós.", cap: "Antes de qualquer entrega sair daqui, tem uma conversa que muda tudo. Vem conversar com a gente 👇" },
        { tag: "Reel", title: "Por que o prazo é mais curto", brief: "Toda semana alguém me pergunta por que o nosso produto tem prazo de validade mais curto que o de prateleira…", cap: "" },
      ].map((p) => (
        <div key={p.title} className="rounded-xl p-3.5 mb-2.5 last:mb-0" style={{ background: "rgba(255,255,255,0.04)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: "rgba(215,255,63,0.14)", color: LIME }}>{p.tag}</span>
            <span className="text-[13px] font-extrabold">{p.title}</span>
          </div>
          <div className="text-[9.5px] font-bold uppercase tracking-widest text-white/35 mb-1">Texto de produção</div>
          <p className="text-xs text-white/65 leading-relaxed whitespace-pre-line">{p.brief}</p>
          {p.cap && (<>
            <div className="text-[9.5px] font-bold uppercase tracking-widest text-white/35 mt-2.5 mb-1">Legenda a publicar</div>
            <p className="text-xs text-white/65 leading-relaxed">{p.cap}</p>
          </>)}
        </div>
      ))}
    </div>
  );
}

const TABS: { id: string; label: string; feats: Feat[]; visual: ReactNode }[] = [
  {
    id: "producao", label: "Produção",
    feats: [
      { icon: <LayoutGrid size={19} />, title: "Board por cliente e por mês", desc: "Posts, reels e stories num quadro visual, com status, responsável, prazo e checklist em cada card." },
      { icon: <CalendarDays size={19} />, title: "Calendário geral", desc: "Tudo que vai ao ar em qualquer dia, de qualquer cliente, com a miniatura do post ao passar o mouse." },
      { icon: <Zap size={19} />, title: "Automações", desc: "Regras do tipo \"quando acontecer X, faça Y\": cobrar aprovação parada, avisar prazo, criar tarefa. Com modelos prontos.", chip: "16 gatilhos · 9 ações" },
    ],
    visual: <BrowserFrame src={calendarImg} alt="Calendário geral com posts de vários clientes" />,
  },
  {
    id: "aprovacao", label: "Aprovação",
    feats: [
      { icon: <Link2 size={19} />, title: "Link de aprovação sem login", desc: "O cliente vê o post do jeito que vai ficar no Instagram e aprova ou pede ajuste pelo celular, sem criar conta." },
      { icon: <FileText size={19} />, title: "Roteiros e planejamento aprovados", desc: "Manda o roteiro ou o planejamento do mês pro cliente, ele responde por item e você vê tudo organizado." },
      { icon: <ImageIcon size={19} />, title: "Seleção e entrega de fotos", desc: "Galeria a partir do Drive, com marca d'água na escolha e download em alta ou tamanho pra redes na entrega." },
    ],
    visual: <div className="flex justify-center"><PhoneFrame src={approvalImg} alt="Cliente aprovando um post pelo celular" className="w-[min(260px,70%)]" /></div>,
  },
  {
    id: "publicacao", label: "Publicação",
    feats: [
      { icon: <Send size={19} />, title: "Instagram e Facebook", desc: "Publica posts, carrosséis, reels e stories direto do Modo Criador, com autorização oficial da Meta.", chip: "App Review aprovado" },
      { icon: <Clock size={19} />, title: "Programa e esquece", desc: "Agendou, aprovou, saiu. Se algo falhar, você é avisado na hora com o motivo." },
      { icon: <UserPlus size={19} />, title: "Cliente conecta o próprio Instagram", desc: "Manda um link e ele conecta sozinho — sem passar login e senha pra você." },
    ],
    visual: <BrowserFrame src={publishImg} alt="Tela de publicação e programação no Instagram" />,
  },
  {
    id: "gestao", label: "Gestão",
    feats: [
      { icon: <BarChart3 size={19} />, title: "Dashboard e relatórios", desc: "Entregas, gargalos e ranking de produtividade da equipe, com retrabalho e prazos cumpridos." },
      { icon: <Wallet size={19} />, title: "Cobrança, margem e contrato", desc: "Vencimento de cada cliente, custo por hora e margem, e contrato com assinatura por link." },
      { icon: <Trophy size={19} />, title: "Programa de Níveis", desc: "Da Bronze à Lendária: sua agência sobe de nível usando o sistema e desbloqueia novidades." },
    ],
    visual: (
      <div className="flex flex-col gap-4">
        <BrowserFrame src={dashboardImg} alt="Dashboard de entregas do mês" />
        <img src={rankingImg} alt="Ranking de produtividade da equipe" loading="lazy" className="block w-full h-auto rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
      </div>
    ),
  },
  {
    id: "ia", label: "Inteligência artificial",
    feats: [
      { icon: <Sparkles size={19} />, title: "Planejamento do próximo mês", desc: "A IA lê o histórico, a marca e os concorrentes do cliente e monta as sugestões com texto e legenda prontos.", chip: "Novo" },
      { icon: <Upload size={19} />, title: "Importação de clientes", desc: "Manda uma planilha, PDF ou até um print e ela organiza todos os seus clientes pra você revisar." },
      { icon: <MessageCircle size={19} />, title: "Chat de suporte", desc: "Tira dúvida na hora com o assistente do Modo Criador — e passa pro nosso time quando precisar." },
    ],
    visual: <AiOutputCard />,
  },
];

export function SalesFeatures() {
  const [active, setActive] = useState(TABS[0].id);
  const tab = TABS.find((t) => t.id === active) ?? TABS[0];
  return (
    <section id="funcoes" style={{ background: BG_GRAY }} className="border-y border-white/10">
      <div className="max-w-[1100px] mx-auto px-5 sm:px-10 py-20">
        <Reveal className="max-w-[680px] mb-9">
          <Eyebrow>Tudo que tem dentro</Eyebrow>
          <h2 className={`${SERIF} text-[clamp(32px,4.6vw,52px)] leading-[1.05]`} style={{ fontStyle: "italic" }}>Do planejamento à cobrança, num lugar só.</h2>
          <p className="text-white/60 text-[17px] mt-4">Cada parte da rotina da agência tem o seu espaço — e conversa com as outras.</p>
        </Reveal>
        <div role="tablist" aria-label="Áreas do Modo Criador" className="flex gap-2 overflow-x-auto pb-1.5 mb-8" style={{ scrollbarWidth: "none" }}>
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => setActive(t.id)}
              className="shrink-0 font-bold text-sm px-5 py-2.5 rounded-full border transition"
              style={active === t.id ? { background: LIME, color: BG_BLUE, borderColor: LIME } : { borderColor: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.6)" }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="grid lg:grid-cols-[0.82fr_1.18fr] gap-8 lg:gap-12 items-center" key={tab.id}>
          <div className="flex flex-col gap-3.5">
            {tab.feats.map((f) => (
              <div key={f.title} className="rounded-2xl p-5 border flex gap-4" style={{ background: BG_BLUE, borderColor: "rgba(255,255,255,0.09)" }}>
                <span className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(215,255,63,0.12)", color: LIME }}>{f.icon}</span>
                <div>
                  <h3 className="font-extrabold text-[16px] leading-tight mb-1.5">{f.title}</h3>
                  <p className="text-[13.5px] text-white/58 leading-relaxed">{f.desc}</p>
                  {f.chip && <span className="inline-block mt-2.5 text-[10.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: "rgba(215,255,63,0.14)", color: LIME }}>{f.chip}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="min-w-0">{tab.visual}</div>
        </div>
      </div>
    </section>
  );
}

/* ============ IA em destaque ============ */

export function SalesAiSpotlight({ onCta }: { onCta: () => void }) {
  const steps = [
    ["Ela lê o que sua agência já sabe:", "histórico de posts, roteiros, arquivos de marca e concorrentes."],
    ["Você cola o contexto da reunião", "com o cliente, se tiver — isso pesa mais que qualquer histórico."],
    ["Sai uma prévia completa:", "de 4 a 12 sugestões com roteiro e legenda prontos, no tom do cliente."],
    ["Você revisa e decide.", "Nada é salvo sozinho — aprova direto pros roteiros do mês."],
  ];
  return (
    <section id="ia" className="relative overflow-hidden" style={{ background: `radial-gradient(ellipse 60% 60% at 80% 30%, rgba(74,158,255,0.16), transparent), ${BG_BLUE}` }}>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-10 py-20 grid lg:grid-cols-2 gap-12 lg:gap-14 items-center">
        <Reveal>
          <Eyebrow>Novo · Planejamento com IA</Eyebrow>
          <h2 className={`${SERIF} text-[clamp(32px,4.6vw,52px)] leading-[1.05]`} style={{ fontStyle: "italic" }}>Um mês de conteúdo planejado antes de você abrir a agenda.</h2>
          <div className="flex flex-col gap-3.5 my-7">
            {steps.map(([b, r], i) => (
              <div key={b} className="flex gap-3.5 items-start">
                <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-black mt-0.5" style={{ background: "rgba(215,255,63,0.14)", color: LIME }}>{i + 1}</span>
                <p className="text-[15px] text-white/70"><b className="text-white">{b}</b> {r}</p>
              </div>
            ))}
          </div>
          <button onClick={onCta} className="inline-flex items-center gap-2 font-black text-sm px-6 py-3.5 rounded-full transition hover:-translate-y-0.5" style={{ background: LIME, color: BG_BLUE }}>
            Quero testar <ArrowRight size={16} />
          </button>
          <p className="text-[11.5px] text-white/35 mt-3">O planejamento com IA é liberado conforme o nível da agência no Programa de Níveis.</p>
        </Reveal>
        <Reveal><AiOutputCard /></Reveal>
      </div>
    </section>
  );
}

/* ============ barra fixa (celular) ============ */

export function SalesStickyCta({ onCta }: { onCta: () => void }) {
  return (
    <div className="sm:hidden fixed left-0 right-0 bottom-0 z-40 px-4 pt-2.5 backdrop-blur-md border-t"
      style={{ background: "rgba(10,14,35,0.92)", borderColor: "rgba(255,255,255,0.1)", paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))" }}>
      <button onClick={onCta} className="w-[calc(100%-4.25rem)] font-black text-sm py-3.5 rounded-full" style={{ background: LIME, color: BG_BLUE }}>Testar 30 dias grátis →</button>
    </div>
  );
}
