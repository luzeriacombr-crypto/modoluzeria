// House (Fase 3) — Playbook da função. scope "org" = o playbook da própria
// House (RLS: equipe lê, master edita). scope "modelo" = o playbook modelo
// global (org_id NULL), editado só pela Luzeria e copiado pra cada House
// nova (copy_playbook_template).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

type Scope = "org" | "modelo";
const scopeSchema = z.enum(["org", "modelo"]).default("org");

export type PlaybookPage = {
  id: string; sectionId: string; title: string; summary: string | null; content: string;
  checklist: string[]; stepKeys: string[]; sortOrder: number; updatedAt: string;
};
export type PlaybookSection = { id: string; title: string; icon: string; sortOrder: number; pages: PlaybookPage[] };
export type PlaybookRead = { readAt: string | null; checked: number[] };

/** Cliente de banco pro escopo: o da própria pessoa (RLS da org) ou, no
 * modelo, o service role — depois de confirmar que é a Luzeria. */
async function dbFor(context: { supabase: any; userId: string; orgId: string }, scope: Scope, write: boolean) {
  if (scope === "modelo") {
    const { LUZERIA_ORG_ID } = await import("./api.functions");
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (context.orgId !== LUZERIA_ORG_ID || !isMaster) throw new Error("Só a Luzeria edita o playbook modelo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return { db: supabaseAdmin as any, orgId: null as string | null };
  }
  if (write) {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Só o gestor edita o playbook.");
  }
  return { db: context.supabase as any, orgId: context.orgId as string | null };
}

function scoped(q: any, orgId: string | null) {
  return orgId ? q.eq("org_id", orgId) : q.is("org_id", null);
}

function mapPage(p: any): PlaybookPage {
  return {
    id: p.id, sectionId: p.section_id, title: p.title, summary: p.summary ?? null, content: p.content ?? "",
    checklist: Array.isArray(p.checklist) ? p.checklist.map(String) : [], stepKeys: p.step_keys ?? [],
    sortOrder: p.sort_order, updatedAt: p.updated_at,
  };
}

export const getPlaybook = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { scope?: Scope }) => z.object({ scope: scopeSchema }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<{ sections: PlaybookSection[]; reads: Record<string, PlaybookRead> }> => {
    const { db, orgId } = await dbFor(context, data.scope, false);
    const [{ data: secRows, error: sErr }, { data: pageRows, error: pErr }] = await Promise.all([
      scoped(db.from("playbook_sections").select("*"), orgId).order("sort_order"),
      scoped(db.from("playbook_pages").select("*"), orgId).order("sort_order"),
    ]);
    if (sErr || pErr) throw new Error((sErr ?? pErr)!.message);
    const pages = ((pageRows ?? []) as any[]).map(mapPage);
    const sections = ((secRows ?? []) as any[]).map((s) => ({
      id: s.id, title: s.title, icon: s.icon, sortOrder: s.sort_order,
      pages: pages.filter((p) => p.sectionId === s.id),
    }));
    const reads: Record<string, PlaybookRead> = {};
    if (data.scope === "org") {
      const { data: readRows } = await (context.supabase as any).from("playbook_reads")
        .select("page_id, read_at, checked").eq("user_id", context.userId);
      for (const r of (readRows ?? []) as any[]) reads[r.page_id] = { readAt: r.read_at ?? null, checked: r.checked ?? [] };
    }
    return { sections, reads };
  });

