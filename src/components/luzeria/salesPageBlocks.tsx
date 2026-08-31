import { useRef, useState, useEffect } from "react";
import {
  Rocket, CalendarDays, Users, Link2, FolderOpen, Check, X, Zap, Lock, Star,
  MessageCircle, LayoutDashboard, BarChart3, Bell, ShieldCheck, Smartphone, Tablet, Monitor,
  ChevronLeft, ChevronRight, Play, Heart, Send, Bookmark, Plus, Pencil, ImagePlus, Loader2, GripVertical,
  Sparkles, Waves, Squircle,
} from "lucide-react";
import clickupTrelloLogos from "@/assets/clickup-trello-logos.png";
import { useMarketingAssetUpload } from "@/lib/luzeria/use-marketing-asset-upload";
import { requestConfirm } from "@/lib/luzeria/confirm-store";

/* ---------------------------------------------------------------------- *
 * Módulo compartilhado entre o site de vendas público (SalesPage.tsx) e o
 * editor visual (SalesPageEditorTab.tsx) — os dois precisam renderizar os
 * blocos exatamente da mesma forma. Cada renderizador de bloco aceita um
 * `onChange` opcional: quando presente, o próprio texto/imagem renderizado
 * vira editável ao clicar nele (usado só pelo editor); quando ausente,
 * fica só leitura (usado pelo site público).
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

/** Quando a seção tem uma imagem de fundo, sempre usa texto claro (escurece
 * a foto com um véu escuro por cima) — assim o texto continua legível sem
 * depender de qual das 4 cores estava selecionada antes de trocar pra imagem. */
