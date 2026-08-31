import { useEffect, useState } from "react";
import { Sparkles, ChevronLeft, ChevronRight, Users, Target, Package, Clock, Sun, Moon } from "lucide-react";
import { LIME, BG_BLUE_2, EASE, LIFT, useReveal, staggerStyle } from "./salesPageBlocks";

/* ---------------------------------------------------------------------- *
 * "Você decide tudo" — réplica fiel do Dashboard de verdade (mesma
 * estrutura de AdminDashboard.tsx: hero com donut real em SVG, 4 cards de
 * métrica), só que com as variáveis de tema do app (--lz-brand-rgb,
 * --lz-accent-ink, --lz-radius, --background/--card/--foreground...)
 * definidas LOCALMENTE num wrapper, a partir do estado desta demo — em vez
 * de vir de Configurações de uma agência de verdade. Clicar numa cor, no
 * sol/lua ou no raio dos cantos muda essas variáveis, e como os elementos
 * abaixo leem exatamente os mesmos var(...) que o app real usa, tudo
 * reage — é o próprio mecanismo de personalização do produto, não uma
 * simulação separada dele.
 * ---------------------------------------------------------------------- */

const PALETTE_OPTIONS = [
  { hex: "#C8D44E", name: "Lima (padrão)" },
  { hex: "#4A9EFF", name: "Azul" },
  { hex: "#E76F51", name: "Coral" },
  { hex: "#B392F0", name: "Roxo" },
  { hex: "#5BA88A", name: "Verde" },
  { hex: "#FF6FA5", name: "Rosa" },
];

// Raio dos cantos fixo (sem controle na demo — o app de verdade deixa
// ajustar ponto a ponto, mas aqui só "cor" e "aparência" já bastam).
const FIXED_RADIUS = 14;

function hexToRgbChannels(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return "200, 212, 78";
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
}

function useCountUpOnce(target: number, active: boolean) {
  // Versão simplificada do useCountUp real — sobe até o valor uma vez
  // quando a seção entra na tela, sem depender de nenhum hook do app.
  // `active` começa false (antes do IntersectionObserver disparar) e vira
  // true depois — precisa ser um efeito de verdade com essa dependência,
  // não um inicializador de useState (que só roda uma vez, no mount, e
  // nunca mais reage a `active` mudar depois).
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setValue(target); return; }
    let raf = 0;
    const start = performance.now();
    const duration = 900;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target]);
  return value;
}

function BigDonutDemo({ percent, active }: { percent: number; active: boolean }) {
  const size = 128, stroke = 11, r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const animated = useCountUpOnce(percent, active);
  return (
    <div className="relative shrink-0 mx-auto md:mx-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="salesdemo-donut" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--lz-donut-stop1)" />
            <stop offset="100%" stopColor="var(--lz-donut-stop2)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="color-mix(in srgb, var(--foreground) 6%, transparent)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="url(#salesdemo-donut)" strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - animated / 100)} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 200ms linear" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[28px] font-extrabold tabular-nums leading-none" style={{ color: "var(--foreground)" }}>{animated}%</div>
        <div className="text-[9px] uppercase tracking-wider font-bold mt-1" style={{ color: "color-mix(in srgb, var(--foreground) 50%, transparent)" }}>Entregue</div>
        <div className="text-[10px] mt-0.5" style={{ color: "color-mix(in srgb, var(--foreground) 70%, transparent)" }}>
          <span className="font-bold" style={{ color: "var(--lz-accent-ink)" }}>199</span> / 233
        </div>
      </div>
    </div>
  );
}

function hexA(color: string, a: number) {
  return `color-mix(in srgb, ${color} ${a * 100}%, transparent)`;
}

function MetricCardDemo({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div
      className="relative overflow-hidden p-3 text-center md:text-left"
      style={{
        borderRadius: "var(--lz-radius)",
        background: `linear-gradient(160deg, ${hexA(tone, 0.16)} 0%, var(--card) 70%)`,
        border: `1px solid ${hexA(tone, 0.22)}`,
      }}
    >
      <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-20 blur-2xl" style={{ background: tone }} />
      <div className="relative flex items-center justify-center md:justify-start mb-2">
        <div className="h-6 w-6 rounded-md inline-flex items-center justify-center" style={{ background: hexA(tone, 0.18), color: tone }}>
          {icon}
        </div>
      </div>
      <div className="relative text-[22px] font-extrabold leading-none mb-1 tabular-nums" style={{ color: "var(--foreground)" }}>{value}</div>
      <div className="relative text-[9.5px] uppercase tracking-wider font-bold" style={{ color: hexA(tone, 0.9) }}>{label}</div>
    </div>
  );
}

