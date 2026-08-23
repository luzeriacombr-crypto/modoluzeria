export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthKey(): string {
  return monthKey(new Date());
}

export function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m, 1); // m is next month already (0-based)
  return monthKey(d);
}

const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function formatMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_PT[m - 1]} ${y}`;
}

export function shortMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS_PT[m - 1].slice(0, 3)}/${String(y).slice(2)}`;
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  const mo = Math.floor(d / 30);
  return `há ${mo}mês`;
}

export function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

export const PRESET_COLORS = [
  "#C8D44E",
  "#FF6B6B",
  "#4A9EFF",
  "#FF8C42",
  "#A855F7",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#FFFFFF",
];

export const PRESET_ICONS = [
  "✨",
  "💎",
  "🌿",
  "🔥",
  "⚡",
  "🌙",
  "☀️",
  "🎯",
  "📸",
  "🎬",
  "💼",
  "🌸",
];

/* ============== DEADLINE INDICATOR ============== */
export type DeadlineLevel = "overdue" | "urgent" | "soon" | "ok" | "none" | "done";

export interface DeadlineInfo {
  level: DeadlineLevel;
  label: string;
  color: string;
  bg: string;
  days: number | null;
}

export function deadlineInfo(dueDate?: string | null, status?: string): DeadlineInfo {
  if (status === "PRONTO_PARA_PUBLICAR" || status === "FINALIZADO" || status === "CONCLUIDO") {
    return { level: "done", label: "", color: "color-mix(in srgb, var(--foreground) 30%, transparent)", bg: "color-mix(in srgb, var(--foreground) 5%, transparent)", days: null };
  }
  if (!dueDate) {
    return { level: "none", label: "Sem prazo", color: "color-mix(in srgb, var(--foreground) 40%, transparent)", bg: "color-mix(in srgb, var(--foreground) 4%, transparent)", days: null };
  }
  const [y, m, d] = dueDate.split("-").map(Number);
  const due = new Date(y, (m ?? 1) - 1, d ?? 1); due.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (days < 0) {
    const n = Math.abs(days);
    return { level: "overdue", label: n === 1 ? "Atrasado 1d" : `Atrasado ${n}d`, color: "#FF4444", bg: "rgba(255,68,68,0.12)", days };
  }
  if (days === 0) return { level: "urgent", label: "Vence hoje", color: "#FF4444", bg: "rgba(255,68,68,0.12)", days };
  if (days === 1) return { level: "urgent", label: "Vence amanhã", color: "#FF4444", bg: "rgba(255,68,68,0.12)", days };
  if (days <= 3) return { level: "soon", label: `Em ${days} dias`, color: "#F5A623", bg: "rgba(245,166,35,0.12)", days };
  return { level: "ok", label: `Em ${days} dias`, color: "var(--lz-accent-ink)", bg: "rgba(var(--lz-brand-light-rgb),0.12)", days };
}

/** "#RRGGBB" -> "R, G, B" for use inside a CSS custom property that's later
 * referenced as rgb(var(--x)) / rgba(var(--x), alpha). Returns null for an
 * invalid hex so callers can safely skip overriding the CSS variable. */
export function hexToRgbChannels(hex: string): string | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** "#RRGGBB" + alpha -> "rgba(r, g, b, alpha)". Falls back to a mid-gray if
 * the hex is malformed, so a bad client/member color never renders `NaN`. */
export function hexAlpha(hex: string, alpha: number): string {
  const channels = hexToRgbChannels(hex) ?? "160, 160, 160";
  return `rgba(${channels}, ${alpha})`;
}

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const channels = hexToRgbChannels(hex) ?? "200, 212, 78";
  const [r, g, b] = channels.split(",").map((s) => parseInt(s.trim(), 10) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** A lighter, hue-shifted companion for a brand color — used when the org
 * only set a primary color and left the "light"/secondary one at the
 * default, so gradients and accents don't end up mixing the org's color
 * with Luzeria's leftover lime. Same technique as hue-rotating a color
 * wheel by a fixed amount, then pushing lightness up. */
export function deriveSecondaryHex(primaryHex: string): string {
  const hsl = hexToHSL(primaryHex);
  const h = (hsl.h + 18) % 360;
  const s = Math.min(95, Math.max(55, hsl.s));
  const l = Math.min(78, Math.max(hsl.l + 15, 60));
  return hslToHex(h, s, l);
}

/** For an accent color shown directly as text/icon color on this app's
 * near-black UI: most brand colors (lime, orange, yellow…) read fine, but a
 * color that's naturally dark even at full saturation (navy, deep purple,
 * dark red) can look low-contrast no matter how "bright" the org considers
 * it. Returns the color's own "R, G, B" channels when it's light enough to
 * read on a dark background, or white channels as a safe fallback
 * otherwise — same format as hexToRgbChannels, for a CSS custom property. */
export function readableAccentRgbChannels(hex: string): string | null {
  const channels = hexToRgbChannels(hex);
  if (!channels) return null;
  const [r, g, b] = channels.split(",").map((s) => parseInt(s.trim(), 10));
  // YIQ perceived brightness (0-255) — standard lightweight contrast heuristic.
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 130 ? channels : "255, 255, 255";
}

/** Shared "tinted card" background — a subtle top-left glow of `hex` fading
 * into the app's dark surface, same formula as the dashboard's MetricCard.
 * Best for a handful of cards with distinct meanings (metric tiles); a long
 * repeated list (clients, members) reads as noisy with one color per row —
 * use `glassCardStyle` there instead. */
export function tintedCardStyle(hex: string): { background: string; border: string } {
  return {
    background: `linear-gradient(160deg, ${hexAlpha(hex, 0.18)} 0%, var(--card) 70%)`,
    border: `1px solid ${hexAlpha(hex, 0.32)}`,
  };
}

/** Same soft gradient-sheen "glass" surface as `tintedCardStyle`, but
 * color-neutral — for repeated rows/cards (client list, team grid) where a
 * different color per item reads as busy. `active` swaps the neutral white
 * wash for a faint brand-color one, for the selected/current item. */
export function glassCardStyle(active = false): { background: string; border: string } {
  const tint = active ? "rgba(var(--lz-brand-light-rgb),0.16)" : "color-mix(in srgb, var(--foreground) 5%, transparent)";
  const border = active ? "rgba(var(--lz-brand-light-rgb),0.35)" : "var(--border)";
  return {
    background: `linear-gradient(160deg, ${tint} 0%, var(--card) 70%)`,
    border: `1px solid ${border}`,
  };
}