export function sectionBackgroundStyle(content: { background: BackgroundKey; backgroundImage?: string | null }): { style: React.CSSProperties; dark: boolean } {
  if (content.backgroundImage) {
    return {
      style: {
        backgroundImage: `linear-gradient(rgba(10,14,35,0.6), rgba(10,14,35,0.6)), url(${content.backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      },
      dark: true,
    };
  }
  const { color, dark } = backgroundStyle(content.background);
  return { style: { background: color }, dark };
}

/* ---------------------------------------------------------------------- *
 * Tamanho de seção — arrastar pra redimensionar (estilo Wix), em vez dos
 * antigos 3 botões de preset. `paddingY`/`heightPx` guardam um valor livre
 * em pixels; blocos publicados antes dessa mudança só têm o velho campo
 * `size` (enum "compact"/"normal"/"spacious") — convertido on-the-fly pra
 * um valor em px equivalente, sem precisar de migração de dados.
 * ---------------------------------------------------------------------- */
const LEGACY_SIZE_TO_PADDING_PX: Record<string, number> = { compact: 40, normal: 64, spacious: 104 };
const LEGACY_SIZE_TO_BANNER_PX: Record<string, number> = { compact: 280, normal: 380, spacious: 520 };
export const PADDING_PX_MIN = 12;
export const PADDING_PX_MAX = 200;
export const BANNER_PX_MIN = 140;
export const BANNER_PX_MAX = 820;

export function paddingYValue(content: { paddingY?: number; size?: string }): number {
  if (typeof content.paddingY === "number") return content.paddingY;
  return LEGACY_SIZE_TO_PADDING_PX[content.size ?? "normal"] ?? LEGACY_SIZE_TO_PADDING_PX.normal;
}
export function bannerHeightValue(content: { heightPx?: number; size?: string }): number {
  if (typeof content.heightPx === "number") return content.heightPx;
  return LEGACY_SIZE_TO_BANNER_PX[content.size ?? "normal"] ?? LEGACY_SIZE_TO_BANNER_PX.normal;
}

/** Arraste vertical genérico: acompanha o ponteiro em tempo real (`display`)
 * e só chama `onCommit` (que salva) ao soltar — evita disparar uma
 * mutação por frame durante o arraste. */
export function useResizeDrag(value: number, min: number, max: number, onCommit: (v: number) => void) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const startRef = useRef<{ y: number; value: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { y: e.clientY, value };
    setDragValue(value);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current) return;
    e.stopPropagation();
    const next = Math.min(max, Math.max(min, startRef.current.value + (e.clientY - startRef.current.y)));
    setDragValue(next);
  }
  function onPointerUp(e: React.PointerEvent) {
    e.stopPropagation();
    if (dragValue !== null) onCommit(dragValue);
    startRef.current = null;
    setDragValue(null);
  }
  return { display: dragValue ?? value, dragging: dragValue !== null, handleProps: { onPointerDown, onPointerMove, onPointerUp } };
}

/** Barra fina no rodapé da seção — aparece no hover, arrasta pra
 * redimensionar. Só é renderizada em modo edição (o site público nunca vê). */
export function SectionResizeHandle({ resize }: { resize: ReturnType<typeof useResizeDrag> }) {
  return (
    <div
      {...resize.handleProps}
      className={`absolute left-0 right-0 bottom-0 h-3 cursor-ns-resize flex items-end justify-center z-20 group/resize touch-none transition-opacity ${resize.dragging ? "opacity-100" : "opacity-0 hover:opacity-100"}`}
      title="Arrastar pra redimensionar a seção"
    >
      <div className="w-14 h-1 rounded-full mb-1 transition-colors" style={{ background: resize.dragging ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 35%, transparent)" }} />
    </div>
  );
}

/** Native HTML5 drag-and-drop reorder — no external DnD library needed for
 * a plain same-list reorder (grip handle drags an item/block, drop target
 * splices it into place). Shared by list items here and by whole-block
 * reordering in the editor. */
export function useDragReorder<T>(items: T[], onReorder: (next: T[]) => void) {
  const dragIndexRef = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function onDragStart(i: number) {
    dragIndexRef.current = i;
  }
  function onDragOverItem(e: React.DragEvent, i: number) {
    e.preventDefault();
    if (overIndex !== i) setOverIndex(i);
  }
  function onDropItem(e: React.DragEvent, i: number) {
    e.preventDefault();
    setOverIndex(null);
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from === null || from === i) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(i, 0, moved);
    onReorder(next);
  }
  function onDragEnd() {
    dragIndexRef.current = null;
    setOverIndex(null);
  }
  return { overIndex, onDragStart, onDragOverItem, onDropItem, onDragEnd };
}

export const EASE = { transitionTimingFunction: "var(--ease-premium)" as const };
export const POP = "transition-transform duration-200 hover:scale-[1.03] active:scale-[0.97]";
export const LIFT = "transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-2xl";

/** Observa quando um elemento entra na tela — base compartilhada por
 * `Reveal` (a seção inteira) e pelo reveal em cascata dos itens de lista
 * dentro dela (um só observer por bloco, os itens só atrasam a própria
 * transição via `staggerStyle`, não criam observer cada um). */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
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
  return { ref, visible };
}

/** Fades + slides a section's content in once it enters the viewport. */
export function Reveal({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={className} style={{
      ...style,
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(28px)",
      transition: "opacity 700ms var(--ease-premium), transform 700ms var(--ease-premium)",
    }}>
      {children}
    </div>
  );
}

/** Estilo de um item dentro de uma lista/grade que revela em cascata —
 * mesmo `visible` de um único observer no container (a lista inteira),
 * só a transição de cada item atrasa em sequência. Efeito "premium" de
 * itens aparecendo um a um ao rolar, sem criar um observer por item.
 *
 * `transform` some (vira `undefined`, não "translateY(0)") assim que
 * `visible` vira true — alguns desses itens (os cards de "Simples assim")
 * também têm um `transform` próprio no hover (LIFT, levanta o card). Um
 * `style.transform` fixo inline venceria essa classe pra sempre e o hover
 * nunca mais levantaria nada; devolvendo o controle, o hover volta a
 * funcionar normalmente depois que o item já apareceu. */
export function staggerStyle(visible: boolean, index: number, stepMs = 70): React.CSSProperties {
  const delay = visible ? `${index * stepMs}ms` : "0ms";
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? undefined : "translateY(18px)",
    transition: `opacity 550ms var(--ease-premium) ${delay}, transform 550ms var(--ease-premium) ${delay}`,
  };
}

/** Parallax leve por scroll — desloca o elemento alguns pixels conforme
 * ele se aproxima do centro da tela. Só usado no site público (a versão
 * editável das imagens já tem o próprio arrastar-pra-mover, que não deve
 * competir com um deslocamento automático). Passivo, sem lib: mede a
 * posição a cada scroll via requestAnimationFrame. */
export function useScrollParallax<T extends HTMLElement = HTMLDivElement>(strength = 0.05) {
  const ref = useRef<T>(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    function measure() {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerDelta = rect.top + rect.height / 2 - window.innerHeight / 2;
      setOffset(centerDelta * -strength);
    }
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    }
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [strength]);
  return { ref, offset };
}

/* ---------------------------------------------------------------------- *
 * Ícones — catálogo fixo selecionável, e um overlay de <select> invisível
 * em cima do ícone renderizado (clicar no ícone abre o seletor nativo).
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
function EditableIcon({ value, onChange, size = 13, style }: { value: string; onChange: (v: string) => void; size?: number; style?: React.CSSProperties }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} onClick={(e) => e.stopPropagation()}>
      <Icon iconKey={value} size={size} style={style} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title="Trocar ícone"
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
      >
        {ICON_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>
    </span>
  );
}

/* ---------------------------------------------------------------------- *
 * Texto clicável — em modo leitura é só o texto; quando `onCommit` é
 * passado, clicar transforma no campo editável, e sair do campo salva.
 * ---------------------------------------------------------------------- */
function Editable({
  value, onCommit, as: Tag = "span", className = "", style, multiline, placeholder = "Clique pra editar",
}: {
  value: string; onCommit: (v: string) => void; as?: any; className?: string;
  style?: React.CSSProperties; multiline?: boolean; placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => { if (!editing) setDraft(value ?? ""); }, [value, editing]);

  function commit() {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  }

  if (editing) {
    const commonClass = `${className} bg-foreground/10 outline outline-2 outline-[rgb(var(--lz-brand-rgb))] rounded px-1 -mx-1`;
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); } }}
          onClick={(e) => e.stopPropagation()}
          className={`${commonClass} resize-none block w-full`}
          style={style}
          rows={3}
        />
      );
    }
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") { setDraft(value ?? ""); setEditing(false); }
        }}
        onClick={(e) => e.stopPropagation()}
        className={`${commonClass} inline-block w-full`}
        style={style}
      />
    );
  }

  return (
    <Tag
      className={`${className} cursor-text rounded-sm outline outline-1 outline-dashed outline-transparent hover:outline-white/40 transition-colors`}
      style={style}
      onClick={(e: any) => { e.stopPropagation(); setEditing(true); }}
    >
      {value || <span className="opacity-40 italic not-italic">{placeholder}</span>}
    </Tag>
  );
}

/* ---------------------------------------------------------------------- *
 * Ilustrações prontas — cada uma é uma mini-recriação da tela real do app,
 * usando as mesmas cores/tokens do produto (não é screenshot estático).
 * ---------------------------------------------------------------------- */
export function AppCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`w-full max-w-[420px] rounded-2xl border border-foreground/10 shadow-2xl overflow-hidden ${LIFT} ${className}`}
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
          <div className="h-14 w-14 rounded-full flex items-center justify-center" style={{ background: "color-mix(in srgb, var(--foreground) 10%, transparent)" }}>
            <Play size={20} className="text-foreground/70 fill-white/70 ml-0.5" />
          </div>
        </div>
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-black/50 rounded-full pl-1 pr-2.5 py-1">
          <span className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: LIME, color: "#0A0E23" }}>C</span>
          <span className="text-[10px] font-semibold text-foreground">Clínica Vitta</span>
        </div>
        <div className="absolute top-2.5 right-2.5 text-[9px] font-bold text-foreground bg-black/50 rounded-full px-2 py-0.5">1/5</div>
      </div>
      <div className="px-3.5 pt-3 pb-1 flex items-center gap-3 text-foreground/70">
        <Heart size={17} /> <MessageCircle size={17} /> <Send size={17} /> <div className="flex-1" /> <Bookmark size={17} />
      </div>
      <div className="px-3.5 pb-3.5 flex gap-2">
        <div className="flex-1 rounded-lg py-2.5 text-center text-[11px] font-bold" style={{ background: LIME, color: "#0A0E23" }}>✓ Aprovar post</div>
        <div className="flex-1 rounded-lg py-2.5 text-center text-[11px] font-bold border border-foreground/20 text-foreground/80">Sugerir</div>
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
        <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/40 mb-3">Dashboard · Julho 2026</div>
        <div className="flex items-center gap-4 mb-4">
          <div className="h-20 w-20 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `conic-gradient(rgb(var(--lz-brand-rgb)) ${pct * 3.6}deg, color-mix(in srgb, var(--foreground) 8%, transparent) 0deg)` }}>
            <div className="h-14 w-14 rounded-full flex flex-col items-center justify-center" style={{ background: "#141414" }}>
              <span className="text-base font-black text-foreground">{pct}%</span>
              <span className="text-[8px] text-foreground/40 uppercase tracking-wide">entregas</span>
            </div>
          </div>
          <div>
            <div className="text-foreground font-bold text-sm">Bom ritmo!</div>
            <div className="text-foreground/40 text-xs">Vamos fechar forte esse mês.</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg p-2.5 border border-foreground/6" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)" }}>
              <div className="text-lg font-black" style={{ color: t.color }}>{t.value}</div>
              <div className="text-[9px] text-foreground/40 leading-tight mt-0.5">{t.label}</div>
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
          <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/40">Produtividade da equipe</div>
          <BarChart3 size={14} className="text-foreground/30" />
        </div>
        <div className="space-y-3.5">
          {rows.map((r, i) => (
            <div key={r.name} className="flex items-center gap-3">
              <span className="h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black text-foreground shrink-0"
                style={{ background: r.color, color: "#0A0E23" }}>{r.name.charAt(0)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11.5px] font-semibold text-foreground truncate">{r.name}</span>
                  <span className="text-[10px] text-foreground/40">{r.done} entregues</span>
                </div>
                <div className="h-1.5 rounded-full bg-foreground/[0.08] overflow-hidden">
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
          <ChevronLeft size={14} className="text-foreground/30" />
          <span className="text-[11px] font-bold text-foreground">Agosto 2026</span>
          <ChevronRight size={14} className="text-foreground/30" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
            <div key={i} className="text-center text-[8px] font-bold text-foreground/30 pb-1">{d}</div>
          ))}
          {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
            <div key={day} className="aspect-square rounded-md flex flex-col items-center justify-center gap-0.5 border border-foreground/4" style={{ background: "color-mix(in srgb, var(--foreground) 2%, transparent)" }}>
              <span className="text-[8px] text-foreground/40">{day}</span>
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
        <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/40 mb-4">Notificações · agora</div>
        {[
          { t: "Novo comentário", d: "Bruno comentou no Post 02 — Clínica Vitta", time: "agora" },
          { t: "Prazo se aproximando", d: "Reel \"Bastidores\" vence amanhã", time: "há 12min" },
          { t: "Post aprovado ✓", d: "Cliente aprovou \"Depoimento — Ana\"", time: "há 1h" },
        ].map((n) => (
          <div key={n.t} className="flex items-start gap-2.5 rounded-lg p-2.5 mb-2 last:mb-0 border border-foreground/6" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)" }}>
            <span className="h-7 w-7 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(var(--lz-brand-light-rgb),0.15)" }}>
              <Bell size={13} style={{ color: "rgb(var(--lz-brand-rgb))" }} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-foreground truncate">{n.t}</div>
              <div className="text-[10px] text-foreground/45 leading-snug">{n.d}</div>
            </div>
            <span className="text-[9px] text-foreground/30 shrink-0">{n.time}</span>
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
          <div key={i} className={`${w} ${h} rounded-lg border border-foreground/10 flex flex-col overflow-hidden shrink-0`} style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)" }}>
            <div className="flex-1 flex flex-col gap-1 p-1.5">
              <div className="h-1.5 rounded-full w-full" style={{ background: "rgb(var(--lz-brand-rgb))" }} />
              <div className="h-1 rounded-full w-3/4 bg-foreground/15" />
              <div className="h-1 rounded-full w-1/2 bg-foreground/15" />
            </div>
            <div className="flex items-center justify-center py-1.5 border-t border-foreground/6">
              <Icon size={12} className="text-foreground/40" />
            </div>
          </div>
        ))}
      </div>
      <div className="px-5 pb-4 flex items-center justify-center gap-1.5 text-[10px] text-foreground/40">
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
              <span className="text-[11.5px] text-foreground/70 leading-relaxed">{r}</span>
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
// Ordem importa: termos mais específicos primeiro, porque alguns textos de
// seção citam "celular" tanto em notificações quanto em responsividade —
// checar os mais distintos antes evita escolher a ilustração errada.
const BUILTIN_KEYWORDS: [string, string[]][] = [
  ["security", ["segurança", "seguro", "lgpd", "protegid", "criptograf", "isolados"]],
  ["notifications", ["notificaç", "aviso", "push"]],
  ["calendar", ["calendário", "agenda"]],
  ["report", ["relatório", "relatorio", "produtividade", "ranking", "desempenho"]],
  ["dashboard", ["dashboard", "painel", "gargalo", "saúde da operação"]],
  ["responsive", ["responsiv", "rapidez", "qualquer tela", "qualquer dispositivo"]],
  ["feedPreview", ["feed", "aprova"]],
];
/** Sugere a ilustração pronta mais relacionada ao assunto da seção (pelo
 * eyebrow/título), pra não sempre cair no "Preview de feed" por padrão. */
export function guessBuiltinKey(topicHint?: string): string {
  const text = (topicHint ?? "").toLowerCase();
  for (const [key, words] of BUILTIN_KEYWORDS) {
    if (words.some((w) => text.includes(w))) return key;
  }
  return BUILTIN_KEYS[0];
}

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
  rounded?: boolean;
};

function ImageSpecVisual({ img, alt, fill }: { img: ImageSpec; alt: string; fill?: boolean }) {
  if (img.source === "builtin") {
    const Cmp = BUILTIN_ILLUSTRATIONS[img.builtinKey ?? ""];
    return Cmp ? <Cmp /> : null;
  }
  const roundedClass = img.rounded ? "rounded-2xl overflow-hidden" : "";
  return img.url ? (
    <img src={img.url} alt={alt} className={`${fill ? "w-full h-full object-cover" : "w-full h-auto"} drop-shadow-xl ${roundedClass}`} />
  ) : null;
}

// Tailwind's scanner needs the literal class names visible somewhere in the
// source — building "lz-float-" + variant with a template literal would get
// the utility purged from the production CSS since it never appears whole.
const FLOAT_CLASS: Record<string, string> = { a: "lz-float-a", b: "lz-float-b", c: "lz-float-c" };

function floatVariantClass(img: ImageSpec, floatingIndex: number, sync: boolean | undefined): string {
  if (!img.floating) return "";
  if (sync) return `${FLOAT_CLASS.a} absolute`;
  return `${FLOAT_CLASS[(["a", "b", "c"] as const)[floatingIndex % 3]]} absolute`;
}

/** Só leitura — usada no site público. Renderização inalterada. */
export function ImageStack({
  images, alt, aspectClassName, floatSync,
}: { images: ImageSpec[]; alt: string; aspectClassName?: string; floatSync?: boolean }) {
  if (images.length === 0) return null;
  // Com uma imagem só, "flutuante" vira apenas a animação de balanço — não
  // precisa (e não deve) usar posicionamento absoluto por top/left%, que é
  // pensado pra empilhar 2+ imagens e pode jogar a única imagem pra fora do
  // centro dependendo do valor salvo.
  const single = images.length === 1;
  if (single) {
    const img = images[0];
    return (
      <div className="w-full flex justify-center">
        <div className={img.floating ? FLOAT_CLASS.a : ""} style={{ width: `${img.widthPct}%` }}>
          <ImageSpecVisual img={img} alt={alt} />
        </div>
      </div>
    );
  }
  const floatingImages = images.filter((im) => im.floating);
  return (
    <div className={`relative w-full mx-auto ${aspectClassName ?? "aspect-[4/3]"}`}>
      {images.map((img) => (
        <div
          key={img.id}
          className={img.floating ? floatVariantClass(img, floatingImages.indexOf(img), floatSync) : "absolute"}
          style={{ width: `${img.widthPct}%`, top: `${img.top}%`, left: `${img.left}%`, zIndex: img.z }}
        >
          <ImageSpecVisual img={img} alt={alt} />
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Arrastar-pra-mover e arrastar-pra-redimensionar de imagens — mesma
 * técnica do useResizeDrag (seção): acompanha o ponteiro localmente
 * (`display`) e só chama `onCommit` (que salva) ao soltar.
 * ---------------------------------------------------------------------- */
function clampImgPct(v: number) { return Math.min(120, Math.max(-20, v)); }
function clampImgWidth(v: number) { return Math.min(100, Math.max(5, v)); }

function useImageMoveDrag(top: number, left: number, containerRef: React.RefObject<HTMLElement | null>, onCommit: (top: number, left: number) => void) {
  const [live, setLive] = useState<{ top: number; left: number } | null>(null);
  const startRef = useRef<{ x: number; y: number; top: number; left: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY, top, left };
    setLive({ top, left });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current) return;
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const dxPct = ((e.clientX - startRef.current.x) / rect.width) * 100;
    const dyPct = ((e.clientY - startRef.current.y) / rect.height) * 100;
    setLive({ top: clampImgPct(startRef.current.top + dyPct), left: clampImgPct(startRef.current.left + dxPct) });
  }
  function onPointerUp(e: React.PointerEvent) {
    e.stopPropagation();
    if (live) onCommit(live.top, live.left);
    startRef.current = null;
    setLive(null);
  }
  return { display: live ?? { top, left }, dragging: live !== null, handleProps: { onPointerDown, onPointerMove, onPointerUp } };
}

function useImageResizeDrag(widthPct: number, containerRef: React.RefObject<HTMLElement | null>, onCommit: (widthPct: number) => void) {
  const [live, setLive] = useState<number | null>(null);
  const startRef = useRef<{ x: number; width: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, width: widthPct };
    setLive(widthPct);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!startRef.current) return;
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const dPct = ((e.clientX - startRef.current.x) / rect.width) * 100;
    setLive(clampImgWidth(startRef.current.width + dPct));
  }
  function onPointerUp(e: React.PointerEvent) {
    e.stopPropagation();
    if (live !== null) onCommit(live);
    startRef.current = null;
    setLive(null);
  }
  return { display: live ?? widthPct, dragging: live !== null, handleProps: { onPointerDown, onPointerMove, onPointerUp } };
}

/** Barrinha de ações que aparece no hover de uma imagem em edição — trocar
 * foto, usar ilustração pronta, tornar flutuante, remover. Nada disso é um
 * modal: fica ancorada na própria imagem, então o resultado real nunca
 * fica escondido atrás de uma caixa. */
function ImageToolbar({
  img, uploading, onUploadFile, onPickBuiltin, onToggleFloating, onToggleRounded, onRemove,
}: {
  img: ImageSpec; uploading: boolean; onUploadFile: (file: File) => void; onPickBuiltin: (key: string) => void;
  onToggleFloating: () => void; onToggleRounded: () => void; onRemove: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-black/85 backdrop-blur rounded-lg p-1 shadow-xl opacity-0 group-hover/stackimg:opacity-100 focus-within:opacity-100 transition z-30 whitespace-nowrap"
    >
      <label className="p-1.5 rounded text-foreground/80 hover:text-foreground hover:bg-foreground/10 cursor-pointer" title="Enviar foto">
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
        <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadFile(f); }} />
      </label>
      <div className="relative">
        <button onClick={() => setPickerOpen((v) => !v)} className="p-1.5 rounded text-foreground/80 hover:text-foreground hover:bg-foreground/10" title="Usar ilustração pronta">
          <Sparkles size={13} />
        </button>
        {pickerOpen && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-card border border-foreground/10 rounded-lg p-1 flex flex-col gap-0.5 shadow-xl min-w-[150px] max-h-48 overflow-y-auto z-40">
            {BUILTIN_KEYS.map((k) => (
              <button key={k} onClick={() => { onPickBuiltin(k); setPickerOpen(false); }}
                className="text-[11px] text-left px-2 py-1.5 rounded hover:bg-foreground/10 text-foreground/80 whitespace-nowrap">
                {BUILTIN_LABELS[k] ?? k}
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={onToggleFloating} className="p-1.5 rounded hover:bg-foreground/10" title={img.floating ? "Fixar (parar de flutuar)" : "Deixar flutuante"}
        style={{ color: img.floating ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 80%, transparent)" }}>
        <Waves size={13} />
      </button>
      <button onClick={onToggleRounded} className="p-1.5 rounded hover:bg-foreground/10" title={img.rounded ? "Cantos arredondados (clique pra deixar reto)" : "Cantos retos (clique pra arredondar)"}
        style={{ color: img.rounded ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 80%, transparent)" }}>
        <Squircle size={13} />
      </button>
      <button onClick={onRemove} className="p-1.5 rounded text-foreground/80 hover:text-red-400 hover:bg-foreground/10" title="Remover">
        <X size={13} />
      </button>
    </div>
  );
}

/** Uma imagem dentro da pilha posicionada (flutuante ou não, 2+ imagens) —
 * arrasta pra mover, alça no canto pra redimensionar. */
function EditableStackImage({
  img, alt, containerRef, floatClass, onUpdate, onRemove, onUploadFile, onPickBuiltin, uploading,
}: {
  img: ImageSpec; alt: string; containerRef: React.RefObject<HTMLDivElement | null>; floatClass: string;
  onUpdate: (patch: Partial<ImageSpec>) => void; onRemove: () => void;
  onUploadFile: (file: File) => void; onPickBuiltin: (key: string) => void; uploading: boolean;
}) {
  const move = useImageMoveDrag(img.top, img.left, containerRef, (top, left) => onUpdate({ top, left }));
  const resize = useImageResizeDrag(img.widthPct, containerRef, (w) => onUpdate({ widthPct: w }));

  return (
    <div
      className={`group/stackimg absolute ${floatClass}`}
      style={{ width: `${resize.display}%`, top: `${move.display.top}%`, left: `${move.display.left}%`, zIndex: img.z, touchAction: "none" }}
    >
      <div
        {...move.handleProps}
        className={`relative rounded-md outline outline-2 outline-dashed transition-colors ${move.dragging ? "cursor-grabbing outline-[rgb(var(--lz-brand-rgb))]" : "cursor-grab outline-transparent hover:outline-white/30"}`}
      >
        <ImageSpecVisual img={img} alt={alt} />
        <ImageToolbar img={img} uploading={uploading} onUploadFile={onUploadFile} onPickBuiltin={onPickBuiltin} onToggleFloating={() => onUpdate({ floating: !img.floating })} onToggleRounded={() => onUpdate({ rounded: !img.rounded })} onRemove={onRemove} />
        <div
          {...resize.handleProps}
          className="absolute bottom-0 right-0 w-4 h-4 rounded-tl-md cursor-nwse-resize opacity-0 group-hover/stackimg:opacity-100 transition z-30"
          style={{ background: resize.dragging ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 55%, transparent)" }}
          title="Arrastar pra redimensionar"
        />
      </div>
    </div>
  );
}

/** Imagem única, centralizada (o caso mais comum) — sem arrastar pra mover
 * (não faz sentido, já está centralizada), só redimensionar. */
function EditableSingleImage({
  img, alt, onUpdate, onRemove, onUploadFile, onPickBuiltin, uploading, onAdd, wrapInAppCard,
}: {
  img: ImageSpec; alt: string; onUpdate: (patch: Partial<ImageSpec>) => void; onRemove: () => void;
  onUploadFile: (file: File) => void; onPickBuiltin: (key: string) => void; uploading: boolean;
  onAdd?: () => void; wrapInAppCard?: boolean;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const resize = useImageResizeDrag(img.widthPct, outerRef, (w) => onUpdate({ widthPct: w }));
  const visual = <ImageSpecVisual img={img} alt={alt} />;

  return (
    <div>
      <div ref={outerRef} className="w-full flex justify-center">
        <div className={`relative group/stackimg ${img.floating ? FLOAT_CLASS.a : ""}`} style={{ width: `${resize.display}%` }}>
          {wrapInAppCard && img.source === "upload" ? <AppCard>{visual}</AppCard> : visual}
          <ImageToolbar img={img} uploading={uploading} onUploadFile={onUploadFile} onPickBuiltin={onPickBuiltin} onToggleFloating={() => onUpdate({ floating: !img.floating })} onToggleRounded={() => onUpdate({ rounded: !img.rounded })} onRemove={onRemove} />
          <div
            {...resize.handleProps}
            className="absolute bottom-0 right-0 w-4 h-4 rounded-tl-md cursor-ew-resize opacity-0 group-hover/stackimg:opacity-100 transition z-30"
            style={{ background: resize.dragging ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 55%, transparent)" }}
            title="Arrastar pra redimensionar"
          />
        </div>
      </div>
      {onAdd && (
        <div className="flex justify-center mt-2">
          <button onClick={onAdd} className="text-[11px] text-foreground/40 hover:text-foreground inline-flex items-center gap-1 transition"><Plus size={11} /> Adicionar mais uma imagem</button>
        </div>
      )}
    </div>
  );
}

/** Pilha de imagens editável (hero/destaque) — arrastar pra mover, alça
 * pra redimensionar, tudo em cima da imagem real do site (sem modal
 * escondendo o resultado). */
function ImageStackInteractive({
  images, onChange, alt, aspectClassName, topicHint, wrapSingleInAppCard, floatSync, onFloatSync,
}: {
  images: ImageSpec[]; onChange: (images: ImageSpec[]) => void; alt: string; aspectClassName?: string;
  topicHint?: string; wrapSingleInAppCard?: boolean;
  floatSync?: boolean; onFloatSync?: (v: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const { upload, uploading } = useMarketingAssetUpload();
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  function updateAt(id: string, patch: Partial<ImageSpec>) {
    onChange(imagesRef.current.map((im) => (im.id === id ? { ...im, ...patch } : im)));
  }
  async function removeAt(id: string) {
    if (imagesRef.current.length === 1 && !(await requestConfirm("Remover a única imagem desta seção?", { danger: true }))) return;
    onChange(imagesRef.current.filter((im) => im.id !== id));
  }
  async function handleUploadFile(id: string, file: File) {
    setUploadingId(id);
    const url = await upload(file);
    setUploadingId(null);
    if (url) updateAt(id, { source: "upload", url, builtinKey: undefined });
  }
  function addImage() {
    if (imagesRef.current.length >= 4) return;
    const n = imagesRef.current.length;
    onChange([...imagesRef.current, {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      source: "builtin", builtinKey: guessBuiltinKey(topicHint),
      floating: n > 0, floatVariant: "a",
      widthPct: n === 0 ? 90 : 50, top: n === 0 ? 5 : 15 + n * 12, left: n === 0 ? 5 : 15 + n * 12, z: n,
    }]);
  }

  if (images.length === 0) {
    return (
      <button
        onClick={addImage}
        className="w-full aspect-square max-w-[220px] mx-auto rounded-xl border-2 border-dashed border-foreground/20 hover:border-[rgb(var(--lz-brand-rgb))] flex flex-col items-center justify-center gap-2 text-foreground/40 hover:text-foreground transition"
      >
        <ImagePlus size={22} /> <span className="text-xs">Adicionar imagem</span>
      </button>
    );
  }

  const single = images.length === 1;
  if (single) {
    const img = images[0];
    return (
      <EditableSingleImage
        img={img} alt={alt}
        onUpdate={(patch) => updateAt(img.id, patch)}
        onRemove={() => removeAt(img.id)}
        onUploadFile={(f) => handleUploadFile(img.id, f)}
        onPickBuiltin={(k) => updateAt(img.id, { source: "builtin", builtinKey: k })}
        uploading={uploadingId === img.id}
        onAdd={images.length < 4 ? addImage : undefined}
        wrapInAppCard={wrapSingleInAppCard}
      />
    );
  }

  const floatingImages = images.filter((im) => im.floating);
  const floatingCount = floatingImages.length;

  return (
    <div ref={containerRef} className={`relative w-full mx-auto ${aspectClassName ?? "aspect-[4/3]"}`}>
      {images.map((img) => (
        <EditableStackImage
          key={img.id} img={img} alt={alt} containerRef={containerRef}
          floatClass={img.floating ? floatVariantClass(img, floatingImages.indexOf(img), floatSync) : ""}
          onUpdate={(patch) => updateAt(img.id, patch)}
          onRemove={() => removeAt(img.id)}
          onUploadFile={(f) => handleUploadFile(img.id, f)}
          onPickBuiltin={(k) => updateAt(img.id, { source: "builtin", builtinKey: k })}
          uploading={uploadingId === img.id}
        />
      ))}
      {images.length < 4 && (
        <button onClick={addImage} className="absolute bottom-2 right-2 z-30 bg-black/70 backdrop-blur text-foreground rounded-full p-2 hover:bg-black/90 transition" title="Adicionar imagem">
          <Plus size={14} />
        </button>
      )}
      {floatingCount >= 2 && onFloatSync && (
        <button
          onClick={() => onFloatSync(!floatSync)}
          className="absolute top-2 left-2 z-30 text-[10px] font-semibold px-2.5 py-1.5 rounded-full bg-black/70 backdrop-blur text-foreground hover:bg-black/90 transition inline-flex items-center gap-1"
          title="Controla se as imagens flutuantes se movem juntas ou cada uma no seu tempo"
        >
          <Waves size={11} /> {floatSync ? "Sincronizado" : "Natural"}
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Editor de galeria (dentro do modal aberto ao clicar numa imagem) —
 * enviar foto ou usar ilustração pronta. Galeria não tem posição livre
 * (é uma grade), então não precisa do editor de arrastar.
 * ---------------------------------------------------------------------- */
function ImageStackEditor({ images, onChange, topicHint }: { images: ImageSpec[]; onChange: (images: ImageSpec[]) => void; topicHint?: string }) {
  const { upload, uploading } = useMarketingAssetUpload();
  // Upload é assíncrono (rede) — se o usuário mexer em outra imagem enquanto
  // ele está rolando, um `updateAt` que fechasse sobre o array antigo (`images`
  // capturado no render em que o upload começou) reconstruiria o array a
  // partir de um estado desatualizado e apagaria essa outra edição. O ref
  // sempre aponta pro array mais recente, não importa quanto tempo o upload
  // demore nem quantos renders aconteçam nesse meio tempo.
  const imagesRef = useRef(images);
  imagesRef.current = images;

  function updateAt(i: number, patch: Partial<ImageSpec>) {
    const next = [...imagesRef.current];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }

  async function handleUpload(i: number, file: File) {
    const url = await upload(file);
    if (url) updateAt(i, { source: "upload", url, builtinKey: undefined });
  }

  function addImage() {
    if (imagesRef.current.length >= 12) return;
    onChange([...imagesRef.current, {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, source: "builtin", builtinKey: guessBuiltinKey(topicHint),
      floating: false, floatVariant: "a", widthPct: 100, top: 0, left: 0, z: imagesRef.current.length,
    }]);
  }

  async function removeAt(i: number) {
    if (imagesRef.current.length === 1 && !(await requestConfirm("Remover a única imagem desta seção?", { danger: true }))) return;
    onChange(imagesRef.current.filter((_, j) => j !== i));
  }

  return (
    <div>
      <div className="space-y-3">
        {images.map((img, i) => (
          <div key={img.id} className="bg-background rounded-md p-3 border border-foreground/6 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => updateAt(i, { source: "upload" })}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${img.source === "upload" ? "bg-[rgb(var(--lz-brand-rgb))] text-[#0D0D0D]" : "border border-foreground/15 text-foreground/60"}`}
                >Enviar foto</button>
                <button
                  onClick={() => updateAt(i, { source: "builtin", builtinKey: img.builtinKey ?? guessBuiltinKey(topicHint) })}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${img.source === "builtin" ? "bg-[rgb(var(--lz-brand-rgb))] text-[#0D0D0D]" : "border border-foreground/15 text-foreground/60"}`}
                >Usar ilustração pronta</button>
              </div>
              <button onClick={() => removeAt(i)} className="text-foreground/40 hover:text-red-400"><X size={14} /></button>
            </div>

            {img.source === "upload" ? (
              <div className="flex items-center gap-3">
                {img.url && <img src={img.url} alt="" className="h-14 w-14 rounded-md object-cover border border-foreground/10" />}
                <label className="inline-flex items-center gap-1.5 text-xs text-foreground/60 hover:text-foreground cursor-pointer border border-foreground/15 rounded-md px-3 py-2">
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                  {img.url ? "Trocar imagem" : "Escolher imagem"}
                  <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(i, f); }} />
                </label>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="h-14 w-20 rounded-md overflow-hidden border border-foreground/10 flex items-center justify-center bg-card shrink-0 scale-[0.3] origin-top-left" style={{ width: 420, height: 200 }}>
                  {(() => { const Cmp = BUILTIN_ILLUSTRATIONS[img.builtinKey ?? ""]; return Cmp ? <Cmp /> : null; })()}
                </div>
                <select value={img.builtinKey} onChange={(e) => updateAt(i, { builtinKey: e.target.value })} className="lz-input-dark text-xs">
                  {BUILTIN_KEYS.map((k) => <option key={k} value={k}>{BUILTIN_LABELS[k] ?? k}</option>)}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>
      {images.length < 12 && (
        <button onClick={addImage} className="mt-3 text-xs text-foreground/50 hover:text-foreground inline-flex items-center gap-1"><Plus size={12} /> Adicionar imagem</button>
      )}
    </div>
  );
}

function EditImagesModal({
  title, images, onChange, onClose, topicHint, imageFit, onImageFit,
}: {
  title: string; images: ImageSpec[]; onChange: (images: ImageSpec[]) => void; onClose: () => void; topicHint?: string;
  imageFit?: "natural" | "fill"; onImageFit?: (fit: "natural" | "fill") => void;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-card border border-foreground/10 rounded-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground"><X size={16} /></button>
        </div>
        {onImageFit && (
          <div className="mb-4">
            <div className="text-[9px] uppercase tracking-wide text-foreground/30 mb-1.5">Como as imagens aparecem</div>
            <div className="flex gap-1.5">
              <button
                onClick={() => onImageFit("natural")}
                className="flex-1 text-[11px] font-semibold px-2.5 py-2 rounded-md transition"
                style={{
                  background: (imageFit ?? "natural") === "natural" ? "rgb(var(--lz-brand-rgb))" : "transparent",
                  color: (imageFit ?? "natural") === "natural" ? "#0D0D0D" : "color-mix(in srgb, var(--foreground) 60%, transparent)",
                  border: (imageFit ?? "natural") === "natural" ? "none" : "1px solid color-mix(in srgb, var(--foreground) 15%, transparent)",
                }}
              >
                Manter dimensões
              </button>
              <button
                onClick={() => onImageFit("fill")}
                className="flex-1 text-[11px] font-semibold px-2.5 py-2 rounded-md transition"
                style={{
                  background: imageFit === "fill" ? "rgb(var(--lz-brand-rgb))" : "transparent",
                  color: imageFit === "fill" ? "#0D0D0D" : "color-mix(in srgb, var(--foreground) 60%, transparent)",
                  border: imageFit === "fill" ? "none" : "1px solid color-mix(in srgb, var(--foreground) 15%, transparent)",
                }}
              >
                Preencher (1:1)
              </button>
            </div>
            <p className="text-[10px] text-foreground/30 mt-1.5 leading-relaxed">
              {(imageFit ?? "natural") === "natural"
                ? "Cada quadro acompanha o tamanho real da foto — fica mais orgânico."
                : "Corta as fotos num quadrado igual, deixando a grade uniforme."}
            </p>
          </div>
        )}
        <ImageStackEditor images={images} onChange={onChange} topicHint={topicHint} />
        <button onClick={onClose} className="lz-btn-primary text-xs px-4 py-2.5 rounded-md mt-5 w-full">Concluído</button>
      </div>
    </div>
  );
}

/** Pilha de imagens clicável. Hero/Destaque: edição direta, arrastando em
 * cima da imagem real (ImageStackInteractive). Galeria: continua com um
 * modalzinho simples (não tem posição livre, é só uma grade). */
function EditableImageArea({
  images, onChange, alt, mode, topicHint, imageFit, onImageFit, floatSync, onFloatSync,
}: {
  images: ImageSpec[]; onChange?: (images: ImageSpec[]) => void; alt: string;
  mode: "hero" | "feature" | "gallery"; topicHint?: string;
  imageFit?: "natural" | "fill"; onImageFit?: (fit: "natural" | "fill") => void;
  floatSync?: boolean; onFloatSync?: (v: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const editable = !!onChange;
  const fill = imageFit === "fill";

  if (!editable) {
    if (mode === "hero") return <ImageStack images={images} alt={alt} aspectClassName="aspect-[1182/854] max-w-[460px] lg:max-w-none" floatSync={floatSync} />;
    if (mode === "gallery") {
      if (images.length === 0) return null;
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
          {images.map((img) => (
            <div key={img.id} className={`rounded-xl overflow-hidden border shadow-sm border-black/10 ${LIFT} ${fill ? "aspect-square" : ""}`} style={EASE}>
              <ImageSpecVisual img={img} alt={alt} fill={fill} />
            </div>
          ))}
        </div>
      );
    }
    // feature
    if (!images.length) return null;
    return images.length === 1 && !images[0].floating ? (
      images[0].source === "builtin" ? <ImageSpecVisual img={images[0]} alt={alt} /> : <AppCard><ImageSpecVisual img={images[0]} alt={alt} /></AppCard>
    ) : (
      <ImageStack images={images} alt={alt} aspectClassName="aspect-square max-w-[420px]" floatSync={floatSync} />
    );
  }

  if (mode === "hero" || mode === "feature") {
    return (
      <ImageStackInteractive
        images={images}
        onChange={onChange!}
        alt={alt}
        topicHint={topicHint}
        aspectClassName={mode === "hero" ? "aspect-[1182/854] max-w-[460px] lg:max-w-none" : "aspect-square max-w-[420px]"}
        wrapSingleInAppCard={mode === "feature"}
        floatSync={floatSync}
        onFloatSync={onFloatSync}
      />
    );
  }

  // gallery
  return (
    <div className="relative group/img w-full">
      {images.length === 0 ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full aspect-square max-w-[220px] mx-auto rounded-xl border-2 border-dashed border-foreground/20 hover:border-[rgb(var(--lz-brand-rgb))] flex flex-col items-center justify-center gap-2 text-foreground/40 hover:text-foreground transition"
        >
          <ImagePlus size={22} /> <span className="text-xs">Adicionar imagem</span>
        </button>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
            {images.map((img) => (
              <div key={img.id} className={`rounded-xl overflow-hidden border border-foreground/10 shadow-sm ${fill ? "aspect-square" : ""}`}>
                <ImageSpecVisual img={img} alt={alt} fill={fill} />
              </div>
            ))}
          </div>
          <button
            onClick={() => setOpen(true)}
            className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 focus:opacity-100 transition bg-black/70 backdrop-blur text-foreground rounded-full p-2 hover:bg-black/90 z-10"
            title="Editar imagens"
          >
            <Pencil size={13} />
          </button>
        </>
      )}
      {open && (
        <EditImagesModal
          title="Imagens da galeria" images={images} onChange={(imgs) => onChange!(imgs)} onClose={() => setOpen(false)}
          topicHint={topicHint} imageFit={imageFit} onImageFit={onImageFit}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * Renderizadores por tipo de bloco — cada um aceita `onChange` opcional
 * pra ficar editável clicando direto no conteúdo renderizado.
 * ---------------------------------------------------------------------- */
export function BulletListBlock({ content, onChange }: { content: any; onChange?: (c: any) => void }) {
  const { style: bgStyle, dark } = sectionBackgroundStyle(content);
  const IconCmp = content.icon === "x" ? X : Check;
  const iconColor = content.icon === "x" ? "#f87171" : LIME;
  const editable = !!onChange;
  const items: string[] = content.items ?? [];
  const set = (patch: any) => onChange?.({ ...content, ...patch });
  const hasClosing = content.closingTextAccent || content.closingTextPlain;
  const drag = useDragReorder(items, (next) => set({ items: next }));
  const py = paddingYValue(content);
  const resize = useResizeDrag(py, PADDING_PX_MIN, PADDING_PX_MAX, (v) => set({ paddingY: v }));
  // Reveal em cascata só no site público — no editor os itens precisam
  // estar sempre visíveis pra edição, sem depender de rolar a página.
  const listReveal = useReveal<HTMLUListElement>();
  const listVisible = editable || listReveal.visible;

  return (
    <section style={{ ...bgStyle, color: dark ? "#fff" : "#0A0E23" }} className="border-t border-foreground/10 relative">
      <Reveal className="px-5 sm:px-10 max-w-[820px] mx-auto" style={{ paddingTop: resize.display, paddingBottom: resize.display }}>
        {editable ? (
          <Editable as="h2" value={content.heading} onCommit={(v) => set({ heading: v })} className="font-criador-serif normal-case text-3xl sm:text-4xl mb-8 block" />
        ) : (
          <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-8">{content.heading}</h2>
        )}
        <ul ref={editable ? undefined : listReveal.ref} className="space-y-4">
          {items.map((t, i) => (
            <li
              key={i}
              style={editable ? undefined : staggerStyle(listVisible, i)}
              className={`group/item flex gap-3 text-base sm:text-lg items-start rounded-md transition ${dark ? "text-foreground/80" : "text-[#0A0E23]/75"} ${drag.overIndex === i ? "outline outline-2 outline-dashed outline-[rgb(var(--lz-brand-rgb))] outline-offset-4" : ""}`}
              onDragOver={editable ? (e) => drag.onDragOverItem(e, i) : undefined}
              onDrop={editable ? (e) => drag.onDropItem(e, i) : undefined}
            >
              {editable && (
                <span
                  draggable
                  onDragStart={() => drag.onDragStart(i)}
                  onDragEnd={drag.onDragEnd}
                  className="cursor-grab active:cursor-grabbing opacity-0 group-hover/item:opacity-40 hover:!opacity-100 shrink-0 mt-0.5 touch-none"
                  title="Arrastar pra reordenar"
                >
                  <GripVertical size={16} />
                </span>
              )}
              <IconCmp size={20} className="shrink-0 mt-0.5" style={{ color: iconColor }} strokeWidth={2.5} />
              {editable ? (
                <>
                  <Editable
                    value={t} multiline
                    onCommit={(v) => { const next = [...items]; next[i] = v; set({ items: next }); }}
                    className="text-balance flex-1"
                  />
                  <button onClick={() => set({ items: items.filter((_, j) => j !== i) })} className="opacity-0 group-hover/item:opacity-100 text-foreground/30 hover:text-red-400 shrink-0 mt-0.5"><X size={14} /></button>
                </>
              ) : (
                <span className="text-balance">{t}</span>
              )}
            </li>
          ))}
          {editable && (
            <li>
              <button onClick={() => set({ items: [...items, "Novo item"] })} className="text-xs opacity-50 hover:opacity-100 inline-flex items-center gap-1"><Plus size={12} /> Adicionar item</button>
            </li>
          )}
        </ul>
        {editable ? (
          <div className={`mt-8 flex flex-wrap gap-x-1.5 gap-y-1 items-baseline ${dark ? "text-foreground" : "text-[#0A0E23]"}`}>
            <Editable value={content.closingTextPlain ?? ""} onCommit={(v) => set({ closingTextPlain: v })} placeholder="Frase de fechamento (opcional)" />
            <Editable value={content.closingTextAccent ?? ""} onCommit={(v) => set({ closingTextAccent: v })} className="font-bold" style={{ color: LIME }} placeholder="parte destacada (opcional)" />
          </div>
        ) : hasClosing ? (
          <p className={`mt-8 text-balance ${dark ? "text-foreground" : "text-[#0A0E23]"}`}>
            {content.closingTextPlain ? `${content.closingTextPlain} ` : ""}
            <span className="font-bold" style={{ color: LIME }}>{content.closingTextAccent}</span>
          </p>
        ) : null}
      </Reveal>
      {editable && <SectionResizeHandle resize={resize} />}
    </section>
  );
}

export function StepsBlock({ content, onChange }: { content: any; onChange?: (c: any) => void }) {
  const { style: bgStyle, dark } = sectionBackgroundStyle(content);
  const editable = !!onChange;
  const items: any[] = content.items ?? [];
  const set = (patch: any) => onChange?.({ ...content, ...patch });
  const setItem = (i: number, patch: any) => { const next = [...items]; next[i] = { ...next[i], ...patch }; set({ items: next }); };
  const drag = useDragReorder(items, (next) => set({ items: next }));
  const py = paddingYValue(content);
  const resize = useResizeDrag(py, PADDING_PX_MIN, PADDING_PX_MAX, (v) => set({ paddingY: v }));
  const gridReveal = useReveal<HTMLDivElement>();
  const gridVisible = editable || gridReveal.visible;

  return (
    <section style={{ ...bgStyle, color: dark ? "#fff" : "#0A0E23" }} className="border-t border-foreground/10 relative">
      <Reveal className="px-5 sm:px-10 max-w-[1000px] mx-auto" style={{ paddingTop: resize.display, paddingBottom: resize.display }}>
        {editable ? (
          <Editable as="h2" value={content.heading} onCommit={(v) => set({ heading: v })} className="font-criador-serif normal-case text-3xl sm:text-4xl mb-10 block text-center" />
        ) : (
          <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-10 text-center">{content.heading}</h2>
        )}
        <div ref={editable ? undefined : gridReveal.ref} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((s, i) => (
            <div
              key={i}
              className={`relative group/step rounded-xl p-5 border transition ${dark ? "bg-foreground/[0.04] border-foreground/10" : "bg-black/[0.04] border-black/10"} ${LIFT} ${drag.overIndex === i ? "outline outline-2 outline-dashed outline-[rgb(var(--lz-brand-rgb))] outline-offset-4" : ""}`}
              style={editable ? EASE : { ...EASE, ...staggerStyle(gridVisible, i) }}
              onDragOver={editable ? (e) => drag.onDragOverItem(e, i) : undefined}
              onDrop={editable ? (e) => drag.onDropItem(e, i) : undefined}
            >
              {editable && (
                <>
                  <span
                    draggable
                    onDragStart={() => drag.onDragStart(i)}
                    onDragEnd={drag.onDragEnd}
                    className="absolute top-2 left-2 cursor-grab active:cursor-grabbing opacity-0 group-hover/step:opacity-40 hover:!opacity-100 touch-none"
                    title="Arrastar pra reordenar"
                  >
                    <GripVertical size={16} />
                  </span>
                  <button onClick={() => set({ items: items.filter((_, j) => j !== i) })} className="absolute top-2 right-2 opacity-0 group-hover/step:opacity-100 text-foreground/40 hover:text-red-400"><X size={14} /></button>
                </>
              )}
              <div className="flex items-center gap-2 mb-3">
                <span className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0" style={{ background: LIME, color: "#0A0E23" }}>
                  {editable ? (
                    <Editable value={s.number} onCommit={(v) => setItem(i, { number: v })} className="w-full text-center" style={{ color: "#0A0E23" }} />
                  ) : s.number}
                </span>
                {editable ? (
                  <EditableIcon value={s.icon} onChange={(v) => setItem(i, { icon: v })} size={20} style={{ color: dark ? LIME : ACCENT_ON_LIGHT }} />
                ) : (
                  <Icon iconKey={s.icon} size={20} style={{ color: dark ? LIME : ACCENT_ON_LIGHT }} />
                )}
              </div>
              {editable ? (
                <>
                  <Editable value={s.title} onCommit={(v) => setItem(i, { title: v })} className="font-bold mb-1 block" />
                  <Editable value={s.description} multiline onCommit={(v) => setItem(i, { description: v })} className={`text-sm leading-relaxed block ${dark ? "text-foreground/60" : "text-[#0A0E23]/60"}`} />
                </>
              ) : (
                <>
                  <div className="font-bold mb-1">{s.title}</div>
                  <div className={`text-sm leading-relaxed ${dark ? "text-foreground/60" : "text-[#0A0E23]/60"}`}>{s.description}</div>
                </>
              )}
            </div>
          ))}
          {editable && (
            <button
              onClick={() => set({ items: [...items, { icon: "star", number: String(items.length + 1).padStart(2, "0"), title: "Novo passo", description: "" }] })}
              className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 min-h-[120px] transition ${dark ? "border-foreground/15 hover:border-[rgb(var(--lz-brand-rgb))] text-foreground/40" : "border-black/15 hover:border-[rgb(var(--lz-brand-rgb))] text-black/40"} hover:text-foreground`}
            >
              <Plus size={18} /> <span className="text-xs">Adicionar passo</span>
            </button>
          )}
        </div>
      </Reveal>
      {editable && <SectionResizeHandle resize={resize} />}
    </section>
  );
}

