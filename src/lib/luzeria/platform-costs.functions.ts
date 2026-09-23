import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";

/** platform_operating_costs tem RLS ligado sem nenhuma policy (só service
 * role acessa — ver comentário na migration), então toda leitura/escrita
 * passa por supabaseAdmin; quem protege isso de qualquer outra agência é
 * esse gate. */
async function assertPlatformAdmin(supabase: any, userId: string, orgId: string) {
  if (orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (!isMaster) throw new Error("Forbidden");
}

export type PlatformOperatingCost = {
  id: string;
  name: string;
  amountCents: number;
  currency: "USD" | "BRL";
  notes: string | null;
};

export const listOperatingCosts = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<PlatformOperatingCost[]> => {
    await assertPlatformAdmin(context.supabase, context.userId, context.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("platform_operating_costs")
      .select("id, name, amount_cents, currency, notes")
      .order("amount_cents", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id, name: r.name, amountCents: r.amount_cents, currency: r.currency, notes: r.notes,
    }));
  });

export const createOperatingCost = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name: string; amountCents: number; currency: "USD" | "BRL"; notes?: string | null }) =>
    z.object({
      name: z.string().trim().min(1).max(60),
      amountCents: z.number().int().min(0).max(100_000_000),
      currency: z.enum(["USD", "BRL"]),
      notes: z.string().trim().max(300).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId, context.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("platform_operating_costs").insert({
      name: data.name, amount_cents: data.amountCents, currency: data.currency, notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateOperatingCost = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; name: string; amountCents: number; currency: "USD" | "BRL"; notes?: string | null }) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(1).max(60),
      amountCents: z.number().int().min(0).max(100_000_000),
      currency: z.enum(["USD", "BRL"]),
      notes: z.string().trim().max(300).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId, context.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("platform_operating_costs")
      .update({ name: data.name, amount_cents: data.amountCents, currency: data.currency, notes: data.notes ?? null, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOperatingCost = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.userId, context.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("platform_operating_costs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
