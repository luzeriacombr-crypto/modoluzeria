import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X, ArrowLeft, ArrowRight, Check, Sparkles, ListChecks, Search, ClipboardList, Folder,
  LayoutGrid, Link2, CalendarDays, Instagram, Users, BarChart3, Palette, PartyPopper, Bell,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useMe, useApi } from "@/lib/luzeria/queries";
import { useIsMobile } from "@/hooks/use-mobile";

type Role = "master" | "setor" | "member";

type Step = {
  id: string;
  eyebrow: string;
  icon: typeof Sparkles;
  title: string;
  desc: string;
  /** Overrides `desc` on mobile — use when the location/wording differs (e.g. "toque no menu" vs "clique aqui"). */
  descMobile?: string;
  /** Short label shown as a chip under the text, naming what's highlighted. Skipped for centered steps (no target). */
  spotLabel?: string;
  target?: string;
  view?: "my" | "admin" | "settings";
  settingsTab?: string;
  roles?: Role[];
  /** Overrides `target` on mobile, when the feature lives in a different spot (bottom nav vs sidebar). */
  mobileTarget?: string;
  /** Skip this step when the org disabled this optional feature (OPTIONAL_FEATURE_KEYS). */
  hideIfDisabled?: string;
  /** Opening/closing "bookend" moments get the bigger serif treatment. */
  serif?: boolean;
  finale?: boolean;
};

