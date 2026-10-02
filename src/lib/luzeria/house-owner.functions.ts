// House (Fase 4) — painel do dono, relatório mensal (com variável opcional)
// e projetos de marketing. Os números do mês saem de um lugar só
// (computeMonthNumbers), usado tanto pelo painel quanto pelo relatório e
// pelo PDF, pra nunca mostrarem valores diferentes.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { houseDateKey, isoWeekday, LEAD_ORIGINS, type LeadOrigin } from "./house-checklists";
import {
  PROJECT_TEMPLATES, addDays, DEFAULT_VARIABLE_WEIGHTS, shiftMonth,
  type ProjectTemplateId, type ProjectStatus, type VariableWeights,
} from "./house-projects";
import type { BrandInfo, BrandGoals } from "./house-brands";
import type { BrandReach } from "./house-reach.server";
import { getHouseBrands, pickBrands, pickWriteBrand, loadBrandGoals, sumGoals, brandFilter } from "./house-brand-access";

const IG_GRAPH_API = "https://graph.instagram.com/v21.0";
const monthKeySchema = z.string().regex(/^\d{4}-\d{2}$/);

async function assertHouse(context: { supabase: any; orgId: string }) {
  const { data } = await context.supabase.from("orgs").select("account_type, house_client_id, name").eq("id", context.orgId).maybeSingle();
  if (data?.account_type !== "house") throw new Error("Disponível só em contas House.");
  return { houseClientId: (data.house_client_id ?? null) as string | null, orgName: (data.name ?? "") as string };
}

async function assertMaster(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_master", { _user_id: context.userId });
  if (!data) throw new Error("Só o gestor pode fazer isso.");
}

/** Brasília = UTC-3 fixo (sem horário de verão desde 2019). */
const spStart = (dateKey: string) => new Date(`${dateKey}T03:00:00.000Z`).toISOString();

function monthBounds(monthKey: string, todayKey: string) {
  const first = `${monthKey}-01`;
  const [y, m] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
  const isCurrent = todayKey.slice(0, 7) === monthKey;
  const isFuture = monthKey > todayKey.slice(0, 7);
  const until = isCurrent ? todayKey : last; // último dia que já "valeu"
  return { first, last, lastDay, until, isCurrent, isFuture, nextFirst: `${shiftMonth(monthKey, 1)}-01` };
}

function workdaysBetween(fromKey: string, toKey: string) {
  let n = 0;
  for (let d = fromKey; d <= toKey; d = addDays(d, 1)) if (isoWeekday(d) <= 5) n++;
  return n;
}

async function countInstagramFeedInMonth(clientId: string, fromIso: string, toIso: string): Promise<number | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: creds } = await (supabaseAdmin as any).from("client_instagram_credentials")
      .select("instagram_business_account_id, access_token").eq("client_id", clientId).maybeSingle();
    if (!creds?.access_token) return null;
    const from = new Date(fromIso).getTime();
    const to = new Date(toIso).getTime();
    let url: string | null = `${IG_GRAPH_API}/${creds.instagram_business_account_id}/media?fields=id,timestamp,media_product_type&limit=50&access_token=${encodeURIComponent(creds.access_token)}`;
    let count = 0;
    for (let page = 0; url && page < 6; page++) {
      const res: Response = await fetch(url);
      if (!res.ok) return null;
      const json: any = await res.json();
      let older = false;
      for (const m of json.data ?? []) {
        const t = new Date(m.timestamp).getTime();
        if (t < from) { older = true; continue; }
        if (t < to && m.media_product_type !== "STORY") count++;
      }
      url = older ? null : (json.paging?.next ?? null);
    }
    return count;
  } catch {
    return null;
  }
}

export type MonthNumbers = {
  monthKey: string;
  isCurrent: boolean;
  goalsPct: number;
  /** Detalhe por marca (só útil quando a House tem 2+ marcas na visão). */
  byBrand: { brandId: string; name: string; stories: { done: number; goal: number }; posts: { done: number; goal: number }; leads: number; scheduled: number; leadsGoal: number }[];
  stories: { done: number; goal: number; pct: number; source: "instagram" | "app"; trackedDays: number };
  posts: { done: number; goal: number; pct: number; source: "instagram" | "app" };
  planning: { targetMonth: string; deadline: string; delivered: boolean; onTime: boolean | null; deliveredAt: string | null; applies: boolean };
  checklists: { done: number; missed: number; pct: number | null };
  leads: {
    total: number; goal: number; scheduled: number; scheduledGoal: number; attended: number;
    byOrigin: Record<LeadOrigin, number>; scheduleRate: number | null; attendRate: number | null;
  };
  /** Tráfego pago: investimento lançado + leads que vieram de anúncio. */
  ads?: {
    spendCents: number; leads: number; scheduled: number;
    costPerLeadCents: number | null; costPerScheduledCents: number | null;
    byBrand: { brandId: string; name: string; spendCents: number; leads: number }[];
  };
  /** Alcance e seguidores por marca (só quando pedido: chama o Instagram). */
  reach?: BrandReach[];
  variable: null | { weights: VariableWeights; maxCents: number; scores: { goals: number; leads: number; scheduled: number }; totalPct: number; valueCents: number };
};

