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
  // Fail closed: if the token isn't configured, this endpoint can't be
  // verified, so reject everything instead of silently accepting any caller.
  if (!expectedToken || receivedToken !== expectedToken) {
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

  // A one-time gift discount (see applyPromotionCodeToOrg) may be waiting
  // for this org's next invoice. Apply it now that the invoice exists, then
  // clear it so it never discounts more than that single payment.
  if (payload.event === "PAYMENT_CREATED" && payload.payment?.subscription) {
    const { data: org } = await supabaseAdmin
      .from("orgs")
      .select("id, promotion_code_id")
      .eq("asaas_subscription_id", payload.payment.subscription)
      .maybeSingle();
    if (org?.promotion_code_id) {
      const { data: promo } = await supabaseAdmin
        .from("promotion_codes")
        .select("discount_percent")
        .eq("id", org.promotion_code_id)
        .maybeSingle();
      if (promo) {
        const { updateAsaasPaymentValue } = await import("./asaas.server");
        const discountedValueCents = Math.round(
          payload.payment.value * 100 * (1 - promo.discount_percent / 100),
        );
        try {
          await updateAsaasPaymentValue(payload.payment.id, discountedValueCents);
          const { notifyOrgMasters } = await import("./promotion-affiliate.functions");
          await notifyOrgMasters(
            org.id,
            `Desconto de ${promo.discount_percent}% aplicado na sua fatura deste mês! Novo valor: R$ ${(discountedValueCents / 100).toFixed(2)}.`,
          );
        } catch (err) {
          console.error("[asaas-webhook] failed to apply gift discount", err);
        }
      }
      await supabaseAdmin.from("orgs").update({ promotion_code_id: null }).eq("id", org.id);
    }
  }

  return new Response("OK", { status: 200 });
}
