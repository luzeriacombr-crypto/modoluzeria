// Datas comemorativas: catálogo pronto, cálculo das datas móveis e helpers.
// As regras de data móvel são as MESMAS da função SQL
// commemorative_occurrence_date (migration 20261003100000) — se mudar uma,
// mude a outra. Tudo em datas "AAAA-MM-DD" puras (sem fuso).

export const DATE_RULES = ["easter", "carnival", "mothers_day", "fathers_day", "black_friday", "cyber_monday"] as const;
export type DateRule = (typeof DATE_RULES)[number];
export type DateKind = "fixa" | "movel" | "personalizada" | "aniversario";
export type Segment = "varejo" | "saude" | "geral";

export const RULE_LABEL: Record<DateRule, string> = {
  easter: "Páscoa",
  carnival: "Carnaval (terça)",
  mothers_day: "2º domingo de maio",
  fathers_day: "2º domingo de agosto",
  black_friday: "Black Friday",
  cyber_monday: "Cyber Monday",
};

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const utc = (key: string) => { const [y, m, d] = key.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fromUtc = (dt: Date) => iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
export const addDaysKey = (key: string, n: number) => { const d = utc(key); d.setUTCDate(d.getUTCDate() + n); return fromUtc(d); };
export const diffDays = (a: string, b: string) => Math.round((utc(b).getTime() - utc(a).getTime()) / 86_400_000);

function easter(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(year, month, day);
}
const dow = (key: string) => utc(key).getUTCDay();

export function ruleDate(rule: DateRule, year: number): string {
  switch (rule) {
    case "easter": return easter(year);
    case "carnival": return addDaysKey(easter(year), -47);
    case "mothers_day": { const f = iso(year, 5, 1); return addDaysKey(f, ((7 - dow(f)) % 7) + 7); }
    case "fathers_day": { const f = iso(year, 8, 1); return addDaysKey(f, ((7 - dow(f)) % 7) + 7); }
    case "black_friday":
    case "cyber_monday": {
      const f = iso(year, 11, 1);
      const thanksgiving = addDaysKey(f, ((4 - dow(f) + 7) % 7) + 21);
      return addDaysKey(thanksgiving, rule === "black_friday" ? 1 : 4);
    }
  }
}

export type DateLike = { rule: DateRule | null; month: number | null; day: number | null };

/** Data da ocorrência num ano. 29/02 cai em 28/02 nos anos não bissextos. */
export function occurrenceOn(d: DateLike, year: number): string {
  if (d.rule) return ruleDate(d.rule, year);
  const lastDay = new Date(Date.UTC(year, d.month!, 0)).getUTCDate();
  return iso(year, d.month!, Math.min(d.day!, lastDay));
}

/** Próxima ocorrência a partir de hoje (inclusive) e o ano dela. */
export function nextOccurrence(d: DateLike, todayKey: string): { date: string; year: number; daysUntil: number } {
  const y = Number(todayKey.slice(0, 4));
  let date = occurrenceOn(d, y), year = y;
  if (date < todayKey) { year = y + 1; date = occurrenceOn(d, year); }
  return { date, year, daysUntil: diffDays(todayKey, date) };
}

export const fmtDM = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

/* ---------------- catálogo pronto ---------------- */

export type CatalogItem = { key: string; title: string; segment: Segment; rule?: DateRule; month?: number; day?: number };

export const CATALOG: CatalogItem[] = [
  // Varejo e serviços em geral
  { key: "ano-novo", title: "Ano Novo", segment: "geral", month: 1, day: 1 },
  { key: "carnaval", title: "Carnaval", segment: "geral", rule: "carnival" },
  { key: "mulher", title: "Dia Internacional da Mulher", segment: "geral", month: 3, day: 8 },
  { key: "consumidor", title: "Dia do Consumidor", segment: "varejo", month: 3, day: 15 },
  { key: "pascoa", title: "Páscoa", segment: "geral", rule: "easter" },
  { key: "trabalhador", title: "Dia do Trabalhador", segment: "geral", month: 5, day: 1 },
  { key: "maes", title: "Dia das Mães", segment: "geral", rule: "mothers_day" },
  { key: "namorados", title: "Dia dos Namorados", segment: "geral", month: 6, day: 12 },
  { key: "amigo", title: "Dia do Amigo", segment: "geral", month: 7, day: 20 },
  { key: "pais", title: "Dia dos Pais", segment: "geral", rule: "fathers_day" },
  { key: "cliente", title: "Dia do Cliente", segment: "geral", month: 9, day: 15 },
  { key: "criancas", title: "Dia das Crianças", segment: "varejo", month: 10, day: 12 },
  { key: "professor", title: "Dia do Professor", segment: "geral", month: 10, day: 15 },
  { key: "black-friday", title: "Black Friday", segment: "varejo", rule: "black_friday" },
  { key: "cyber-monday", title: "Cyber Monday", segment: "varejo", rule: "cyber_monday" },
  { key: "natal", title: "Natal", segment: "geral", month: 12, day: 25 },
  // Saúde
  { key: "farmaceutico", title: "Dia do Farmacêutico", segment: "saude", month: 1, day: 20 },
  { key: "nutricionista", title: "Dia do Nutricionista", segment: "saude", month: 1, day: 31 },
  { key: "mundial-saude", title: "Dia Mundial da Saúde", segment: "saude", month: 4, day: 7 },
  { key: "enfermagem", title: "Dia do Enfermeiro", segment: "saude", month: 5, day: 12 },
  { key: "psicologo", title: "Dia do Psicólogo", segment: "saude", month: 8, day: 27 },
  { key: "outubro-rosa", title: "Outubro Rosa", segment: "saude", month: 10, day: 1 },
  { key: "fisioterapeuta", title: "Dia do Fisioterapeuta", segment: "saude", month: 10, day: 13 },
  { key: "medico", title: "Dia do Médico", segment: "saude", month: 10, day: 18 },
  { key: "dentista", title: "Dia do Dentista", segment: "saude", month: 10, day: 25 },
  { key: "novembro-azul", title: "Novembro Azul", segment: "saude", month: 11, day: 1 },
];

export const SEGMENT_LABEL: Record<Segment, string> = { varejo: "Varejo", saude: "Saúde", geral: "Datas gerais" };

/** Texto-base do card quando a data vira post (a pessoa ajusta depois). */
export function briefingForDate(title: string, dateKey: string, note?: string | null): string {
  return [
    `Data comemorativa: ${title} (${fmtDM(dateKey)}).`,
    note ? `Observação: ${note}` : "",
    "Sugestão: abra com a data, mostre o que a marca oferece que combina com ela e feche com uma chamada pra ação simples.",
  ].filter(Boolean).join("\n");
}
