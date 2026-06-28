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