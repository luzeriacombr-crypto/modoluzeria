// House (Fase 2) — "Meu dia", checklists recorrentes e leads do Instagram.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import {
  houseDateKey, isoWeekday, weekStartKey, checklistPeriodKey, checklistAppliesToday, checklistIsLate,
  LEAD_ORIGINS, LEAD_STATUSES, type ChecklistCadence, type LeadOrigin, type LeadStatus,
} from "./house-checklists";

const IG_GRAPH_API = "https://graph.instagram.com/v21.0";

async function assertHouse(context: { supabase: any; orgId: string }) {
  const { data } = await context.supabase.from("orgs").select("account_type, house_client_id").eq("id", context.orgId).maybeSingle();
  if (data?.account_type !== "house") throw new Error("Disponível só em contas House.");
  return { houseClientId: (data.house_client_id ?? null) as string | null };
}

async function isAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  return !!data;
}

/** Início de um dia "YYYY-MM-DD" em Brasília, como instante UTC. Brasília
 * não tem horário de verão desde 2019 — UTC-3 fixo. */
function spDayStartUtc(dateKey: string): Date {
  return new Date(`${dateKey}T03:00:00.000Z`);
}

/* ============== Checklists ============== */

export type ChecklistItem = {
  id: string;
  title: string;
  description: string | null;
  cadence: ChecklistCadence;
  dueWeekday: number;
  dueDay: number;
  responsibleId: string | null;
  sortOrder: number;
  active: boolean;
};

function mapItem(r: any): ChecklistItem {
  return {
    id: r.id, title: r.title, description: r.description ?? null, cadence: r.cadence,
    dueWeekday: r.due_weekday, dueDay: r.due_day, responsibleId: r.responsible_id ?? null,
    sortOrder: r.sort_order, active: r.active,
  };
}

export const listChecklistItems = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<ChecklistItem[]> => {
    const { data, error } = await (context.supabase as any).from("house_checklist_items")
      .select("*").eq("org_id", context.orgId).order("sort_order").order("created_at");
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapItem);
  });

