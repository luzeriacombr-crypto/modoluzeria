import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";
import type {
  ChecklistItem, MemberGoalProgress, ClientOnboarding, RecurringTemplate, ActivityEntry,
  StatusDurationStat, Status, AppSettings, WeekItem, WorkloadSummary, TimelineEntry,
} from "./types";

/* =========================================================
 * CHECKLIST  (em content_items.checklist jsonb)
 * ======================================================= */

const checklistSchema = z.array(
  z.object({ id: z.string(), text: z.string().max(300), done: z.boolean() })
).max(50);

export const updateChecklist = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; checklist: ChecklistItem[] }) =>
    z.object({ itemId: z.string().uuid(), checklist: checklistSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("content_items")
      .update({ checklist: data.checklist } as any)
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* =========================================================
 * QUALITY (1–5)
 * ======================================================= */

export const rateItem = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; rating: number | null }) =>
    z.object({
      itemId: z.string().uuid(),
      rating: z.number().int().min(1).max(5).nullable(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("content_items")
      .update({ quality_rating: data.rating } as any)
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* =========================================================
 * MEMBER GOALS
 * ======================================================= */

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthKey: string }) =>
    z.object({ monthKey: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const db: any = context.supabase;
    const { data: rows } = await db
      .from("member_goals")
      .select("user_id, month_key, posts_goal, reels_goal, stories_goal")
      .eq("month_key", data.monthKey);
    return (rows ?? []).map((r: any) => ({
      userId: r.user_id, monthKey: r.month_key,
      postsGoal: r.posts_goal, reelsGoal: r.reels_goal, storiesGoal: r.stories_goal,
    }));
  });

export const setGoals = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    userId: string; monthKey: string;
    postsGoal: number; reelsGoal: number; storiesGoal: number;
  }) => z.object({
    userId: z.string().uuid(),
    monthKey: z.string().regex(/^\d{4}-\d{2}$/),
    postsGoal: z.number().int().min(0).max(9999),
    reelsGoal: z.number().int().min(0).max(9999),
    storiesGoal: z.number().int().min(0).max(9999),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const db: any = context.supabase;
    const { error } = await db.from("member_goals").upsert({
      user_id: data.userId, month_key: data.monthKey,
      posts_goal: data.postsGoal, reels_goal: data.reelsGoal, stories_goal: data.storiesGoal,
    }, { onConflict: "user_id,month_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getGoalProgress = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId?: string; monthKey: string }) =>
    z.object({
      userId: z.string().uuid().optional(),
      monthKey: z.string().regex(/^\d{4}-\d{2}$/),
    }).parse(d))
  .handler(async ({ data, context }): Promise<MemberGoalProgress> => {
    let targetUser = context.userId;
    if (data.userId && data.userId !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) throw new Error("Forbidden");
      targetUser = data.userId;
    }
    const db: any = context.supabase;
    const { data: goalRow } = await db
      .from("member_goals")
      .select("posts_goal, reels_goal, stories_goal")
      .eq("user_id", targetUser).eq("month_key", data.monthKey).maybeSingle();

    const [y, m] = data.monthKey.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
    const end = new Date(Date.UTC(y, m, 1)).toISOString();

    // finalized assigned items in this month
    const { data: assigns } = await context.supabase
      .from("item_assignees").select("item_id").eq("user_id", targetUser);
    const ids = (assigns ?? []).map((a) => a.item_id);
    let postsDone = 0, reelsDone = 0;
    if (ids.length) {
      const { data: done } = await context.supabase
        .from("content_items").select("type")
        .in("id", ids).eq("status", "FINALIZADO")
        .gte("updated_at", start).lt("updated_at", end);
      (done ?? []).forEach((it: any) => {
        if (it.type === "post") postsDone++;
        if (it.type === "reel") reelsDone++;
      });
    }

    // stories: dias publicados pelo usuário no mês
    let storiesDone = 0;
    const { data: storyRows } = await context.supabase
      .from("stories_schedule")
      .select("user_id, day")
      .eq("user_id", targetUser)
      .gte("day", `${data.monthKey}-01`)
      .lt("day", `${data.monthKey}-31T23:59:59`);
    storiesDone = (storyRows ?? []).length;

    return {
      userId: targetUser, monthKey: data.monthKey,
      postsGoal: goalRow?.posts_goal ?? 0,
      reelsGoal: goalRow?.reels_goal ?? 0,
      storiesGoal: goalRow?.stories_goal ?? 0,
      postsDone, reelsDone, storiesDone,
    };
  });

/* =========================================================
 * CLIENT ONBOARDING
 * ======================================================= */

export const getClientOnboarding = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ClientOnboarding | null> => {
    const db: any = context.supabase;
    let { data: row } = await db
      .from("client_onboarding")
      .select("id, client_id, checklist, completed_at")
      .eq("client_id", data.clientId).maybeSingle();
    if (!row) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) return null;
      const { data: inserted } = await db.from("client_onboarding")
        .insert({ client_id: data.clientId })
        .select("id, client_id, checklist, completed_at").single();
      row = inserted;
    }
    if (!row) return null;
    return {
      id: row.id, clientId: row.client_id,
      checklist: row.checklist ?? [],
      completedAt: row.completed_at,
    };
  });

