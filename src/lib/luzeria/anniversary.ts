export const DEFAULT_ANNIVERSARY_MESSAGE =
  "Hoje faz {tempo} que você entrou na {agencia}. Obrigado por cada entrega, cada ideia e por fazer parte desse time. Somos muito felizes de ter você aqui.";

const WORDS: Record<number, string> = { 1: "um ano", 2: "dois anos", 3: "três anos", 4: "quatro anos", 5: "cinco anos", 6: "seis anos", 7: "sete anos", 8: "oito anos", 9: "nove anos", 10: "dez anos" };

export function yearsLabel(years: number): string {
  return WORDS[years] ?? `${years} anos`;
}

/** Quantos anos de agência a pessoa completa HOJE — null se hoje não é o
 * dia do aniversário (ou se ainda não completou 1 ano). Quem entrou em 29/02
 * comemora em 28/02 nos anos não bissextos. */
export function anniversaryYearsToday(joinedAt: string | null | undefined, today = new Date()): number | null {
  if (!joinedAt) return null;
  const [y, m, d] = joinedAt.split("-").map(Number);
  if (!y || !m || !d) return null;
  const isLeap = (n: number) => (n % 4 === 0 && n % 100 !== 0) || n % 400 === 0;
  const ty = today.getFullYear(), tm = today.getMonth() + 1, td = today.getDate();
  const sameDay = tm === m && (td === d || (m === 2 && d === 29 && td === 28 && !isLeap(ty)));
  if (!sameDay) return null;
  const years = ty - y;
  return years >= 1 ? years : null;
}

export function renderAnniversaryMessage(template: string | null | undefined, vars: { nome: string; anos: number; agencia: string }): string {
  return (template?.trim() || DEFAULT_ANNIVERSARY_MESSAGE)
    .replaceAll("{nome}", vars.nome)
    .replaceAll("{tempo}", yearsLabel(vars.anos))
    .replaceAll("{agencia}", vars.agencia);
}