export function FeatureBlock({ content, onChange }: { content: any; onChange?: (c: any) => void }) {
  const { style: bgStyle, dark } = sectionBackgroundStyle(content);
  const editable = !!onChange;
  const bodyClass = dark ? "text-foreground/65" : "text-[#0A0E23]/60";
  const set = (patch: any) => onChange?.({ ...content, ...patch });
  const py = paddingYValue(content);
  const resize = useResizeDrag(py, PADDING_PX_MIN, PADDING_PX_MAX, (v) => set({ paddingY: v }));

  return (
    <section style={{ ...bgStyle, color: dark ? "#fff" : "#0A0E23" }} className="border-t border-foreground/10 relative">
      <Reveal className="px-5 sm:px-10 max-w-[1100px] mx-auto" style={{ paddingTop: resize.display, paddingBottom: resize.display }}>
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className={content.reverse ? "lg:order-2" : ""}>
            <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide font-bold mb-3" style={{ color: dark ? LIME : ACCENT_ON_LIGHT }}>
              {editable ? (
                <EditableIcon value={content.eyebrowIcon} onChange={(v) => set({ eyebrowIcon: v })} />
              ) : (
                <Icon iconKey={content.eyebrowIcon} size={13} />
              )}
              {editable ? <Editable value={content.eyebrowLabel} onCommit={(v) => set({ eyebrowLabel: v })} /> : content.eyebrowLabel}
            </div>
            {editable ? (
              <Editable as="h2" value={content.title} onCommit={(v) => set({ title: v })} className="font-criador-serif normal-case text-3xl sm:text-4xl mb-4 block text-balance" />
            ) : (
              <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-4 text-balance">{content.title}</h2>
            )}
            {editable ? (
              <Editable value={content.description} multiline onCommit={(v) => set({ description: v })} className={`${bodyClass} text-base leading-relaxed max-w-[460px] block`} />
            ) : (
              <p className={`${bodyClass} text-base leading-relaxed max-w-[460px]`}>{content.description}</p>
            )}
          </div>
          <div className={`flex justify-center ${content.reverse ? "lg:order-1" : ""}`}>
            <EditableImageArea
              images={content.images ?? []} onChange={editable ? (images) => set({ images }) : undefined} alt={content.title} mode="feature"
              topicHint={`${content.eyebrowLabel ?? ""} ${content.title ?? ""}`}
              floatSync={content.floatSync} onFloatSync={editable ? (v) => set({ floatSync: v }) : undefined}
            />
          </div>
        </div>
      </Reveal>
      {editable && <SectionResizeHandle resize={resize} />}
    </section>
  );
}