export const updateClientOnboarding = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; checklist: ChecklistItem[] }) =>
    z.object({ clientId: z.string().uuid(), checklist: checklistSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const allDone = data.checklist.length > 0 && data.checklist.every((c) => c.done);
    const db: any = context.supabase;
    const { error } = await db
      .from("client_onboarding")
      .upsert({
        client_id: data.clientId,
        checklist: data.checklist,
        completed_at: allDone ? new Date().toISOString() : null,
      }, { onConflict: "client_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* =========================================================
 * RECURRING TEMPLATES
 * ======================================================= */

export const listRecurring = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<RecurringTemplate[]> => {
    const db: any = context.supabase;
    const { data: rows } = await db
      .from("recurring_templates")
      .select("id, client_id, type, title, cadence, day_of_week, day_of_month, default_assignees, active, last_generated_at")
      .eq("client_id", data.clientId)
      .order("created_at");
    return (rows ?? []).map((r: any) => ({
      id: r.id, clientId: r.client_id, type: r.type, title: r.title,
      cadence: r.cadence, dayOfWeek: r.day_of_week, dayOfMonth: r.day_of_month,
      defaultAssignees: r.default_assignees ?? [], active: r.active,
      lastGeneratedAt: r.last_generated_at,
    }));
  });

export const upsertRecurring = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    id?: string; clientId: string; type: "post" | "reel" | "outros";
    title: string; cadence: "weekly" | "monthly";
    dayOfWeek?: number | null; dayOfMonth?: number | null;
    defaultAssignees?: string[]; active?: boolean;
  }) => z.object({
    id: z.string().uuid().optional(),
    clientId: z.string().uuid(),
    type: z.enum(["post", "reel", "outros"]),
    title: z.string().trim().min(1).max(200),
    cadence: z.enum(["weekly", "monthly"]),
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    defaultAssignees: z.array(z.string().uuid()).max(20).optional(),
    active: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;
    const payload: any = {
      type: data.type, title: data.title, cadence: data.cadence,
      day_of_week: data.cadence === "weekly" ? (data.dayOfWeek ?? 1) : null,
      day_of_month: data.cadence === "monthly" ? (data.dayOfMonth ?? 1) : null,
      default_assignees: data.defaultAssignees ?? [],
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await db.from("recurring_templates").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      payload.client_id = data.clientId;
      const { error } = await db.from("recurring_templates").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteRecurring = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("recurring_templates" as any).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Gera os itens recorrentes dos próximos N dias para este cliente
 * (chamado manualmente pelo admin via botão "Gerar agora").
 */
export const generateRecurring = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; days?: number }) =>
    z.object({
      clientId: z.string().uuid(),
      days: z.number().int().min(1).max(60).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const horizon = data.days ?? 14;
    const db: any = context.supabase;
    const { data: templates } = await db.from("recurring_templates")
      .select("*").eq("client_id", data.clientId).eq("active", true);
    if (!templates?.length) return { generated: 0 };

    const now = new Date();
    const months = new Map<string, string>(); // monthKey -> month_id
    async function getMonthId(monthKey: string) {
      if (months.has(monthKey)) return months.get(monthKey)!;
      const { data: existing } = await context.supabase
        .from("months").select("id").eq("client_id", data.clientId).eq("key", monthKey).maybeSingle();
      if (existing) { months.set(monthKey, existing.id); return existing.id; }
      const { data: m, error } = await context.supabase
        .from("months").insert({ client_id: data.clientId, key: monthKey }).select("id").single();
      if (error) throw new Error(error.message);
      months.set(monthKey, m.id); return m.id;
    }

    let generated = 0;
    for (let d = 0; d < horizon; d++) {
      const dt = new Date(now); dt.setDate(now.getDate() + d);
      const dow = dt.getDay();
      const dom = dt.getDate();
      for (const tpl of templates as any[]) {
        const matches =
          (tpl.cadence === "weekly" && tpl.day_of_week === dow) ||
          (tpl.cadence === "monthly" && tpl.day_of_month === dom);
        if (!matches) continue;
        const lastGen = tpl.last_generated_at ? new Date(tpl.last_generated_at) : null;
        if (lastGen && lastGen.toDateString() === dt.toDateString()) continue;

        const monthKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        const monthId = await getMonthId(monthKey);
        const { data: maxRow } = await context.supabase
          .from("content_items").select("idx").eq("month_id", monthId).eq("type", tpl.type)
          .order("idx", { ascending: false }).limit(1).maybeSingle();
        const nextIdx = ((maxRow as any)?.idx ?? 0) + 1;
        const dueDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        const { data: newItem, error } = await context.supabase
          .from("content_items").insert({
            month_id: monthId, type: tpl.type, idx: nextIdx, title: tpl.title,
            due_date: dueDate,
          } as any).select("id").single();
        if (error) throw new Error(error.message);
        if (tpl.default_assignees?.length) {
          await context.supabase.from("item_assignees").insert(
            tpl.default_assignees.map((uid: string) => ({ item_id: newItem.id, user_id: uid }))
          );
        }
        await db.from("recurring_templates").update({ last_generated_at: dt.toISOString() }).eq("id", tpl.id);
        generated++;
      }
    }
    return { generated };
  });

/* =========================================================
 * ACTIVITY LOG
 * ======================================================= */

export const listActivity = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { entityType?: string; entityId?: string; limit?: number }) =>
    z.object({
      entityType: z.string().max(40).optional(),
      entityId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }).parse(d))
  .handler(async ({ data, context }): Promise<ActivityEntry[]> => {
    let q = context.supabase
      .from("activity_log" as any)
      .select("id, actor_id, entity_type, entity_id, action, meta, at")
      .order("at", { ascending: false })
      .limit(data.limit ?? 50);
    if (data.entityType) q = q.eq("entity_type", data.entityType);
    if (data.entityId) q = q.eq("entity_id", data.entityId);
    const { data: rows } = await q;
    return (rows ?? []).map((r: any) => ({
      id: r.id, actorId: r.actor_id, entityType: r.entity_type,
      entityId: r.entity_id, action: r.action, meta: r.meta ?? {}, at: r.at,
    }));
  });