async function computeMonthNumbers(supabase: any, orgId: string, brands: BrandInfo[], monthKey: string, withReach = false): Promise<MonthNumbers> {
  const todayKey = houseDateKey();
  const b = monthBounds(monthKey, todayKey);
  const fromIso = spStart(b.first);
  const toIso = spStart(b.nextFirst);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin: any = supabaseAdmin;

  const { data: s } = await supabase.from("house_settings").select("*").eq("org_id", orgId).maybeSingle();
  const goalsByBrand = await loadBrandGoals(supabase, orgId, brands);
  const totalGoals = sumGoals([...goalsByBrand.values()]);
  // Metas só contam a partir do dia em que a House passou a existir — uma
  // conta criada no meio do mês não "deve" os dias anteriores.
  const { data: orgRow } = await admin.from("orgs").select("created_at").eq("id", orgId).maybeSingle();
  const createdKey = orgRow?.created_at ? houseDateKey(new Date(orgRow.created_at)) : b.first;
  const countFrom = createdKey > b.first ? createdKey : b.first;
  const deadlineDay = s?.planning_deadline_day ?? 25;
  const workdays = b.isFuture || countFrom > b.until ? 0 : workdaysBetween(countFrom, b.until);
  const elapsedDays = b.isFuture || countFrom > b.until ? 0
    : Math.round((new Date(`${b.until}T12:00:00Z`).getTime() - new Date(`${countFrom}T12:00:00Z`).getTime()) / 86_400_000) + 1;
  const brandIds = brands.map((x) => x.id);

  // Retrato diário do Instagram por marca (stories somem em 24h) e registros
  // manuais da equipe — buscados uma vez e repartidos por marca.
  const [{ data: dayRowsAll }, { data: logRowsAll }] = await Promise.all([
    supabase.from("house_brand_daily_stats").select("client_id, day, stories")
      .eq("org_id", orgId).in("client_id", brandIds).gte("day", b.first).lte("day", b.last),
    brandFilter(supabase.from("house_activity_logs").select("client_id, kind, qty")
      .eq("org_id", orgId).gte("day", b.first).lte("day", b.last), "client_id", brands),
  ]);
  const mainId = brands.find((x) => x.isMain)?.id ?? null;

  let storiesDone = 0, storiesGoal = 0, postsDone = 0, postsGoal = 0, trackedDaysMax = 0;
  let allIgStories = true, allIgPosts = true;
  const perBrand: MonthNumbers["byBrand"] = [];
  for (const br of brands) {
    const g = goalsByBrand.get(br.id)!;
    const days = ((dayRowsAll ?? []) as any[]).filter((r) => r.client_id === br.id);
    const logs = ((logRowsAll ?? []) as any[]).filter((l) => (l.client_id ?? mainId) === br.id);
    const manualStories = logs.filter((l) => l.kind === "story").reduce((n, l) => n + l.qty, 0);
    const manualPosts = logs.filter((l) => l.kind !== "story").reduce((n, l) => n + l.qty, 0);

    let sDone = days.reduce((n, r) => n + (r.stories ?? 0), 0);
    trackedDaysMax = Math.max(trackedDaysMax, days.length);
    if (days.length === 0) {
      const { count } = await supabase.from("content_items").select("id, months!inner(client_id)", { count: "exact", head: true })
        .eq("org_id", orgId).eq("months.client_id", br.id).eq("type", "story")
        .gte("ig_published_at", fromIso).lt("ig_published_at", toIso).is("deleted_at", null);
      sDone = (count ?? 0) + manualStories;
      allIgStories = false;
    }
    const igPosts = await countInstagramFeedInMonth(br.id, fromIso, toIso);
    let pDone = igPosts ?? 0;
    if (igPosts == null) {
      const { count } = await supabase.from("content_items").select("id, months!inner(client_id)", { count: "exact", head: true })
        .eq("org_id", orgId).eq("months.client_id", br.id).in("type", ["post", "reel"])
        .gte("ig_published_at", fromIso).lt("ig_published_at", toIso).is("deleted_at", null);
      pDone = (count ?? 0) + manualPosts;
      allIgPosts = false;
    }
    const sGoal = g.storiesPerWorkday * workdays;
    const pGoal = Math.round((g.feedPostsPerWeek * elapsedDays) / 7);
    storiesDone += sDone; storiesGoal += sGoal; postsDone += pDone; postsGoal += pGoal;
    perBrand.push({ brandId: br.id, name: br.name, stories: { done: sDone, goal: sGoal }, posts: { done: pDone, goal: pGoal }, leads: 0, scheduled: 0, leadsGoal: g.leadsGoalMonth });
  }
  const storiesSource: "instagram" | "app" = brands.length > 0 && allIgStories ? "instagram" : "app";
  const postsSource: "instagram" | "app" = brands.length > 0 && allIgPosts ? "instagram" : "app";
  const trackedDays = trackedDaysMax;

  // Planejamento do mês seguinte, entregue até o dia-limite deste mês.
  const targetMonth = shiftMonth(monthKey, 1);
  const deadline = `${monthKey}-${String(Math.min(deadlineDay, b.lastDay)).padStart(2, "0")}`;
  const { data: planDoc } = await admin.from("client_docs").select("created_at")
    .eq("org_id", orgId)
    .or(`target_month_key.eq.${targetMonth},and(type.eq.planejamento,created_at.gte.${fromIso},created_at.lt.${toIso})`)
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  const deliveredAt = (planDoc?.created_at ?? null) as string | null;
  const deliveredKey = deliveredAt ? houseDateKey(new Date(deliveredAt)) : null;
  // Prazo que venceu antes da conta existir não conta contra ninguém.
  const planningApplies = createdKey <= deadline;
  const onTime = deliveredKey ? deliveredKey <= deadline : todayKey > deadline && planningApplies ? false : null;

  // Checklists: feitos vs. avisos de atraso no mês.
  const [{ count: ckDone }, { count: ckMissed }] = await Promise.all([
    supabase.from("house_checklist_completions").select("id", { count: "exact", head: true }).eq("org_id", orgId).gte("done_at", fromIso).lt("done_at", toIso),
    supabase.from("house_checklist_alerts").select("item_id", { count: "exact", head: true }).eq("org_id", orgId).gte("created_at", fromIso).lt("created_at", toIso),
  ]);
  const ckTotal = (ckDone ?? 0) + (ckMissed ?? 0);
  const checklistPct = ckTotal > 0 ? (ckDone ?? 0) / ckTotal : null;

  // Leads do mês.
  const { data: leadRows } = await brandFilter(supabase.from("instagram_leads").select("client_id, origin, agendou_at, compareceu_at")
    .eq("org_id", orgId).gte("created_at", fromIso).lt("created_at", toIso), "client_id", brands);
  const leads = (leadRows ?? []) as any[];
  for (const pb of perBrand) {
    const mine = leads.filter((l) => (l.client_id ?? mainId) === pb.brandId);
    pb.leads = mine.length;
    pb.scheduled = mine.filter((l) => l.agendou_at).length;
  }
  const byOrigin = Object.fromEntries(LEAD_ORIGINS.map((o) => [o, 0])) as Record<LeadOrigin, number>;
  for (const l of leads) byOrigin[l.origin as LeadOrigin] = (byOrigin[l.origin as LeadOrigin] ?? 0) + 1;
  const scheduled = leads.filter((l) => l.agendou_at).length;
  const attended = leads.filter((l) => l.compareceu_at).length;

  const pct = (done: number, goal: number) => (goal > 0 ? Math.min(1, done / goal) : done > 0 ? 1 : 0);
  const storiesPct = pct(storiesDone, storiesGoal);
  const postsPct = pct(postsDone, postsGoal);
  const planningPct = deliveredAt ? (onTime ? 1 : 0.5) : 0;
  const parts = [
    ...(storiesGoal > 0 || storiesDone > 0 ? [storiesPct] : []),
    ...(postsGoal > 0 || postsDone > 0 ? [postsPct] : []),
    ...(planningApplies || deliveredAt ? [planningPct] : []),
    ...(checklistPct == null ? [] : [checklistPct]),
  ];
  const goalsPct = parts.length ? parts.reduce((a, v) => a + v, 0) / parts.length : 0;

  // Tráfego pago.
  const { data: spendRows } = await supabase.from("house_ad_spend").select("client_id, amount_cents")
    .eq("org_id", orgId).eq("month_key", monthKey).in("client_id", brandIds);
  const spendCents = ((spendRows ?? []) as any[]).reduce((n, r) => n + r.amount_cents, 0);
  const adLeads = leads.filter((l) => l.origin === "anuncio");
  const adScheduled = adLeads.filter((l) => l.agendou_at).length;
  const ads: NonNullable<MonthNumbers["ads"]> = {
    spendCents, leads: adLeads.length, scheduled: adScheduled,
    costPerLeadCents: spendCents > 0 && adLeads.length > 0 ? Math.round(spendCents / adLeads.length) : null,
    costPerScheduledCents: spendCents > 0 && adScheduled > 0 ? Math.round(spendCents / adScheduled) : null,
    byBrand: brands.map((br) => ({
      brandId: br.id, name: br.name,
      spendCents: ((spendRows ?? []) as any[]).filter((r) => r.client_id === br.id).reduce((n, r) => n + r.amount_cents, 0),
      leads: adLeads.filter((l) => (l.client_id ?? mainId) === br.id).length,
    })),
  };
  const reach = withReach ? await (await import("./house-reach.server")).computeBrandReach(brands, b.first, b.last, b.isCurrent) : undefined;

  const leadsGoal = totalGoals.leadsGoalMonth;
  const scheduledGoal = totalGoals.scheduledGoalMonth;
  let variable: MonthNumbers["variable"] = null;
  if (s?.variable_enabled) {
    const weights: VariableWeights = { ...DEFAULT_VARIABLE_WEIGHTS, ...(s.variable_weights ?? {}) };
    const scores = { goals: goalsPct, leads: pct(leads.length, leadsGoal), scheduled: pct(scheduled, scheduledGoal) };
    const wSum = weights.goals + weights.leads + weights.scheduled || 1;
    const totalPct = (scores.goals * weights.goals + scores.leads * weights.leads + scores.scheduled * weights.scheduled) / wSum;
    variable = { weights, maxCents: s.variable_max_cents ?? 0, scores, totalPct, valueCents: Math.round(totalPct * (s.variable_max_cents ?? 0)) };
  }

  return {
    monthKey, isCurrent: b.isCurrent, goalsPct, byBrand: perBrand, ads, reach,
    stories: { done: storiesDone, goal: storiesGoal, pct: storiesPct, source: storiesSource, trackedDays },
    posts: { done: postsDone, goal: postsGoal, pct: postsPct, source: postsSource },
    planning: { targetMonth, deadline, delivered: !!deliveredAt, onTime, deliveredAt, applies: planningApplies },
    checklists: { done: ckDone ?? 0, missed: ckMissed ?? 0, pct: checklistPct },
    leads: {
      total: leads.length, goal: leadsGoal, scheduled, scheduledGoal, attended, byOrigin,
      scheduleRate: leads.length ? scheduled / leads.length : null,
      attendRate: scheduled ? attended / scheduled : null,
    },
    variable,
  };
}

