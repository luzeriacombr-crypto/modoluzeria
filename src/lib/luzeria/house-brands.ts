// House com várias marcas do mesmo grupo (ex.: Levive + Doctor Fit):
// tipos e padrões compartilhados entre servidor e telas.

export type BrandInfo = { id: string; name: string; isMain: boolean };

/** Metas de uma marca (stories por dia útil, posts no feed por semana,
 * leads e agendamentos por mês). */
export type BrandGoals = {
  storiesPerWorkday: number;
  feedPostsPerWeek: number;
  leadsGoalMonth: number;
  scheduledGoalMonth: number;
};

export const DEFAULT_BRAND_GOALS: BrandGoals = {
  storiesPerWorkday: 3,
  feedPostsPerWeek: 3,
  leadsGoalMonth: 20,
  scheduledGoalMonth: 8,
};

/** "all" = todas as marcas que a pessoa pode ver. */
export type BrandScope = string | "all";
export const brandScopeKey = "lz.houseBrandScope";
