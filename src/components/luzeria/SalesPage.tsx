import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Rocket, CalendarDays, Users, Link2, FolderOpen, Check, X, ChevronDown, Zap, Lock,
  MessageCircle, LayoutDashboard, BarChart3, Bell, ShieldCheck, Smartphone, Tablet, Monitor,
  ChevronLeft, ChevronRight, Play, Heart, Send, Bookmark,
} from "lucide-react";
import { getPublicPlans, publicSignup } from "@/lib/luzeria/signup.functions";
import { supabase } from "@/integrations/supabase/client";
import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import clickupTrelloLogos from "@/assets/clickup-trello-logos.png";
import heroDesktopMockup from "@/assets/hero-desktop-mockup.png";
import heroPhoneMockup from "@/assets/hero-phone-mockup.png";
import driveCardMockup from "@/assets/drive-card-mockup.png";
import postCreativeMockup from "@/assets/post-creative-mockup.png";
import appScreenshotMockup from "@/assets/app-screenshot-mockup.png";

const LIME = "#D7FF3F";
const ACCENT_ON_LIGHT = "#111F5C"; // accent color for text on white sections
const BG_BLUE = "#0A0E23";
const BG_BLUE_2 = "#111F5C";
const BG_WHITE = "#F5F5F0";
const BG_GRAY = "#18181B";

// Populate once real screenshots come in — the section below renders
// nothing until there's at least one entry, so it's safe to ship empty.
type Testimonial = { image: string; alt: string };
const TESTIMONIALS: Testimonial[] = [];

const PENDING_GOOGLE_SIGNUP_KEY = "modocriador:pending-google-signup";

function GoogleMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" className="shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4c-7.5 0-14 4.2-17.7 10.7z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-2.1 14.1-5.5l-6.5-5.5C29.5 34.9 26.9 36 24 36c-5.3 0-9.7-3.1-11.3-8l-6.5 5C9.9 39.7 16.4 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.5 5.5C39.9 37.4 44 31.5 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

const EASE = { transitionTimingFunction: "var(--ease-premium)" as const };
// Same curve premium buttons/cards use elsewhere in the app.
const POP = "transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]";
const LIFT = "transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-2xl";

const STEPS = [
  { n: "01", Icon: CalendarDays, t: "Monte o calendário", d: "Organize Posts e Reels de cada cliente num board visual, por mês." },
  { n: "02", Icon: Users, t: "Atribua e acompanhe", d: "Sua equipe sabe exatamente quem faz o quê, qual o prazo e você pode fazer comentários." },
  { n: "03", Icon: Link2, t: "Cliente aprova pelo link", d: "Manda um link público bonito, o cliente aprova ou comenta alterações, sem login." },
  { n: "04", Icon: FolderOpen, t: "Arquivos no Drive", d: "Conecte sua própria conta do Google Drive e faça o Backup dos arquivos automaticamente." },
];

/* ---------------------------------------------------------------------- *
 * Dobras de funcionalidades — uma seção por feature "épica", cada uma com
 * uma mini-recriação visual da própria tela do app (mesmas cores e tokens
 * usados no produto de verdade), em vez de screenshot estático.
 * ---------------------------------------------------------------------- */

type IconType = React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;

function AppCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`w-full max-w-[420px] rounded-2xl border border-white/10 shadow-2xl overflow-hidden ${LIFT} ${className}`}
      style={{ background: "#141414", ...EASE }}
    >
      {children}
    </div>
  );
}

function FeatureFold({
  icon: Icon, eyebrow, title, description, visual, background, dark, reverse,
}: {
  icon: IconType;
  eyebrow: string;
  title: React.ReactNode;
  description: string;
  visual: React.ReactNode;
  background: string;
  dark?: boolean;
  reverse?: boolean;
}) {
  const textColor = dark ? "#fff" : "#0A0E23";
  const eyebrowColor = dark ? LIME : ACCENT_ON_LIGHT;
  const bodyClass = dark ? "text-white/65" : "text-[#0A0E23]/60";
  return (
    <section style={{ background, color: textColor }} className="border-t border-white/10">
      <Reveal className="px-5 sm:px-10 max-w-[1100px] mx-auto py-14 sm:py-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className={reverse ? "lg:order-2" : ""}>
            <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide font-bold mb-3" style={{ color: eyebrowColor }}>
              <Icon size={13} /> {eyebrow}
            </div>
            <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-4 text-balance">{title}</h2>
            <p className={`${bodyClass} text-base leading-relaxed max-w-[460px]`}>{description}</p>
          </div>
          <div className={`flex justify-center ${reverse ? "lg:order-1" : ""}`}>{visual}</div>
        </div>
      </Reveal>
    </section>
  );
}

/** Preview de feed — mini recriação do modal estilo Instagram que o cliente
 * usa pra aprovar posts, sem precisar criar conta. */