/* ============== Painel do dono ============== */

export type OwnerPanel = MonthNumbers & {
  projects: { id: string; title: string; template: string; eventDate: string | null; done: number; total: number; lateTasks: number }[];
  lateChecklists: { title: string; periodKey: string; at: string }[];
  brands: BrandInfo[];
  selectedBrandIds: string[];
  settings: {
    leadsGoal: number; scheduledGoal: number; variableEnabled: boolean; variableMaxCents: number; weights: VariableWeights;
    /** Metas de cada marca (pra tela de metas). */
    brandGoals: ({ brandId: string; name: string } & BrandGoals)[];
  };
};

export const getOwnerPanel = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthKey: string; brandId?: string }) => z.object({ monthKey: monthKeySchema, brandId: z.string().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<OwnerPanel> => {
    const { brands } = await getHouseBrands(context);
    const selected = pickBrands(brands, data.brandId);
    const db: any = context.supabase;
    const numbers = await computeMonthNumbers(db, context.orgId, selected, data.monthKey);
    const allGoals = await loadBrandGoals(db, context.orgId, brands);
    const todayKey = houseDateKey();
    const b = monthBounds(data.monthKey, todayKey);

    const { data: projRows } = await db.from("marketing_projects").select("id, title, template, event_date, marketing_project_tasks(done_at, due_date)")
      .eq("org_id", context.orgId).in("status", ["planejado", "andamento"]).or(`client_id.in.(${selected.map((x) => x.id).join(",")}),client_id.is.null`).order("event_date", { ascending: true, nullsFirst: false });
    const projects = ((projRows ?? []) as any[]).map((p) => {
      const tasks = (p.marketing_project_tasks ?? []) as any[];
      return {
        id: p.id, title: p.title, template: p.template, eventDate: p.event_date ?? null,
        done: tasks.filter((t) => t.done_at).length, total: tasks.length,
        lateTasks: tasks.filter((t) => !t.done_at && t.due_date && t.due_date < todayKey).length,
      };
    });

    const { data: alertRows } = await db.from("house_checklist_alerts").select("period_key, created_at, house_checklist_items(title)")
      .eq("org_id", context.orgId).gte("created_at", spStart(b.first)).lt("created_at", spStart(b.nextFirst))
      .order("created_at", { ascending: false }).limit(30);
    const lateChecklists = ((alertRows ?? []) as any[]).map((r) => ({
      title: r.house_checklist_items?.title ?? "Item apagado", periodKey: r.period_key, at: r.created_at,
    }));

    const { data: s } = await db.from("house_settings").select("*").eq("org_id", context.orgId).maybeSingle();
    return {
      ...numbers, projects, lateChecklists, brands, selectedBrandIds: selected.map((x) => x.id),
      settings: {
        brandGoals: brands.map((x) => ({ brandId: x.id, name: x.name, ...allGoals.get(x.id)! })),
        leadsGoal: sumGoals(selected.map((x) => allGoals.get(x.id)!)).leadsGoalMonth,
        scheduledGoal: sumGoals(selected.map((x) => allGoals.get(x.id)!)).scheduledGoalMonth,
        variableEnabled: !!s?.variable_enabled, variableMaxCents: s?.variable_max_cents ?? 0,
        weights: { ...DEFAULT_VARIABLE_WEIGHTS, ...(s?.variable_weights ?? {}) },
      },
    };
  });

/** Alcance e seguidores por marca — separado do painel porque chama o
 * Instagram (mais lento): a tela carrega os números e depois este cartão. */
export const getHouseReach = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthKey: string; brandId?: string }) => z.object({ monthKey: monthKeySchema, brandId: z.string().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<BrandReach[]> => {
    const { brands } = await getHouseBrands(context);
    const selected = pickBrands(brands, data.brandId);
    const b = monthBounds(data.monthKey, houseDateKey());
    return (await import("./house-reach.server")).computeBrandReach(selected, b.first, b.last, b.isCurrent);
  });

/* ============== Investimento em anúncios ============== */

export type AdSpendRow = { id: string; clientId: string; clientName: string; monthKey: string; amountCents: number; note: string | null };

export const listAdSpend = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthKey: string; brandId?: string }) => z.object({ monthKey: monthKeySchema, brandId: z.string().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<AdSpendRow[]> => {
    const { brands } = await getHouseBrands(context);
    const selected = pickBrands(brands, data.brandId);
    const { data: rows, error } = await (context.supabase as any).from("house_ad_spend").select("*")
      .eq("org_id", context.orgId).eq("month_key", data.monthKey).in("client_id", selected.map((x) => x.id)).order("created_at");
    if (error) throw new Error(error.message);
    const name = new Map(brands.map((x) => [x.id, x.name]));
    return ((rows ?? []) as any[]).map((r) => ({ id: r.id, clientId: r.client_id, clientName: name.get(r.client_id) ?? "", monthKey: r.month_key, amountCents: r.amount_cents, note: r.note ?? null }));
  });

export const addAdSpend = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthKey: string; brandId?: string; amountCents: number; note?: string }) =>
    z.object({ monthKey: monthKeySchema, brandId: z.string().uuid().optional(), amountCents: z.number().int().min(0).max(1_000_000_000), note: z.string().trim().max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    const { brands } = await getHouseBrands(context);
    const brand = pickWriteBrand(brands, data.brandId);
    const { error } = await (context.supabase as any).from("house_ad_spend").insert({
      org_id: context.orgId, client_id: brand.id, month_key: data.monthKey, amount_cents: data.amountCents,
      note: data.note || null, created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAdSpend = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    const { error } = await (context.supabase as any).from("house_ad_spend").delete().eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveHouseTargets = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { leadsGoal: number; scheduledGoal: number; variableEnabled: boolean; variableMaxCents: number; weights: VariableWeights; brandGoals?: ({ brandId: string } & BrandGoals)[] }) =>
    z.object({
      brandGoals: z.array(z.object({
        brandId: z.string().uuid(),
        storiesPerWorkday: z.number().int().min(0).max(50),
        feedPostsPerWeek: z.number().int().min(0).max(50),
        leadsGoalMonth: z.number().int().min(0).max(10000),
        scheduledGoalMonth: z.number().int().min(0).max(10000),
      })).max(50).optional(),
      leadsGoal: z.number().int().min(0).max(10000),
      scheduledGoal: z.number().int().min(0).max(10000),
      variableEnabled: z.boolean(),
      variableMaxCents: z.number().int().min(0).max(100000000),
      weights: z.object({ goals: z.number().min(0).max(100), leads: z.number().min(0).max(100), scheduled: z.number().min(0).max(100) }),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { houseClientId } = await assertHouse(context);
    await assertMaster(context);
    const db: any = context.supabase;
    // Metas por marca; a marca principal também espelha em house_settings
    // (onde ela já morava), pra o que está no ar continuar lendo certo.
    let leadsGoal = data.leadsGoal, scheduledGoal = data.scheduledGoal;
    const mainGoal: Partial<{ stories_per_workday: number; feed_posts_per_week: number }> = {};
    if (data.brandGoals?.length) {
      const { brands } = await getHouseBrands(context);
      const allowed = new Set(brands.map((x) => x.id));
      for (const g of data.brandGoals) {
        if (!allowed.has(g.brandId)) throw new Error("Marca inválida.");
        const { error: gErr } = await db.from("house_brand_settings").upsert({
          client_id: g.brandId, org_id: context.orgId,
          stories_per_workday: g.storiesPerWorkday, feed_posts_per_week: g.feedPostsPerWeek,
          leads_goal_month: g.leadsGoalMonth, scheduled_goal_month: g.scheduledGoalMonth, updated_at: new Date().toISOString(),
        }, { onConflict: "client_id" });
        if (gErr) throw new Error(gErr.message);
        if (g.brandId === houseClientId) {
          leadsGoal = g.leadsGoalMonth; scheduledGoal = g.scheduledGoalMonth;
          mainGoal.stories_per_workday = g.storiesPerWorkday; mainGoal.feed_posts_per_week = g.feedPostsPerWeek;
        }
      }
    }
    const { error } = await db.from("house_settings").update({
      ...mainGoal,
      leads_goal_month: leadsGoal, scheduled_goal_month: scheduledGoal,
      variable_enabled: data.variableEnabled, variable_max_cents: data.variableMaxCents,
      variable_weights: data.weights, updated_at: new Date().toISOString(),
    }).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============== Relatório mensal ============== */

export type MonthlyReport = {
  monthKey: string;
  whatWorked: string; learned: string; nextChanges: string;
  status: "rascunho" | "enviado"; submittedAt: string | null; submittedBy: string | null; updatedAt: string | null;
  numbers: MonthNumbers;
};

export const getMonthlyReport = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthKey: string }) => z.object({ monthKey: monthKeySchema }).parse(d))
  .handler(async ({ data, context }): Promise<MonthlyReport> => {
    const { brands } = await getHouseBrands(context);
    const db: any = context.supabase;
    const { data: r } = await db.from("monthly_reports").select("*").eq("org_id", context.orgId).eq("month_key", data.monthKey).maybeSingle();
    // Enviado = números congelados no envio; rascunho = sempre ao vivo.
    const numbers = r?.status === "enviado" && r.numbers ? (r.numbers as MonthNumbers)
      : await computeMonthNumbers(db, context.orgId, brands, data.monthKey, true);
    return {
      monthKey: data.monthKey,
      whatWorked: r?.what_worked ?? "", learned: r?.learned ?? "", nextChanges: r?.next_changes ?? "",
      status: r?.status ?? "rascunho", submittedAt: r?.submitted_at ?? null, submittedBy: r?.submitted_by ?? null,
      updatedAt: r?.updated_at ?? null, numbers,
    };
  });

export const saveMonthlyReport = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthKey: string; whatWorked: string; learned: string; nextChanges: string; submit?: boolean; reopen?: boolean }) =>
    z.object({
      monthKey: monthKeySchema,
      whatWorked: z.string().max(5000), learned: z.string().max(5000), nextChanges: z.string().max(5000),
      submit: z.boolean().optional(), reopen: z.boolean().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { brands } = await getHouseBrands(context);
    const db: any = context.supabase;
    const row: Record<string, unknown> = {
      org_id: context.orgId, month_key: data.monthKey,
      what_worked: data.whatWorked.trim() || null, learned: data.learned.trim() || null, next_changes: data.nextChanges.trim() || null,
      updated_by: context.userId, updated_at: new Date().toISOString(),
    };
    if (data.submit) {
      row.status = "enviado";
      row.submitted_by = context.userId;
      row.submitted_at = new Date().toISOString();
      row.numbers = await computeMonthNumbers(db, context.orgId, brands, data.monthKey, true);
    }
    if (data.reopen) {
      await assertMaster(context);
      row.status = "rascunho";
      row.numbers = null;
    }
    const { error } = await db.from("monthly_reports").upsert(row, { onConflict: "org_id,month_key" });
    if (error) throw new Error(error.message);

    if (data.submit) {
      // Avisa o(s) gestor(es) que o relatório chegou.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: people } = await (supabaseAdmin as any).from("profiles").select("id").eq("org_id", context.orgId).eq("active", true);
      const ids = ((people ?? []) as any[]).map((p) => p.id);
      const { data: masterRoles } = ids.length
        ? await (supabaseAdmin as any).from("user_roles").select("user_id").eq("role", "master").in("user_id", ids)
        : { data: [] };
      const masters = ((masterRoles ?? []) as any[]).map((r) => ({ id: r.user_id as string }));
      const { data: me } = await (supabaseAdmin as any).from("profiles").select("name").eq("id", context.userId).maybeSingle();
      const { monthLabel } = await import("./house-projects");
      const rows = masters.filter((m) => m.id !== context.userId).map((m) => ({
        user_id: m.id, type: "house_report",
        message: `${me?.name ?? "A equipe"} enviou o relatório de ${monthLabel(data.monthKey)}.`,
      }));
      if (rows.length) await (supabaseAdmin as any).from("notifications").insert(rows);
    }
    return { ok: true };
  });