export function GalleryBlock({ content, onChange }: { content: any; onChange?: (c: any) => void }) {
  const { style: bgStyle, dark } = sectionBackgroundStyle(content);
  const editable = !!onChange;
  const images: ImageSpec[] = content.images ?? [];
  const set = (patch: any) => onChange?.({ ...content, ...patch });
  const py = paddingYValue(content);
  const resize = useResizeDrag(py, PADDING_PX_MIN, PADDING_PX_MAX, (v) => set({ paddingY: v }));
  if (!editable && images.length === 0) return null;
  return (
    <section style={{ ...bgStyle, color: dark ? "#fff" : "#0A0E23" }} className="border-t border-foreground/10 relative">
      <Reveal className="px-5 sm:px-10 max-w-[1000px] mx-auto" style={{ paddingTop: resize.display, paddingBottom: resize.display }}>
        {editable ? (
          <Editable as="h2" value={content.heading} onCommit={(v) => set({ heading: v })} className="font-criador-serif normal-case text-3xl sm:text-4xl mb-10 block text-center" />
        ) : (
          <h2 className="font-criador-serif normal-case text-3xl sm:text-4xl mb-10 text-center">{content.heading}</h2>
        )}
        <EditableImageArea
          images={images} onChange={editable ? (imgs) => set({ images: imgs }) : undefined} alt={content.heading} mode="gallery" topicHint={content.heading}
          imageFit={content.imageFit} onImageFit={editable ? (fit) => set({ imageFit: fit }) : undefined}
        />
      </Reveal>
      {editable && <SectionResizeHandle resize={resize} />}
    </section>
  );
}