function FeedPreviewVisual() {
  return (
    <AppCard className="max-w-[300px]">
      <div className="relative w-full aspect-[4/5]" style={{ background: "linear-gradient(135deg, #2A1E3A, #0D2B4A)" }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-14 w-14 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.1)" }}>
            <Play size={20} className="text-white/70 fill-white/70 ml-0.5" />
          </div>
        </div>
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-black/50 rounded-full pl-1 pr-2.5 py-1">
          <span className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: LIME, color: "#0A0E23" }}>C</span>
          <span className="text-[10px] font-semibold text-white">Clínica Vitta</span>
        </div>
        <div className="absolute top-2.5 right-2.5 text-[9px] font-bold text-white bg-black/50 rounded-full px-2 py-0.5">1/5</div>
      </div>
      <div className="px-3.5 pt-3 pb-1 flex items-center gap-3 text-white/70">
        <Heart size={17} /> <MessageCircle size={17} /> <Send size={17} /> <div className="flex-1" /> <Bookmark size={17} />
      </div>
      <div className="px-3.5 pb-3.5 flex gap-2">
        <div className="flex-1 rounded-lg py-2.5 text-center text-[11px] font-bold" style={{ background: LIME, color: "#0A0E23" }}>✓ Aprovar post</div>
        <div className="flex-1 rounded-lg py-2.5 text-center text-[11px] font-bold border border-white/20 text-white/80">Sugerir</div>
      </div>
    </AppCard>
  );
}

/** Dashboard — anel de progresso (conic-gradient) + tiles de métrica, iguais
 * aos do Dashboard real (Entregues / Falta / Travados / Clientes ativos). */
function DashboardVisual() {
  const pct = 85;
  const tiles = [
    { label: "Clientes ativos", value: "22", color: "#7EB3FF" },
    { label: "Entregues", value: "199", color: "rgb(var(--lz-brand-rgb))" },
    { label: "Falta", value: "34", color: "#FF6B6B" },
  ];
  return (
    <AppCard>
      <div className="p-5">
        <div className="text-[10px] uppercase font-bold tracking-wider text-white/40 mb-3">Dashboard · Julho 2026</div>
        <div className="flex items-center gap-4 mb-4">
          <div
            className="h-20 w-20 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `conic-gradient(rgb(var(--lz-brand-rgb)) ${pct * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
          >
            <div className="h-14 w-14 rounded-full flex flex-col items-center justify-center" style={{ background: "#141414" }}>
              <span className="text-base font-black text-white">{pct}%</span>
              <span className="text-[8px] text-white/40 uppercase tracking-wide">entregas</span>
            </div>
          </div>
          <div>
            <div className="text-white font-bold text-sm">Bom ritmo!</div>
            <div className="text-white/40 text-xs">Vamos fechar forte esse mês.</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg p-2.5 border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.03)" }}>
              <div className="text-lg font-black" style={{ color: t.color }}>{t.value}</div>
              <div className="text-[9px] text-white/40 leading-tight mt-0.5">{t.label}</div>
            </div>
          ))}
        </div>
      </div>
    </AppCard>
  );
}

/** Relatório por membro — ranking com avatar, entregues no mês e barra de
 * produtividade, no mesmo espírito do ranking real da equipe. */
function ReportVisual() {
  const rows = [
    { name: "Andreia R.", done: 34, pct: 92, color: "rgb(var(--lz-brand-rgb))" },
    { name: "Bruno M.", done: 29, pct: 81, color: "#7EB3FF" },
    { name: "Carol S.", done: 21, pct: 63, color: "#FFD97E" },
  ];
  return (
    <AppCard>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-white/40">Produtividade da equipe</div>
          <BarChart3 size={14} className="text-white/30" />
        </div>
        <div className="space-y-3.5">
          {rows.map((r, i) => (
            <div key={r.name} className="flex items-center gap-3">
              <span
                className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                style={{ background: r.color, color: "#0A0E23" }}
              >{r.name.charAt(0)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11.5px] font-semibold text-white truncate">{r.name}</span>
                  <span className="text-[10px] text-white/40">{r.done} entregues</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: r.color }} />
                </div>
              </div>
              {i === 0 && <span className="text-[13px] shrink-0">🏆</span>}
            </div>
          ))}
        </div>
      </div>
    </AppCard>
  );
}

/** Calendário geral — mini grade mensal, com pílulas coloridas nos dias que
 * têm post/reel programado, igual ao Calendário real. */
