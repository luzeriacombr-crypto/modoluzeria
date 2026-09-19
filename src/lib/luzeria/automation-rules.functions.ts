import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

async function ensureMaster(context: any) {
  const { data } = await context.supabase.rpc("is_master", { _user_id: context.userId });
  if (!data) throw new Error("Forbidden");
}

export const TRIGGER_TYPES = [
  "on_create", "status_change", "deadline_days_before", "deadline_overdue",
  "stale_days", "feed_approved", "feed_feedback", "file_attached",
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const ACTION_TYPES = ["set_status", "assign_member", "notify", "whatsapp_link", "schedule_instagram"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export type AutomationRule = {
  id: string;
  active: boolean;
  triggerType: TriggerType;
  triggerStatus: string | null;
  triggerDays: number | null;
  actionType: ActionType;
  actionStatus: string | null;
  actionUserId: string | null;
  actionMessage: string | null;
};

export const listAutomationRules = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<AutomationRule[]> => {
    const { data, error } = await context.supabase
      .from("automation_rules")
      .select("id, active, trigger_type, trigger_status, trigger_days, action_type, action_status, action_user_id, action_message")
      .order("created_at");
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id, active: r.active,
      triggerType: r.trigger_type, triggerStatus: r.trigger_status, triggerDays: r.trigger_days,
      actionType: r.action_type, actionStatus: r.action_status, actionUserId: r.action_user_id,
      actionMessage: r.action_message,
    }));
  });

const createRuleSchema = z.object({
  triggerType: z.enum(TRIGGER_TYPES),
  triggerStatus: z.string().min(1).max(60).optional().nullable(),
  triggerDays: z.number().int().min(0).max(365).optional().nullable(),
  actionType: z.enum(ACTION_TYPES),
  actionStatus: z.string().min(1).max(60).optional().nullable(),
  actionUserId: z.string().uuid().optional().nullable(),
  actionMessage: z.string().trim().max(500).optional().nullable(),
}).superRefine((d, ctx) => {
  if (d.triggerType === "status_change" && !d.triggerStatus) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Escolha o status que dispara a regra", path: ["triggerStatus"] });
  }
  if ((d.triggerType === "deadline_days_before" || d.triggerType === "stale_days") && (d.triggerDays == null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe quantos dias", path: ["triggerDays"] });
  }
  if (d.actionType === "set_status" && !d.actionStatus) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Escolha o status de destino", path: ["actionStatus"] });
  }
  if (d.actionType === "assign_member" && !d.actionUserId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Escolha quem vai ser atribuído", path: ["actionUserId"] });
  }
});

export const createAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: z.infer<typeof createRuleSchema>) => createRuleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureMaster(context);
    const { error } = await (context.supabase as any).from("automation_rules").insert({
      org_id: context.orgId,
      trigger_type: data.triggerType,
      trigger_status: data.triggerType === "status_change" ? data.triggerStatus : null,
      trigger_days: (data.triggerType === "deadline_days_before" || data.triggerType === "stale_days") ? data.triggerDays : null,
      action_type: data.actionType,
      action_status: data.actionType === "set_status" ? data.actionStatus : null,
      action_user_id: data.actionType === "assign_member" ? data.actionUserId : (data.actionUserId ?? null),
      action_message: (data.actionType === "notify" || data.actionType === "whatsapp_link") ? (data.actionMessage || null) : null,
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
