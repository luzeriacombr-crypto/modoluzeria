// TEMPORARY — investigating missing posts reported by Jordânia (2026-07-09). Delete after use.
import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";

export const investigateItemLoss = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");

    const names = ["Anastasia", "Fonseca e Pinto", "CVC Viagens", "Eglantine Queiroz", "Filipe Damasceno"];
    const { data: clients, error: clientsErr } = await context.supabase
      .from("clients").select("id,name,archived,category").in("name", names);
    const clientIds = (clients ?? []).map((c: any) => c.id);

    const { data: months, error: monthsErr } = await context.supabase
      .from("months").select("id,key,client_id").in("client_id", clientIds.length ? clientIds : ["00000000-0000-0000-0000-000000000000"]);
    const monthIds = (months ?? []).map((m: any) => m.id);

    const { data: items, error: itemsErr } = await context.supabase
      .from("content_items")
      .select("id,title,type,status,month_id,updated_at")
      .in("month_id", monthIds.length ? monthIds : ["00000000-0000-0000-0000-000000000000"]);

    // Sanity check: is content_items readable/non-empty at all for this session?
    const { count: totalItemsCount, error: countErr } = await context.supabase
      .from("content_items").select("id", { count: "exact", head: true });

    const since = new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString();
    const { data: activity, error: activityErr } = await context.supabase
      .from("activity_log")
      .select("id,actor_id,entity_type,entity_id,action,meta,at")
      .eq("entity_type", "content_item")
      .gte("at", since)
      .order("at", { ascending: false })
      .limit(500);

    // Direct per-ID lookup for every "created" entity in the window, bypassing
    // the month/client join entirely — conclusive existence check per item.
    const createdIds = [...new Set((activity ?? []).filter((a: any) => a.action === "created").map((a: any) => a.entity_id))];
    const { data: directLookup, error: directErr } = await context.supabase
      .from("content_items")
      .select("id,title,status,month_id,updated_at")
      .in("id", createdIds.length ? createdIds : ["00000000-0000-0000-0000-000000000000"]);

    // For whichever of those DO still exist, resolve their real client/month via a direct join.
    const survivingMonthIds = [...new Set((directLookup ?? []).map((i: any) => i.month_id))];
    const { data: survivingMonths, error: survivingMonthsErr } = await context.supabase
      .from("months").select("id,key,client_id").in("id", survivingMonthIds.length ? survivingMonthIds : ["00000000-0000-0000-0000-000000000000"]);
    const survivingClientIds = [...new Set((survivingMonths ?? []).map((m: any) => m.client_id))];
    const { data: survivingClients, error: survivingClientsErr } = await context.supabase
      .from("clients").select("id,name").in("id", survivingClientIds.length ? survivingClientIds : ["00000000-0000-0000-0000-000000000000"]);

    const { data: profiles } = await context.supabase.from("profiles").select("id,name");

    return {
      clients: clients ?? [],
      months: months ?? [],
      items: items ?? [],
      activity: activity ?? [],
      profiles: profiles ?? [],
      directLookup: directLookup ?? [],
      survivingMonths: survivingMonths ?? [],
      survivingClients: survivingClients ?? [],
      totalItemsCount,
      errors: {
        clientsErr: clientsErr?.message ?? null,
        monthsErr: monthsErr?.message ?? null,
        itemsErr: itemsErr?.message ?? null,
        countErr: countErr?.message ?? null,
        activityErr: activityErr?.message ?? null,
        directErr: directErr?.message ?? null,
        survivingMonthsErr: survivingMonthsErr?.message ?? null,
        survivingClientsErr: survivingClientsErr?.message ?? null,
      },
    };
  });