export const exportMonthlyReportPdf = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthKey: string }) => z.object({ monthKey: monthKeySchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { orgName } = await assertHouse(context);
    const { brands } = await getHouseBrands(context);
    const db: any = context.supabase;
    const { data: r } = await db.from("monthly_reports").select("*").eq("org_id", context.orgId).eq("month_key", data.monthKey).maybeSingle();
    const numbers = r?.status === "enviado" && r.numbers ? (r.numbers as MonthNumbers)
      : await computeMonthNumbers(db, context.orgId, brands, data.monthKey, true);
    const { buildHouseReportPdf } = await import("./house-report-pdf.server");
    const bytes = await buildHouseReportPdf({
      orgName, monthKey: data.monthKey, numbers,
      whatWorked: r?.what_worked ?? "", learned: r?.learned ?? "", nextChanges: r?.next_changes ?? "",
      status: r?.status ?? "rascunho",
    });
    return { base64: Buffer.from(bytes).toString("base64"), filename: `Relatorio ${orgName} ${data.monthKey}.pdf` };
  });

/* ============== Projetos ============== */

export type ProjectTask = {
  id: string; stage: string; title: string; responsibleId: string | null; dueDate: string | null;
  doneAt: string | null; doneBy: string | null; sortOrder: number;
};
export type Project = {
  clientId: string | null; id: string; title: string; template: ProjectTemplateId; description: string | null; status: ProjectStatus;
  eventDate: string | null; ownerId: string | null; createdBy: string | null; createdAt: string;
  tasks: ProjectTask[];
};