/* =========================================================
 * REPORT EXTENSIONS (Lead Time, Bloqueios, Tempo por Status, Retrabalho, Qualidade)
 * ======================================================= */

const reportRangeSchema = z.object({
  from: z.string(),
  to: z.string(),
  clientId: z.string().uuid().nullable().optional(),
  userId: z.string().uuid().nullable().optional(),
});

export const getReportExtras = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { from: string; to: string; clientId?: string | null; userId?: string | null }) =>
    reportRangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");

    const fromIso = new Date(data.from).toISOString();
    const toIso = new Date(data.to).toISOString();

    // ---- Build base item id pool (matching filters) ----
    let itemQuery = context.supabase
      .from("content_items")
      .select("id, type, title, status, started_at, finished_at, rework_count, quality_rating, month_id, due_date, months!inner(client_id, clients!inner(name, color, category))")
      .gte("updated_at", fromIso).lt("updated_at", toIso);
    if (data.clientId) itemQuery = itemQuery.eq("months.client_id", data.clientId);
    const { data: items } = await itemQuery;
    let pool = (items ?? []) as any[];

    if (data.userId) {
      const { data: assigns } = await context.supabase
        .from("item_assignees").select("item_id").eq("user_id", data.userId);
      const ids = new Set((assigns ?? []).map((a) => a.item_id));
      pool = pool.filter((it) => ids.has(it.id));
    }

    // ---- Lead time ----
    const leadHours: { id: string; title: string; clientName: string; hours: number }[] = [];
    pool.forEach((it) => {
      if (it.status === "FINALIZADO" && it.started_at && it.finished_at) {
        const h = (new Date(it.finished_at).getTime() - new Date(it.started_at).getTime()) / 3_600_000;
        if (h > 0) leadHours.push({
          id: it.id, title: it.title,
          clientName: it.months?.clients?.name ?? "—",
          hours: Math.round(h * 10) / 10,
        });
      }
    });
    const avgLead = leadHours.length
      ? Math.round((leadHours.reduce((a, b) => a + b.hours, 0) / leadHours.length) * 10) / 10
      : 0;
    const fastest = [...leadHours].sort((a, b) => a.hours - b.hours).slice(0, 5);
    const slowest = [...leadHours].sort((a, b) => b.hours - a.hours).slice(0, 5);

    // ---- Bloqueios ----
    const currentlyBlocked = pool.filter((it) => it.status === "BLOQUEADO")
      .map((it) => ({
        id: it.id, title: it.title,
        clientName: it.months?.clients?.name ?? "—",
        clientColor: it.months?.clients?.color ?? "#888",
      }));

    // ---- Retrabalho ----
    const rework = pool.filter((it) => (it.rework_count ?? 0) > 0)
      .map((it) => ({
        id: it.id, title: it.title, count: it.rework_count,
        clientName: it.months?.clients?.name ?? "—",
        type: it.type,
      }))
      .sort((a, b) => b.count - a.count);
    const reworkRate = pool.length ? Math.round((rework.length / pool.length) * 1000) / 10 : 0;

    // ---- Qualidade ----
    const rated = pool.filter((it) => it.quality_rating != null);
    const qualityAvg = rated.length
      ? Math.round((rated.reduce((a, b) => a + b.quality_rating, 0) / rated.length) * 10) / 10
      : 0;
    const qualityDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rated.forEach((it) => { qualityDist[it.quality_rating] = (qualityDist[it.quality_rating] ?? 0) + 1; });

    // ---- Tempo por status (via status_transitions) ----
    const itemIds = pool.map((it) => it.id);
    let statusDur: StatusDurationStat[] = [];
    if (itemIds.length) {
      const { data: tx } = await context.supabase
        .from("status_transitions" as any)
        .select("from_status, duration_ms")
        .in("item_id", itemIds)
        .not("duration_ms", "is", null);
      const agg = new Map<string, { sum: number; n: number }>();
      ((tx ?? []) as any[]).forEach((t: any) => {
        if (!t.from_status || !t.duration_ms) return;
        const cur = agg.get(t.from_status) ?? { sum: 0, n: 0 };
        cur.sum += Number(t.duration_ms); cur.n++;
        agg.set(t.from_status, cur);
      });
      statusDur = [...agg.entries()]
        .map(([status, { sum, n }]) => ({
          status: status as Status,
          avgHours: Math.round((sum / n / 3_600_000) * 10) / 10,
          count: n,
        }))
        .sort((a, b) => b.avgHours - a.avgHours);
    }

    return {
      leadTime: { avgHours: avgLead, count: leadHours.length, fastest, slowest, all: leadHours },
      blocked: currentlyBlocked,
      rework: { items: rework, ratePercent: reworkRate, total: rework.length },
      quality: { avg: qualityAvg, count: rated.length, distribution: qualityDist },
      statusDuration: statusDur,
    };
  });