export const savePlaybookSection = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { scope?: Scope; id?: string; title: string; icon?: string }) =>
    z.object({
      scope: scopeSchema, id: z.string().uuid().optional(),
      title: z.string().trim().min(1).max(120), icon: z.string().trim().max(40).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, orgId } = await dbFor(context, data.scope, true);
    if (data.id) {
      const patch: Record<string, unknown> = { title: data.title };
      if (data.icon) patch.icon = data.icon;
      const { error } = await scoped(db.from("playbook_sections").update(patch).eq("id", data.id), orgId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: maxRow } = await scoped(db.from("playbook_sections").select("sort_order"), orgId)
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data: row, error } = await db.from("playbook_sections").insert({
      org_id: orgId, title: data.title, icon: data.icon || "BookOpen", sort_order: (maxRow?.sort_order ?? -1) + 1,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deletePlaybookSection = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { scope?: Scope; id: string }) => z.object({ scope: scopeSchema, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, orgId } = await dbFor(context, data.scope, true);
    const { error } = await scoped(db.from("playbook_sections").delete().eq("id", data.id), orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const savePlaybookPage = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    scope?: Scope; id?: string; sectionId: string; title: string; summary?: string | null;
    content: string; checklist: string[]; stepKeys: string[];
  }) =>
    z.object({
      scope: scopeSchema, id: z.string().uuid().optional(), sectionId: z.string().uuid(),
      title: z.string().trim().min(1).max(160), summary: z.string().trim().max(300).nullable().optional(),
      content: z.string().max(60000),
      checklist: z.array(z.string().trim().min(1).max(300)).max(30),
      stepKeys: z.array(z.string().max(60)).max(20),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, orgId } = await dbFor(context, data.scope, true);
    // A seção precisa ser do mesmo escopo (nunca mistura modelo com House).
    const { data: sec } = await scoped(db.from("playbook_sections").select("id").eq("id", data.sectionId), orgId).maybeSingle();
    if (!sec) throw new Error("Seção não encontrada.");
    const row = {
      section_id: data.sectionId, title: data.title, summary: data.summary || null, content: data.content,
      checklist: data.checklist, step_keys: data.stepKeys,
      updated_at: new Date().toISOString(), updated_by: data.scope === "org" ? context.userId : null,
    };
    if (data.id) {
      const { error } = await scoped(db.from("playbook_pages").update(row).eq("id", data.id), orgId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: maxRow } = await db.from("playbook_pages").select("sort_order").eq("section_id", data.sectionId)
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data: created, error } = await db.from("playbook_pages")
      .insert({ ...row, org_id: orgId, sort_order: (maxRow?.sort_order ?? -1) + 1 }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const deletePlaybookPage = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { scope?: Scope; id: string }) => z.object({ scope: scopeSchema, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, orgId } = await dbFor(context, data.scope, true);
    const { error } = await scoped(db.from("playbook_pages").delete().eq("id", data.id), orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Sobe/desce uma seção ou página trocando o sort_order com a vizinha. */
export const movePlaybookItem = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { scope?: Scope; kind: "section" | "page"; id: string; dir: "up" | "down" }) =>
    z.object({ scope: scopeSchema, kind: z.enum(["section", "page"]), id: z.string().uuid(), dir: z.enum(["up", "down"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, orgId } = await dbFor(context, data.scope, true);
    const table = data.kind === "section" ? "playbook_sections" : "playbook_pages";
    const { data: me } = await scoped(db.from(table).select("*").eq("id", data.id), orgId).maybeSingle();
    if (!me) throw new Error("Item não encontrado.");
    let q = scoped(db.from(table).select("id, sort_order"), orgId);
    if (data.kind === "page") q = q.eq("section_id", me.section_id);
    const { data: siblings } = await q.order("sort_order").order("id");
    const list = (siblings ?? []) as any[];
    const i = list.findIndex((s) => s.id === data.id);
    const j = data.dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return { ok: true };
    // Renumera tudo (sort_orders antigos podem ter empate).
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((s, idx) => db.from(table).update({ sort_order: idx }).eq("id", s.id)));
    return { ok: true };
  });

export const setPlaybookRead = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { pageId: string; read?: boolean; checked?: number[] }) =>
    z.object({ pageId: z.string().uuid(), read: z.boolean().optional(), checked: z.array(z.number().int().min(0).max(50)).max(50).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const db: any = context.supabase;
    const { data: existing } = await db.from("playbook_reads").select("read_at, checked")
      .eq("page_id", data.pageId).eq("user_id", context.userId).maybeSingle();
    const row = {
      page_id: data.pageId, user_id: context.userId, org_id: context.orgId,
      read_at: data.read === undefined ? (existing?.read_at ?? null) : data.read ? (existing?.read_at ?? new Date().toISOString()) : null,
      checked: data.checked ?? existing?.checked ?? [],
      updated_at: new Date().toISOString(),
    };
    const { error } = await db.from("playbook_reads").upsert(row, { onConflict: "page_id,user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Painel do gestor: quanto cada pessoa da equipe já leu. */
export const getPlaybookProgress = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const db: any = context.supabase;
    const [{ data: pages }, { data: reads }, { data: people }] = await Promise.all([
      db.from("playbook_pages").select("id, section_id").eq("org_id", context.orgId),
      db.from("playbook_reads").select("page_id, user_id, read_at").eq("org_id", context.orgId).not("read_at", "is", null),
      db.from("profiles").select("id, name, color, avatar_url, active").eq("org_id", context.orgId).eq("active", true),
    ]);
    const pageIds = new Set(((pages ?? []) as any[]).map((p) => p.id));
    const total = pageIds.size;
    return {
      total,
      people: ((people ?? []) as any[]).map((p) => {
        const mine = ((reads ?? []) as any[]).filter((r) => r.user_id === p.id && pageIds.has(r.page_id));
        const last = mine.map((r) => r.read_at as string).sort().pop() ?? null;
        return { id: p.id as string, name: p.name as string, color: p.color as string, read: mine.length, readPageIds: mine.map((r) => r.page_id as string), lastReadAt: last };
      }),
    };
  });

/** "Como fazer" no item do fluxo: status → página do playbook da House. */
export const getPlaybookStepLinks = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<Record<string, { pageId: string; title: string }>> => {
    const { data } = await (context.supabase as any).from("playbook_pages")
      .select("id, title, step_keys, sort_order").eq("org_id", context.orgId).neq("step_keys", "{}").order("sort_order");
    const map: Record<string, { pageId: string; title: string }> = {};
    for (const p of (data ?? []) as any[]) for (const k of p.step_keys ?? []) if (!map[k]) map[k] = { pageId: p.id, title: p.title };
    return map;
  });