export function TextBlurbBlock({ content, onChange }: { content: any; onChange?: (c: any) => void }) {
  const { style: bgStyle, dark } = sectionBackgroundStyle(content);
  const editable = !!onChange;
  const set = (patch: any) => onChange?.({ ...content, ...patch });
  const py = paddingYValue(content);
  const resize = useResizeDrag(py, PADDING_PX_MIN, PADDING_PX_MAX, (v) => set({ paddingY: v }));
  return (
    <section style={{ ...bgStyle, color: dark ? "#fff" : "#0A0E23" }} className="border-t border-foreground/10 text-center relative">
      <div className="px-5 sm:px-10 max-w-[720px] mx-auto" style={{ paddingTop: resize.display, paddingBottom: resize.display }}>
        <div className="inline-flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide font-bold mb-3" style={{ color: dark ? LIME : ACCENT_ON_LIGHT }}>
          {editable ? (
            <EditableIcon value={content.eyebrowIcon} onChange={(v) => set({ eyebrowIcon: v })} />
          ) : (
            <Icon iconKey={content.eyebrowIcon} size={13} />
          )}
          {editable ? <Editable value={content.eyebrowLabel} onCommit={(v) => set({ eyebrowLabel: v })} /> : content.eyebrowLabel}
        </div>
        {editable ? (
          <Editable value={content.paragraph} multiline onCommit={(v) => set({ paragraph: v })} className={`text-sm leading-relaxed block ${dark ? "text-foreground/70" : "text-[#0A0E23]/70"}`} />
        ) : (
          <p className={`text-sm leading-relaxed ${dark ? "text-foreground/70" : "text-[#0A0E23]/70"}`}>{content.paragraph}</p>
        )}
      </div>
      {editable && <SectionResizeHandle resize={resize} />}
    </section>
  );
}