/* =========================================================
 * MEMBER STATUS DURATION (para o MemberDetailPanel)
 * ======================================================= */

export const getMemberStatusDuration = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<StatusDurationStat[]> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin && data.userId !== context.userId) throw new Error("Forbidden");

    const { data: assigns } = await context.supabase
      .from("item_assignees").select("item_id").eq("user_id", data.userId);
    const itemIds = (assigns ?? []).map((a) => a.item_id);
    if (!itemIds.length) return [];
    const { data: tx } = await context.supabase
      .from("status_transitions" as any)
      .select("from_status, duration_ms")
      .in("item_id", itemIds)
      .not("duration_ms", "is", null);
    const agg = new Map<string, { sum: number; n: number }>();
    ((tx ?? []) as any[]).forEach((t: any) => {
      if (!t.from_status || !t.duration_ms) return;
      const cur = agg.get(t.from_status) ?? { sum: 0, n: 0 };
      cur.sum += Number(t.duration_ms); cur.n++;
      agg.set(t.from_status, cur);
    });
    return [...agg.entries()]
      .map(([status, { sum, n }]) => ({
        status: status as Status,
        avgHours: Math.round((sum / n / 3_600_000) * 10) / 10,
        count: n,
      }))
      .sort((a, b) => b.avgHours - a.avgHours);
  });