function CalendarVisual() {
  const dots: Record<number, string[]> = {
    3: ["rgb(var(--lz-brand-rgb))"], 7: ["#7EB3FF", "#FFD97E"], 12: ["#B97EFF"],
    15: ["rgb(var(--lz-brand-rgb))", "#7EB3FF"], 21: ["#4A9EFF"], 26: ["#FFD97E"],
  };
  return (
    <AppCard>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3 px-0.5">
          <ChevronLeft size={14} className="text-white/30" />
          <span className="text-[11px] font-bold text-white">Agosto 2026</span>
          <ChevronRight size={14} className="text-white/30" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
            <div key={i} className="text-center text-[8px] font-bold text-white/30 pb-1">{d}</div>
          ))}
          {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
            <div key={day} className="aspect-square rounded-md flex flex-col items-center justify-center gap-0.5 border border-white/[0.04]" style={{ background: "rgba(255,255,255,0.02)" }}>
              <span className="text-[8px] text-white/40">{day}</span>
              <div className="flex gap-0.5">
                {(dots[day] ?? []).map((c, i) => <span key={i} className="h-1 w-1 rounded-full" style={{ background: c }} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppCard>
  );
}

/** Notificações no celular — banner de push notification, igual ao que
 * chega no aparelho quando ativa notificações pelo sino no app. */
function NotificationVisual() {
  return (
    <AppCard className="max-w-[340px]">
      <div className="p-5">
        <div className="text-[10px] uppercase font-bold tracking-wider text-white/40 mb-4">Notificações · agora</div>
        {[
          { t: "Novo comentário", d: "Bruno comentou no Post 02 — Clínica Vitta", time: "agora" },
          { t: "Prazo se aproximando", d: "Reel \"Bastidores\" vence amanhã", time: "há 12min" },
          { t: "Post aprovado ✓", d: "Cliente aprovou \"Depoimento — Ana\"", time: "há 1h" },
        ].map((n) => (
          <div key={n.t} className="flex items-start gap-2.5 rounded-lg p-2.5 mb-2 last:mb-0 border border-white/[0.06]" style={{ background: "rgba(255,255,255,0.03)" }}>
            <span className="h-7 w-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(var(--lz-brand-light-rgb),0.15)" }}>
              <Bell size={13} style={{ color: "rgb(var(--lz-brand-rgb))" }} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-white truncate">{n.t}</div>
              <div className="text-[10px] text-white/45 leading-snug">{n.d}</div>
            </div>
            <span className="text-[9px] text-white/30 shrink-0">{n.time}</span>
          </div>
        ))}
      </div>
    </AppCard>
  );
}

/** Rapidez e responsividade — três "molduras" de dispositivo lado a lado,
 * mostrando que a mesma tela se adapta em qualquer tamanho. */
function ResponsiveVisual() {
  const devices = [
    { Icon: Monitor, w: "w-28", h: "h-20" },
    { Icon: Tablet, w: "w-16", h: "h-20" },
    { Icon: Smartphone, w: "w-10", h: "h-20" },
  ];
  return (
    <AppCard className="max-w-[420px]">
      <div className="p-6 flex items-end justify-center gap-4">
        {devices.map(({ Icon, w, h }, i) => (
          <div key={i} className={`${w} ${h} rounded-lg border border-white/10 flex flex-col overflow-hidden shrink-0`} style={{ background: "rgba(255,255,255,0.03)" }}>
            <div className="flex-1 flex flex-col gap-1 p-1.5">
              <div className="h-1.5 rounded-full w-full" style={{ background: "rgb(var(--lz-brand-rgb))" }} />
              <div className="h-1 rounded-full w-3/4 bg-white/15" />
              <div className="h-1 rounded-full w-1/2 bg-white/15" />
            </div>
            <div className="flex items-center justify-center py-1.5 border-t border-white/[0.06]">
              <Icon size={12} className="text-white/40" />
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 pb-4 flex items-center justify-center gap-1.5 text-[10px] text-white/40">
        <Zap size={11} style={{ color: "rgb(var(--lz-brand-rgb))" }} /> Carrega rápido em qualquer tela
      </div>
    </AppCard>
  );
}

/** Segurança e LGPD — selo central com os pontos que mais importam pra
 * quem vai confiar dados de cliente na plataforma. */
function SecurityVisual() {
  const rows = [
    "Dados isolados por agência (nunca cruzam entre contas)",
    "Conexão criptografada de ponta a ponta",
    "Backup automático no seu próprio Google Drive",
    "Conformidade com a LGPD, com política de privacidade clara",
  ];
  return (
    <AppCard className="max-w-[400px]">
      <div className="p-6">
        <div className="flex justify-center mb-4">
          <span className="h-14 w-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(var(--lz-brand-light-rgb),0.12)" }}>
            <ShieldCheck size={26} style={{ color: "rgb(var(--lz-brand-rgb))" }} />
          </span>
        </div>
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r} className="flex items-start gap-2">
              <Check size={13} className="shrink-0 mt-0.5" style={{ color: "rgb(var(--lz-brand-rgb))" }} strokeWidth={2.5} />
              <span className="text-[11.5px] text-white/70 leading-relaxed">{r}</span>
            </div>
          ))}
        </div>
      </div>
    </AppCard>
  );
}

