import { useRef, useState, useEffect } from "react";
import {
  Rocket, CalendarDays, Users, Link2, FolderOpen, Check, X, Zap, Lock, Star,
  MessageCircle, LayoutDashboard, BarChart3, Bell, ShieldCheck, Smartphone, Tablet, Monitor,
  ChevronLeft, ChevronRight, Play, Heart, Send, Bookmark,
} from "lucide-react";

/* ---------------------------------------------------------------------- *
 * Módulo compartilhado entre o site de vendas público (SalesPage.tsx) e o
 * editor visual (SalesPageEditorTab.tsx) — os dois precisam renderizar os
 * blocos exatamente da mesma forma, então a lógica visual mora só aqui.
 * ---------------------------------------------------------------------- */

export const LIME = "#D7FF3F";
export const ACCENT_ON_LIGHT = "#111F5C";
export const BG_BLUE = "#0A0E23";
export const BG_BLUE_2 = "#111F5C";
export const BG_WHITE = "#F5F5F0";
export const BG_GRAY = "#18181B";

export type BackgroundKey = "white" | "gray" | "blue" | "blue2";
export const BACKGROUND_SWATCHES: { key: BackgroundKey; label: string; color: string; dark: boolean }[] = [
  { key: "white", label: "Branco", color: BG_WHITE, dark: false },
  { key: "gray", label: "Cinza escuro", color: BG_GRAY, dark: true },
  { key: "blue", label: "Azul escuro", color: BG_BLUE, dark: true },
  { key: "blue2", label: "Azul marinho", color: BG_BLUE_2, dark: true },
];
export function backgroundStyle(key: BackgroundKey) {
  const found = BACKGROUND_SWATCHES.find((b) => b.key === key) ?? BACKGROUND_SWATCHES[0];
  return { color: found.color, dark: found.dark };
}

export const EASE = { transitionTimingFunction: "var(--ease-premium)" as const };
export const POP = "transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]";
export const LIFT = "transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-2xl";

/** Fades + slides a section's content in once it enters the viewport. */
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
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
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(28px)",
      transition: "opacity 700ms var(--ease-premium), transform 700ms var(--ease-premium)",
    }}>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Ícones selecionáveis no editor (eyebrow dos blocos, ícone dos passos)
 * ---------------------------------------------------------------------- */
export type IconType = React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
export const BLOCK_ICONS: Record<string, IconType> = {
  rocket: Rocket, x: X, check: Check, calendarDays: CalendarDays, users: Users, link2: Link2,
  folderOpen: FolderOpen, messageCircle: MessageCircle, layoutDashboard: LayoutDashboard,
  barChart3: BarChart3, bell: Bell, zap: Zap, shieldCheck: ShieldCheck, star: Star, lock: Lock,
};
export const ICON_KEYS = Object.keys(BLOCK_ICONS);
function Icon({ iconKey, size, style }: { iconKey: string; size?: number; style?: React.CSSProperties }) {
  const Cmp = BLOCK_ICONS[iconKey] ?? Star;
  return <Cmp size={size} style={style} />;
}

/* ---------------------------------------------------------------------- *
 * Ilustrações prontas — cada uma é uma mini-recriação da tela real do app,
 * usando as mesmas cores/tokens do produto (não é screenshot estático).
 * ---------------------------------------------------------------------- */
export function AppCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`w-full max-w-[420px] rounded-2xl border border-white/10 shadow-2xl overflow-hidden ${LIFT} ${className}`}
      style={{ background: "#141414", ...EASE }}>
      {children}
    </div>
  );
}

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
          <div className="h-20 w-20 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `conic-gradient(rgb(var(--lz-brand-rgb)) ${pct * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}>
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
              <span className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                style={{ background: r.color, color: "#0A0E23" }}>{r.name.charAt(0)}</span>
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

