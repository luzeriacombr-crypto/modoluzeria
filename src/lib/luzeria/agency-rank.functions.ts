import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { agencyPointsFromBillingRow } from "./agency-level";

/** Quantas posições ganham selo ("Agência Top N"). Fora disso, agency_rank
 * fica sem valor (nulo) e nenhum selo aparece. */
const RANKED_POSITIONS = 20;

/** Recalcula o ranking de pontos entre TODAS as agências elegíveis e grava a
 * posição de cada uma na própria linha de `orgs` — chamado 1x por dia pelo
 * cron externo (api.cron.compute-agency-ranks.ts), nunca pelo client.
 *
 * Fica de fora da disputa (não recebe agency_rank, mas ainda tem os pontos
 * calculados e zera o streak): agências de revenda (`is_reseller`), contas
 * revendidas por elas (`reseller_org_id` preenchido) e contas demo
 * (`demo_read_only`) — decisão do Junior, pra não deixar conta de teste ou
 * instância revendida do mesmo dono "roubar" uma posição de verdade.
 *
 * Segurança: essa é a ÚNICA função do sistema que compara pontos entre
 * agências diferentes — roda com supabaseAdmin (bypassa RLS de propósito,
 * mesmo padrão de listOrgsBilling) só aqui, num contexto protegido por
 * CRON_SECRET, nunca a partir de uma chamada do client. A leitura de volta
 * (getMyAgencyRank) só lê a própria linha de `orgs` via RLS normal — nenhum
 * dado de outra agência trafega pra fora dessa função. */
export async function runAgencyRankRecompute() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: orgs, error } = await supabaseAdmin
    .from("orgs")
    .select("id, plan_id, subscription_status, asaas_subscription_id, is_reseller, reseller_org_id, demo_read_only, agency_rank_streak_days");
  if (error) throw new Error(error.message);

  const { data: plans } = await supabaseAdmin.from("plans").select("id, max_clients, max_collaborators");
  const planList = (plans ?? []).map((p: any) => ({
    id: p.id as string,
    maxClients: p.max_clients as number | null,
    maxCollaborators: p.max_collaborators as number | null,
  }));

  const { data: clientRows } = await supabaseAdmin
    .from("clients").select("org_id").eq("archived", false).neq("category", "Ex-clientes");
  const clientsByOrg = new Map<string, number>();
  (clientRows ?? []).forEach((c: any) => clientsByOrg.set(c.org_id, (clientsByOrg.get(c.org_id) ?? 0) + 1));

  const { data: finalizedRows } = await supabaseAdmin
    .from("content_items")
    .select("months!inner(clients!inner(org_id))")
    .in("status", ["PRONTO_PARA_PUBLICAR", "FINALIZADO", "CONCLUIDO"])
    .in("type", ["post", "reel", "story"]);
  const finalizedByOrg = new Map<string, number>();
  (finalizedRows ?? []).forEach((r: any) => {
    const orgId = r.months?.clients?.org_id;
    if (!orgId) return;
    finalizedByOrg.set(orgId, (finalizedByOrg.get(orgId) ?? 0) + 1);
  });

  const { data: profileRows } = await supabaseAdmin.from("profiles").select("org_id, active");
  const teamCountByOrg = new Map<string, number>();
  (profileRows ?? []).forEach((p: any) => {
    if (!p.active) return;
    teamCountByOrg.set(p.org_id, (teamCountByOrg.get(p.org_id) ?? 0) + 1);
  });

  const { data: driveRows } = await supabaseAdmin.from("org_google_credentials").select("org_id");
  const orgsWithDrive = new Set((driveRows ?? []).map((r: any) => r.org_id as string));

  const { data: igRows } = await supabaseAdmin
    .from("client_instagram_credentials").select("client_id, clients!client_instagram_credentials_client_id_fkey(org_id)");
  const igConnectedByOrg = new Map<string, number>();
  (igRows ?? []).forEach((r: any) => {
    const orgId = r.clients?.org_id;
    if (!orgId) return;
    igConnectedByOrg.set(orgId, (igConnectedByOrg.get(orgId) ?? 0) + 1);
  });

  const eligible: { id: string; points: number; prevStreak: number }[] = [];
  const ineligibleIds: string[] = [];

  (orgs ?? []).forEach((o: any) => {
    const points = agencyPointsFromBillingRow(
      {
        clientsUsed: clientsByOrg.get(o.id) ?? 0,
        finalizedCount: finalizedByOrg.get(o.id) ?? 0,
        subscriptionStatus: o.subscription_status,
        hasAsaasSubscription: !!o.asaas_subscription_id,
        driveConnected: orgsWithDrive.has(o.id),
        instagramConnected: igConnectedByOrg.get(o.id) ?? 0,
        teamCount: teamCountByOrg.get(o.id) ?? 0,
        planId: o.plan_id,
      },
      planList,
    );
    const isExcluded = !!o.is_reseller || !!o.reseller_org_id || !!o.demo_read_only;
    if (isExcluded) {
      ineligibleIds.push(o.id);
    } else {
      eligible.push({ id: o.id, points, prevStreak: (o.agency_rank_streak_days as number) ?? 0 });
    }
  });

  eligible.sort((a, b) => b.points - a.points);

  const now = new Date().toISOString();
  const updates = eligible.map((o, idx) => {
    const rank = idx + 1;
    const inTop = rank <= RANKED_POSITIONS;
    return {
      id: o.id,
      agency_rank: inTop ? rank : null,
      agency_rank_points: o.points,
      agency_rank_streak_days: inTop ? o.prevStreak + 1 : 0,
      agency_rank_computed_at: now,
    };
  });

  // Agências excluídas da disputa: zera posição/streak mas registra que o
  // cron rodou (evita `getMyAgencyRank` devolver dado de dias atrás).
  ineligibleIds.forEach((id) => {
    updates.push({ id, agency_rank: null, agency_rank_points: null as any, agency_rank_streak_days: 0, agency_rank_computed_at: now });
  });

  for (const u of updates) {
    const { id, ...fields } = u;
    const { error: updateError } = await supabaseAdmin.from("orgs").update(fields).eq("id", id);
    if (updateError) throw new Error(`Falha ao gravar ranking da org ${id}: ${updateError.message}`);
  }

  return { totalEligible: eligible.length, totalExcluded: ineligibleIds.length, computedAt: now };
}

/** Lê SÓ a posição/streak da própria agência — RLS normal (a policy "read
 * own org" já cobre essas colunas), nenhuma query cross-org acontece aqui.
 * Devolve null se a agência nunca competiu ou está fora do Top 20. */
export const getMyAgencyRank = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("orgs")
      .select("agency_rank, agency_rank_streak_days")
      .eq("id", context.orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const rank = (data as any)?.agency_rank as number | null;
    if (!rank) return null;
    return {
      rank,
      streakDays: ((data as any)?.agency_rank_streak_days as number) ?? 0,
    };
  });