export const upsertChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    id?: string; title: string; description?: string | null; cadence: ChecklistCadence;
    dueWeekday?: number; dueDay?: number; responsibleId?: string | null; active?: boolean;
  }) =>
    z.object({
      id: z.string().uuid().optional(),
      title: z.string().trim().min(1).max(200),
      description: z.string().trim().max(2000).nullable().optional(),
      cadence: z.enum(["daily", "weekly", "monthly"]),
      dueWeekday: z.number().int().min(1).max(7).optional(),
      dueDay: z.number().int().min(1).max(31).optional(),
      responsibleId: z.string().uuid().nullable().optional(),
      active: z.boolean().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertHouse(context);
    if (!(await isAdmin(context))) throw new Error("Só o gestor pode editar os checklists.");
    const db: any = context.supabase;
    const row: Record<string, unknown> = {
      title: data.title, description: data.description || null, cadence: data.cadence,
      due_weekday: data.dueWeekday ?? 5, due_day: data.dueDay ?? 31,
      responsible_id: data.responsibleId ?? null,
    };
    if (data.active !== undefined) row.active = data.active;
    if (data.id) {
      const { error } = await db.from("house_checklist_items").update(row).eq("id", data.id).eq("org_id", context.orgId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: maxRow } = await db.from("house_checklist_items").select("sort_order")
      .eq("org_id", context.orgId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data: created, error } = await db.from("house_checklist_items").insert({
      ...row, org_id: context.orgId, created_by: context.userId, sort_order: (maxRow?.sort_order ?? -1) + 1,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const deleteChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Só o gestor pode editar os checklists.");
    const { error } = await (context.supabase as any).from("house_checklist_items").delete().eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Marca/desmarca o item no período atual (hoje / esta semana / este mês). */
export const setChecklistDone = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; done: boolean }) =>
    z.object({ itemId: z.string().uuid(), done: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db: any = context.supabase;
    const { data: item } = await db.from("house_checklist_items").select("id, cadence").eq("id", data.itemId).eq("org_id", context.orgId).maybeSingle();
    if (!item) throw new Error("Item não encontrado.");
    const periodKey = checklistPeriodKey(item.cadence, houseDateKey());
    if (data.done) {
      const { error } = await db.from("house_checklist_completions").upsert(
        { org_id: context.orgId, item_id: item.id, period_key: periodKey, done_by: context.userId },
        { onConflict: "item_id,period_key", ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db.from("house_checklist_completions").delete().eq("item_id", item.id).eq("period_key", periodKey);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Histórico dos últimos N dias: cada conclusão e cada aviso de atraso. */
export const getChecklistHistory = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { days?: number }) => z.object({ days: z.number().int().min(1).max(120).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - (data.days ?? 30) * 86_400_000).toISOString();
    const db: any = context.supabase;
    const [{ data: done }, { data: missed }] = await Promise.all([
      db.from("house_checklist_completions").select("item_id, period_key, done_by, done_at")
        .eq("org_id", context.orgId).gte("done_at", since).order("done_at", { ascending: false }),
      db.from("house_checklist_alerts").select("item_id, period_key, created_at")
        .eq("org_id", context.orgId).gte("created_at", since).order("created_at", { ascending: false }),
    ]);
    return {
      completions: ((done ?? []) as any[]).map((r) => ({ itemId: r.item_id as string, periodKey: r.period_key as string, doneBy: r.done_by as string | null, doneAt: r.done_at as string })),
      missed: ((missed ?? []) as any[]).map((r) => ({ itemId: r.item_id as string, periodKey: r.period_key as string, at: r.created_at as string })),
    };
  });

/* ============== Meu dia ============== */

type GoalCount = { done: number; goal: number; source: "instagram" | "app" };

async function countFromInstagram(clientId: string, todayKey: string): Promise<{ storiesToday: number; postsWeek: number } | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: creds } = await (supabaseAdmin as any).from("client_instagram_credentials")
      .select("instagram_business_account_id, access_token").eq("client_id", clientId).maybeSingle();
    if (!creds?.access_token) return null;
    const acct = creds.instagram_business_account_id;
    const tok = encodeURIComponent(creds.access_token);
    const [storiesRes, mediaRes] = await Promise.all([
      fetch(`${IG_GRAPH_API}/${acct}/stories?fields=id,timestamp&access_token=${tok}`),
      fetch(`${IG_GRAPH_API}/${acct}/media?fields=id,timestamp,media_product_type&limit=30&access_token=${tok}`),
    ]);
    if (!storiesRes.ok || !mediaRes.ok) return null;
    const stories: any = await storiesRes.json();
    const media: any = await mediaRes.json();
    const dayStart = spDayStartUtc(todayKey).getTime();
    const weekStart = spDayStartUtc(weekStartKey(todayKey)).getTime();
    return {
      storiesToday: (stories.data ?? []).filter((s: any) => new Date(s.timestamp).getTime() >= dayStart).length,
      postsWeek: (media.data ?? []).filter((m: any) => m.media_product_type !== "STORY" && new Date(m.timestamp).getTime() >= weekStart).length,
    };
  } catch {
    return null;
  }
}

async function countFromApp(supabase: any, orgId: string, todayKey: string) {
  const dayStart = spDayStartUtc(todayKey).toISOString();
  const weekStart = spDayStartUtc(weekStartKey(todayKey)).toISOString();
  const [{ count: stories }, { count: posts }] = await Promise.all([
    supabase.from("content_items").select("id", { count: "exact", head: true })
      .eq("org_id", orgId).eq("type", "story").gte("ig_published_at", dayStart).is("deleted_at", null),
    supabase.from("content_items").select("id", { count: "exact", head: true })
      .eq("org_id", orgId).in("type", ["post", "reel"]).gte("ig_published_at", weekStart).is("deleted_at", null),
  ]);
  return { storiesToday: stories ?? 0, postsWeek: posts ?? 0 };
}

function nextMonthKey(todayKey: string) {
  const [y, m] = todayKey.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

export type MyDay = {
  todayKey: string;
  isWorkday: boolean;
  checklist: (ChecklistItem & { done: boolean; late: boolean; mine: boolean })[];
  stories: GoalCount;
  posts: GoalCount;
  planning: { monthKey: string; deadlineDay: number; delivered: boolean; daysLeft: number };
  upcoming: { id: string; title: string; type: string; status: string; dueDate: string; clientId: string; clientName: string; monthKey: string; mine: boolean; assigneeIds: string[] }[];
};

export const getMyDay = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<MyDay> => {
    const { houseClientId } = await assertHouse(context);
    const db: any = context.supabase;
    const todayKey = houseDateKey();
    const admin = await isAdmin(context);

    const { data: settings } = await db.from("house_settings")
      .select("stories_per_workday, feed_posts_per_week, planning_deadline_day").eq("org_id", context.orgId).maybeSingle();
    const storiesGoal = settings?.stories_per_workday ?? 0;
    const postsGoal = settings?.feed_posts_per_week ?? 0;
    const deadlineDay = settings?.planning_deadline_day ?? 25;

    // Checklist do período atual.
    const { data: itemRows } = await db.from("house_checklist_items").select("*")
      .eq("org_id", context.orgId).eq("active", true).order("sort_order");
    const items = ((itemRows ?? []) as any[]).map(mapItem)
      .filter((i) => checklistAppliesToday(i.cadence, todayKey))
      // Gestor vê tudo; a equipe vê o que é dela e o que não tem dono.
      .filter((i) => admin || !i.responsibleId || i.responsibleId === context.userId);
    const periodKeys = [...new Set(items.map((i) => checklistPeriodKey(i.cadence, todayKey)))];
    const { data: doneRows } = periodKeys.length && items.length
      ? await db.from("house_checklist_completions").select("item_id, period_key")
        .in("item_id", items.map((i) => i.id)).in("period_key", periodKeys)
      : { data: [] };
    const doneSet = new Set(((doneRows ?? []) as any[]).map((r) => `${r.item_id}:${r.period_key}`));
    const checklist = items.map((i) => {
      const done = doneSet.has(`${i.id}:${checklistPeriodKey(i.cadence, todayKey)}`);
      return { ...i, done, late: !done && checklistIsLate(i, todayKey), mine: i.responsibleId === context.userId };
    });

    // Metas: Instagram de verdade quando conectado; senão, o que saiu pelo app.
    const ig = houseClientId ? await countFromInstagram(houseClientId, todayKey) : null;
    const counts = ig ?? await countFromApp(db, context.orgId, todayKey);
    const source = ig ? "instagram" : "app";

    // Planejamento do mês seguinte: entregue se já existe planejamento/roteiro
    // pra ele (target_month_key), ou um planejamento escrito neste mês.
    const nextKey = nextMonthKey(todayKey);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const monthStart = spDayStartUtc(`${todayKey.slice(0, 7)}-01`).toISOString();
    const { count: planDocs } = await (supabaseAdmin as any).from("client_docs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", context.orgId)
      .or(`target_month_key.eq.${nextKey},and(type.eq.planejamento,created_at.gte.${monthStart})`);
    const today = Number(todayKey.slice(8, 10));

    // Próximos conteúdos com prazo (atrasados primeiro).
    const { data: itemsRows } = await db.from("content_items")
      .select("id, title, type, status, due_date, months!inner(key, client_id, clients!inner(name)), item_assignees(user_id)")
      .eq("org_id", context.orgId).is("deleted_at", null).not("due_date", "is", null)
      .not("status", "in", "(FINALIZADO,CONCLUIDO)")
      .order("due_date", { ascending: true }).limit(40);
    const upcoming = ((itemsRows ?? []) as any[]).map((r) => {
      const assigneeIds = ((r.item_assignees ?? []) as any[]).map((a) => a.user_id as string);
      return {
        id: r.id, title: r.title, type: r.type, status: r.status, dueDate: r.due_date,
        clientId: r.months.client_id, clientName: r.months.clients?.name ?? "", monthKey: r.months.key,
        mine: assigneeIds.includes(context.userId), assigneeIds,
      };
    })
      // Os meus primeiro, depois o resto — sempre por prazo.
      .sort((a, b) => Number(b.mine) - Number(a.mine) || a.dueDate.localeCompare(b.dueDate))
      .slice(0, 12);

    return {
      todayKey,
      isWorkday: isoWeekday(todayKey) <= 5,
      checklist,
      stories: { done: counts.storiesToday, goal: storiesGoal, source },
      posts: { done: counts.postsWeek, goal: postsGoal, source },
      planning: { monthKey: nextKey, deadlineDay, delivered: (planDocs ?? 0) > 0, daysLeft: deadlineDay - today },
      upcoming,
    };
  });

/* ============== Leads do Instagram ============== */

export type InstagramLead = {
  id: string; name: string; origin: LeadOrigin; note: string | null; status: LeadStatus;
  createdBy: string | null; createdAt: string; statusChangedAt: string;
};

function mapLead(r: any): InstagramLead {
  return {
    id: r.id, name: r.name, origin: r.origin, note: r.note ?? null, status: r.status,
    createdBy: r.created_by ?? null, createdAt: r.created_at, statusChangedAt: r.status_changed_at,
  };
}

export const createInstagramLead = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name: string; origin: LeadOrigin; note?: string }) =>
    z.object({
      name: z.string().trim().min(1).max(120),
      origin: z.enum(LEAD_ORIGINS),
      note: z.string().trim().max(1000).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { houseClientId } = await assertHouse(context);
    const { data: row, error } = await (context.supabase as any).from("instagram_leads").insert({
      org_id: context.orgId, client_id: houseClientId, name: data.name, origin: data.origin,
      note: data.note || null, created_by: context.userId,
    }).select("*").single();
    if (error) throw new Error(error.message);
    return mapLead(row);
  });

export const listInstagramLeads = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { from?: string; origin?: LeadOrigin }) =>
    z.object({ from: z.string().datetime().optional(), origin: z.enum(LEAD_ORIGINS).optional() }).parse(d))
  .handler(async ({ data, context }): Promise<InstagramLead[]> => {
    let q = (context.supabase as any).from("instagram_leads").select("*")
      .eq("org_id", context.orgId).order("created_at", { ascending: false }).limit(500);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.origin) q = q.eq("origin", data.origin);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map(mapLead);
  });

export const updateInstagramLead = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; status?: LeadStatus; name?: string; origin?: LeadOrigin; note?: string | null }) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(LEAD_STATUSES).optional(),
      name: z.string().trim().min(1).max(120).optional(),
      origin: z.enum(LEAD_ORIGINS).optional(),
      note: z.string().trim().max(1000).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.status) patch.status = data.status;
    if (data.name) patch.name = data.name;
    if (data.origin) patch.origin = data.origin;
    if (data.note !== undefined) patch.note = data.note || null;
    const { error } = await (context.supabase as any).from("instagram_leads").update(patch).eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteInstagramLead = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error, count } = await (context.supabase as any).from("instagram_leads")
      .delete({ count: "exact" }).eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    if (!count) throw new Error("Só quem lançou o lead (ou o gestor) pode apagar.");
    return { ok: true };
  });