export const BUILTIN_ILLUSTRATIONS: Record<string, React.ComponentType> = {
  feedPreview: FeedPreviewVisual,
  dashboard: DashboardVisual,
  report: ReportVisual,
  calendar: CalendarVisual,
  notifications: NotificationVisual,
  responsive: ResponsiveVisual,
  security: SecurityVisual,
};
export const BUILTIN_KEYS = Object.keys(BUILTIN_ILLUSTRATIONS);
export const BUILTIN_LABELS: Record<string, string> = {
  feedPreview: "Preview de feed", dashboard: "Dashboard", report: "Relatórios",
  calendar: "Calendário", notifications: "Notificações", responsive: "Responsividade", security: "Segurança",
};

/* ---------------------------------------------------------------------- *
 * Pilha de imagens — 1 imagem parada = fluxo normal; 2+ ou flutuante =
 * container relative com cada imagem em absolute (mesma técnica do Hero e
 * do "Backup automático" originais), cobrindo flutuar/parada e
 * separadas/sobrepostas via as posições escolhidas.
 * ---------------------------------------------------------------------- */
export type ImageSpec = {
  id: string;
  source: "upload" | "builtin";
  url?: string;
  builtinKey?: string;
  floating: boolean;
  floatVariant?: "a" | "b" | "c";
  widthPct: number;
  top: number;
  left: number;
  z: number;
};

function ImageSpecVisual({ img, alt }: { img: ImageSpec; alt: string }) {
  if (img.source === "builtin") {
    const Cmp = BUILTIN_ILLUSTRATIONS[img.builtinKey ?? ""];
    return Cmp ? <Cmp /> : null;
  }
  return img.url ? <img src={img.url} alt={alt} className="w-full h-auto drop-shadow-xl" /> : null;
}

// Tailwind's scanner needs the literal class names visible somewhere in the
// source — building "lz-float-" + variant with a template literal would get
// the utility purged from the production CSS since it never appears whole.
const FLOAT_CLASS: Record<string, string> = { a: "lz-float-a", b: "lz-float-b", c: "lz-float-c" };

