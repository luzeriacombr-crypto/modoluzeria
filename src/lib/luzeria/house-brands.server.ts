// House com várias marcas — lado servidor: quais marcas a pessoa enxerga
// (respeita o acesso por marca: o select de clients já passa pela RLS
// has_client_access, então quem é restrito só recebe as marcas liberadas)
// e as metas de cada uma. Server-only.
import { DEFAULT_BRAND_GOALS, type BrandGoals, type BrandInfo } from "./house-brands";

export async function getHouseBrands(context: { supabase: any; orgId: string }): Promise<{ brands: BrandInfo[]; mainId: string | null }> {
  const { data: org } = await context.supabase.from("orgs").select("account_type, house_client_id").eq("id", context.orgId).maybeSingle();
  if (org?.account_type !== "house") throw new Error("Disponível só em contas House.");
  const mainId = (org.house_client_id ?? null) as string | null;
  const { data: rows } = await context.supabase.from("clients")
    .select("id, name, archived, category").eq("org_id", context.orgId).order("name");
  const brands = ((rows ?? []) as any[])
    .filter((c) => !c.archived && c.category !== "Ex-clientes")
    .map((c) => ({ id: c.id as string, name: c.name as string, isMain: c.id === mainId }))
    // principal primeiro
    .sort((a, b) => Number(b.isMain) - Number(a.isMain) || a.name.localeCompare(b.name));
  return { brands, mainId };
}

/** Marcas do pedido: "all"/ausente = todas as que a pessoa vê; um id = só aquela. */
export function pickBrands(brands: BrandInfo[], requested?: string | null): BrandInfo[] {
  if (!requested || requested === "all") return brands;
  const b = brands.find((x) => x.id === requested);
  if (!b) throw new Error("Você não tem acesso a essa marca.");
  return [b];
}

/** Marca onde um registro novo (lead, demanda, projeto, "postei") vai ser
 * criado: a pedida; senão a única que a pessoa vê; senão a principal. */
export function pickWriteBrand(brands: BrandInfo[], requested?: string | null): BrandInfo {
  if (brands.length === 0) throw new Error("Você não tem acesso a nenhuma marca.");
  if (requested && requested !== "all") {
    const b = brands.find((x) => x.id === requested);
    if (!b) throw new Error("Você não tem acesso a essa marca.");
    return b;
  }
  return brands.find((b) => b.isMain) ?? brands[0];
}

/** Metas por marca: linha própria em house_brand_settings; a principal, sem
 * linha, usa house_settings (onde já estava); as demais usam o padrão. */
export async function loadBrandGoals(supabase: any, orgId: string, brands: BrandInfo[]): Promise<Map<string, BrandGoals>> {
  const out = new Map<string, BrandGoals>();
  if (brands.length === 0) return out;
  const [{ data: own }, { data: main }] = await Promise.all([
    supabase.from("house_brand_settings").select("*").eq("org_id", orgId).in("client_id", brands.map((b) => b.id)),
    supabase.from("house_settings").select("stories_per_workday, feed_posts_per_week, leads_goal_month, scheduled_goal_month").eq("org_id", orgId).maybeSingle(),
  ]);
  const byId = new Map(((own ?? []) as any[]).map((r) => [r.client_id as string, r]));
  for (const b of brands) {
    const r = byId.get(b.id);
    if (r) {
      out.set(b.id, { storiesPerWorkday: r.stories_per_workday, feedPostsPerWeek: r.feed_posts_per_week, leadsGoalMonth: r.leads_goal_month, scheduledGoalMonth: r.scheduled_goal_month });
    } else if (b.isMain && main) {
      out.set(b.id, {
        storiesPerWorkday: main.stories_per_workday ?? DEFAULT_BRAND_GOALS.storiesPerWorkday,
        feedPostsPerWeek: main.feed_posts_per_week ?? DEFAULT_BRAND_GOALS.feedPostsPerWeek,
        leadsGoalMonth: main.leads_goal_month ?? DEFAULT_BRAND_GOALS.leadsGoalMonth,
        scheduledGoalMonth: main.scheduled_goal_month ?? DEFAULT_BRAND_GOALS.scheduledGoalMonth,
      });
    } else {
      out.set(b.id, { ...DEFAULT_BRAND_GOALS });
    }
  }
  return out;
}

export function sumGoals(goals: BrandGoals[]): BrandGoals {
  return goals.reduce((a, g) => ({
    storiesPerWorkday: a.storiesPerWorkday + g.storiesPerWorkday,
    feedPostsPerWeek: a.feedPostsPerWeek + g.feedPostsPerWeek,
    leadsGoalMonth: a.leadsGoalMonth + g.leadsGoalMonth,
    scheduledGoalMonth: a.scheduledGoalMonth + g.scheduledGoalMonth,
  }), { storiesPerWorkday: 0, feedPostsPerWeek: 0, leadsGoalMonth: 0, scheduledGoalMonth: 0 });
}

/** Aplica o filtro de marca numa consulta com coluna client_id. A marca
 * principal também enxerga registros antigos sem marca (client_id nulo). */
export function brandFilter(q: any, column: string, selected: BrandInfo[]): any {
  const ids = selected.map((b) => b.id);
  const hasMain = selected.some((b) => b.isMain);
  if (hasMain) return q.or(`${column}.in.(${ids.join(",")}),${column}.is.null`);
  return q.in(column, ids);
}
