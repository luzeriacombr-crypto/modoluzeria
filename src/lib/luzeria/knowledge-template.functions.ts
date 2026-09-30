// Base de conhecimento modelo (Método Luzeria). A Luzeria edita tudo; as
// Houses só enxergam os TÍTULOS (a IA delas lê o conteúdo no servidor —
// ver luzeria-method.server.ts). O texto nunca sai do servidor pra House.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

async function assertLuzeria(context: { supabase: any; userId: string; orgId: string }) {
  const { LUZERIA_ORG_ID } = await import("./api.functions");
  const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
  if (context.orgId !== LUZERIA_ORG_ID || !isMaster) throw new Error("Só a Luzeria edita a base de conhecimento modelo.");
}

export type KnowledgeTemplateDoc = { id: string; title: string; textContent: string; sortOrder: number; updatedAt: string };

export const listKnowledgeTemplate = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<KnowledgeTemplateDoc[]> => {
    await assertLuzeria(context);
    const { data, error } = await (context.supabase as any).from("knowledge_templates")
      .select("id, title, text_content, sort_order, updated_at").order("sort_order").order("created_at");
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((d) => ({ id: d.id, title: d.title, textContent: d.text_content, sortOrder: d.sort_order, updatedAt: d.updated_at }));
  });

export const saveKnowledgeTemplateDoc = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id?: string; title: string; textContent: string }) =>
    z.object({ id: z.string().uuid().optional(), title: z.string().trim().min(1).max(200), textContent: z.string().trim().min(1).max(60000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertLuzeria(context);
    const db: any = context.supabase;
    if (data.id) {
      const { error } = await db.from("knowledge_templates")
        .update({ title: data.title, text_content: data.textContent, updated_at: new Date().toISOString() }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: maxRow } = await db.from("knowledge_templates").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data: row, error } = await db.from("knowledge_templates")
      .insert({ title: data.title, text_content: data.textContent, sort_order: (maxRow?.sort_order ?? -1) + 1 }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteKnowledgeTemplateDoc = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertLuzeria(context);
    const { error } = await (context.supabase as any).from("knowledge_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveKnowledgeTemplateDoc = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; dir: "up" | "down" }) => z.object({ id: z.string().uuid(), dir: z.enum(["up", "down"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertLuzeria(context);
    const db: any = context.supabase;
    const { data: rows } = await db.from("knowledge_templates").select("id").order("sort_order").order("created_at");
    const list = ((rows ?? []) as any[]).map((r) => r.id as string);
    const i = list.indexOf(data.id);
    const j = data.dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= list.length) return { ok: true };
    [list[i], list[j]] = [list[j], list[i]];
    await Promise.all(list.map((id, idx) => db.from("knowledge_templates").update({ sort_order: idx }).eq("id", id)));
    return { ok: true };
  });

/** Pra House: só os títulos do Método Luzeria (o texto é confidencial). */
export const listLuzeriaMethodTitles = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<string[]> => {
    const { data: org } = await (context.supabase as any).from("orgs").select("account_type").eq("id", context.orgId).maybeSingle();
    if (org?.account_type !== "house") return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any).from("knowledge_templates").select("title").order("sort_order");
    return ((data ?? []) as any[]).map((d) => d.title as string);
  });
