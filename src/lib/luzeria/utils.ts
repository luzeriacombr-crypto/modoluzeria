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
  if (status === "FINALIZADO") {
    return { level: "done", label: "", color: "rgba(255,255,255,0.3)", bg: "rgba(255,255,255,0.05)", days: null };
  }
  if (!dueDate) {
    return { level: "none", label: "Sem prazo", color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.04)", days: null };
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
  return { level: "ok", label: `Em ${days} dias`, color: "#C8D44E", bg: "rgba(200,212,78,0.12)", days };
}