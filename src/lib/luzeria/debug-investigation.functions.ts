// TEMPORARY — investigating missing posts reported by Jordânia (2026-07-09). Delete after use.
import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";

export const investigateItemLoss = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");

    const names = ["Anastasia", "Fonseca e Pinto", "CVC Viagens", "Eglantine Queiroz", "Filipe Damasceno"];
    const { data: clients } = await context.supabase
      .from("clients").select("id,name,archived,category").in("name", names);
    const clientIds = (clients ?? []).map((c: any) => c.id);

    const { data: months } = await context.supabase
      .from("months").select("id,key,client_id").in("client_id", clientIds.length ? clientIds : ["-"]);
    const monthIds = (months ?? []).map((m: any) => m.id);

    const { data: items } = await context.supabase
      .from("content_items")
      .select("id,title,type,status,month_id,created_at,updated_at")
      .in("month_id", monthIds.length ? monthIds : ["-"]);

    const since = new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString();
    const { data: activity } = await context.supabase
      .from("activity_log")
      .select("id,actor_id,entity_type,entity_id,action,meta,at")
      .eq("entity_type", "content_item")
      .gte("at", since)
      .order("at", { ascending: false })
      .limit(500);

    const { data: profiles } = await context.supabase.from("profiles").select("id,name");

    return {
      clients: clients ?? [],
      months: months ?? [],
      items: items ?? [],
      activity: activity ?? [],
      profiles: profiles ?? [],
    };
  });
