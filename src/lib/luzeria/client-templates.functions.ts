import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

async function ensureAdmin(context: any) {
  const { data } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (!data) throw new Error("Forbidden");
}

export type ClientTemplate = {
  id: string;
  category: string;
  postsCount: number;
  reelsCount: number;
  createDemandsPage: boolean;
  welcomeMessage: string | null;
  defaultAssigneeId: string | null;
};

export const listClientTemplates = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<ClientTemplate[]> => {
    const { data, error } = await (context.supabase as any)
      .from("client_templates")
      .select("id, category, posts_count, reels_count, create_demands_page, welcome_message, default_assignee_id")
      .order("category");
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((t) => ({
      id: t.id,
      category: t.category,
      postsCount: t.posts_count,
      reelsCount: t.reels_count,
      createDemandsPage: t.create_demands_page,
      welcomeMessage: t.welcome_message,
      defaultAssigneeId: t.default_assignee_id,
    }));
  });

const templateSchema = z.object({
  category: z.string().trim().min(1).max(40),
  postsCount: z.number().int().min(0).max(60),
  reelsCount: z.number().int().min(0).max(60),
  createDemandsPage: z.boolean(),
  welcomeMessage: z.string().trim().max(1000).optional().nullable(),
  defaultAssigneeId: z.string().uuid().optional().nullable(),
});

/** Um modelo por categoria — salvar de novo sobrescreve o que existia. */
export const upsertClientTemplate = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: z.infer<typeof templateSchema>) => templateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await (context.supabase as any)
      .from("client_templates")
      .upsert({
        org_id: context.orgId,
        category: data.category,
        posts_count: data.postsCount,
        reels_count: data.reelsCount,
        create_demands_page: data.createDemandsPage,
        welcome_message: data.welcomeMessage || null,
        default_assignee_id: data.defaultAssigneeId || null,
        created_by: context.userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "org_id,category" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClientTemplate = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { error } = await (context.supabase as any).from("client_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
