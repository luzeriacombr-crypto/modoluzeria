import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useMe, useApi } from "@/lib/luzeria/queries";
import { useIsMobile } from "@/hooks/use-mobile";

type Role = "master" | "setor" | "member";

type Step = {
  id: string;
  title: string;
  desc: string;
  /** Overrides `desc` on mobile — use when the location/wording differs (e.g. "toque no menu" vs "clique aqui"). */
  descMobile?: string;
  target?: string;
  view?: "my" | "admin" | "settings" | "profile";
  roles?: Role[];
  /** Overrides `target` on mobile, when the feature lives in a different spot (bottom nav vs sidebar). */
  mobileTarget?: string;
  /** Skip this step when the org disabled this optional feature (OPTIONAL_FEATURE_KEYS). */
  hideIfDisabled?: string;
};

const STEPS: Step[] = [
  {
    id: "intro",
    title: "Bem-vindo ao Modo Criador 💚",
    desc: "Em poucos passos eu te mostro o app. Você pode avançar, voltar ou pular a qualquer momento.",
  },
  {
    id: "tasks",
    title: "Minhas demandas",
    desc: "Tudo o que está atribuído a você aparece aqui, agrupado por status. A pílula colorida mostra a urgência do prazo (🔴 urgente, 🟡 atenção, 🟢 tranquilo).",
    view: "my",
    target: '[data-tour="my-tasks"]',
  },
  {
    id: "activity-counts",
    title: "Atividades registradas",
    desc: "Gravações, roteiros e outras atividades que você concluiu no mês aparecem aqui. Clique em uma pílula pra ver a lista e abrir direto o item.",
    view: "my",
    target: '[data-tour="activity-counts"]',
  },
  {
    id: "goals",
    title: "Suas metas do mês",
    desc: "Acompanhe Posts, Reels e Stories em tempo real. Se a cor virar laranja/vermelho, você está atrás do esperado pro dia do mês.",
    view: "my",
    target: '[data-tour="goals"]',
  },
  {
    id: "week",
    title: "Visão Minha Semana",
    desc: "Clique aqui pra ver suas demandas em formato de kanban, organizado por dia da semana.",
    view: "my",
    target: '[data-tour="my-week"]',
  },
  {
    id: "calendario",
    title: "Calendário",
    desc: "Visão mensal em grade com todas as publicações da agência. Passe o mouse num dia pra ver a miniatura e o cliente.",
    descMobile: "Visão mensal em grade com todas as publicações da agência. No celular, é só tocar no menu (☰) aqui embaixo e escolher Calendário.",
    target: '[data-tour="nav-calendario"]',
    mobileTarget: '[data-tour="mobile-menu-btn"]',
    hideIfDisabled: "calendar",
  },
  {
    id: "biblioteca",
    title: "Biblioteca de referências",
    desc: "Guarde links de vídeos e posts (do YouTube, Instagram, TikTok...) como referência — geral ou de um cliente específico — pra puxar na hora de escrever um roteiro novo.",
    descMobile: "Guarde links de vídeos e posts como referência — geral ou de um cliente específico. No celular, é só tocar no menu (☰) aqui embaixo e escolher Biblioteca.",
    target: '[data-tour="nav-biblioteca"]',
    mobileTarget: '[data-tour="mobile-menu-btn"]',
    hideIfDisabled: "reference_library",
  },
  {
    id: "instagram",
    title: "Instagram",
    desc: "Conecte a conta do Instagram da agência e publique posts, reels e stories direto pelo Modo Criador, sem precisar abrir o app do Instagram.",
    descMobile: "Conecte a conta do Instagram da agência e publique direto pelo Modo Criador. No celular, é só tocar no menu (☰) aqui embaixo e escolher Instagram.",
    target: '[data-tour="nav-instagram"]',
    mobileTarget: '[data-tour="mobile-menu-btn"]',
    roles: ["master", "setor"],
    hideIfDisabled: "instagram",
  },
  {
    id: "financeiro",
    title: "Financeiro",
    desc: "Plano e cobrança da agência, margem por cliente, programa de afiliados e revenda white label — tudo isso fica agrupado aqui.",
    descMobile: "Plano e cobrança, margem por cliente, afiliados e revenda white label. No celular, é só tocar no menu (☰) aqui embaixo.",
    target: '[data-tour="nav-financeiro"]',
    mobileTarget: '[data-tour="mobile-menu-btn"]',
    roles: ["master"],
  },
  {
    id: "equipe",
    title: "Equipe",
    desc: "Aprovação de membros, metas de cada um, relatório de produtividade e a jornada do cliente (as etapas que avisam o cliente por WhatsApp) ficam agrupados aqui.",
    descMobile: "Membros, metas, relatório de produtividade e jornada do cliente. No celular, é só tocar no menu (☰) aqui embaixo.",
    target: '[data-tour="nav-equipe"]',
    mobileTarget: '[data-tour="mobile-menu-btn"]',
    roles: ["master", "setor"],
  },
  {
    id: "rotina",
    title: "Rotina",
    desc: "Dentro do grupo Equipe também tem a Rotina — tarefas de limpeza e organização recorrentes, marcadas como feitas dia a dia.",
    descMobile: "Tarefas de limpeza e organização recorrentes, marcadas como feitas dia a dia. No celular, é só tocar no menu (☰) aqui embaixo e escolher Rotina.",
    target: '[data-tour="nav-equipe"]',
    mobileTarget: '[data-tour="mobile-menu-btn"]',
    roles: ["master", "setor"],
    hideIfDisabled: "rotina",
  },
  {
    id: "ajuda",
    title: "Ajuda",
    desc: "Tutoriais, perguntas frequentes e um botão pra reportar bugs — com acompanhamento do status direto por aqui.",
    descMobile: "Tutoriais, perguntas frequentes e um botão pra reportar bugs. No celular, é só tocar no menu (☰) aqui embaixo e escolher Ajuda.",
    target: '[data-tour="nav-ajuda"]',
    mobileTarget: '[data-tour="mobile-menu-btn"]',
  },
  {
    id: "sidebar",
    title: "Seus clientes",
    desc: "Aqui ficam os clientes da agência separados por categoria. Clique em um pra ver o board mensal de Posts e Reels.",
    descMobile: "Aqui ficam os clientes da agência separados por categoria. Toque num pra ver o board mensal de Posts e Reels.",
    target: '[data-tour="sidebar"]',
    mobileTarget: '[data-tour="mobile-clients-btn"]',
  },
  {
    id: "bell",
    title: "Notificações",
    desc: "Avisos de prazo, menções (@nome) e novas tarefas chegam por aqui. Clicar leva direto pro item.",
    target: '[data-tour="notifications"]',
  },
  {
    id: "profile",
    title: "Seu perfil",
    desc: "Edite sua foto, cor do avatar, ative a verificação em duas etapas e refaça este tour quando quiser.",
    target: '[data-tour="profile-btn"]',
  },
  {
    id: "dashboard",
    title: "Dashboard",
    desc: "Métricas do mês, ranking de produtividade e saúde da operação — clique num número (Entregues/Falta) pra ver a lista de itens por trás dele. Atualiza automaticamente em Modo TV.",
    view: "admin",
    target: '[data-tour="dashboard-hero"]',
    roles: ["master", "setor"],
  },
  {
    id: "settings",
    title: "Configurações",
    desc: "Equipe, Relatório, Jornada do cliente, Automações (Drive e lembretes), Plano e Cobrança, Margem por cliente, Afiliados, Revenda white label, Atualizações (o que mudou no Modo Criador) e a marca da agência (cores, logo, menu personalizado) — tudo fica aqui.",
    view: "settings",
    target: '[data-tour="settings-tabs"]',
    roles: ["master"],
  },
  {
    id: "done",
    title: "Tudo pronto! ✨",
    desc: "Pode refazer este tour quando quiser em Perfil → \"Refazer tour\" ou em Configurações → Geral. Boas entregas 💚",
  },
];

