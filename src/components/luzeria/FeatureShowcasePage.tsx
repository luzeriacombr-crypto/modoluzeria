import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Sparkles, Wallet, TrendingUp, Handshake, Link2, Route, Calendar,
  LayoutDashboard, Bookmark, Zap, ChevronDown, Compass,
} from "lucide-react";
import { useMe } from "@/lib/luzeria/queries";
import { FEATURE_SHOWCASE, SHOWCASE_CATEGORY_LABEL, type ShowcaseCategory, type ShowcaseEntry } from "@/lib/luzeria/feature-showcase-content";

const ICONS: Record<ShowcaseEntry["icon"], typeof Sparkles> = {
  wallet: Wallet, "trending-up": TrendingUp, handshake: Handshake, link: Link2,
  route: Route, sparkles: Sparkles, calendar: Calendar, "layout-dashboard": LayoutDashboard,
  bookmark: Bookmark, zap: Zap,
};

const CATEGORY_ORDER: ShowcaseCategory[] = ["financeiro", "cliente", "ia", "organizacao"];

/** `**negrito**` bem simples — só isso, sem mais nenhuma marcação. Suficiente
 * pro texto curto de cada card, sem puxar uma lib de markdown inteira. */
function renderBold(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

export function FeatureShowcasePage() {
  const me = useMe().data;
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<ShowcaseCategory | "todas">("todas");
  const [openId, setOpenId] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (!me) return [];
    const disabled = new Set(me.disabledFeatures ?? []);
    return FEATURE_SHOWCASE.filter((e) =>
      (!e.roles || (me.role && e.roles.includes(me.role as "master" | "setor"))) &&
      (!e.hideIfDisabled || !disabled.has(e.hideIfDisabled)) &&
      (activeCategory === "todas" || e.category === activeCategory)
    );
  }, [me, activeCategory]);

  return (
    <div className="px-4 sm:px-6 md:px-10 py-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-2.5 mb-1.5">
        <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg shrink-0" style={{ background: "rgba(var(--lz-brand-rgb),0.12)" }}>
          <Compass size={18} className="text-[var(--lz-accent-ink)]" />
        </span>
        <h1 className="text-xl font-bold text-foreground">Conheça o Modo Criador</h1>
      </div>
      <p className="text-sm text-foreground/50 mb-6 max-w-2xl">
        Um resumo rápido do que dá pra fazer por aqui. Clique em qualquer card pra ver como funciona, com um passo a passo curto.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        <CategoryPill label="Todas" active={activeCategory === "todas"} onClick={() => setActiveCategory("todas")} />
        {CATEGORY_ORDER.map((c) => (
          <CategoryPill key={c} label={SHOWCASE_CATEGORY_LABEL[c]} active={activeCategory === c} onClick={() => setActiveCategory(c)} />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-foreground/40 text-center py-16">Nada por aqui pro seu perfil de acesso.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visible.map((entry) => {
            const Icon = ICONS[entry.icon];
            const open = openId === entry.id;
            return (
              <div key={entry.id} className="rounded-xl border border-foreground/8 bg-card overflow-hidden transition-colors" style={open ? { borderColor: "rgba(var(--lz-brand-rgb),0.4)" } : undefined}>
                <button
                  onClick={() => setOpenId(open ? null : entry.id)}
                  className="w-full flex items-start gap-3 p-4 text-left"
                >
                  <span className="inline-flex items-center justify-center h-9 w-9 rounded-lg shrink-0" style={{ background: "rgba(var(--lz-brand-rgb),0.1)" }}>
                    <Icon size={17} className="text-[var(--lz-accent-ink)]" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-foreground">{entry.label}</span>
                      <ChevronDown size={15} className="shrink-0 text-foreground/35 transition-transform" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
                    </div>
                    <p className="text-[13px] text-foreground/60 leading-snug mt-1">{renderBold(entry.highlight)}</p>
                  </div>
                </button>
                {open && (
                  <div className="px-4 pb-4 -mt-1">
                    <ul className="space-y-1.5 mb-3">
                      {entry.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-[12.5px] text-foreground/55 leading-snug">
                          <span className="shrink-0 mt-0.5 inline-flex items-center justify-center h-4 w-4 rounded-full text-[9px] font-bold"
                            style={{ background: "rgba(var(--lz-brand-rgb),0.15)", color: "var(--lz-accent-ink)" }}>{i + 1}</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => navigate({ to: entry.to, search: entry.toSearch as any })}
                      className="text-xs font-bold uppercase px-3 py-2 rounded-md transition-opacity hover:opacity-90"
                      style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
                    >
                      {entry.ctaLabel ?? `Ir pra ${entry.label}`} →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
      style={active
        ? { background: "rgb(var(--lz-brand-rgb))", borderColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }
        : { background: "transparent", borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
    >
      {label}
    </button>
  );
}