// 14 passos — enxugado dos 22 de antes pra só o que carrega o produto no
// dia a dia (redesenhado a partir de feedback direto do Junior: o tour
// antigo era "pequenininho" e mostrava "coisas bobas"). Cortados: atividades
// registradas, Minha Semana, organizar o mês, lixeira, biblioteca, vendas,
// visão geral admin, financeiro, rotina, ajuda (agora só citado no fechamento),
// sino de notificações e perfil — todos autoexplicativos ou secundários pra
// um primeiro contato, ainda descobríveis na Central de Ajuda depois.
const STEPS: Step[] = [
  {
    id: "intro",
    eyebrow: "Começando agora",
    icon: Sparkles,
    title: "Bem-vindo ao Modo Criador",
    desc: "Alguns passos rápidos e só o que importa — sem enrolação. Pode avançar, voltar ou pular quando quiser.",
    serif: true,
  },
  {
    id: "setup",
    eyebrow: "Primeiros passos",
    icon: ListChecks,
    title: "Seu checklist de início",
    desc: "Mostra exatamente o que falta pra sua agência ficar redonda: marca, Google Drive, seus clientes. Risque um por um — ele some sozinho quando terminar.",
    spotLabel: "Checklist \"Primeiros passos\"",
    view: "admin",
    target: '[data-tour="setup-checklist"]',
    roles: ["master"],
  },
  {
    id: "busca",
    eyebrow: "Ache qualquer coisa",
    icon: Search,
    title: "Busca inteligente",
    desc: "Digite do jeito que vier na cabeça — \"pagar assinatura\", \"apaguei sem querer\", ou o nome de um cliente. Ela entende sinônimo e aguenta erro de digitação.",
    descMobile: "Toque na lupa aqui em cima e digite do jeito que vier na cabeça — \"pagar assinatura\", \"apaguei sem querer\", ou o nome de um cliente.",
    spotLabel: "Busca global",
    target: '[data-tour="global-search"]',
  },
  {
    id: "tasks",
    eyebrow: "Sua base diária",
    icon: ClipboardList,
    title: "Minhas demandas",
    desc: "Tudo que está atribuído a você, agrupado por status, com a urgência do prazo colorida (🔴 urgente, 🟡 atenção, 🟢 tranquilo). É a tela que você vai abrir todo dia.",
    spotLabel: "Minhas demandas",
    view: "my",
    target: '[data-tour="my-tasks"]',
  },
  {
    id: "sidebar",
    eyebrow: "Sua carteira",
    icon: Folder,
    title: "Seus clientes",
    desc: "Aqui ficam os clientes da agência, separados por categoria. Clique num pra abrir o mês dele — é dali que sai todo o resto.",
    descMobile: "Aqui ficam os clientes da agência, separados por categoria. Toque num pra abrir o mês dele — e use o + pra cadastrar um novo.",
    spotLabel: "Clientes",
    target: '[data-tour="sidebar"]',
    mobileTarget: '[data-tour="mobile-clients-btn"]',
  },
  {
    id: "cliente-board",
    eyebrow: "O coração do app",
    icon: LayoutGrid,
    title: "O board que organiza tudo",
    desc: "Dentro de cada cliente, todo post e reel vira um card com prazo, responsável e status. Arraste, comente (inclusive por áudio), aprove — sem planilha, sem se perder no WhatsApp.",
    spotLabel: "Board de conteúdo do cliente",
    target: '[data-tour="client-board"]',
  },
  {
    id: "cliente-feed",
    eyebrow: "Aprovação sem atrito",
    icon: Link2,
    title: "Seu cliente aprova em segundos",
    desc: "A aba \"Preview de Feed\" monta a grade como vai ficar no Instagram e gera um link público — o cliente aprova ou pede ajuste sem precisar de conta no sistema.",
    spotLabel: "Preview de Feed",
    target: '[data-tour="client-feed-tab"]',
  },
  {
    id: "calendario",
    eyebrow: "Visão geral",
    icon: CalendarDays,
    title: "Todo mundo, num calendário só",
    desc: "Visão mensal com todas as publicações da agência juntas. Passe o mouse num dia pra ver a miniatura e o cliente.",
    descMobile: "Visão mensal com todas as publicações da agência juntas. No celular, toque no menu (☰) aqui embaixo e escolha Calendário.",
    spotLabel: "Calendário",
    target: '[data-tour="nav-calendario"]',
    mobileTarget: '[data-tour="mobile-menu-btn"]',
    hideIfDisabled: "calendar",
  },
  {
    id: "instagram",
    eyebrow: "Publicação",
    icon: Instagram,
    title: "Publique sem sair daqui",
    desc: "Conecte a conta do cliente e publique post, reel ou story direto pelo app — na hora ou agendado. Sem abrir o Instagram, sem outro app.",
    descMobile: "Conecte a conta do cliente e publique direto pelo app. No celular, toque no menu (☰) aqui embaixo e escolha Instagram.",
    spotLabel: "Instagram",
    target: '[data-tour="nav-instagram"]',
    mobileTarget: '[data-tour="mobile-menu-btn"]',
    roles: ["master", "setor"],
    hideIfDisabled: "instagram",
  },
  {
    id: "equipe",
    eyebrow: "Sua equipe",
    icon: Users,
    title: "Cargos, permissões e metas",
    desc: "Aprove quem entra, defina o que cada pessoa vê e faz (Membro, Adm Setor ou Adm Master), e acompanhe a produtividade de todo mundo.",
    descMobile: "Aprove quem entra, defina cargo, permissões e metas. No celular, toque no menu (☰) aqui embaixo e escolha Equipe.",
    spotLabel: "Equipe",
    target: '[data-tour="nav-equipe"]',
    mobileTarget: '[data-tour="mobile-menu-btn"]',
    roles: ["master", "setor"],
  },
  {
    id: "dashboard",
    eyebrow: "Saúde da operação",
    icon: BarChart3,
    title: "Dashboard geral",
    desc: "Métricas do mês e ranking de produtividade num piscar de olhos — clique num número (Entregues/Falta) pra ver a lista de itens por trás dele.",
    spotLabel: "Dashboard",
    view: "admin",
    target: '[data-tour="dashboard-hero"]',
    roles: ["master", "setor"],
  },
  {
    id: "branding",
    eyebrow: "Deixa com a sua cara",
    icon: Palette,
    title: "Personalize a sua agência",
    desc: "Troque a cor principal, o logo e o modo claro/escuro bem aqui. O Modo Criador veste a camisa da sua marca — inclusive quando o cliente abre o link de aprovação.",
    spotLabel: "Configurações → Geral → Marca da agência",
    view: "settings",
    settingsTab: "general",
    target: '[data-tour="org-branding"]',
    roles: ["master"],
  },
  {
    id: "bell",
    eyebrow: "Fique de olho",
    icon: Bell,
    title: "Notificações",
    desc: "Avisos de prazo, menções (@nome) e demandas novas chegam por aqui. Clicar leva direto pro item — nada se perde.",
    spotLabel: "Notificações",
    target: '[data-tour="notifications"]',
  },
  {
    id: "done",
    eyebrow: "Pronto",
    icon: PartyPopper,
    title: "Agora é com você",
    desc: "Isso é o essencial. Qualquer dúvida, clique no ícone (?) em qualquer tela — lá tem tutoriais, FAQ, e dá pra refazer esse tour quando quiser.",
    serif: true,
    finale: true,
  },
];