function mapTask(t: any): ProjectTask {
  return {
    id: t.id, stage: t.stage, title: t.title, responsibleId: t.responsible_id ?? null, dueDate: t.due_date ?? null,
    doneAt: t.done_at ?? null, doneBy: t.done_by ?? null, sortOrder: t.sort_order,
  };
}
function mapProject(p: any): Project {
  return {
    clientId: p.client_id ?? null, id: p.id, title: p.title, template: p.template, description: p.description ?? null, status: p.status,
    eventDate: p.event_date ?? null, ownerId: p.owner_id ?? null, createdBy: p.created_by ?? null, createdAt: p.created_at,
    tasks: ((p.marketing_project_tasks ?? []) as any[]).map(mapTask).sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { brandId?: string } | undefined) => z.object({ brandId: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data: input, context }): Promise<Project[]> => {
    const { brands } = await getHouseBrands(context);
    const selected = pickBrands(brands, input.brandId);
    const { data, error } = await brandFilter((context.supabase as any).from("marketing_projects")
      .select("*, marketing_project_tasks(*)").eq("org_id", context.orgId), "client_id", selected)
      .order("event_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapProject);
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { template: ProjectTemplateId; title: string; eventDate?: string | null; ownerId?: string | null; description?: string | null; brandId?: string }) =>
    z.object({
      brandId: z.string().uuid().optional(),
      template: z.enum(["evento", "radio", "campanha", "livre"]),
      title: z.string().trim().min(1).max(160),
      eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      ownerId: z.string().uuid().nullable().optional(),
      description: z.string().trim().max(5000).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { brands } = await getHouseBrands(context);
    const brand = pickWriteBrand(brands, data.brandId);
    const db: any = context.supabase;
    const { data: proj, error } = await db.from("marketing_projects").insert({
      org_id: context.orgId, client_id: brand.id, title: data.title, template: data.template, description: data.description || null,
      event_date: data.eventDate ?? null, owner_id: data.ownerId ?? context.userId, created_by: context.userId,
      status: "andamento",
    }).select("id").single();
    if (error) throw new Error(error.message);
    const tpl = PROJECT_TEMPLATES.find((t) => t.id === data.template)!;
    const tasks = tpl.stages.flatMap((st, si) => st.tasks.map((t, ti) => ({
      project_id: proj.id, org_id: context.orgId, stage: st.stage, title: t.title,
      responsible_id: data.ownerId ?? context.userId,
      due_date: data.eventDate ? addDays(data.eventDate, t.offset) : null,
      sort_order: si * 100 + ti,
    })));
    if (tasks.length) {
      const { error: tErr } = await db.from("marketing_project_tasks").insert(tasks);
      if (tErr) throw new Error(tErr.message);
    }
    return { id: proj.id as string };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; title?: string; status?: ProjectStatus; eventDate?: string | null; ownerId?: string | null; description?: string | null }) =>
    z.object({
      id: z.string().uuid(),
      title: z.string().trim().min(1).max(160).optional(),
      status: z.enum(["planejado", "andamento", "concluido", "cancelado"]).optional(),
      eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      ownerId: z.string().uuid().nullable().optional(),
      description: z.string().trim().max(5000).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) patch.title = data.title;
    if (data.status !== undefined) patch.status = data.status;
    if (data.eventDate !== undefined) patch.event_date = data.eventDate;
    if (data.ownerId !== undefined) patch.owner_id = data.ownerId;
    if (data.description !== undefined) patch.description = data.description || null;
    const { error } = await (context.supabase as any).from("marketing_projects").update(patch).eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error, count } = await (context.supabase as any).from("marketing_projects")
      .delete({ count: "exact" }).eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    if (!count) throw new Error("Só o gestor ou quem criou pode apagar o projeto.");
    return { ok: true };
  });

