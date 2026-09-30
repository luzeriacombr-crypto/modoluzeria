// House — demandas avulsas, registro manual do que foi postado e ranking
// da equipe (quem fez o quê no mês).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { houseDateKey } from "./house-checklists";
import { DEMAND_KINDS, shiftMonth, type DemandKind } from "./house-projects";

const spStart = (dateKey: string) => new Date(`${dateKey}T03:00:00.000Z`).toISOString();

async function houseInfo(context: { supabase: any; orgId: string }) {
  const { data } = await context.supabase.from("orgs").select("account_type, house_client_id").eq("id", context.orgId).maybeSingle();
  if (data?.account_type !== "house") throw new Error("Disponível só em contas House.");
  if (!data.house_client_id) throw new Error("A House ainda não tem marca principal.");
  return { houseClientId: data.house_client_id as string };
}

/* ============== Demandas avulsas ============== */

export type Demand = {
  id: string; kind: DemandKind; title: string; briefing: string; status: string;
  dueDate: string | null; assigneeIds: string[]; clientId: string; monthKey: string; createdAt: string | null; finishedAt: string | null;
};

export const listDemands = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<Demand[]> => {
    const { data, error } = await (context.supabase as any).from("content_items")
      .select("id, demand_kind, title, copy, status, due_date, finished_at, updated_at, months!inner(key, client_id), item_assignees(user_id)")
      .eq("org_id", context.orgId).not("demand_kind", "is", null).is("deleted_at", null)
      .order("due_date", { ascending: true, nullsFirst: false }).limit(300);
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id, kind: r.demand_kind, title: r.title, briefing: r.copy ?? "", status: r.status,
      dueDate: r.due_date ?? null, assigneeIds: ((r.item_assignees ?? []) as any[]).map((a) => a.user_id),
      clientId: r.months.client_id, monthKey: r.months.key, createdAt: r.updated_at ?? null, finishedAt: r.finished_at ?? null,
    }));
  });

/** Cria a demanda como item do fluxo (tipo "outros") no mês do prazo, na
 * marca principal. Service role porque criar item no board é só de admin
 * na RLS de agência — numa House a equipe toda abre demandas. */