export function InteractiveDashboardDemo() {
  const [accent, setAccent] = useState(PALETTE_OPTIONS[0].hex);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const radius = FIXED_RADIUS;
  const reveal = useReveal<HTMLDivElement>();

  const brandRgb = hexToRgbChannels(accent);
  const sidebarRgb = "17, 31, 92";
  const dark = theme === "dark";

  // Mesma fórmula de App.tsx: no claro, a cor de marca escurece sozinha
  // pra virar texto legível contra fundo branco.
  const accentInk = dark ? `rgb(${brandRgb})` : `color-mix(in srgb, rgb(${brandRgb}) 55%, black)`;
  const donutStop1 = dark ? `rgb(${brandRgb})` : `color-mix(in srgb, rgb(${brandRgb}) 65%, black)`;
  const donutStop2 = dark ? `color-mix(in srgb, rgb(${brandRgb}) 60%, white)` : `color-mix(in srgb, rgb(${brandRgb}) 40%, black)`;

  const themeVars: React.CSSProperties = dark
    ? { ["--background" as any]: "#0D0D0D", ["--foreground" as any]: "#FFFFFF", ["--card" as any]: "#1C1C1C", ["--lz-hero-pill-bg" as any]: "rgba(0,0,0,0.3)", ["--lz-hero-badge-bg" as any]: `rgba(${brandRgb},0.15)` }
    : { ["--background" as any]: "#F7F7F5", ["--foreground" as any]: "#16171B", ["--card" as any]: "#FFFFFF", ["--lz-hero-pill-bg" as any]: "transparent", ["--lz-hero-badge-bg" as any]: "transparent" };

  return (
    <section style={{ background: BG_BLUE_2 }} className="border-t border-foreground/10">
      <div ref={reveal.ref} className="px-5 sm:px-10 max-w-[980px] mx-auto py-12">
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide font-bold mb-2.5" style={{ color: LIME }}>
            <Sparkles size={13} /> Personalização de verdade
          </div>
          <h2 className="font-criador-serif normal-case text-2xl sm:text-3xl mb-2.5">Você decide tudo.</h2>
          <p className="text-foreground/55 text-sm max-w-[480px] mx-auto">
            Cor da marca, modo claro ou escuro — o Modo Criador se adapta à sua agência, não o contrário. Clica aí do lado e experimenta.
          </p>
        </div>

        <div className="grid lg:grid-cols-[220px_1fr] gap-5 items-start">
          {/* Controles — usam o visual do site, não o tema do mockup */}
          <div className="rounded-xl p-4 space-y-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)" }}>
            <div>
              <div className="text-[10px] uppercase tracking-wide font-bold text-foreground/40 mb-2">Cor da marca</div>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {PALETTE_OPTIONS.map((opt) => (
                  <button
                    key={opt.hex}
                    onClick={() => setAccent(opt.hex)}
                    title={opt.name}
                    aria-label={opt.name}
                    className="h-7 w-7 rounded-full transition-transform hover:scale-110"
                    style={{
                      background: opt.hex,
                      outline: accent === opt.hex ? `2px solid ${LIME}` : "2px solid transparent",
                      outlineOffset: 2,
                      ...EASE,
                    }}
                  />
                ))}
              </div>
              <p className="text-[10.5px] text-foreground/35 italic">ou a cor que você quiser</p>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-wide font-bold text-foreground/40 mb-2">Aparência</div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setTheme("dark")}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition"
                  style={{
                    background: dark ? LIME : "transparent",
                    color: dark ? "#0A0E23" : "rgba(255,255,255,0.6)",
                    border: dark ? "none" : "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <Moon size={13} /> Escuro
                </button>
                <button
                  onClick={() => setTheme("light")}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition"
                  style={{
                    background: !dark ? LIME : "transparent",
                    color: !dark ? "#0A0E23" : "rgba(255,255,255,0.6)",
                    border: !dark ? "none" : "1px solid rgba(255,255,255,0.15)",
                  }}
                >
                  <Sun size={13} /> Claro
                </button>
              </div>
            </div>
          </div>

          {/* O "app" — mesmas variáveis, mesma estrutura do Dashboard real */}
          <div
            className={`p-4 md:p-5 ${LIFT}`}
            style={{
              ...themeVars,
              ["--lz-brand-rgb" as any]: brandRgb,
              ["--lz-accent-ink" as any]: accentInk,
              ["--lz-donut-stop1" as any]: donutStop1,
              ["--lz-donut-stop2" as any]: donutStop2,
              ["--lz-radius" as any]: `${radius}px`,
              background: "var(--background)",
              border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
              borderRadius: Math.max(radius, 12),
              transition: "background 300ms var(--ease-premium), border-radius 300ms var(--ease-premium)",
              ...EASE,
            }}
          >
            {/* Hero */}
            <div
              className="relative overflow-hidden mb-5"
              style={{
                borderRadius: "var(--lz-radius)",
                background:
                  `radial-gradient(120% 140% at 0% 0%, rgba(${brandRgb},0.18) 0%, color-mix(in srgb, rgb(${brandRgb}) 10%, transparent) 35%, transparent 70%), ` +
                  `radial-gradient(80% 120% at 100% 100%, color-mix(in srgb, color-mix(in srgb, rgb(${sidebarRgb}) 40%, var(--background)) 55%, transparent) 0%, transparent 65%), ` +
                  "linear-gradient(180deg, var(--card) 0%, var(--background) 100%)",
                border: `1px solid rgba(${brandRgb},0.18)`,
                transition: "background 300ms var(--ease-premium), border-color 300ms var(--ease-premium)",
              }}
            >
              <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full opacity-30 blur-3xl" style={{ background: `rgb(${brandRgb})` }} />
              <div className="pointer-events-none absolute -bottom-24 right-10 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: `rgb(${sidebarRgb})` }} />

              <div className="relative grid md:grid-cols-[1fr_auto] gap-4 p-5 items-center">
                <div className="text-center md:text-left flex flex-col items-center md:items-start">
                  <div
                    className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: "var(--lz-hero-badge-bg)", color: "var(--lz-accent-ink)" }}
                  >
                    <Sparkles size={11} /> Dashboard
                  </div>
                  <h1 className="mt-2.5 font-bold text-[24px] md:text-[30px] leading-tight tracking-tight" style={{ color: "var(--foreground)" }}>
                    ENTREGAS
                  </h1>
                  <p className="mt-1.5 italic text-xs" style={{ color: "color-mix(in srgb, var(--foreground) 70%, transparent)" }}>Bom ritmo! Vamos fechar forte esse mês.</p>
                  <div
                    className="mt-3 inline-flex items-center gap-1 rounded-full backdrop-blur p-1 border mx-auto md:mx-0"
                    style={{ background: "var(--lz-hero-pill-bg)", borderColor: "color-mix(in srgb, var(--foreground) 10%, transparent)" }}
                  >
                    <span className="h-7 w-7 rounded-full flex items-center justify-center" style={{ color: "color-mix(in srgb, var(--foreground) 70%, transparent)" }}>
                      <ChevronLeft size={13} />
                    </span>
                    <div className="px-3 text-xs font-semibold min-w-[100px] text-center" style={{ color: "var(--foreground)" }}>Agosto 2026</div>
                    <span className="h-7 w-7 rounded-full flex items-center justify-center" style={{ color: "color-mix(in srgb, var(--foreground) 70%, transparent)" }}>
                      <ChevronRight size={13} />
                    </span>
                  </div>
                </div>
                <div className="mx-auto md:mx-0">
                  <BigDonutDemo percent={85} active={reveal.visible} />
                </div>
              </div>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              <div style={staggerStyle(reveal.visible, 0)}><MetricCardDemo icon={<Users size={14} />} label="Clientes ativos" value="22" tone={`rgb(${brandRgb})`} /></div>
              <div style={staggerStyle(reveal.visible, 1)}><MetricCardDemo icon={<Target size={14} />} label="Meta do mês" value="233" tone="#4A9EFF" /></div>
              <div style={staggerStyle(reveal.visible, 2)}><MetricCardDemo icon={<Package size={14} />} label="Entregues" value="199" tone={`rgb(${brandRgb})`} /></div>
              <div style={staggerStyle(reveal.visible, 3)}><MetricCardDemo icon={<Clock size={14} />} label="Falta" value="34" tone="#FF6B6B" /></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
