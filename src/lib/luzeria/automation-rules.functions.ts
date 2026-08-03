import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

async function ensureMaster(context: any) {
  const { data } = await context.supabase.rpc("is_master", { _user_id: context.userId });
  if (!data) throw new Error("Forbidden");
}

export type AutomationRule = {
  id: string;
  active: boolean;
  triggerStatus: string | null;
  onCreate: boolean;
  actionType: "set_status" | "assign_member";
  actionStatus: string | null;
  actionUserId: string | null;
};

export const listAutomationRules = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<AutomationRule[]> => {
    const { data, error } = await context.supabase
      .from("automation_rules")
      .select("id, active, trigger_status, on_create, action_type, action_status, action_user_id")
      .order("created_at");
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id, active: r.active, triggerStatus: r.trigger_status, onCreate: r.on_create,
      actionType: r.action_type, actionStatus: r.action_status, actionUserId: r.action_user_id,
    }));
  });

export const createAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { triggerStatus?: string | null; onCreate?: boolean; actionType: "set_status" | "assign_member"; actionStatus?: string | null; actionUserId?: string | null }) =>
    z.object({
      triggerStatus: z.string().min(1).optional().nullable(),
      onCreate: z.boolean().optional(),
      actionType: z.enum(["set_status", "assign_member"]),
      actionStatus: z.string().min(1).optional().nullable(),
      actionUserId: z.string().uuid().optional().nullable(),
    }).refine(
      (d) => d.actionType === "set_status" ? !!d.actionStatus : !!d.actionUserId,
      { message: "Campo da ação é obrigatório" },
    ).refine(
      (d) => !!d.onCreate !== !!d.triggerStatus,
      { message: "Escolha um gatilho: status ou criação" },
    ).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMaster(context);
    const { error } = await context.supabase.from("automation_rules").insert({
      org_id: context.orgId,
      trigger_status: data.onCreate ? null : data.triggerStatus,
      on_create: !!data.onCreate,
      action_type: data.actionType,
      action_status: data.actionType === "set_status" ? data.actionStatus : null,
      action_user_id: data.actionType === "assign_member" ? data.actionUserId : null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await ensureMaster(context);
    const { error } = await context.supabase.from("automation_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
