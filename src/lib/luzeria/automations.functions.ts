import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

export type NotificationPreferences = {
  dailyDigest: boolean;
  deadlineAlerts: boolean;
  digestHour: number;
  pushAssigned: boolean;
  pushStatus: boolean;
  pushComment: boolean;
  pushMention: boolean;
  pushClientFeedback: boolean;
  pushBugReport: boolean;
};

const DEFAULTS: NotificationPreferences = {
  dailyDigest: true,
  deadlineAlerts: true,
  digestHour: 8,
  pushAssigned: true,
  pushStatus: true,
  pushComment: true,
  pushMention: true,
  pushClientFeedback: true,
  pushBugReport: true,
};

export const getMyNotificationPreferences = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<NotificationPreferences> => {
    const { data, error } = await context.supabase
      .from("notification_preferences" as any)
      .select("daily_digest, deadline_alerts, digest_hour, push_assigned, push_status, push_comment, push_mention, push_client_feedback, push_bug_report")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return DEFAULTS;
    const row = data as any;
    return {
      dailyDigest: row.daily_digest ?? true,
      deadlineAlerts: row.deadline_alerts ?? true,
      digestHour: row.digest_hour ?? 8,
      pushAssigned: row.push_assigned ?? true,
      pushStatus: row.push_status ?? true,
      pushComment: row.push_comment ?? true,
      pushMention: row.push_mention ?? true,
      pushClientFeedback: row.push_client_feedback ?? true,
      pushBugReport: row.push_bug_report ?? true,
    };
  });

export const setMyNotificationPreferences = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: Partial<NotificationPreferences>) =>
    z.object({
      dailyDigest: z.boolean().optional(),
      deadlineAlerts: z.boolean().optional(),
      digestHour: z.number().int().min(0).max(23).optional(),
      pushAssigned: z.boolean().optional(),
      pushStatus: z.boolean().optional(),
      pushComment: z.boolean().optional(),
      pushMention: z.boolean().optional(),
      pushClientFeedback: z.boolean().optional(),
      pushBugReport: z.boolean().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const payload: Record<string, any> = { user_id: context.userId };
    if (data.dailyDigest !== undefined) payload.daily_digest = data.dailyDigest;
    if (data.deadlineAlerts !== undefined) payload.deadline_alerts = data.deadlineAlerts;
    if (data.digestHour !== undefined) payload.digest_hour = data.digestHour;
    if (data.pushAssigned !== undefined) payload.push_assigned = data.pushAssigned;
    if (data.pushStatus !== undefined) payload.push_status = data.pushStatus;
    if (data.pushComment !== undefined) payload.push_comment = data.pushComment;
    if (data.pushMention !== undefined) payload.push_mention = data.pushMention;
    if (data.pushClientFeedback !== undefined) payload.push_client_feedback = data.pushClientFeedback;
    if (data.pushBugReport !== undefined) payload.push_bug_report = data.pushBugReport;
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
    const { data, error } = await context.supabase.rpc("send_daily_digest" as any);
    if (error) throw new Error(error.message);
    return { ok: true, sent: data ?? 0 };
  });

export const runDeadlineRemindersNow = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    await ensureMaster(context);
    const { data, error } = await context.supabase.rpc("send_deadline_reminders" as any);
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
    const { data, error } = await context.supabase.rpc("luzeria_admin_list_cron_jobs" as any);
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      jobname: r.jobname,
      schedule: r.schedule,
      active: r.active,
      lastStart: r.last_start ? new Date(r.last_start).toISOString() : null,
      lastStatus: r.last_status,
    }));
  });
