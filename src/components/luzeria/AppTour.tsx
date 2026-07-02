import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useMe, useApi } from "@/lib/luzeria/queries";

type Role = "master" | "setor" | "member";

type Step = {
  id: string;
  title: string;
  desc: string;
  target?: string;
  view?: "my" | "admin" | "settings" | "profile";
  roles?: Role[];
  mobileTarget?: string;
};

const STEPS: Step[] = [
  {
    id: "intro",
    title: "Bem-vindo à Luzeria 💚",
    desc: "Em poucos passos eu te mostro o app. Você pode avançar, voltar ou pular a qualquer momento.",
  },
  {
    id: "tasks",
    title: "Coisas para fazer",
    desc: "Tudo o que está atribuído a você aparece aqui, agrupado por status. A pílula colorida mostra a urgência do prazo (🔴 urgente, 🟡 atenção, 🟢 tranquilo).",
    view: "my",
    target: '[data-tour="my-tasks"]',
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
    id: "sidebar",
    title: "Seus clientes",
    desc: "Aqui ficam os clientes da agência separados por categoria. Clique em um pra ver o board mensal de Posts e Reels.",
    target: '[data-tour="sidebar"]',
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
    desc: "Edite sua foto, cor do avatar e refaça este tour quando quiser.",
    target: '[data-tour="profile-btn"]',
  },
  {
    id: "dashboard",
    title: "Dashboard",
    desc: "Métricas do mês, ranking de produtividade e saúde da operação. Atualiza automaticamente em Modo TV.",
    view: "admin",
    target: '[data-tour="dashboard-hero"]',
    roles: ["master", "setor"],
  },
  {
    id: "settings",
    title: "Configurações",
    desc: "Aprovação de membros, exportação de relatórios (Excel) e ajustes gerais da agência.",
    view: "settings",
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
  const { updateMyProfile } = useApi();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const autoStartedRef = useRef(false);

  const visibleSteps = STEPS.filter((s) => !s.roles || (me?.role && s.roles.includes(me.role as Role)));
  const step = visibleSteps[stepIdx];

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
    if (!open || !step?.target) { setRect(null); return; }
    let raf = 0;
    const update = () => {
      const el = document.querySelector(step.target!);
      if (el) {
        setRect((el as HTMLElement).getBoundingClientRect());
        // ensure visible
        try { (el as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" }); } catch {}
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
  }, [open, step]);

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
        boxShadow: "0 0 0 4px rgba(200,212,78,0.45), 0 0 0 9999px rgba(0,0,0,0.65)",
        border: "2px solid #C8D44E",
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
        className="rounded-xl bg-[#1C1C1C] border border-[#C8D44E]/40 p-4 shadow-2xl text-white"
      >
        <div className="flex items-start gap-2 mb-2">
          <div className="h-7 w-7 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(200,212,78,0.18)", color: "#C8D44E" }}>
            <Sparkles size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider font-bold text-[#C8D44E]">
              Tour · {stepIdx + 1} de {visibleSteps.length}
            </div>
            <h3 className="text-white font-bold text-sm mt-0.5 leading-tight">{step.title}</h3>
          </div>
          <button onClick={() => close(true)} className="text-white/40 hover:text-white shrink-0" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <p className="text-white/70 text-[13px] leading-relaxed mb-4">{step.desc}</p>

        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-white/5 mb-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${((stepIdx + 1) / visibleSteps.length) * 100}%`, backgroundColor: "#C8D44E" }}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => close(true)}
            className="text-[11px] text-white/40 hover:text-white/70 underline-offset-2 hover:underline"
          >
            Pular tour
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={prev}
              disabled={stepIdx === 0}
              className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-md text-white/70 hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft size={12} /> Anterior
            </button>
            <button
              onClick={next}
              className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md text-black"
              style={{ backgroundColor: "#C8D44E" }}
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