/** Uma única imagem de ponta a ponta na horizontal — sem texto, sem container
 * centralizado, cobrindo a seção inteira (largura e altura). */
export function ImageBannerBlock({ content, onChange }: { content: any; onChange?: (c: any) => void }) {
  const editable = !!onChange;
  const set = (patch: any) => onChange?.({ ...content, ...patch });
  const { upload, uploading } = useMarketingAssetUpload();
  const heightPx = bannerHeightValue(content);
  const resize = useResizeDrag(heightPx, BANNER_PX_MIN, BANNER_PX_MAX, (v) => set({ heightPx: v }));

  async function handleFile(file: File) {
    const url = await upload(file);
    if (url) set({ imageUrl: url });
  }

  if (!editable) {
    if (!content.imageUrl) return null;
    return (
      <section className="border-t border-foreground/10">
        <img src={content.imageUrl} alt={content.alt ?? ""} className="w-full object-cover block" style={{ height: heightPx }} />
      </section>
    );
  }

  const { style: bgStyle } = sectionBackgroundStyle({ background: content.background });

  return (
    <section style={bgStyle} className="border-t border-foreground/10 relative">
      <div className="relative w-full group/banner" style={{ height: resize.display }}>
        {content.imageUrl ? (
          <>
            <img src={content.imageUrl} alt={content.alt ?? ""} className="w-full h-full object-cover block" />
            <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover/banner:opacity-100 focus-within:opacity-100 transition">
              <label className="bg-black/70 backdrop-blur text-foreground rounded-full p-2 hover:bg-black/90 cursor-pointer" title="Trocar imagem">
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Pencil size={13} />}
                <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </label>
              <button onClick={() => set({ imageUrl: null })} className="bg-black/70 backdrop-blur text-foreground rounded-full p-2 hover:bg-black/90" title="Remover imagem">
                <X size={13} />
              </button>
            </div>
          </>
        ) : (
          <label className="w-full h-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-foreground/20 hover:border-[rgb(var(--lz-brand-rgb))] text-foreground/40 hover:text-foreground cursor-pointer transition">
            {uploading ? <Loader2 size={22} className="animate-spin" /> : <ImagePlus size={22} />}
            <span className="text-xs">Adicionar imagem</span>
            <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </label>
        )}
      </div>
      {editable && <SectionResizeHandle resize={resize} />}
    </section>
  );
}