export const upsertProjectTask = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id?: string; projectId: string; stage: string; title: string; responsibleId?: string | null; dueDate?: string | null }) =>
    z.object({
      id: z.string().uuid().optional(), projectId: z.string().uuid(),
      stage: z.string().trim().min(1).max(60), title: z.string().trim().min(1).max(300),
      responsibleId: z.string().uuid().nullable().optional(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const db: any = context.supabase;
    const row = { stage: data.stage, title: data.title, responsible_id: data.responsibleId ?? null, due_date: data.dueDate ?? null };
    if (data.id) {
      const { error } = await db.from("marketing_project_tasks").update(row).eq("id", data.id).eq("org_id", context.orgId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: maxRow } = await db.from("marketing_project_tasks").select("sort_order").eq("project_id", data.projectId)
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data: created, error } = await db.from("marketing_project_tasks").insert({
      ...row, project_id: data.projectId, org_id: context.orgId, sort_order: (maxRow?.sort_order ?? -1) + 1,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const setProjectTaskDone = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; done: boolean }) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("marketing_project_tasks").update(
      data.done ? { done_at: new Date().toISOString(), done_by: context.userId } : { done_at: null, done_by: null },
    ).eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProjectTask = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("marketing_project_tasks").delete().eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============== Cron: retrato diário (23h50 de Brasília) ============== */

export async function runHouseDailyStats(): Promise<{ recorded: number; skipped: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { countFromInstagram, recordDailyStats } = await import("./house-day.functions");
  const { data: orgs } = await (supabaseAdmin as any).from("orgs").select("id").eq("account_type", "house");
  const todayKey = houseDateKey();
  let recorded = 0;
  let skipped = 0;
  for (const o of (orgs ?? []) as any[]) {
    const { data: clients } = await (supabaseAdmin as any).from("clients").select("id, archived, category").eq("org_id", o.id);
    for (const c of ((clients ?? []) as any[]).filter((x) => !x.archived && x.category !== "Ex-clientes")) {
      const ig = await countFromInstagram(c.id, todayKey);
      if (!ig) { skipped++; continue; }
      await recordDailyStats(o.id, c.id, todayKey, ig.storiesToday, ig.feedToday);
      recorded++;
    }
  }
  return { recorded, skipped };
}
