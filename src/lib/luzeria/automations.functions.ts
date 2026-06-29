import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

export type NotificationPreferences = {
  dailyDigest: boolean;
  deadlineAlerts: boolean;
  digestHour: number;
};

const DEFAULTS: NotificationPreferences = {
  dailyDigest: true,
  deadlineAlerts: true,
  digestHour: 8,
};

export const getMyNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<NotificationPreferences> => {
    const { data, error } = await context.supabase
      .from("notification_preferences" as any)
      .select("daily_digest, deadline_alerts, digest_hour")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return DEFAULTS;
    const row = data as any;
    return {
      dailyDigest: row.daily_digest ?? true,
      deadlineAlerts: row.deadline_alerts ?? true,
      digestHour: row.digest_hour ?? 8,
    };
  });

export const setMyNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: Partial<NotificationPreferences>) =>
    z.object({
      dailyDigest: z.boolean().optional(),
      deadlineAlerts: z.boolean().optional(),
      digestHour: z.number().int().min(0).max(23).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const payload: Record<string, any> = { user_id: context.userId };
    if (data.dailyDigest !== undefined) payload.daily_digest = data.dailyDigest;
    if (data.deadlineAlerts !== undefined) payload.deadline_alerts = data.deadlineAlerts;
    if (data.digestHour !== undefined) payload.digest_hour = data.digestHour;
    const { error } = await context.supabase
      .from("notification_preferences" as any)
      .upsert(payload, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function ensureMaster(context: any) {
  const { data } = await context.supabase.rpc("is_master", { _user_id: context.userId });
  if (!data) throw new Error("Forbidden");
}

export const runDailyDigestNow = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    await ensureMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("send_daily_digest" as any);
    if (error) throw new Error(error.message);
    return { ok: true, sent: data ?? 0 };
  });

export const runDeadlineRemindersNow = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    await ensureMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("send_deadline_reminders" as any);
    if (error) throw new Error(error.message);
    return { ok: true, sent: data ?? 0 };
  });

export type CronJobInfo = {
  jobname: string;
  schedule: string;
  active: boolean;
  lastStart: string | null;
  lastStatus: string | null;
};

export const listCronJobs = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<CronJobInfo[]> => {
    await ensureMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Use direct SQL via the rpc helper isn't possible without a wrapper; use a read-only system view through PostgREST.
    // pg_cron tables aren't exposed via Data API by default — so go through a SECURITY DEFINER function.
    const { data, error } = await supabaseAdmin
      .from("v_luzeria_cron_jobs" as any)
      .select("*");
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      jobname: r.jobname,
      schedule: r.schedule,
      active: r.active,
      lastStart: r.last_start ? new Date(r.last_start).toISOString() : null,
      lastStatus: r.last_status,
    }));
  });