/** Uma única imagem CONTIDA (largura normal da página, cantos arredondados,
 * altura natural pela proporção da foto) — complementa o ImageBannerBlock
 * (ponta a ponta, altura fixa) com uma variante mais discreta. */
export function SingleImageBlock({ content, onChange }: { content: any; onChange?: (c: any) => void }) {
  const editable = !!onChange;
  const set = (patch: any) => onChange?.({ ...content, ...patch });
  const { style: bgStyle } = sectionBackgroundStyle(content);
  const { upload, uploading } = useMarketingAssetUpload();
  const py = paddingYValue(content);
  const resize = useResizeDrag(py, PADDING_PX_MIN, PADDING_PX_MAX, (v) => set({ paddingY: v }));

  async function handleFile(file: File) {
    const url = await upload(file);
    if (url) set({ imageUrl: url });
  }

  if (!editable) {
    if (!content.imageUrl) return null;
    return (
      <section style={bgStyle} className="border-t border-foreground/10">
        <Reveal className={`px-5 sm:px-10 max-w-[860px] mx-auto`} style={{ paddingTop: py, paddingBottom: py }}>
          <img src={content.imageUrl} alt={content.alt ?? ""} className={`w-full h-auto rounded-xl shadow-xl block ${LIFT}`} />
        </Reveal>
      </section>
    );
  }

  return (
    <section style={bgStyle} className="border-t border-foreground/10 relative">
      <div className="px-5 sm:px-10 max-w-[860px] mx-auto" style={{ paddingTop: resize.display, paddingBottom: resize.display }}>
        <div className="relative group/single">
          {content.imageUrl ? (
            <>
              <img src={content.imageUrl} alt={content.alt ?? ""} className="w-full h-auto rounded-xl shadow-xl block" />
              <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover/single:opacity-100 focus-within:opacity-100 transition">
                <label className="bg-black/70 backdrop-blur text-foreground rounded-full p-2 hover:bg-black/90 cursor-pointer" title="Trocar imagem">
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <Pencil size={13} />}
                  <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </label>
                <button onClick={() => set({ imageUrl: null })} className="bg-black/70 backdrop-blur text-foreground rounded-full p-2 hover:bg-black/90" title="Remover imagem">
                  <X size={13} />
                </button>
              </div>
            </>
          ) : (
            <label className="w-full aspect-video rounded-xl flex flex-col items-center justify-center gap-2 border-2 border-dashed border-foreground/20 hover:border-[rgb(var(--lz-brand-rgb))] text-foreground/40 hover:text-foreground cursor-pointer transition">
              {uploading ? <Loader2 size={22} className="animate-spin" /> : <ImagePlus size={22} />}
              <span className="text-xs">Adicionar imagem</span>
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </label>
          )}
        </div>
      </div>
      {editable && <SectionResizeHandle resize={resize} />}
    </section>
  );
}