/* =========================================================
 * APP SETTINGS
 * ======================================================= */

export const getAppSettings = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<AppSettings> => {
    const db: any = context.supabase;
    const { data: rows } = await db.from("app_settings").select("key, value");
    const map = new Map<string, any>();
    (rows ?? []).forEach((r: any) => map.set(r.key, r.value));
    return {
      requireRatingOnFinalize: map.get("require_rating_on_finalize")?.enabled !== false,
    };
  });

export const updateAppSettings = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { requireRatingOnFinalize?: boolean }) =>
    z.object({ requireRatingOnFinalize: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const db: any = context.supabase;
    if (data.requireRatingOnFinalize !== undefined) {
      const { error } = await db.from("app_settings").upsert({
        key: "require_rating_on_finalize",
        value: { enabled: data.requireRatingOnFinalize },
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      }, { onConflict: "key" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/* =========================================================
 * MY WEEK
 * ======================================================= */

export const getMyWeek = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId?: string; from: string; to: string }) =>
    z.object({
      userId: z.string().uuid().optional(),
      from: z.string(), to: z.string(),
    }).parse(d))
  .handler(async ({ data, context }): Promise<WeekItem[]> => {
    let targetUser = context.userId;
    if (data.userId && data.userId !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) throw new Error("Forbidden");
      targetUser = data.userId;
    }
    const { data: assigns } = await context.supabase
      .from("item_assignees").select("item_id").eq("user_id", targetUser);
    const ids = (assigns ?? []).map((a) => a.item_id);
    if (!ids.length) return [];
    const { data: items } = await context.supabase
      .from("content_items")
      .select("id, type, idx, title, status, due_date, months!inner(key, clients!inner(id, name, color))")
      .in("id", ids)
      .neq("status", "FINALIZADO");
    return ((items ?? []) as any[]).map((it) => ({
      id: it.id, type: it.type, idx: it.idx, title: it.title, status: it.status,
      clientId: it.months.clients.id,
      clientName: it.months.clients.name,
      clientColor: it.months.clients.color,
      monthKey: it.months.key,
      dueDate: it.due_date,
    }));
  });

/* =========================================================
 * WORKLOAD (carga de trabalho — itens em aberto)
 * ======================================================= */

export const getWorkload = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<WorkloadSummary> => {
    const { data: assigns } = await context.supabase
      .from("item_assignees").select("item_id").eq("user_id", data.userId);
    const ids = (assigns ?? []).map((a) => a.item_id);
    if (!ids.length) return { userId: data.userId, openCount: 0, oldest: [] };
    const { data: items } = await context.supabase
      .from("content_items")
      .select("id, title, updated_at, last_status_change_at, months!inner(clients!inner(name))")
      .in("id", ids)
      .neq("status", "FINALIZADO");
    const arr = ((items ?? []) as any[]).map((it) => {
      const ref = it.last_status_change_at ?? it.updated_at;
      const days = Math.max(0, Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000));
      return { id: it.id, title: it.title, clientName: it.months?.clients?.name ?? "—", daysOpen: days };
    }).sort((a, b) => b.daysOpen - a.daysOpen);
    return { userId: data.userId, openCount: arr.length, oldest: arr.slice(0, 3) };
  });