export function SalesPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const promoCode = searchParams.get("promoCode") || undefined;
  const affiliateCode = searchParams.get("affiliateCode") || undefined;

  const plans = useQuery({ queryKey: ["public-plans"], queryFn: () => getPublicPlans() });
  const signup = useServerFn(publicSignup);

  const [planId, setPlanId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [taxId, setTaxId] = useState("");
  const [billingType, setBillingType] = useState<"CREDIT_CARD" | "UNDEFINED">("CREDIT_CARD");
  const [website, setWebsite] = useState(""); // honeypot
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null | undefined>(undefined);

  const selectablePlans = (plans.data ?? []).filter((p) => p.priceCents != null);

  function scrollToForm(id?: string) {
    if (id) setPlanId(id);
    document.getElementById("assinar-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!planId) { setError("Escolha um plano antes de continuar."); return; }
    if (!consent) { setError("Você precisa aceitar a Política de Privacidade para continuar."); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await signup({
        data: {
          agencyName, name, email, password, planId, taxId: taxId.replace(/\D/g, ""), website,
          promoCode,
          affiliateCode,
          billingType,
        },
      });
      setInvoiceUrl(r.invoiceUrl);
      if (r.invoiceUrl) window.open(r.invoiceUrl, "_blank");
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível concluir seu cadastro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function signUpWithGoogle() {
    if (!agencyName.trim() || !name.trim() || !taxId.trim()) {
      setError("Preenche o nome da agência, seu nome e o CNPJ/CPF antes de continuar com o Google.");
      return;
    }
    if (!planId) { setError("Escolha um plano antes de continuar."); return; }
    if (!consent) { setError("Você precisa aceitar a Política de Privacidade para continuar."); return; }
    setError(null);
    setGoogleLoading(true);
    try {
      sessionStorage.setItem(PENDING_GOOGLE_SIGNUP_KEY, JSON.stringify({
        agencyName, name, taxId: taxId.replace(/\D/g, ""), planId,
        promoCode,
        affiliateCode,
        billingType,
      }));
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/assinar/completar` },
      });
      if (oauthErr) throw oauthErr;
    } catch (err: any) {
      setError(err?.message ?? "Erro ao continuar com o Google");
      setGoogleLoading(false);
    }
  }

  const scrolled = useScrolled();

  return (
    <div className="min-h-screen text-white" style={{ background: "#0A0E23", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-5 sm:px-10 py-5"
        style={{
          transition: "background-color 300ms var(--ease-premium), backdrop-filter 300ms var(--ease-premium), border-color 300ms var(--ease-premium)",
          backgroundColor: scrolled ? "rgba(10,14,35,0.8)" : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
        }}
      >
        <div className="flex items-center justify-between max-w-[1100px] mx-auto w-full">
          <ModoCriadorLogo variant="brand" className="h-6 w-auto" />
          <Link to="/auth" className="text-sm text-white/70 hover:text-white transition">
            Já tem conta? Entrar →
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-5 sm:px-10 max-w-[1200px] mx-auto pt-8 pb-16">
        <div className="grid lg:grid-cols-2 gap-2 lg:gap-8 items-center">
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 border border-white/15 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide mb-6">
              <Rocket size={13} style={{ color: LIME }} /> Gestão de conteúdo pra agência
            </div>
            <h1 className="font-black uppercase leading-[0.95] text-[clamp(2rem,5.5vw,3.75rem)]">
              Pare de perder cliente
              <br />
              por falta de organização.
              <br />
              <span className="font-criador-serif normal-case block" style={{ color: LIME }}>
                Ganhe tempo com
                <br />
                o Modo Criador.
              </span>
            </h1>
            <p className="text-white/60 text-base sm:text-lg max-w-[560px] mt-6 leading-relaxed">
              A plataforma que centraliza tudo que um Social Media precisa: produtividade da equipe, calendário de postagens, link aprovação de cliente, organização de arquivos… tudo num só lugar, sem planilha chata ou arquivos perdidos no WhatsApp.
            </p>
            <button
              onClick={() => scrollToForm()}
              className={`mt-8 inline-flex items-center gap-2 font-black uppercase text-sm px-7 py-4 rounded-full ${POP}`}
              style={{ background: LIME, color: "#0A0E23", ...EASE }}
            >
              Quero testar por 7 dias! →
            </button>
            <div className="flex items-center gap-3 mt-3 max-w-[480px]">
              <img src={clickupTrelloLogos} alt="Logos do ClickUp e do Trello" className="h-9 w-auto shrink-0 opacity-80" />
              <p className="text-white/40 text-xs">
                Usava o ClickUp ou Trello? Sem problemas, você pode migrar todo o seu fluxo com facilidade.
              </p>
            </div>
          </div>
          <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[460px] lg:max-w-none aspect-[1182/854]">
              <img
                src={heroDesktopMockup}
                alt="Painel do Modo Criador no computador"
                className="lz-float-c absolute right-0 top-0 w-[82%] h-auto drop-shadow-2xl"
              />
              <img
                src={heroPhoneMockup}
                alt="Painel do Modo Criador no celular"
                className="lz-float-a absolute left-0 bottom-0 w-[50%] h-auto drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Dores */}
      <section style={{ background: "#0C1F61" }} className="border-t border-white/10">
        <Reveal className="px-5 sm:px-10 max-w-[820px] mx-auto py-14">
          <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-8">O Modo Criador é para...</h2>
          <ul className="space-y-4">
            {[
              "Você que gerencia vários clientes e cada um vive numa planilha ou pasta diferente",
              "Cliente que demora dias pra aprovar um post porque os arquivos se perdem no WhatsApp",
              "Sua equipe que não sabe quem é responsável por qual entrega e qual o prazo",
              "Você que quer mensurar a produtividade do time",
              "Você que já perdeu prazo porque ninguém viu que faltava aprovar algo",
              "Você que tem vergonha de mostrar sua \"organização interna\" pra um cliente novo",
            ].map((t) => (
              <li key={t} className="flex gap-3 text-white/75 text-base sm:text-lg">
                <X size={20} className="text-red-400 shrink-0 mt-0.5" strokeWidth={2.5} /><span className="text-balance">{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-white text-balance">
            Se você marcou pelo menos um,{" "}
            <span className="font-bold" style={{ color: LIME }}>
              o Modo Criador foi feito pra você.
            </span>
          </p>
        </Reveal>
      </section>

      {/* Simples assim */}
      <section style={{ background: BG_WHITE, color: "#0A0E23" }} className="border-t border-black/10">
        <Reveal className="px-5 sm:px-10 max-w-[1000px] mx-auto py-14">
          <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-10 text-center">Simples assim</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map((s) => (
              <div key={s.n} className={`bg-black/[0.04] rounded-xl p-5 border border-black/10 ${LIFT}`} style={EASE}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                    style={{ background: LIME, color: "#0A0E23" }}>
                    {s.n}
                  </span>
                  <s.Icon size={20} style={{ color: ACCENT_ON_LIGHT }} />
                </div>
                <div className="font-bold mb-1">{s.t}</div>
                <div className="text-[#0A0E23]/60 text-sm leading-relaxed">{s.d}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Backup automático */}
      <section style={{ background: BG_WHITE, color: "#0A0E23" }} className="border-t border-black/10 overflow-hidden">
        <Reveal className="px-5 sm:px-10 max-w-[1100px] mx-auto py-14">
          <div className="max-w-[640px] mx-auto text-center mb-12">
            <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide font-bold mb-3" style={{ color: ACCENT_ON_LIGHT }}>
              <FolderOpen size={13} /> Backup automático
            </div>
            <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-4">
              Todo post vai direto pro seu Google Drive.
            </h2>
            <p className="text-[#0A0E23]/60 text-base leading-relaxed">
              Conecte sua própria conta do Google Drive e cada arquivo que sua equipe sobe no Modo Criador é organizado e salvo automaticamente. Sem pasta perdida, sem procurar arquivo em conversa do WhatsApp.
            </p>
          </div>
          <div className="relative max-w-[820px] mx-auto aspect-[3/2] sm:aspect-[16/9]">
            <img
              src={appScreenshotMockup}
              alt="Tela do Modo Criador com os posts do cliente"
              className="lz-float-c absolute right-0 top-[14%] w-[62%] sm:w-[58%] h-auto drop-shadow-xl"
            />
            <img
              src={driveCardMockup}
              alt="Post organizado automaticamente numa pasta do Google Drive"
              className="lz-float-a absolute left-0 top-[6%] w-[34%] sm:w-[30%] h-auto drop-shadow-xl"
            />
            <img
              src={postCreativeMockup}
              alt="Arte de post criada no Modo Criador"
              className="lz-float-b absolute left-[27%] sm:left-[29%] top-0 w-[38%] sm:w-[34%] h-auto rounded-xl drop-shadow-2xl"
            />
          </div>
        </Reveal>
      </section>

      <FeatureFold
        icon={MessageCircle}
        eyebrow="Preview de feed"
        title="O cliente aprova em segundos, sem sair do celular."
        description="Manda um link, ele vê o post do jeitinho que vai ficar no Instagram — imagem, legenda, tudo — e aprova ou pede ajuste com um toque. Sem precisar criar conta, sem confusão de WhatsApp."
        visual={<FeedPreviewVisual />}
        background={BG_GRAY}
        dark
      />

      <FeatureFold
        icon={LayoutDashboard}
        eyebrow="Dashboard geral"
        title="A saúde da operação, num piscar de olhos."
        description="Veja quantos posts foram entregues, quantos ainda faltam e onde estão os gargalos — de todos os clientes, de uma vez só. Clique em qualquer número e já cai na lista de tarefas por trás dele."
        visual={<DashboardVisual />}
        background={BG_WHITE}
        reverse
      />

      <FeatureFold
        icon={BarChart3}
        eyebrow="Relatórios da equipe"
        title="Saiba exatamente quem está entregando (e quem precisa de ajuda)."
        description="Ranking de produtividade por pessoa, taxa de retrabalho, prazos cumpridos. Chega de planilha manual pra saber como a equipe está performando no mês."
        visual={<ReportVisual />}
        background={BG_BLUE_2}
        dark
      />

      <FeatureFold
        icon={CalendarDays}
        eyebrow="Calendário geral"
        title="Todos os clientes, num calendário só."
        description="Veja tudo que está programado pra publicar em qualquer dia, de qualquer cliente, sem precisar abrir pasta por pasta. Passe o mouse e já vê a miniatura do post."
        visual={<CalendarVisual />}
        background={BG_WHITE}
        reverse
      />

      <FeatureFold
        icon={Bell}
        eyebrow="Notificações no celular"
        title="Um comentário novo? Você fica sabendo na hora."
        description="Ative as notificações push no seu celular e receba avisos de comentário, prazo próximo ou aprovação de cliente — direto na tela de bloqueio, sem precisar ficar checando o app."
        visual={<NotificationVisual />}
        background={BG_GRAY}
        dark
      />

      <FeatureFold
        icon={Zap}
        eyebrow="Rapidez e responsividade"
        title="Rápido no computador. Rápido no celular. Sempre."
        description="O Modo Criador foi construído pra carregar rápido e funcionar liso em qualquer tela — desktop, tablet ou celular — porque sua equipe não trabalha só sentada na frente do computador."
        visual={<ResponsiveVisual />}
        background={BG_WHITE}
        reverse
      />

      <FeatureFold
        icon={ShieldCheck}
        eyebrow="Segurança e LGPD"
        title="Os dados dos seus clientes, protegidos de verdade."
        description="Cada agência tem seus dados totalmente isolados dos de outras contas, com conexão criptografada e conformidade com a LGPD — pra você confiar informação sensível de cliente na plataforma sem medo."
        visual={<SecurityVisual />}
        background={BG_BLUE_2}
        dark
      />

      {/* Benefícios */}
      <section style={{ background: BG_GRAY }} className="border-t border-white/10">
        <Reveal className="px-5 sm:px-10 max-w-[820px] mx-auto py-14">
          <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-8">Você vai ter...</h2>
          <ul className="space-y-4">
            {[
              "Calendário de conteúdo ilimitado, por cliente e por mês",
              "Link de aprovação pro cliente",
              "Equipe com papéis e responsáveis por tarefa",
              "Google Drive conectado, arquivos organizados automaticamente",
              "Relatórios de produtividade da equipe",
              "Suporte em português, feito pra agência brasileira",
            ].map((t) => (
              <li key={t} className="flex gap-3 text-white/85 text-base sm:text-lg">
                <Check size={20} className="shrink-0 mt-0.5" style={{ color: LIME }} strokeWidth={2.5} /><span className="text-balance">{t}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* Depoimentos — renders nothing until TESTIMONIALS has entries */}
      {TESTIMONIALS.length > 0 && (
        <section style={{ background: BG_WHITE, color: "#0A0E23" }} className="border-t border-black/10">
          <Reveal className="px-5 sm:px-10 max-w-[1000px] mx-auto py-14">
            <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-10 text-center">Quem usa, recomenda</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {TESTIMONIALS.map((t) => (
                <img key={t.image} src={t.image} alt={t.alt} className={`w-full h-auto rounded-xl border border-black/10 shadow-sm ${LIFT}`} style={EASE} />
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {/* Planos */}
      <section style={{ background: BG_BLUE_2 }} className="border-t border-white/10">
        <Reveal className="px-5 sm:px-10 max-w-[1100px] mx-auto py-14">
          <h2 className="font-black uppercase text-2xl sm:text-3xl mb-10 text-center">Escolha seu plano</h2>
          {plans.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl p-6 border border-white/10 bg-white/5 animate-pulse h-[180px]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {selectablePlans.map((p) => {
                const recommended = p.name.trim().toLowerCase() === "pro";
                return (
                  <div key={p.id} className={`relative rounded-xl p-6 flex flex-col ${LIFT}`}
                    style={{
                      background: recommended ? "rgba(215,255,63,0.06)" : "rgba(255,255,255,0.05)",
                      border: recommended ? `2px solid ${LIME}` : "1px solid rgba(255,255,255,0.1)",
                      ...EASE,
                    }}>
                    {recommended && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase tracking-wide px-3 py-1 rounded-full"
                        style={{ background: LIME, color: "#0A0E23" }}>
                        Mais popular
                      </span>
                    )}
                    <div className="font-black text-xl mb-1">{p.name}</div>
                    <div className="text-3xl font-black mb-1">
                      R$ {(p.priceCents! / 100).toFixed(2).replace(".", ",")}
                      <span className="text-sm font-normal text-white/50">/mês</span>
                    </div>
                    <div className="text-white/50 text-sm mb-6">
                      até {p.maxClients} clientes · até {p.maxCollaborators} colaboradores
                    </div>
                    <button
                      onClick={() => scrollToForm(p.id)}
                      className={`mt-auto font-bold uppercase text-sm px-5 py-3 rounded-full ${POP}`}
                      style={{
                        ...(planId === p.id || recommended
                          ? { background: LIME, color: "#0A0E23" }
                          : { background: "rgba(255,255,255,0.08)", color: "#fff" }),
                        ...EASE,
                      }}
                    >
                      {planId === p.id ? "Selecionado ✓" : "Escolher plano"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Reveal>
      </section>

      {/* Formulário */}
      <section id="assinar-form" style={{ background: BG_WHITE, color: "#0A0E23" }} className="border-t border-black/10">
        <div className="px-5 sm:px-10 max-w-[560px] mx-auto py-14">
        <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-2 text-center">Comece seu teste de 7 dias</h2>
        <p className="text-[#0A0E23]/60 text-sm text-center mb-8">Sem compromisso. Cancele quando quiser antes da cobrança.</p>

        {invoiceUrl !== undefined ? (
          <div className="bg-black/[0.03] rounded-xl p-6 border border-black/10 text-center">
            <div className="mb-3 flex justify-center">
              <span className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: LIME }}>
                <Check size={20} color="#0A0E23" strokeWidth={3} />
              </span>
            </div>
            <div className="font-bold text-lg mb-2">Cadastro criado!</div>
            {invoiceUrl ? (
              <>
                <p className="text-[#0A0E23]/70 text-sm mb-4">
                  {billingType === "UNDEFINED"
                    ? "Abrimos numa nova aba o link seguro com sua primeira fatura, onde dá pra escolher PIX, boleto ou cartão (sem cobrança agora — só depois dos 7 dias de teste)."
                    : "Abrimos numa nova aba o link seguro pra você cadastrar o cartão (sem cobrança agora — só depois dos 7 dias de teste)."}
                </p>
                <a href={invoiceUrl} target="_blank" rel="noreferrer" className="font-bold uppercase text-sm px-5 py-3 rounded-full inline-block" style={{ background: LIME, color: "#0A0E23" }}>
                  Abrir cadastro de pagamento
                </a>
              </>
            ) : (
              <p className="text-[#0A0E23]/70 text-sm">Enviamos um e-mail de confirmação — clique no link pra ativar sua conta.</p>
            )}
            <p className="text-[#0A0E23]/50 text-xs mt-6">
              Também mandamos um e-mail de confirmação — confirme antes de tentar entrar em <Link to="/auth" className="underline">/auth</Link>.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Nome da agência">
              <input required value={agencyName} onChange={(e) => setAgencyName(e.target.value)} className="lz-input-onlight" maxLength={80} />
            </Field>
            <Field label="Seu nome">
              <input required value={name} onChange={(e) => setName(e.target.value)} className="lz-input-onlight" maxLength={80} />
            </Field>
            <Field label="Seu e-mail">
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="lz-input-onlight" />
            </Field>
            <Field label="Crie uma senha">
              <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="lz-input-onlight" />
            </Field>
            <Field label="CNPJ ou CPF da agência">
              <input required value={taxId} onChange={(e) => setTaxId(e.target.value)} className="lz-input-onlight" placeholder="Somente números" maxLength={18} />
            </Field>
            <Field label="Forma de pagamento">
              <div className="flex gap-2">
                {([
                  { id: "CREDIT_CARD" as const, label: "Cartão de crédito" },
                  { id: "UNDEFINED" as const, label: "PIX ou Boleto" },
                ]).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBillingType(opt.id)}
                    className="flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold border transition"
                    style={{
                      borderColor: billingType === opt.id ? "#0A0E23" : "rgba(10,14,35,0.15)",
                      background: billingType === opt.id ? "#0A0E23" : "transparent",
                      color: billingType === opt.id ? "#fff" : "#0A0E23",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
            {/* Honeypot — invisible to real users, bots tend to fill every field */}
            <input
              type="text" value={website} onChange={(e) => setWebsite(e.target.value)}
              autoComplete="off" tabIndex={-1} aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
            />
            <label className="flex items-start gap-2 text-xs text-[#0A0E23]/70 cursor-pointer">
              <input
                type="checkbox" required checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Li e aceito a{" "}
                <Link to="/privacidade" target="_blank" className="underline font-semibold">
                  Política de Privacidade
                </Link>, e autorizo o uso dos meus dados conforme descrito nela.
              </span>
            </label>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit" disabled={loading || !consent}
              className="w-full font-black uppercase text-sm px-5 py-4 rounded-full transition disabled:opacity-50"
              style={{ background: LIME, color: "#0A0E23" }}
            >
              {loading ? "Criando conta…" : "Começar meu teste grátis →"}
            </button>

            <div className="flex items-center gap-3 pt-1">
              <div className="h-px flex-1 bg-black/10" />
              <span className="text-[#0A0E23]/30 text-[10px] uppercase tracking-wider">ou</span>
              <div className="h-px flex-1 bg-black/10" />
            </div>

            <button
              type="button" onClick={signUpWithGoogle} disabled={googleLoading}
              className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold border border-black/15 bg-white transition disabled:opacity-50 hover:bg-black/[0.03]"
            >
              <GoogleMark size={16} />
              {googleLoading ? "..." : "Continuar com Google"}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#0A0E23]/45 pt-1">
              <Lock size={11} /> Ambiente seguro · Seus dados ficam protegidos
            </p>
          </form>
        )}
        </div>
      </section>

      {/* Fundador */}
      <section style={{ background: BG_WHITE, color: "#0A0E23" }} className="border-t border-black/10 text-center">
        <div className="px-5 sm:px-10 max-w-[720px] mx-auto py-14">
        <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide font-bold mb-3" style={{ color: ACCENT_ON_LIGHT }}>
          <Zap size={13} /> Somos a Luzeria Estúdio!
        </div>
        <p className="text-[#0A0E23]/70 text-sm leading-relaxed">
          Com mais de uma década em comunicação e criação de conteúdo, vivemos na pele a dor de gerenciar vários clientes ao mesmo tempo e foi aí que nasceu o Modo Criador: a ferramenta que a nossa própria agência usa todos os dias e agora queremos compartilhar também com a sua.
        </p>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ background: BG_GRAY }} className="border-t border-white/10">
        <div className="px-5 sm:px-10 max-w-[720px] mx-auto py-14">
        <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-8">Dúvidas frequentes</h2>
        <div className="space-y-3">
          {[
            ["Preciso saber mexer em tecnologia?", "Não. É muito intuitivo usar o Modo Criador. (Bem mais fácil que o ClickUp e Trello.)"],
            ["Estou vindo de outra plataforma, consigo migrar meus clientes?", "Sim, criamos um sistema que você consegue colocar toda a sua operação dentro do Modo Criador com rapidez."],
            ["Meu cliente precisa criar conta pra aprovar o conteúdo?", "Não. Ele recebe um link público, com a sua marca, e aprova direto, sem cadastro."],
            ["Funciona pra qualquer tipo de agência?", "Sim, foi feito pra qualquer agência ou social media que gerencia múltiplos clientes."],
            ["Posso trocar de plano depois?", "Sim, a qualquer momento nas configurações da sua conta."],
            ["O que acontece se eu não cancelar antes do teste acabar?", "A cobrança do plano escolhido começa automaticamente no cartão cadastrado, depois dos 7 dias."],
            ["Meus dados ficam seguros?", "Sim. Seus dados e os dos seus clientes ficam isolados dos de outras agências, com infraestrutura segura."],
          ].map(([q, a]) => (
            <FaqItem key={q} question={q} answer={a} />
          ))}
        </div>
        </div>
      </section>

      <footer style={{ background: BG_BLUE }} className="px-5 sm:px-10 py-10 text-center text-white/30 text-xs">
        Modo <span className="font-criador-serif">Criador</span> — desenvolvido pela Luzeria Estúdio.
        {" · "}
        <Link to="/privacidade" className="underline hover:text-white/50 transition">Política de Privacidade</Link>
      </footer>

      <a
        href="https://wa.me/5599991135486?text=Oi!%20Fiquei%20com%20uma%20d%C3%BAvida%20sobre%20o%20Modo%20Criador."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 pl-3 pr-4 py-3 rounded-full shadow-2xl transition hover:opacity-90"
        style={{ background: "#25D366", color: "#0A0E23" }}
      >
        <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor" aria-hidden="true">
          <path d="M16.004 2.667C8.64 2.667 2.667 8.64 2.667 16.004c0 2.45.66 4.847 1.914 6.947L2.667 29.333l6.55-1.883a13.29 13.29 0 0 0 6.787 1.85h.006c7.363 0 13.336-5.973 13.336-13.337 0-3.563-1.388-6.913-3.907-9.43a13.253 13.253 0 0 0-9.435-3.866Zm0 24.4h-.005a11.06 11.06 0 0 1-5.638-1.543l-.404-.24-4.19 1.204 1.12-4.087-.264-.42a11.05 11.05 0 0 1-1.696-5.977c0-6.116 4.978-11.093 11.096-11.093a11.04 11.04 0 0 1 7.851 3.25 11.03 11.03 0 0 1 3.245 7.85c0 6.117-4.978 11.056-11.115 11.056Zm6.086-8.284c-.334-.167-1.97-.972-2.275-1.083-.305-.111-.527-.167-.75.167-.222.334-.86 1.083-1.054 1.306-.194.223-.389.25-.723.083-.334-.167-1.409-.52-2.684-1.657-.992-.885-1.663-1.978-1.858-2.312-.194-.334-.02-.514.147-.68.15-.15.334-.39.5-.585.167-.195.223-.334.334-.556.111-.223.056-.417-.028-.584-.083-.167-.75-1.806-1.027-2.474-.27-.65-.545-.562-.75-.573l-.638-.012c-.222 0-.583.083-.888.417-.305.334-1.166 1.14-1.166 2.778 0 1.639 1.194 3.222 1.361 3.444.167.223 2.352 3.59 5.696 5.035.796.344 1.417.55 1.901.703.799.254 1.526.218 2.101.132.641-.096 1.97-.805 2.248-1.583.278-.778.278-1.445.194-1.584-.083-.139-.305-.222-.639-.389Z"/>
        </svg>
        <span className="text-sm font-bold">Falar no WhatsApp</span>
      </a>
    </div>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left px-4 py-4"
      >
        <span className="font-semibold text-sm">{question}</span>
        <ChevronDown size={16} className="shrink-0 text-white/50 transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {open && (
        <p className="text-white/50 text-sm leading-relaxed px-4 pb-4">{answer}</p>
      )}
    </div>
  );
}

function useScrolled(threshold = 30) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

/** Fades + slides a section's content in once it enters the viewport.
 * Skips the animation entirely for prefers-reduced-motion. */
function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(28px)",
        transition: "opacity 700ms var(--ease-premium), transform 700ms var(--ease-premium)",
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-[#0A0E23]/60 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