/* ---------------------------------------------------------------------- *
 * Hero — extraído como componente próprio pra poder ser usado tanto pelo
 * corpo público quanto diretamente pelo editor (que precisa dele editável
 * fora da lista de blocos reordenável).
 * ---------------------------------------------------------------------- */
export function HeroSection({ content, onChange, onCtaClick }: { content: any; onChange?: (c: any) => void; onCtaClick?: () => void }) {
  const editable = !!onChange;
  const set = (patch: any) => onChange?.({ ...content, ...patch });
  // Parallax só no site público, e só no wrapper — as imagens já flutuam
  // sozinhas por dentro (keyframe CSS); um transform inline direto nelas
  // bloquearia essa animação pra sempre. Aplicado num container por fora,
  // os dois efeitos compõem em vez de brigar.
  const parallax = useScrollParallax<HTMLDivElement>(0.06);
  return (
    <section className="px-5 sm:px-10 max-w-[1200px] mx-auto pt-8 pb-16">
      <div className="grid lg:grid-cols-2 gap-2 lg:gap-8 items-center">
        <div className="order-2 lg:order-1">
          <div className="inline-flex items-center gap-2 border border-foreground/15 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide mb-6">
            {editable ? (
              <EditableIcon value={content.eyebrowIcon} onChange={(v) => set({ eyebrowIcon: v })} style={{ color: LIME }} />
            ) : (
              <Icon iconKey={content.eyebrowIcon} size={13} style={{ color: LIME }} />
            )}
            {editable ? <Editable value={content.eyebrowLabel} onCommit={(v) => set({ eyebrowLabel: v })} /> : content.eyebrowLabel}
          </div>
          <h1 className="font-black uppercase leading-[0.95] text-[clamp(2rem,5.5vw,3.75rem)]">
            {editable ? <Editable value={content.titleLine1} onCommit={(v) => set({ titleLine1: v })} className="block" /> : content.titleLine1}
            <br />
            {editable ? <Editable value={content.titleLine2} onCommit={(v) => set({ titleLine2: v })} className="block" /> : content.titleLine2}
            <br />
            <span className="font-criador-serif normal-case block" style={{ color: LIME }}>
              {editable ? <Editable value={content.titleAccentLine1} onCommit={(v) => set({ titleAccentLine1: v })} className="block" /> : content.titleAccentLine1}
              <br />
              {editable ? <Editable value={content.titleAccentLine2} onCommit={(v) => set({ titleAccentLine2: v })} className="block" /> : content.titleAccentLine2}
            </span>
          </h1>
          {editable ? (
            <Editable value={content.subtitle} multiline onCommit={(v) => set({ subtitle: v })} className="text-foreground/60 text-base sm:text-lg max-w-[560px] mt-6 leading-relaxed block" />
          ) : (
            <p className="text-foreground/60 text-base sm:text-lg max-w-[560px] mt-6 leading-relaxed">{content.subtitle}</p>
          )}
          <div
            className={`mt-8 inline-flex items-center gap-2 font-black uppercase text-sm px-7 py-4 rounded-full ${editable ? "" : POP}`}
            style={{ background: LIME, color: "#0A0E23", ...EASE }}
            onClick={editable ? undefined : onCtaClick}
          >
            {editable ? <Editable value={content.ctaLabel} onCommit={(v) => set({ ctaLabel: v })} /> : content.ctaLabel}
          </div>
          <div className="flex items-center gap-3 mt-3 max-w-[480px]">
            <img src={clickupTrelloLogos} alt="Logos do ClickUp e do Trello" className="h-9 w-auto shrink-0 opacity-80" />
            <p className="text-foreground/40 text-xs">
              Usava o ClickUp ou Trello? Sem problemas, você pode migrar todo o seu fluxo com facilidade.
            </p>
          </div>
        </div>
        <div
          ref={editable ? undefined : parallax.ref}
          className="order-1 lg:order-2 flex justify-center lg:justify-end"
          style={editable ? undefined : { transform: `translateY(${parallax.offset}px)` }}
        >
          <EditableImageArea
            images={content.images ?? []} onChange={editable ? (images) => set({ images }) : undefined} alt="Modo Criador" mode="hero"
            topicHint={`${content.eyebrowLabel ?? ""} ${content.titleLine1 ?? ""} ${content.titleAccentLine1 ?? ""}`}
            floatSync={content.floatSync} onFloatSync={editable ? (v) => set({ floatSync: v }) : undefined}
          />
        </div>
      </div>
    </section>
  );
}

/** Despacha um bloco (que não seja hero) pro componente certo. */
export function renderBlockNode(block: { id: string; type: string; content: any }, onChange?: (c: any) => void) {
  switch (block.type) {
    case "bullet_list": return <BulletListBlock key={block.id} content={block.content} onChange={onChange} />;
    case "steps": return <StepsBlock key={block.id} content={block.content} onChange={onChange} />;
    case "feature": return <FeatureBlock key={block.id} content={block.content} onChange={onChange} />;
    case "gallery": return <GalleryBlock key={block.id} content={block.content} onChange={onChange} />;
    case "text_blurb": return <TextBlurbBlock key={block.id} content={block.content} onChange={onChange} />;
    case "image_banner": return <ImageBannerBlock key={block.id} content={block.content} onChange={onChange} />;
    case "single_image": return <SingleImageBlock key={block.id} content={block.content} onChange={onChange} />;
    default: return null;
  }
}

/* ---------------------------------------------------------------------- *
 * Corpo do site (Hero + blocos), só leitura — usado pelo site público
 * (SalesPage.tsx). O editor (SalesPageEditorTab.tsx) usa HeroSection e
 * renderBlockNode diretamente, com onChange, pra ficar editável.
 * ---------------------------------------------------------------------- */
export function SalesPageBody({
  hero, blocks, onCtaClick,
}: {
  hero: { content: any } | undefined;
  blocks: { id: string; type: string; content: any }[];
  onCtaClick?: () => void;
}) {
  return (
    <>
      {hero && <HeroSection content={hero.content} onCtaClick={onCtaClick} />}
      {blocks.map((b) => renderBlockNode(b))}
    </>
  );
}