export const createDemand = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { kind: DemandKind; title: string; briefing?: string; dueDate?: string | null; responsibleId?: string | null }) =>
    z.object({
      kind: z.enum(DEMAND_KINDS),
      title: z.string().trim().min(1).max(200),
      briefing: z.string().trim().max(4000).optional(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      responsibleId: z.string().uuid().nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { houseClientId } = await houseInfo(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db: any = supabaseAdmin;
    const responsibleId = data.responsibleId ?? context.userId;
    const { data: resp } = await db.from("profiles").select("org_id").eq("id", responsibleId).maybeSingle();
    if (resp?.org_id !== context.orgId) throw new Error("Responsável inválido.");

    const key = (data.dueDate ?? houseDateKey()).slice(0, 7);
    let { data: month } = await db.from("months").select("id").eq("client_id", houseClientId).eq("key", key).maybeSingle();
    if (!month) {
      const { data: m, error } = await db.from("months").insert({ client_id: houseClientId, key, org_id: context.orgId }).select("id").single();
      if (error) throw new Error(error.message);
      month = m;
    }
    const { data: maxRow } = await db.from("content_items").select("idx").eq("month_id", month.id).eq("type", "outros")
      .order("idx", { ascending: false }).limit(1).maybeSingle();
    const { data: item, error } = await db.from("content_items").insert({
      month_id: month.id, type: "outros", idx: (maxRow?.idx ?? 0) + 1, title: data.title,
      status: "PENDENTE", copy: data.briefing || "", due_date: data.dueDate ?? null, demand_kind: data.kind,
    }).select("id").single();
    if (error) throw new Error(error.message);
    await db.from("item_assignees").insert({ item_id: item.id, user_id: responsibleId });
    return { id: item.id as string, clientId: houseClientId, monthKey: key };
  });

/* ============== Registro manual (story/post/reels) ============== */

const KINDS = ["story", "post", "reel"] as const;
type LogKind = (typeof KINDS)[number];

export const logActivity = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { kind: LogKind; qty?: number }) => z.object({ kind: z.enum(KINDS), qty: z.number().int().min(1).max(50).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await houseInfo(context);
    const { error } = await (context.supabase as any).from("house_activity_logs").insert({
      org_id: context.orgId, user_id: context.userId, day: houseDateKey(), kind: data.kind, qty: data.qty ?? 1,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Desfaz o último registro de hoje desse tipo (toque errado). */
export const undoActivity = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { kind: LogKind }) => z.object({ kind: z.enum(KINDS) }).parse(d))
  .handler(async ({ data, context }) => {
    const db: any = context.supabase;
    const { data: last } = await db.from("house_activity_logs").select("id")
      .eq("user_id", context.userId).eq("day", houseDateKey()).eq("kind", data.kind)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!last) return { ok: true };
    const { error } = await db.from("house_activity_logs").delete().eq("id", last.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============== Ranking da equipe ============== */

export const RANKING_POINTS = { story: 1, post: 2, content: 3, demand: 2, lead: 1, scheduled: 3, checklist: 1, task: 1 } as const;
export type RankingRow = {
  userId: string; name: string; color: string; avatarPath: string | null;
  stories: number; posts: number; contents: number; demands: number; leads: number; scheduled: number;
  checklists: number; tasks: number; points: number;
};

export const getTeamRanking = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthKey: string }) => z.object({ monthKey: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }): Promise<RankingRow[]> => {
    await houseInfo(context);
    const db: any = context.supabase;
    const first = `${data.monthKey}-01`;
    const nextFirst = `${shiftMonth(data.monthKey, 1)}-01`;
    const fromIso = spStart(first);
    const toIso = spStart(nextFirst);

    const [people, logs, fins, leads, sched, checks, tasks] = await Promise.all([
      db.from("profiles").select("id, name, color, avatar_url").eq("org_id", context.orgId).eq("active", true),
      db.from("house_activity_logs").select("user_id, kind, qty").eq("org_id", context.orgId).gte("day", first).lt("day", nextFirst),
      db.from("finalizations").select("user_id, content_items!inner(org_id, demand_kind)")
        .eq("content_items.org_id", context.orgId).gte("finalized_at", fromIso).lt("finalized_at", toIso),
      db.from("instagram_leads").select("created_by").eq("org_id", context.orgId).gte("created_at", fromIso).lt("created_at", toIso),
      db.from("instagram_leads").select("created_by").eq("org_id", context.orgId).gte("agendou_at", fromIso).lt("agendou_at", toIso),
      db.from("house_checklist_completions").select("done_by").eq("org_id", context.orgId).gte("done_at", fromIso).lt("done_at", toIso),
      db.from("marketing_project_tasks").select("done_by").eq("org_id", context.orgId).gte("done_at", fromIso).lt("done_at", toIso),
    ]);

    const rows = new Map<string, RankingRow>();
    for (const p of (people.data ?? []) as any[]) {
      rows.set(p.id, { userId: p.id, name: p.name, color: p.color, avatarPath: p.avatar_url ?? null,
        stories: 0, posts: 0, contents: 0, demands: 0, leads: 0, scheduled: 0, checklists: 0, tasks: 0, points: 0 });
    }
    const bump = (uid: string | null, key: keyof Omit<RankingRow, "userId" | "name" | "color" | "avatarPath" | "points">, n = 1) => {
      const r = uid ? rows.get(uid) : undefined;
      if (r) r[key] += n;
    };
    for (const l of (logs.data ?? []) as any[]) bump(l.user_id, l.kind === "story" ? "stories" : "posts", l.qty ?? 1);
    for (const f of (fins.data ?? []) as any[]) bump(f.user_id, f.content_items?.demand_kind ? "demands" : "contents");
    for (const l of (leads.data ?? []) as any[]) bump(l.created_by, "leads");
    for (const l of (sched.data ?? []) as any[]) bump(l.created_by, "scheduled");
    for (const c of (checks.data ?? []) as any[]) bump(c.done_by, "checklists");
    for (const t of (tasks.data ?? []) as any[]) bump(t.done_by, "tasks");

    const P = RANKING_POINTS;
    for (const r of rows.values()) {
      r.points = r.stories * P.story + r.posts * P.post + r.contents * P.content + r.demands * P.demand
        + r.leads * P.lead + r.scheduled * P.scheduled + r.checklists * P.checklist + r.tasks * P.task;
    }
    // Assina as fotos de perfil (bucket privado).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const list = [...rows.values()];
    await Promise.all(list.map(async (r) => {
      if (!r.avatarPath) return;
      const { data: signed } = await (supabaseAdmin as any).storage.from("avatars").createSignedUrl(r.avatarPath, 3600);
      r.avatarPath = signed?.signedUrl ?? null;
    }));
    return list.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  });

/* ============== Itens sem responsável (lembrete) ============== */

export const listUnassignedItems = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const today = houseDateKey();
    const from = shiftMonth(today.slice(0, 7), -1);
    const { data } = await (context.supabase as any).from("content_items")
      .select("id, title, type, status, due_date, demand_kind, months!inner(key, client_id), item_assignees(user_id)")
      .eq("org_id", context.orgId).is("deleted_at", null)
      .not("status", "in", "(FINALIZADO,CONCLUIDO,PLANEJAMENTO)")
      .gte("months.key", from)
      .order("due_date", { ascending: true, nullsFirst: false }).limit(80);
    return ((data ?? []) as any[])
      .filter((r) => (r.item_assignees ?? []).length === 0)
      .slice(0, 8)
      .map((r) => ({ id: r.id as string, title: r.title as string, type: r.type as string, status: r.status as string,
        dueDate: (r.due_date ?? null) as string | null, clientId: r.months.client_id as string, monthKey: r.months.key as string }));
  });
