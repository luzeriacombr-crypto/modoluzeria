import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";

/** Ordem padrão dos blocos de Minhas demandas, definida pelo Junior e usada
 * por quem ainda não personalizou a própria página. Mora em
 * site_tracking_settings (chave/valor que já existe; leitura liberada pra
 * qualquer logado, escrita só do master da Luzeria). */
const KEY = "my_tasks_default_layout";
const layoutSchema = z.object({
  order: z.array(z.string().max(30)).max(20),
  hidden: z.array(z.string().max(30)).max(20),
});

export const getMyTasksDefaultLayout = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<{ order: string[]; hidden: string[] } | null> => {
    const { data, error } = await (context.supabase as any)
      .from("site_tracking_settings").select("value").eq("key", KEY).maybeSingle();
    if (error) throw new Error(error.message);
    const parsed = layoutSchema.safeParse(data?.value);
    return parsed.success ? parsed.data : null;
  });

export const setMyTasksDefaultLayout = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { layout: { order: string[]; hidden: string[] } }) => ({ layout: layoutSchema.parse(d.layout) }))
  .handler(async ({ data, context }) => {
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const { error } = await (context.supabase as any).from("site_tracking_settings").upsert({
      key: KEY, value: data.layout, updated_by: context.userId, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
