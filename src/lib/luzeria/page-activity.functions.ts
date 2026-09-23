import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";

/** Client-side tracker (page-activity-tracker.ts) batches visits and sends
 * them here — one call per flush, not one per page, to keep the write
 * volume low. Each visit is "person was on route X for N seconds", never
 * mouse/click position. */
export const logPageActivity = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { visits: { path: string; durationSeconds: number }[] }) =>
    z.object({
      visits: z.array(z.object({
        path: z.string().trim().min(1).max(300),
        durationSeconds: z.number().int().min(0).max(3600),
      })).min(1).max(50),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const rows = data.visits.map((v) => ({
      org_id: context.orgId,
      user_id: context.userId,
      path: v.path,
      duration_seconds: v.durationSeconds,
    }));
    const { error } = await context.supabase.from("page_activity").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type PageActivityRow = {
  path: string;
  visits: number;
  uniqueUsers: number;
  totalSeconds: number;
  avgSeconds: number;
};

/** Platform-admin only: ranking of most/least used routes across every
 * agency, for the "onde tem gargalo" analysis — uses the service-role
 * client to aggregate past RLS (same pattern as listOrgsBilling), gated by
 * LUZERIA_ORG_ID since this is product-usage data, not agency data. */
export const getPageActivityReport = createServerFn({ method: "GET" })
  .inputValidator((d: { days: number }) => z.object({ days: z.number().int().min(1).max(365) }).parse(d))
  .middleware([requireActiveProfile])
  .handler(async ({ data, context }): Promise<PageActivityRow[]> => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("page_activity")
      .select("path, user_id, duration_seconds")
      .gte("created_at", since);
    if (error) throw new Error(error.message);

    const byPath = new Map<string, { visits: number; users: Set<string>; totalSeconds: number }>();
    (rows ?? []).forEach((r: any) => {
      const entry = byPath.get(r.path) ?? { visits: 0, users: new Set<string>(), totalSeconds: 0 };
      entry.visits += 1;
      entry.users.add(r.user_id);
      entry.totalSeconds += r.duration_seconds ?? 0;
      byPath.set(r.path, entry);
    });

    return Array.from(byPath.entries())
      .map(([path, e]) => ({
        path,
        visits: e.visits,
        uniqueUsers: e.users.size,
        totalSeconds: e.totalSeconds,
        avgSeconds: e.visits > 0 ? Math.round(e.totalSeconds / e.visits) : 0,
      }))
      .sort((a, b) => b.visits - a.visits);
  });

export type NewUserJourneyReport = {
  cohortSize: number;
  windowDays: number;
  usersWithNoPageViews: number;
  firstPageRanking: { path: string; count: number }[];
  topPagesByTime: { path: string; uniqueUsers: number; totalSeconds: number; avgSecondsPerUser: number }[];
};

// page_views só existe a partir dessa data (migração 20260919235200) — um
// perfil criado antes disso nunca teria "primeira página" completa, então
// fica de fora da coorte pra não distorcer o número.
const PAGE_VIEWS_TRACKING_START = "2026-09-19T00:00:00Z";

/** Platform-admin only: pra quem se cadastrou há pelo menos `windowDays`
 * dias, olha só o que aconteceu nos primeiros `windowDays` dias de cada um
 * (não o calendário todo) — qual página abriram primeiro, onde passaram
 * mais tempo, e quantos nem chegaram a navegar. Isso é o que Junior queria
 * pra saber se o onboarding self-service está funcionando ou se alguém
 * precisa de contato humano. */
export const getNewUserJourneyReport = createServerFn({ method: "GET" })
  .inputValidator((d: { windowDays: number }) => z.object({ windowDays: z.number().int().min(1).max(30) }).parse(d))
  .middleware([requireActiveProfile])
  .handler(async ({ data, context }): Promise<NewUserJourneyReport> => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const windowMs = data.windowDays * 86_400_000;
    const cutoff = new Date(Date.now() - windowMs).toISOString();

    const { data: cohort, error: cohortErr } = await supabaseAdmin
      .from("profiles")
      .select("id, created_at")
      .neq("org_id", LUZERIA_ORG_ID)
      .gte("created_at", PAGE_VIEWS_TRACKING_START)
      .lte("created_at", cutoff);
    if (cohortErr) throw new Error(cohortErr.message);

    const cohortIds = (cohort ?? []).map((p: any) => p.id as string);
    if (cohortIds.length === 0) {
      return { cohortSize: 0, windowDays: data.windowDays, usersWithNoPageViews: 0, firstPageRanking: [], topPagesByTime: [] };
    }
    const startByUser = new Map<string, number>((cohort ?? []).map((p: any) => [p.id, new Date(p.created_at).getTime()]));
    const inWindow = (userId: string, createdAt: string) => {
      const start = startByUser.get(userId);
      if (start == null) return false;
      const t = new Date(createdAt).getTime();
      return t >= start && t <= start + windowMs;
    };

    const [{ data: viewRows, error: viewErr }, { data: activityRows, error: actErr }] = await Promise.all([
      (supabaseAdmin as any).from("page_views").select("user_id, path, created_at").in("user_id", cohortIds),
      supabaseAdmin.from("page_activity").select("user_id, path, duration_seconds, created_at").in("user_id", cohortIds),
    ]);
    if (viewErr) throw new Error(viewErr.message);
    if (actErr) throw new Error(actErr.message);

    const firstByUser = new Map<string, { path: string; t: number }>();
    (viewRows ?? []).forEach((r: any) => {
      if (!inWindow(r.user_id, r.created_at)) return;
      const t = new Date(r.created_at).getTime();
      const cur = firstByUser.get(r.user_id);
      if (!cur || t < cur.t) firstByUser.set(r.user_id, { path: r.path, t });
    });
    const firstPageCounts = new Map<string, number>();
    firstByUser.forEach(({ path }) => firstPageCounts.set(path, (firstPageCounts.get(path) ?? 0) + 1));
    const firstPageRanking = Array.from(firstPageCounts.entries())
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count);

    const byPath = new Map<string, { users: Set<string>; totalSeconds: number }>();
    (activityRows ?? []).forEach((r: any) => {
      if (!inWindow(r.user_id, r.created_at)) return;
      const entry = byPath.get(r.path) ?? { users: new Set<string>(), totalSeconds: 0 };
      entry.users.add(r.user_id);
      entry.totalSeconds += r.duration_seconds ?? 0;
      byPath.set(r.path, entry);
    });
    const topPagesByTime = Array.from(byPath.entries())
      .map(([path, e]) => ({
        path, uniqueUsers: e.users.size, totalSeconds: e.totalSeconds,
        avgSecondsPerUser: e.users.size > 0 ? Math.round(e.totalSeconds / e.users.size) : 0,
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds);

    return {
      cohortSize: cohortIds.length,
      windowDays: data.windowDays,
      usersWithNoPageViews: cohortIds.filter((id) => !firstByUser.has(id)).length,
      firstPageRanking,
      topPagesByTime,
    };
  });
