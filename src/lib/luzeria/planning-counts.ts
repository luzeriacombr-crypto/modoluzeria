// Quantidade de conteúdos por tipo na prévia de planejamento com IA —
// compartilhado entre a tela (contadores) e o servidor (pedido, conferência
// e complemento do que faltar). Vale pra agência e pra House: é a mesma
// função de servidor.

export type PlanCounts = { reel: number; estatico: number; carrossel: number };
export const PLAN_KINDS = ["reel", "estatico", "carrossel"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

export const PLAN_KIND_LABEL: Record<PlanKind, { singular: string; plural: string }> = {
  reel: { singular: "reel", plural: "reels" },
  estatico: { singular: "post estático", plural: "posts estáticos" },
  carrossel: { singular: "carrossel", plural: "carrosséis" },
};

/** Teto por geração: acima disso a resposta fica lenta e a qualidade cai. */
export const MAX_PLAN_ITEMS = 30;

export const planTotal = (c: PlanCounts) => c.reel + c.estatico + c.carrossel;

/** A qual contador um item do plano pertence. Post sem formato = estático. */
export function classifyPlanItem(item: { type: string; postFormat?: string | null }): PlanKind {
  if (item.type === "reel") return "reel";
  return item.postFormat === "carrossel" ? "carrossel" : "estatico";
}

export function countPlanItems(items: { type: string; postFormat?: string | null }[]): PlanCounts {
  const c: PlanCounts = { reel: 0, estatico: 0, carrossel: 0 };
  for (const it of items) c[classifyPlanItem(it)]++;
  return c;
}

/** Padrão da tela: usa as metas da marca (posts e reels por mês). Sem metas,
 * 3 reels + 2 estáticos + 1 carrossel (6 conteúdos). Sempre dentro do teto. */
export function defaultPlanCounts(postsPerMonth: number, reelsPerMonth: number): PlanCounts {
  const posts = Math.max(0, Math.round(postsPerMonth));
  const reels = Math.max(0, Math.round(reelsPerMonth));
  let c: PlanCounts = posts + reels > 0
    ? { reel: reels, estatico: Math.ceil(posts / 2), carrossel: Math.floor(posts / 2) }
    : { reel: 3, estatico: 2, carrossel: 1 };
  const total = planTotal(c);
  if (total > MAX_PLAN_ITEMS) {
    const f = MAX_PLAN_ITEMS / total;
    c = { reel: Math.floor(c.reel * f), estatico: Math.floor(c.estatico * f), carrossel: Math.floor(c.carrossel * f) };
  }
  return c;
}

/** "8 reels, 4 posts estáticos e 4 carrosséis" (só o que for > 0). */
export function describePlanCounts(c: PlanCounts): string {
  const parts = PLAN_KINDS.filter((k) => c[k] > 0).map((k) => `${c[k]} ${c[k] === 1 ? PLAN_KIND_LABEL[k].singular : PLAN_KIND_LABEL[k].plural}`);
  if (parts.length <= 1) return parts[0] ?? "nenhum conteúdo";
  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}
