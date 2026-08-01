// Raw HTTP handler for Asaas payment webhooks, wired directly into
// src/server.ts (this app has no file-based "API route" concept — only
// createServerFn RPCs, which Asaas's servers can't call). Server-only file.

async function loadAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const STATUS_BY_EVENT: Record<string, string> = {
  PAYMENT_RECEIVED: "active",
  PAYMENT_CONFIRMED: "active",
  PAYMENT_OVERDUE: "past_due",
  PAYMENT_DELETED: "canceled",
  PAYMENT_REFUNDED: "canceled",
  SUBSCRIPTION_DELETED: "canceled",
  SUBSCRIPTION_INACTIVATED: "canceled",
};

export async function handleAsaasWebhook(request: Request): Promise<Response> {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  const receivedToken = request.headers.get("asaas-access-token");
  if (expectedToken && receivedToken !== expectedToken) {
    return new Response("Forbidden", { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload?.id || !payload?.event) {
    return new Response("Bad Request", { status: 400 });
  }

  const supabaseAdmin = await loadAdmin();

  const { error: insertError } = await supabaseAdmin
    .from("asaas_webhook_events")
    .insert({ id: payload.id, event: payload.event, payload });
  if (insertError) {
    // Duplicate delivery (Asaas retried) — already processed, ack and stop.
    if (insertError.code === "23505") return new Response("OK", { status: 200 });
    console.error("[asaas-webhook] failed to log event", insertError);
    return new Response("OK", { status: 200 });
  }

  const newStatus = STATUS_BY_EVENT[payload.event as string];
  const subscriptionId = payload.payment?.subscription ?? payload.subscription?.id;
  if (newStatus && subscriptionId) {
    const { error: updateError } = await supabaseAdmin
      .from("orgs")
      .update({ subscription_status: newStatus })
      .eq("asaas_subscription_id", subscriptionId);
    if (updateError) console.error("[asaas-webhook] failed to update org status", updateError);
  }

  return new Response("OK", { status: 200 });
}