export function ImageStack({ images, alt, aspectClassName }: { images: ImageSpec[]; alt: string; aspectClassName?: string }) {
  if (images.length === 0) return null;
  const single = images.length === 1 && !images[0].floating;
  if (single) {
    return (
      <div className="w-full flex justify-center">
        <div style={{ width: `${images[0].widthPct}%` }}>
          <ImageSpecVisual img={images[0]} alt={alt} />
        </div>
      </div>
    );
  }
  return (
    <div className={`relative w-full ${aspectClassName ?? "aspect-[4/3]"}`}>
      {images.map((img) => (
        <div
          key={img.id}
          className={img.floating ? `${FLOAT_CLASS[img.floatVariant ?? "a"]} absolute` : "absolute"}
          style={{ width: `${img.widthPct}%`, top: `${img.top}%`, left: `${img.left}%`, zIndex: img.z }}
        >
          <ImageSpecVisual img={img} alt={alt} />
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Renderizadores por tipo de bloco
 * ---------------------------------------------------------------------- */
export function BulletListBlock({ content }: { content: any }) {
  const { color, dark } = backgroundStyle(content.background);
  const IconCmp = content.icon === "x" ? X : Check;
  const iconColor = content.icon === "x" ? "#f87171" : LIME;
  return (
    <section style={{ background: color, color: dark ? "#fff" : "#0A0E23" }} className="border-t border-white/10">
      <Reveal className="px-5 sm:px-10 max-w-[820px] mx-auto py-14">
        <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-8">{content.heading}</h2>
        <ul className="space-y-4">
          {(content.items ?? []).map((t: string, i: number) => (
            <li key={i} className={`flex gap-3 text-base sm:text-lg ${dark ? "text-white/80" : "text-[#0A0E23]/75"}`}>
              <IconCmp size={20} className="shrink-0 mt-0.5" style={{ color: iconColor }} strokeWidth={2.5} />
              <span className="text-balance">{t}</span>
            </li>
          ))}
        </ul>
        {(content.closingTextAccent || content.closingTextPlain) && (
          <p className={`mt-8 text-balance ${dark ? "text-white" : "text-[#0A0E23]"}`}>
            {content.closingTextPlain ? `${content.closingTextPlain} ` : ""}
            <span className="font-bold" style={{ color: LIME }}>{content.closingTextAccent}</span>
          </p>
        )}
      </Reveal>
    </section>
  );
}

export function StepsBlock({ content }: { content: any }) {
  const { color, dark } = backgroundStyle(content.background);
  return (
    <section style={{ background: color, color: dark ? "#fff" : "#0A0E23" }} className="border-t border-white/10">
      <Reveal className="px-5 sm:px-10 max-w-[1000px] mx-auto py-14">
        <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-10 text-center">{content.heading}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {(content.items ?? []).map((s: any, i: number) => (
            <div key={i} className={`rounded-xl p-5 border ${dark ? "bg-white/[0.04] border-white/10" : "bg-black/[0.04] border-black/10"} ${LIFT}`} style={EASE}>
              <div className="flex items-center gap-2 mb-3">
                <span className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0" style={{ background: LIME, color: "#0A0E23" }}>
                  {s.number}
                </span>
                <Icon iconKey={s.icon} size={20} style={{ color: dark ? LIME : ACCENT_ON_LIGHT }} />
              </div>
              <div className="font-bold mb-1">{s.title}</div>
              <div className={`text-sm leading-relaxed ${dark ? "text-white/60" : "text-[#0A0E23]/60"}`}>{s.description}</div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export function FeatureBlock({ content }: { content: any }) {
  const { color, dark } = backgroundStyle(content.background);
  const bodyClass = dark ? "text-white/65" : "text-[#0A0E23]/60";
  return (
    <section style={{ background: color, color: dark ? "#fff" : "#0A0E23" }} className="border-t border-white/10">
      <Reveal className="px-5 sm:px-10 max-w-[1100px] mx-auto py-14 sm:py-20">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className={content.reverse ? "lg:order-2" : ""}>
            <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide font-bold mb-3" style={{ color: dark ? LIME : ACCENT_ON_LIGHT }}>
              <Icon iconKey={content.eyebrowIcon} size={13} /> {content.eyebrowLabel}
            </div>
            <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-4 text-balance">{content.title}</h2>
            <p className={`${bodyClass} text-base leading-relaxed max-w-[460px]`}>{content.description}</p>
          </div>
          <div className={`flex justify-center ${content.reverse ? "lg:order-1" : ""}`}>
            {content.images?.length ? (
              content.images.length === 1 && !content.images[0].floating ? (
                content.images[0].source === "builtin" ? (
                  <ImageSpecVisual img={content.images[0]} alt={content.title} />
                ) : (
                  <AppCard><ImageSpecVisual img={content.images[0]} alt={content.title} /></AppCard>
                )
              ) : (
                <ImageStack images={content.images} alt={content.title} aspectClassName="aspect-square max-w-[420px]" />
              )
            ) : null}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function GalleryBlock({ content }: { content: any }) {
  const { color, dark } = backgroundStyle(content.background);
  const images: ImageSpec[] = content.images ?? [];
  if (images.length === 0) return null;
  return (
    <section style={{ background: color, color: dark ? "#fff" : "#0A0E23" }} className="border-t border-white/10">
      <Reveal className="px-5 sm:px-10 max-w-[1000px] mx-auto py-14">
        <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-10 text-center">{content.heading}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {images.map((img) => (
            <div key={img.id} className={`rounded-xl overflow-hidden border shadow-sm ${dark ? "border-white/10" : "border-black/10"} ${LIFT}`} style={EASE}>
              <ImageSpecVisual img={img} alt={content.heading} />
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export function TextBlurbBlock({ content }: { content: any }) {
  const { color, dark } = backgroundStyle(content.background);
  return (
    <section style={{ background: color, color: dark ? "#fff" : "#0A0E23" }} className="border-t border-white/10 text-center">
      <div className="px-5 sm:px-10 max-w-[720px] mx-auto py-14">
        <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide font-bold mb-3" style={{ color: dark ? LIME : ACCENT_ON_LIGHT }}>
          <Icon iconKey={content.eyebrowIcon} size={13} /> {content.eyebrowLabel}
        </div>
        <p className={`text-sm leading-relaxed ${dark ? "text-white/70" : "text-[#0A0E23]/70"}`}>{content.paragraph}</p>
      </div>
    </section>
  );
}