const PAD = 10;
const CARD_W = 340;

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
    else if (step.view === "settings") navigate({ to: "/configuracoes" });
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
    borderColor: "rgba(var(--lz-brand-rgb), 0.4)",
  };
  if (rect) {
    const cardW = Math.min(CARD_W, vw - 24);
    const cardH = 200; // approx
    const spaceBelow = vh - rect.bottom;
    const placeBelow = spaceBelow > cardH + PAD + 16;
    const top = placeBelow ? rect.bottom + PAD : Math.max(12, rect.top - cardH - PAD);
    let left = rect.left + rect.width / 2 - cardW / 2;
    left = Math.max(12, Math.min(vw - cardW - 12, left));
    cardStyle = { ...cardStyle, top, left };
  } else {
    cardStyle = { ...cardStyle, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  // Highlight box around target
  const highlight = rect && (
    <div
      style={{
        position: "fixed",
        top: rect.top - 6,
        left: rect.left - 6,
        width: rect.width + 12,
        height: rect.height + 12,
        borderRadius: 12,
        boxShadow: "0 0 0 4px rgba(var(--lz-brand-light-rgb),0.45), 0 0 0 9999px rgba(0,0,0,0.65)",
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
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 999 }}
    />
  );

  return createPortal(
    <>
      {backdrop}
      {highlight}
      <div
        style={cardStyle}
        className="rounded-xl bg-card border p-4 shadow-2xl text-foreground"
      >
        <div className="flex items-start gap-2 mb-2">
          <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.18)", color: "var(--lz-accent-ink)" }}>
            <Sparkles size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-bold text-[var(--lz-accent-ink)]">
              Tour · {stepIdx + 1} de {visibleSteps.length}
            </div>
            <h3 className="text-foreground font-bold text-sm mt-0.5 leading-tight">{step.title}</h3>
          </div>
          <button onClick={() => close(true)} className="text-foreground/40 hover:text-foreground shrink-0" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <p className="text-foreground/70 text-[13px] leading-relaxed mb-4">{stepDesc}</p>

        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-foreground/5 mb-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${((stepIdx + 1) / visibleSteps.length) * 100}%`, backgroundColor: "rgb(var(--lz-brand-rgb))" }}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => close(true)}
            className="text-[11px] text-foreground/40 hover:text-foreground/70 underline-offset-2 hover:underline"
          >
            Pular tour
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              disabled={stepIdx === 0}
              className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md text-foreground/70 hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft size={12} /> Anterior
            </button>
            <button
              onClick={next}
              className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md text-black"
              style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
            >
              {stepIdx >= visibleSteps.length - 1 ? (
                <>Finalizar <Check size={12} /></>
              ) : (
                <>Próximo <ArrowRight size={12} /></>
              )}
            </button>
          </div>
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