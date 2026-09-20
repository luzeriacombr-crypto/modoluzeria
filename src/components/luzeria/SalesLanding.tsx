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
import { DEFAULT_LANDING, type LandingContent, type LandingTab } from "@/lib/luzeria/sales-landing-content";
import { LIME, BG_BLUE, BG_GRAY, BG_WHITE, Reveal } from "./salesPageBlocks";
import boardImg from "@/assets/sales/board.webp";
import approvalImg from "@/assets/sales/aprovacao-mobile.webp";
import dashboardImg from "@/assets/sales/dashboard.webp";
import calendarImg from "@/assets/sales/calendario.webp";
import rankingImg from "@/assets/sales/ranking.webp";
import publishImg from "@/assets/sales/publicar.webp";

const SERIF = "font-criador-serif normal-case";

export const LANDING_ICONS: Record<string, { label: string; render: (size: number) => ReactNode }> = {
  link: { label: "Link", render: (n) => <Link2 size={n} /> },
  drive: { label: "Drive", render: (n) => <HardDrive size={n} /> },
  clock: { label: "Relógio", render: (n) => <Clock size={n} /> },
  send: { label: "Enviar", render: (n) => <Send size={n} /> },
  sparkles: { label: "IA", render: (n) => <Sparkles size={n} /> },
  layout: { label: "Quadro", render: (n) => <LayoutGrid size={n} /> },
  calendar: { label: "Calendário", render: (n) => <CalendarDays size={n} /> },
  zap: { label: "Raio", render: (n) => <Zap size={n} /> },
  file: { label: "Documento", render: (n) => <FileText size={n} /> },
  image: { label: "Imagem", render: (n) => <ImageIcon size={n} /> },
  userplus: { label: "Pessoa +", render: (n) => <UserPlus size={n} /> },
  chart: { label: "Gráfico", render: (n) => <BarChart3 size={n} /> },
  wallet: { label: "Carteira", render: (n) => <Wallet size={n} /> },
  trophy: { label: "Troféu", render: (n) => <Trophy size={n} /> },
  upload: { label: "Upload", render: (n) => <Upload size={n} /> },
  message: { label: "Mensagem", render: (n) => <MessageCircle size={n} /> },
  check: { label: "Check", render: (n) => <Check size={n} /> },
};
const landingIcon = (key: string, size: number) => (LANDING_ICONS[key] ?? LANDING_ICONS.sparkles).render(size);


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

export function SalesHero({ onCta, content = DEFAULT_LANDING }: { onCta: () => void; content?: LandingContent }) {
  const h = content.hero;
  return (
    <section className="relative overflow-hidden"
      style={{ background: `radial-gradient(ellipse 70% 60% at 75% 10%, rgba(74,158,255,0.18), transparent), radial-gradient(ellipse 60% 50% at 10% 0%, rgba(215,255,63,0.1), transparent), ${BG_BLUE}` }}>
      <div className="absolute inset-0 pointer-events-none"><ConstellationBackground count={38} alpha={0.75} /></div>
      <div className="relative max-w-[1100px] mx-auto px-5 sm:px-10 pt-10 pb-20 lg:pt-16 lg:pb-24 grid lg:grid-cols-[1.02fr_1fr] gap-12 items-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 pl-2 pr-3.5 py-1.5 rounded-full text-[12.5px] font-semibold mb-5"
            style={{ border: "1px solid rgba(215,255,63,0.35)", background: "rgba(215,255,63,0.08)", color: "rgba(255,255,255,0.85)" }}>
            <b className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: LIME, color: BG_BLUE }}>{h.badge}</b>
            {h.pill}
          </div>
          <h1 className="font-black uppercase leading-[1.02] tracking-[-0.03em] text-[clamp(36px,5.6vw,64px)]">
            {h.title}
            <span className={`block mt-1.5 ${SERIF}`} style={{ color: LIME, fontWeight: 400, fontStyle: "italic", textTransform: "none", letterSpacing: "-0.01em" }}>
              {h.titleAccent}
            </span>
          </h1>
          <p className="text-white/65 text-lg max-w-[520px] mt-5 mb-7 leading-relaxed">
            {h.subtitle}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button onClick={onCta} className="inline-flex items-center gap-2 font-black text-sm px-6 py-3.5 rounded-full transition hover:-translate-y-0.5" style={{ background: LIME, color: BG_BLUE }}>
              {h.ctaLabel} <ArrowRight size={16} />
            </button>
            <a href="#funcoes" className="inline-flex items-center font-bold text-sm px-6 py-3.5 rounded-full border transition hover:bg-white/5" style={{ borderColor: "rgba(255,255,255,0.25)" }}>
              {h.ctaSecondaryLabel}
            </a>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 text-[12.5px] text-white/45">
            {h.trust.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5"><Check size={12} style={{ color: LIME }} strokeWidth={3} />{t}</span>
            ))}
          </div>
        </Reveal>

        <Reveal className="relative pt-4 pb-6 sm:pb-2">
          <BrowserFrame src={h.image || boardImg} alt="Board de posts de um cliente no Modo Criador" />
          <div className="lz-float-b absolute -top-4 -right-1 sm:-right-4 bg-white text-[#0A0E23] rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5 text-xs shadow-2xl">
            <span className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: "#D4F1DC", color: "#1B6B34" }}><Check size={17} strokeWidth={3} /></span>
            <span><b className="block font-extrabold">{h.chipTitle}</b><span className="text-[#0A0E23]/55 text-[11px]">{h.chipSub}</span></span>
          </div>
          <div className="lz-float-a flex absolute -bottom-4 left-1 sm:-bottom-3 sm:-left-4 lg:-left-8 bg-white text-[#0A0E23] rounded-2xl px-3.5 py-2.5 items-center gap-2.5 text-xs shadow-2xl">
            <span className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: "#D6E8FF", color: "#0B4FB3" }}><Sparkles size={17} strokeWidth={2.4} /></span>
            <span><b className="block font-extrabold">{h.chip2Title}</b><span className="text-[#0A0E23]/55 text-[11px]">{h.chip2Sub}</span></span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ============ números reais ============ */

