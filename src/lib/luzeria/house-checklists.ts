// House (Fase 2) — regras compartilhadas entre navegador e servidor:
// período de cada cadência de checklist (sempre no fuso de Brasília, igual
// à função SQL house_checklist_period_key) e os rótulos de leads.

export const HOUSE_TZ = "America/Sao_Paulo";

export type ChecklistCadence = "daily" | "weekly" | "monthly";

export const CADENCE_LABEL: Record<ChecklistCadence, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

export const WEEKDAY_LABEL: Record<number, string> = {
  1: "segunda", 2: "terça", 3: "quarta", 4: "quinta", 5: "sexta", 6: "sábado", 7: "domingo",
};

/** Data de hoje (ou de `at`) no fuso da House, como "YYYY-MM-DD". */
export function houseDateKey(at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: HOUSE_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Dia da semana ISO (1 = segunda … 7 = domingo) de uma data "YYYY-MM-DD". */
export function isoWeekday(dateKey: string): number {
  const d = parseDateKey(dateKey).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Mesmo formato do to_char(_, 'IYYY-"W"IW') do Postgres. */
export function isoWeekKey(dateKey: string): string {
  const d = parseDateKey(dateKey);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function checklistPeriodKey(cadence: ChecklistCadence, dateKey: string): string {
  if (cadence === "daily") return dateKey;
  if (cadence === "weekly") return isoWeekKey(dateKey);
  return dateKey.slice(0, 7);
}

/** Segunda-feira (YYYY-MM-DD) da semana da data. */
export function weekStartKey(dateKey: string): string {
  const d = parseDateKey(dateKey);
  d.setUTCDate(d.getUTCDate() - (isoWeekday(dateKey) - 1));
  return d.toISOString().slice(0, 10);
}

export function lastDayOfMonth(dateKey: string): number {
  const [y, m] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** O item aparece no "Meu dia" de hoje? Diário: só em dia útil. Semanal e
 * mensal: o período inteiro, até ser marcado. */
export function checklistAppliesToday(cadence: ChecklistCadence, dateKey: string): boolean {
  if (cadence === "daily") return isoWeekday(dateKey) <= 5;
  return true;
}

/** Já passou do prazo neste período (e ainda não foi feito)? */
export function checklistIsLate(item: { cadence: ChecklistCadence; dueWeekday: number; dueDay: number }, dateKey: string): boolean {
  if (item.cadence === "daily") return false; // o prazo é o próprio dia
  if (item.cadence === "weekly") return isoWeekday(dateKey) > item.dueWeekday;
  return Number(dateKey.slice(8, 10)) > Math.min(item.dueDay, lastDayOfMonth(dateKey));
}

export function checklistDueLabel(item: { cadence: ChecklistCadence; dueWeekday: number; dueDay: number }): string {
  if (item.cadence === "daily") return "todo dia útil";
  if (item.cadence === "weekly") return `até ${WEEKDAY_LABEL[item.dueWeekday]}`;
  return item.dueDay >= 31 ? "até o fim do mês" : `até o dia ${item.dueDay}`;
}

/* ===== Leads ===== */

export const LEAD_ORIGINS = ["story", "caixinha", "comentario", "direct", "outro"] as const;
export type LeadOrigin = (typeof LEAD_ORIGINS)[number];
export const LEAD_ORIGIN_LABEL: Record<LeadOrigin, string> = {
  story: "Resposta de story",
  caixinha: "Caixinha",
  comentario: "Comentário",
  direct: "Direct",
  outro: "Outro",
};

export const LEAD_STATUSES = ["conversa", "agendou", "compareceu", "nao_avancou"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_META: Record<LeadStatus, { label: string; color: string }> = {
  conversa: { label: "Conversa iniciada", color: "#4A9EFF" },
  agendou: { label: "Agendou", color: "#C8A2FF" },
  compareceu: { label: "Compareceu", color: "#4ADE80" },
  nao_avancou: { label: "Não avançou", color: "#9AA4B2" },
};