/* =========================================================
 * ITEM TIMELINE (history)
 * ======================================================= */

export const getItemTimeline = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string }) =>
    z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<TimelineEntry[]> => {
    const db: any = context.supabase;
    const [{ data: acts }, { data: txs }] = await Promise.all([
      db.from("activity_log").select("id, actor_id, action, meta, at")
        .eq("entity_type", "content_item").eq("entity_id", data.itemId)
        .order("at", { ascending: false }).limit(200),
      db.from("status_transitions").select("id, from_status, to_status, actor_id, at")
        .eq("item_id", data.itemId).order("at", { ascending: false }).limit(200),
    ]);
    const entries: TimelineEntry[] = [];
    ((acts ?? []) as any[]).forEach((a) => {
      let kind: TimelineEntry["kind"] = "system";
      let text = a.action;
      if (a.action === "created") { kind = "created"; text = "criou o item"; }
      else if (a.action === "due_date_changed") {
        kind = "due";
        text = `prazo alterado: ${a.meta?.from ?? "—"} → ${a.meta?.to ?? "—"}`;
      } else if (a.action === "rated") {
        kind = "rated";
        text = `avaliou a entrega: ${a.meta?.rating}/5 estrelas`;
      }
      entries.push({ id: a.id, at: a.at, actorId: a.actor_id, kind, text, meta: a.meta });
    });
    ((txs ?? []) as any[]).forEach((t) => {
      entries.push({
        id: t.id, at: t.at, actorId: t.actor_id,
        kind: "status",
        text: `mudou status: ${t.from_status ?? "—"} → ${t.to_status}`,
      });
    });
    entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return entries.slice(0, 80);
  });

/* =========================================================
 * COMMENT WITH MENTIONS
 * ======================================================= */

export const addCommentWithMentions = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; text: string; mentionedUserIds?: string[] }) =>
    z.object({
      itemId: z.string().uuid(),
      text: z.string().trim().min(1).max(2000),
      mentionedUserIds: z.array(z.string().uuid()).max(20).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: inserted, error } = await context.supabase.from("comments")
      .insert({ item_id: data.itemId, author_id: context.userId, text: data.text, is_system: false })
      .select("id").single();
    if (error) throw new Error(error.message);
    const mentions = (data.mentionedUserIds ?? []).filter((u) => u !== context.userId);
    if (mentions.length) {
      const db: any = context.supabase;
      await db.from("mentions").insert(
        mentions.map((uid) => ({
          comment_id: inserted.id, mentioned_user_id: uid, item_id: data.itemId,
        }))
      );
    }
    return { ok: true };
  });