// Banco de conhecimento de conteúdo por agência — texto livre ou arquivos
// (upload direto do browser pro bucket "org-knowledge", metadata gravada
// aqui). Alimenta generateMonthlyPlanPreview (ai-planning.functions.ts).
import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

export type OrgKnowledgeEntry = {
  id: string;
  kind: "text" | "file";
  title: string | null;
  textContent: string | null;
  fileName: string | null;
  mimeType: string | null;
  createdAt: string;
};

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (!isAdmin) throw new Error("Forbidden");
}

export const listOrgKnowledge = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<OrgKnowledgeEntry[]> => {
    await assertAdmin(context);
    const { data: rows, error } = await (context.supabase as any)
      .from("org_content_knowledge")
      .select("id, kind, title, text_content, file_name, mime_type, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id, kind: r.kind, title: r.title, textContent: r.text_content,
      fileName: r.file_name, mimeType: r.mime_type, createdAt: r.created_at,
    }));
  });

export const saveOrgKnowledgeText = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { title?: string; content: string }) =>
    z.object({
      title: z.string().trim().max(160).optional(),
      content: z.string().trim().min(1).max(20000),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await (context.supabase as any).from("org_content_knowledge").insert({
      org_id: context.orgId, kind: "text",
      title: data.title || null, text_content: data.content, created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// A pessoa faz o upload direto do browser pro bucket "org-knowledge"
// (mesmo padrão do avatar) e só chama isso depois, com o path já gravado,
// pra registrar a metadata.
export const saveOrgKnowledgeFile = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { storagePath: string; fileName: string; mimeType: string; title?: string }) =>
    z.object({
      storagePath: z.string().min(1).max(300),
      fileName: z.string().min(1).max(200),
      mimeType: z.string().max(120),
      title: z.string().trim().max(160).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.storagePath.startsWith(`${context.orgId}/`)) throw new Error("Caminho inválido.");
    const { error } = await (context.supabase as any).from("org_content_knowledge").insert({
      org_id: context.orgId, kind: "file", title: data.title || null,
      storage_path: data.storagePath, file_name: data.fileName, mime_type: data.mimeType,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOrgKnowledge = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase as any;
    const { data: row } = await db.from("org_content_knowledge")
      .select("storage_path").eq("id", data.id).maybeSingle();
    if (row?.storage_path) {
      await context.supabase.storage.from("org-knowledge").remove([row.storage_path]);
    }
    const { error } = await db.from("org_content_knowledge").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
