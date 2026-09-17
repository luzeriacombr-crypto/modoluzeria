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
