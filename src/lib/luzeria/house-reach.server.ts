// House — alcance e seguidores por marca (Instagram), pro painel do dono e
// pro relatório mensal. Server-only. Usa o mesmo "Visão geral" do Instagram
// das agências e os retratos diários de seguidores (instagram_client_snapshots).
import type { BrandInfo } from "./house-brands";

export type BrandReach = {
  brandId: string;
  name: string;
  connected: boolean;
  /** Seguidores agora. */
  followers: number | null;
  /** Variação de seguidores no mês (pelos retratos diários); null sem 2 retratos. */
  followersChange: number | null;
  followersSince: string | null;
  /** Janela de 30 dias da Meta (não é o mês fechado). */
  reach30: number | null;
  profileViews30: number | null;
  interactions30: number | null;
};

export async function computeBrandReach(brands: BrandInfo[], first: string, last: string, isCurrent: boolean): Promise<BrandReach[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin: any = supabaseAdmin;
  const { fetchInstagramOverview } = await import("./instagram.functions");
  return Promise.all(brands.map(async (b): Promise<BrandReach> => {
    const empty: BrandReach = { brandId: b.id, name: b.name, connected: false, followers: null, followersChange: null, followersSince: null, reach30: null, profileViews30: null, interactions30: null };
    let overview: Awaited<ReturnType<typeof fetchInstagramOverview>> | null = null;
    try {
      overview = await fetchInstagramOverview(admin, b.id);
    } catch {
      overview = null;
    }
    const { data: snaps } = await admin.from("instagram_client_snapshots").select("captured_on, followers_count")
      .eq("client_id", b.id).gte("captured_on", first).lte("captured_on", last).order("captured_on", { ascending: true });
    const rows = (snaps ?? []) as { captured_on: string; followers_count: number }[];
    const start = rows[0] ?? null;
    const end = isCurrent && overview ? overview.followersCount : rows[rows.length - 1]?.followers_count ?? null;
    const canCompare = start != null && end != null && (rows.length >= 2 || (isCurrent && overview != null));
    if (!overview && rows.length === 0) return empty;
    return {
      ...empty,
      connected: !!overview,
      followers: overview ? overview.followersCount : rows[rows.length - 1]?.followers_count ?? null,
      followersChange: canCompare ? (end as number) - start!.followers_count : null,
      followersSince: start?.captured_on ?? null,
      reach30: overview?.kpis.reach ?? null,
      profileViews30: overview?.kpis.profileViews ?? null,
      interactions30: overview?.kpis.totalInteractions ?? null,
    };
  }));
}