const FALLBACK_STATS = { clients: 230, deliveries: 1365 };

export function SalesNumbers({ content = DEFAULT_LANDING }: { content?: LandingContent }) {
  const nm = content.numbers;
  const { data } = useQuery({ queryKey: ["sales-stats"], queryFn: () => getPublicSalesStats(), staleTime: 60 * 60_000, retry: false });
  const s = data ?? FALLBACK_STATS;
  const roundedDeliveries = Math.max(100, Math.floor(s.deliveries / 100) * 100);
  const fmt = (n: number) => n.toLocaleString("pt-BR");
  const items = [
    { value: fmt(s.clients), label: nm.clientsLabel },
    { value: `+${fmt(roundedDeliveries)}`, label: nm.deliveriesLabel },
    { value: nm.trialValue, label: nm.trialLabel },
  ];
  return (
    <section style={{ background: LIME, color: BG_BLUE }}>
      <div className="grid grid-cols-1 sm:grid-cols-3">
        {items.map((it, i) => (
          <div key={it.label} className="py-8 px-5 sm:px-10 text-center sm:text-left"
            style={{ background: i === 1 ? "#EAFF9A" : LIME }}>
            <div className="max-w-[340px] mx-auto sm:mx-0 sm:ml-auto sm:mr-auto lg:max-w-[300px]">
              <div className={`${SERIF} text-[clamp(40px,5vw,58px)] leading-none`} style={{ fontStyle: "italic", letterSpacing: "-0.02em" }}>{it.value}</div>
              <div className="mt-2 text-[13.5px] font-semibold" style={{ color: "rgba(10,14,35,0.72)" }}>{it.label}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============ antes / depois ============ */

export function SalesBeforeAfter({ content = DEFAULT_LANDING }: { content?: LandingContent }) {
  const ba = content.beforeAfter;
  return (
    <section style={{ background: BG_WHITE, color: BG_BLUE }}>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-10 py-20">
        <Reveal className="max-w-[680px] mb-11">
          <Eyebrow dark>{ba.eyebrow}</Eyebrow>
          <h2 className={`${SERIF} text-[clamp(32px,4.6vw,52px)] leading-[1.05]`} style={{ fontStyle: "italic" }}>{ba.heading}</h2>
        </Reveal>
        <div className="flex flex-col gap-3">
          {ba.rows.map((r, ri) => (
            <Reveal key={ri} className="grid md:grid-cols-[minmax(0,0.72fr)_auto_minmax(0,1.28fr)] items-center gap-2.5 md:gap-4">
              <div className="flex items-center gap-3 rounded-xl px-4 py-3.5" style={{ background: "rgba(10,14,35,0.05)" }}>
                <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(255,107,107,0.16)", color: "#E5484D" }}><X size={13} strokeWidth={3} /></span>
                <span className="text-[14.5px] font-medium leading-snug" style={{ color: "rgba(10,14,35,0.55)" }}>{r.before}</span>
              </div>
              <ArrowRight size={18} className="hidden md:block" style={{ color: "rgba(10,14,35,0.35)" }} />
              <div className="flex items-center gap-4 rounded-2xl px-5 py-5" style={{ background: BG_BLUE, color: "#fff", boxShadow: "0 18px 40px -22px rgba(10,14,35,0.55)" }}>
                <span className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(215,255,63,0.14)", color: LIME }}>{landingIcon(r.icon, 20)}</span>
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

function tabVisual(t: LandingTab): ReactNode {
  switch (t.id) {
    case "producao": return <BrowserFrame src={t.image || calendarImg} alt="Calendário geral com posts de vários clientes" />;
    case "aprovacao": return <div className="flex justify-center"><PhoneFrame src={t.image || approvalImg} alt="Cliente aprovando um post pelo celular" className="w-[min(260px,70%)]" /></div>;
    case "publicacao": return <BrowserFrame src={t.image || publishImg} alt="Tela de publicação e programação no Instagram" />;
    case "gestao": return (
      <div className="flex flex-col gap-4">
        <BrowserFrame src={t.image || dashboardImg} alt="Dashboard de entregas do mês" />
        <img src={t.image2 || rankingImg} alt="Ranking de produtividade da equipe" loading="lazy" className="block w-full h-auto rounded-2xl border" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
      </div>
    );
    case "ia": return <AiOutputCard />;
    default: return t.image ? <BrowserFrame src={t.image} alt={t.label} /> : null;
  }
}

export function SalesFeatures({ content = DEFAULT_LANDING }: { content?: LandingContent }) {
  const ft = content.features;
  const TABS = ft.tabs;
  const [active, setActive] = useState(TABS[0]?.id ?? "");
  const tab = TABS.find((t) => t.id === active) ?? TABS[0];
  if (!tab) return null;
  return (
    <section id="funcoes" style={{ background: BG_GRAY }} className="border-y border-white/10">
      <div className="max-w-[1100px] mx-auto px-5 sm:px-10 py-20">
        <Reveal className="max-w-[680px] mb-9">
          <Eyebrow>{ft.eyebrow}</Eyebrow>
          <h2 className={`${SERIF} text-[clamp(32px,4.6vw,52px)] leading-[1.05]`} style={{ fontStyle: "italic" }}>{ft.heading}</h2>
          <p className="text-white/60 text-[17px] mt-4">{ft.subheading}</p>
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
            {tab.feats.map((f, fi) => (
              <div key={fi} className="rounded-2xl p-5 border flex gap-4" style={{ background: BG_BLUE, borderColor: "rgba(255,255,255,0.09)" }}>
                <span className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(215,255,63,0.12)", color: LIME }}>{landingIcon(f.icon, 19)}</span>
                <div>
                  <h3 className="font-extrabold text-[16px] leading-tight mb-1.5">{f.title}</h3>
                  <p className="text-[13.5px] text-white/58 leading-relaxed">{f.desc}</p>
                  {f.chip && <span className="inline-block mt-2.5 text-[10.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: "rgba(215,255,63,0.14)", color: LIME }}>{f.chip}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="min-w-0">{tabVisual(tab)}</div>
        </div>
      </div>
    </section>
  );
}

/* ============ IA em destaque ============ */

export function SalesAiSpotlight({ onCta, content = DEFAULT_LANDING }: { onCta: () => void; content?: LandingContent }) {
  const ai = content.ai;
  return (
    <section id="ia" className="relative overflow-hidden" style={{ background: `radial-gradient(ellipse 60% 60% at 80% 30%, rgba(74,158,255,0.16), transparent), ${BG_BLUE}` }}>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-10 py-20 grid lg:grid-cols-2 gap-12 lg:gap-14 items-center">
        <Reveal>
          <Eyebrow>{ai.eyebrow}</Eyebrow>
          <h2 className={`${SERIF} text-[clamp(32px,4.6vw,52px)] leading-[1.05]`} style={{ fontStyle: "italic" }}>{ai.heading}</h2>
          <div className="flex flex-col gap-3.5 my-7">
            {ai.steps.map((st, i) => (
              <div key={i} className="flex gap-3.5 items-start">
                <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-black mt-0.5" style={{ background: "rgba(215,255,63,0.14)", color: LIME }}>{i + 1}</span>
                <p className="text-[15px] text-white/70"><b className="text-white">{st.bold}</b> {st.rest}</p>
              </div>
            ))}
          </div>
          <button onClick={onCta} className="inline-flex items-center gap-2 font-black text-sm px-6 py-3.5 rounded-full transition hover:-translate-y-0.5" style={{ background: LIME, color: BG_BLUE }}>
            {ai.ctaLabel} <ArrowRight size={16} />
          </button>
          <p className="text-[11.5px] text-white/35 mt-3">{ai.note}</p>
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