const PAD = 10;
const CARD_W = 380;
const CONFETTI_COLORS = ["rgb(var(--lz-brand-rgb))", "#6FA8DC", "#FF6B6B", "#B892FF", "rgba(var(--lz-brand-rgb),0.5)"];

export function AppTour() {
  const me = useMe().data;
  const isMobile = useIsMobile();
  const { updateMyProfile } = useApi();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const autoStartedRef = useRef(false);

  const disabledFeatures = new Set(me?.disabledFeatures ?? []);
  const visibleSteps = STEPS.filter((s) =>
    (!s.roles || (me?.role && s.roles.includes(me.role as Role))) &&
    (!s.hideIfDisabled || !disabledFeatures.has(s.hideIfDisabled))
  );
  const step = visibleSteps[stepIdx];
  const stepTarget = isMobile && step?.mobileTarget ? step.mobileTarget : step?.target;
  const stepDesc = isMobile && step?.descMobile ? step.descMobile : step?.desc;

  const confetti = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    })),
    [step?.finale],
  );

  // Auto-start once on first login (after onboarding completes).
  useEffect(() => {
    if (!me || autoStartedRef.current) return;
    if (me.onboardedAt && !me.tourCompletedAt) {
      autoStartedRef.current = true;
      // small delay so UI mounts first
      const t = setTimeout(() => { setStepIdx(0); setOpen(true); }, 600);
      return () => clearTimeout(t);
    }
  }, [me]);

  // External restart trigger.
  useEffect(() => {
    const handler = () => { setStepIdx(0); setOpen(true); };
    window.addEventListener("lz:start-tour", handler);
    return () => window.removeEventListener("lz:start-tour", handler);
  }, []);

  // Switch view when step requires it.
  useEffect(() => {
    if (!open || !step) return;
    if (step.view === "admin") navigate({ to: "/admin" });
    else if (step.view === "settings") navigate({ to: "/configuracoes", search: { tab: step.settingsTab ?? "general" } });
  }, [open, step, navigate]);

  // Track target rect.
  useLayoutEffect(() => {
    if (!open || !stepTarget) { setRect(null); return; }
    let raf = 0;
    const update = () => {
      const el = document.querySelector(stepTarget) as HTMLElement | null;
      // Elements hidden via `display:none` (e.g. the desktop sidebar on a
      // mobile viewport) still match the selector but report a zero-size
      // rect — treat that the same as "not found" instead of drawing a
      // highlight box around nothing.
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        setRect(el.getBoundingClientRect());
        // ensure visible
        try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch {}
      } else {
        setRect(null);
      }
    };
    // give the view a tick to render
    raf = window.setTimeout(update, 120) as unknown as number;
    const onResize = () => update();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    const interval = window.setInterval(update, 500);
    return () => {
      window.clearTimeout(raf);
      window.clearInterval(interval);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, step, stepTarget]);

  if (!open || !step) return null;

  const close = async (markDone: boolean) => {
    setOpen(false);
    setRect(null);
    if (markDone) {
      try { await updateMyProfile.mutateAsync({ data: { tourCompleted: true } }); } catch {}
    }
  };

  const next = () => {
    if (stepIdx >= visibleSteps.length - 1) close(true);
    else setStepIdx((i) => i + 1);
  };
  const prev = () => setStepIdx((i) => Math.max(0, i - 1));

  // Card position
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let cardStyle: React.CSSProperties = {
    position: "fixed",
    width: Math.min(CARD_W, vw - 24),
    zIndex: 1000,
  };
  if (rect) {
    const cardW = Math.min(CARD_W, vw - 24);
    const cardH = 260; // approx
    const spaceBelow = vh - rect.bottom;
    const placeBelow = spaceBelow > cardH + PAD + 16;
    const top = placeBelow ? rect.bottom + PAD : Math.max(12, rect.top - cardH - PAD);
    let left = rect.left + rect.width / 2 - cardW / 2;
    left = Math.max(12, Math.min(vw - cardW - 12, left));
    cardStyle = { ...cardStyle, top, left };
  } else {
    cardStyle = { ...cardStyle, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  // Highlight box around target — pulses softly instead of sitting static.
  const highlight = rect && (
    <div
      className="lz-tour-pulse"
      style={{
        position: "fixed",
        top: rect.top - 8,
        left: rect.left - 8,
        width: rect.width + 16,
        height: rect.height + 16,
        borderRadius: 14,
        border: "2px solid rgb(var(--lz-brand-rgb))",
        pointerEvents: "none",
        zIndex: 999,
        transition: "top 200ms ease, left 200ms ease, width 200ms ease, height 200ms ease",
      }}
    />
  );

  const backdrop = !rect && (
    <div
      onClick={() => close(false)}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 999 }}
    />
  );

  const Icon = step.icon;
  const progressPct = ((stepIdx + 1) / visibleSteps.length) * 100;

  return createPortal(
    <>
      {backdrop}
      {highlight}
      <div
        key={step.id}
        style={{
          ...cardStyle,
          backgroundImage: "linear-gradient(180deg, color-mix(in srgb, var(--card) 100%, white 2%), var(--card))",
          boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45), 0 0 0 1px rgba(var(--lz-brand-rgb),0.18)",
        }}
        className="lz-tour-card-in rounded-2xl border p-6 text-foreground relative overflow-hidden"
      >
        {step.finale && confetti.map((c, i) => (
          <span
            key={i}
            style={{
              position: "absolute", top: -12, left: `${c.left}%`, width: 6, height: 10, borderRadius: 1,
              backgroundColor: c.color, animation: `lz-tour-confetti 1.6s ease-in ${c.delay}s forwards`,
            }}
          />
        ))}

        <button onClick={() => close(true)} className="absolute top-4 right-4 text-foreground/40 hover:text-foreground z-10" aria-label="Fechar">
          <X size={16} />
        </button>

        {step.finale ? (
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{
              background: "radial-gradient(circle at 35% 30%, rgba(var(--lz-brand-rgb),0.9), rgb(var(--lz-brand-rgb)))",
              boxShadow: "0 0 0 6px rgba(var(--lz-brand-rgb),0.14), 0 10px 26px -6px rgba(var(--lz-brand-rgb),0.5)",
            }}
          >
            <Icon size={22} color="#0D0D0D" />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.14)", color: "var(--lz-accent-ink)" }}
            >
              <Icon size={16} />
            </div>
            <div className="text-[10px] uppercase tracking-wider font-extrabold" style={{ color: "var(--lz-accent-ink)" }}>
              {step.eyebrow}
            </div>
            <div className="ml-auto text-[10px] text-foreground/35 font-bold tabular-nums">
              {stepIdx + 1} / {visibleSteps.length}
            </div>
          </div>
        )}

        <h3
          className={step.serif ? "text-[24px] italic leading-tight mb-2" : "font-extrabold text-[17px] leading-tight mb-2"}
          style={step.serif ? { fontFamily: "'Instrument Serif', serif", fontWeight: 400, textAlign: "center" } : undefined}
        >
          {step.title}
        </h3>
        <p className={`text-foreground/65 text-[13px] leading-relaxed mb-3.5 ${step.finale ? "text-center" : ""}`}>{stepDesc}</p>

        {step.spotLabel && (
          <div
            className="inline-flex items-center gap-1.5 text-[10.5px] font-bold rounded-full px-2.5 py-1 mb-3.5"
            style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.14)", color: "var(--lz-accent-ink)" }}
          >
            <span className="h-1 w-1 rounded-full" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }} />
            {step.spotLabel}
          </div>
        )}

        {/* Progress bar */}
        <div className="h-[3px] w-full rounded-full bg-foreground/8 mb-4 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, backgroundColor: "rgb(var(--lz-brand-rgb))" }}
          />
        </div>

        <div className={`flex items-center gap-2 ${step.finale ? "justify-center" : "justify-between"}`}>
          {!step.finale && (
            <div className="flex items-center gap-2">
              {stepIdx > 0 ? (
                <button
                  onClick={prev}
                  className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-2 rounded-lg text-foreground/70 bg-foreground/6 hover:bg-foreground/10 border border-foreground/10"
                >
                  <ArrowLeft size={12} /> Voltar
                </button>
              ) : (
                <button onClick={() => close(false)} className="text-[11px] text-foreground/40 hover:text-foreground/70 px-1">
                  Pular tour
                </button>
              )}
            </div>
          )}
          <button
            onClick={next}
            className="inline-flex items-center gap-1.5 text-[12px] font-bold px-4 py-2.5 rounded-lg transition-transform active:scale-95"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D", boxShadow: "0 4px 18px -4px rgba(var(--lz-brand-rgb),0.55)" }}
          >
            {step.finale ? <>Concluir <PartyPopper size={13} /></> : stepIdx >= visibleSteps.length - 2 ? <>Última página <ArrowRight size={13} /></> : <>Próximo <ArrowRight size={13} /></>}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

/** Dispara o tour de qualquer canto do app. */
export function startTour() {
  window.dispatchEvent(new Event("lz:start-tour"));
}
