import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

export type ClientBlockedItem = {
  id: string;
  title: string;
  type: string;
  blockedReason: string | null;
  updatedAt: string;
  monthKey: string;
};

export const getClientBlockedItems = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: rows, error } = await context.supabase
      .from("content_items")
      .select("id, title, type, blocked_reason, updated_at, months!inner(key, client_id)")
      .eq("status", "TRAVADO")
      .eq("months.client_id", data.clientId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id, title: r.title, type: r.type,
      blockedReason: r.blocked_reason, updatedAt: r.updated_at,
      monthKey: r.months.key,
    })) as ClientBlockedItem[];
  });
