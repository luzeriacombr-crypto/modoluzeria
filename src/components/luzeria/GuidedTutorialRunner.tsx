import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X, ArrowLeft, ArrowRight, Check, Compass, Search } from "lucide-react";
import { useGuidedTutorial } from "@/lib/luzeria/guided-tutorial-store";
import { GUIDED_TUTORIALS } from "@/lib/luzeria/guided-tutorials";
import { clientsQO } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { Avatar } from "./Avatar";

const PAD = 10;
const CARD_W = 360;

/** Versão "ao vivo" dos tutoriais da Central de Ajuda — destaca o elemento
 * de verdade na tela em vez de só descrever em texto. Montado globalmente
 * (App.tsx), acionado pelo botão "Me guie" em AjudaPage.tsx via
 * useGuidedTutorial. Mesma mecânica de destaque/posição do AppTour.tsx
 * (onboarding), mas sem papéis/persistência — é disparado sob demanda,
 * nunca sozinho. */
export function GuidedTutorialRunner() {
  const { activeTitle, clientId, stepIdx, pickingClientFor, next, prev, close, pickClient } = useGuidedTutorial();
  const navigate = useNavigate();
  const openFicha = useUI((s) => s.openFicha);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const guide = activeTitle ? GUIDED_TUTORIALS[activeTitle] : null;
  const steps = guide ? (typeof guide.steps === "function" ? guide.steps(clientId ?? "") : guide.steps) : [];
  const step = steps[stepIdx];

  // Navega (rota) ou abre a Ficha do Cliente (modal global, não é rota) —
  // o que o passo pedir.
  useEffect(() => {
    if (!step) return;
    if (step.to) navigate({ to: step.to as any, search: step.search as any });
    if (step.openClientFicha && clientId) openFicha(clientId);
  }, [step, clientId, navigate, openFicha]);

  // Mesma lógica de rastreio de alvo do AppTour.tsx: sonda o seletor a cada
  // 500ms (cobre o tempo de montar a tela/modal depois da navegação acima),
  // ignora elemento com rect zerado (escondido por responsivo) em vez de
  // destacar um quadrado vazio.
  useLayoutEffect(() => {
    if (!step?.target) { setRect(null); return; }
    const target = step.target;
    const update = () => {
      const el = document.querySelector(target) as HTMLElement | null;
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        setRect(el.getBoundingClientRect());
        try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* noop */ }
      } else {
        setRect(null);
      }
    };
    const raf = window.setTimeout(update, 150);
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
  }, [step]);

  if (pickingClientFor) return <ClientPickerModal onPick={pickClient} onClose={close} />;
  if (!activeTitle || !guide || !step) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  let cardStyle: React.CSSProperties = { position: "fixed", width: Math.min(CARD_W, vw - 24), zIndex: 1000 };
  if (rect) {
    const cardW = Math.min(CARD_W, vw - 24);
    const cardH = 210;
    const spaceBelow = vh - rect.bottom;
    const placeBelow = spaceBelow > cardH + PAD + 16;
    const top = placeBelow ? rect.bottom + PAD : Math.max(12, rect.top - cardH - PAD);
    let left = rect.left + rect.width / 2 - cardW / 2;
    left = Math.max(12, Math.min(vw - cardW - 12, left));
    cardStyle = { ...cardStyle, top, left };
  } else {
    cardStyle = { ...cardStyle, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  const highlight = rect && (
    <div
      className="lz-tour-pulse"
      style={{
        position: "fixed", top: rect.top - 8, left: rect.left - 8, width: rect.width + 16, height: rect.height + 16,
        borderRadius: 14, border: "2px solid rgb(var(--lz-brand-rgb))", pointerEvents: "none", zIndex: 999,
        transition: "top 200ms ease, left 200ms ease, width 200ms ease, height 200ms ease",
      }}
    />
  );
  const backdrop = !rect && (
    <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 999 }} />
  );

  const isLast = stepIdx >= steps.length - 1;

  return createPortal(
    <>
      {backdrop}
      {highlight}
      <div
        key={stepIdx}
        style={{
          ...cardStyle,
          backgroundImage: "linear-gradient(180deg, color-mix(in srgb, var(--card) 100%, white 2%), var(--card))",
          boxShadow: "0 24px 60px -12px rgba(0,0,0,0.45), 0 0 0 1px rgba(var(--lz-brand-rgb),0.18)",
        }}
        className="lz-tour-card-in rounded-2xl border p-5 text-foreground relative"
      >
        <button onClick={close} className="absolute top-4 right-4 text-foreground/40 hover:text-foreground" aria-label="Fechar">
          <X size={16} />
        </button>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.14)", color: "var(--lz-accent-ink)" }}>
            <Compass size={14} />
          </div>
          <div className="text-[10px] uppercase tracking-wider font-extrabold truncate pr-6" style={{ color: "var(--lz-accent-ink)" }}>
            {activeTitle}
          </div>
        </div>
        <p className="text-foreground/70 text-[13px] leading-relaxed mb-4">{step.text}</p>
        <div className="h-[3px] w-full rounded-full bg-foreground/8 mb-4 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((stepIdx + 1) / steps.length) * 100}%`, backgroundColor: "rgb(var(--lz-brand-rgb))" }} />
        </div>
        <div className="flex items-center justify-between gap-2">
          {stepIdx > 0 ? (
            <button onClick={prev} className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-2 rounded-lg text-foreground/70 bg-foreground/6 hover:bg-foreground/10 border border-foreground/10">
              <ArrowLeft size={12} /> Voltar
            </button>
          ) : (
            <button onClick={close} className="text-[11px] text-foreground/40 hover:text-foreground/70 px-1">Encerrar</button>
          )}
          <button
            onClick={() => (isLast ? close() : next())}
            className="inline-flex items-center gap-1.5 text-[12px] font-bold px-4 py-2.5 rounded-lg transition-transform active:scale-95"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D", boxShadow: "0 4px 18px -4px rgba(var(--lz-brand-rgb),0.55)" }}
          >
            {isLast ? <>Entendi <Check size={13} /></> : <>Próximo <ArrowRight size={13} /></>}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

function ClientPickerModal({ onPick, onClose }: { onPick: (clientId: string) => void; onClose: () => void }) {
  const { data: clients = [] } = useQuery(clientsQO());
  const [search, setSearch] = useState("");
  const list = clients
    .filter((c) => !c.archived)
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.72)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border p-5 text-foreground" style={{ background: "var(--card)", borderColor: "rgba(var(--lz-brand-rgb),0.18)" }}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-extrabold text-[15px]">Em qual cliente?</h3>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground" aria-label="Fechar"><X size={16} /></button>
        </div>
        <p className="text-foreground/55 text-[12px] mb-3">Esse tutorial é dentro de um cliente — escolha qual pra eu te levar até lá.</p>
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/35" />
          <input
            autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente…"
            className="w-full bg-background border border-foreground/10 rounded-md pl-8 pr-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
          />
        </div>
        <div className="max-h-72 overflow-y-auto -mx-1 px-1 space-y-1">
          {list.length === 0 && <p className="text-xs text-foreground/35 text-center py-6">Nenhum cliente encontrado.</p>}
          {list.map((c) => (
            <button
              key={c.id} onClick={() => onPick(c.id)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-foreground/5 transition text-left"
            >
              <Avatar name={c.name} color={c.color} size={28} avatarUrl={c.photoUrl} />
              <span className="text-sm font-medium truncate">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
