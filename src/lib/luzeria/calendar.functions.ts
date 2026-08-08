import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { signCoverPaths } from "./api.functions";

export const getCalendarItems = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { from: string; to: string }) =>
    z.object({ from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: items, error } = await context.supabase
      .from("content_items")
      .select(
        "id, title, type, status, scheduled_at, cover_path, months!inner(key, clients!inner(id, name, color, category, archived))",
      )
      .gte("scheduled_at", data.from)
      .lt("scheduled_at", data.to)
      .not("scheduled_at", "is", null);
    if (error) throw error;

    const filtered = (items ?? []).filter((it: any) => {
      const client = it.months?.clients;
      if (!client || client.archived) return false;
      if ((client.category ?? "Social Media") === "Ex-clientes") return false;
      return true;
    });

    const signedCovers = await signCoverPaths(context.supabase, filtered.map((it: any) => it.cover_path));

    return filtered.map((it: any) => ({
      id: it.id,
      title: it.title,
      type: it.type,
      status: it.status,
      scheduledAt: it.scheduled_at,
      monthKey: it.months.key,
      clientId: it.months.clients.id,
      clientName: it.months.clients.name,
      clientColor: it.months.clients.color,
      coverUrl: it.cover_path ? signedCovers.get(it.cover_path) ?? null : null,
    }));
  });
