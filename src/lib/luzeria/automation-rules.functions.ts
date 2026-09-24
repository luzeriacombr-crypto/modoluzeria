import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

async function ensureMaster(context: any) {
  const { data } = await context.supabase.rpc("is_master", { _user_id: context.userId });
  if (!data) throw new Error("Forbidden");
}

export const TRIGGER_TYPES = [
  "on_create", "status_change", "deadline_days_before", "deadline_overdue",
  "stale_days", "feed_approved", "item_approved", "feed_feedback", "file_attached",
  "ig_publish_failed", "roteiro_approved", "roteiro_adjust",
  "photo_selection_done", "contract_signed",
  "client_no_post_days", "payment_days_before", "payment_overdue",
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export const ACTION_TYPES = [
  "set_status", "assign_member", "notify", "whatsapp_link", "schedule_instagram",
  "create_item", "add_comment", "move_next_month", "send_email",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/** Gatilhos que acontecem no nível do cliente/agência, sem um item de
 * conteúdo específico — só aceitam ações que não dependem de um item. */
export const CLIENT_LEVEL_TRIGGERS: TriggerType[] = [
  "roteiro_approved", "roteiro_adjust", "photo_selection_done", "contract_signed",
  "client_no_post_days", "payment_days_before", "payment_overdue",
];
export const ITEM_ONLY_ACTIONS: ActionType[] = [
  "set_status", "assign_member", "schedule_instagram", "add_comment", "move_next_month",
];
export const DAYS_TRIGGER_TYPES: TriggerType[] = [
  "deadline_days_before", "stale_days", "client_no_post_days", "payment_days_before",
];

export type AutomationRule = {
  id: string;
  active: boolean;
  filterClientId: string | null;
  filterContentType: string | null;
  actionAudience: string | null;
  actionSubject: string | null;
  fires: number;
  lastFiredAt: string | null;
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
      .select("id, active, trigger_type, trigger_status, trigger_days, action_type, action_status, action_user_id, action_message, filter_client_id, filter_content_type, action_audience, action_subject")
      .order("created_at");
    if (error) throw new Error(error.message);
    // Estatística de disparos (últimos 120 dias, o que o log guarda) —
    // só admin lê o log (RLS), pra membro simplesmente vem zerado.
    const { data: logRows } = await (context.supabase as any)
      .from("automation_rule_log").select("rule_id, fired_at").order("fired_at", { ascending: false }).limit(20000);
    const stats = new Map<string, { fires: number; last: string }>();
    for (const l of (logRows ?? []) as any[]) {
      const cur = stats.get(l.rule_id);
      if (cur) cur.fires += 1; else stats.set(l.rule_id, { fires: 1, last: l.fired_at });
    }
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id, active: r.active,
      filterClientId: r.filter_client_id ?? null, filterContentType: r.filter_content_type ?? null,
      actionAudience: r.action_audience ?? null, actionSubject: r.action_subject ?? null,
      fires: stats.get(r.id)?.fires ?? 0, lastFiredAt: stats.get(r.id)?.last ?? null,
      triggerType: r.trigger_type, triggerStatus: r.trigger_status, triggerDays: r.trigger_days,
      actionType: r.action_type, actionStatus: r.action_status, actionUserId: r.action_user_id,
      actionMessage: r.action_message,
    }));
  });

const MESSAGE_ACTION_TYPES: ActionType[] = ["notify", "whatsapp_link", "create_item", "add_comment", "send_email"];

const createRuleSchema = z.object({
  triggerType: z.enum(TRIGGER_TYPES),
  triggerStatus: z.string().min(1).max(60).optional().nullable(),
  triggerDays: z.number().int().min(0).max(365).optional().nullable(),
  actionType: z.enum(ACTION_TYPES),
  actionStatus: z.string().min(1).max(60).optional().nullable(),
  actionUserId: z.string().uuid().optional().nullable(),
  actionMessage: z.string().trim().max(500).optional().nullable(),
  filterClientId: z.string().uuid().optional().nullable(),
  filterContentType: z.enum(["post", "reel", "story"]).optional().nullable(),
  actionAudience: z.enum(["team", "client"]).optional().nullable(),
  actionSubject: z.string().trim().max(150).optional().nullable(),
}).superRefine((d, ctx) => {
  if (CLIENT_LEVEL_TRIGGERS.includes(d.triggerType) && ITEM_ONLY_ACTIONS.includes(d.actionType)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Essa ação precisa de um item de conteúdo — escolha outra pra esse gatilho", path: ["actionType"] });
  }
  if (d.actionType === "add_comment" && !d.actionMessage) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Escreva o comentário", path: ["actionMessage"] });
  }
  if (d.actionType === "create_item" && !d.actionMessage) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Escreva o título da tarefa", path: ["actionMessage"] });
  }
  if (d.actionType === "send_email" && !d.actionMessage) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Escreva a mensagem do e-mail", path: ["actionMessage"] });
  }
  if (d.triggerType === "status_change" && !d.triggerStatus) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Escolha o status que dispara a regra", path: ["triggerStatus"] });
  }
  if (DAYS_TRIGGER_TYPES.includes(d.triggerType) && (d.triggerDays == null)) {
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
      trigger_status: (data.triggerType === "status_change" || data.triggerType === "stale_days") ? (data.triggerStatus || null) : null,
      trigger_days: DAYS_TRIGGER_TYPES.includes(data.triggerType) ? data.triggerDays : null,
      action_type: data.actionType,
      action_status: data.actionType === "set_status" ? data.actionStatus : null,
      action_user_id: data.actionType === "assign_member" ? data.actionUserId : (data.actionUserId ?? null),
      action_message: MESSAGE_ACTION_TYPES.includes(data.actionType) ? (data.actionMessage || null) : null,
      filter_client_id: data.filterClientId ?? null,
      filter_content_type: CLIENT_LEVEL_TRIGGERS.includes(data.triggerType) ? null : (data.filterContentType ?? null),
      action_audience: data.actionType === "send_email" ? (data.actionAudience ?? "team") : null,
      action_subject: data.actionType === "send_email" ? (data.actionSubject || null) : null,
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

export const setAutomationRuleActive = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { ids: string[]; active: boolean }) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(50), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMaster(context);
    const { error } = await context.supabase.from("automation_rules").update({ active: data.active }).in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** "Testar regra": não executa a ação de verdade — manda uma notificação
 * pra quem clicou mostrando exatamente o texto que sairia (com {cliente} e
 * {titulo} trocados por exemplos), pra conferir a mensagem antes de ativar. */
export const testAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { message: string; description: string }) =>
    z.object({ message: z.string().max(600), description: z.string().max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureMaster(context);
    const preview = data.message
      .replaceAll("{cliente}", "Cliente Exemplo").replaceAll("{titulo}", "Post de exemplo").replaceAll("{erro}", "erro de exemplo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("notifications").insert({
      user_id: context.userId, type: "automation_notify",
      message: `🧪 Teste de automação (${data.description}): ${preview}`,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
