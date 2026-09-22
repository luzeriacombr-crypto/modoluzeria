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
    const { LUZERIA_ORG_ID } = await import("./api.functions");
    // Luzeria is the platform owner, not a paying customer — never let a
    // real (or lapsed) Asaas subscription flip its own status to past_due/
    // canceled/etc. Junior's explicit call: special case, not a bug.
    const dbStatus = supabaseAdmin as any;
    const { data: orgBefore } = await dbStatus
      .from("orgs").select("id, payment_grace_started_at, deactivation_reason")
      .eq("asaas_subscription_id", subscriptionId).neq("id", LUZERIA_ORG_ID).maybeSingle();

    const statusUpdate: Record<string, unknown> = { subscription_status: newStatus };
    if (newStatus === "past_due") {
      // Começa a contar os 7 dias de tolerância só na primeira vez que a
      // fatura vence — um novo webhook OVERDUE pro mesmo atraso (Asaas
      // reenvia) não pode resetar o prazo que a pessoa já recebeu.
      if (orgBefore && !orgBefore.payment_grace_started_at) {
        statusUpdate.payment_grace_started_at = new Date().toISOString();
      }
    } else if (newStatus === "active") {
      // Pagamento em dia de novo — encerra a régua de cobrança e, se a
      // conta tinha sido pausada por causa dela, reabre na hora (sem
      // esperar a pessoa pedir pra alguém da Luzeria reativar na mão).
      statusUpdate.payment_grace_started_at = null;
      if (orgBefore?.deactivation_reason === "payment") {
        statusUpdate.deactivation_reason = null;
        statusUpdate.deactivated_at = null;
      }
    }

    const { error: updateError } = await dbStatus
      .from("orgs")
      .update(statusUpdate)
      .eq("asaas_subscription_id", subscriptionId)
      .neq("id", LUZERIA_ORG_ID);
    if (updateError) console.error("[asaas-webhook] failed to update org status", updateError);

    if (orgBefore && newStatus === "active" && orgBefore.deactivation_reason === "payment") {
      const { error: reactivateError } = await supabaseAdmin
        .from("profiles").update({ active: true }).eq("org_id", orgBefore.id);
      if (reactivateError) console.error("[asaas-webhook] failed to reactivate profiles", reactivateError);
    }

    // Marca a primeira cobrança confirmada, uma única vez — é a partir daqui
    // que o programa de indicação conta os 60 dias como pagante ativo antes
    // de confirmar o crédito de quem indicou (ver runAgencyReferralChecks).
    // "as any": first_payment_confirmed_at é uma coluna nova, ainda não
    // presente nos tipos gerados do Supabase até a migração rodar.
    if (newStatus === "active") {
      const dbFirstPayment = supabaseAdmin as any;
      const { data: orgRow } = await dbFirstPayment
        .from("orgs").select("id, first_payment_confirmed_at")
        .eq("asaas_subscription_id", subscriptionId).maybeSingle();
      if (orgRow && !orgRow.first_payment_confirmed_at) {
        await dbFirstPayment.from("orgs")
          .update({ first_payment_confirmed_at: new Date().toISOString() }).eq("id", orgRow.id);
      }
    }
  }

  // A one-time gift discount (see applyPromotionCodeToOrg) may be waiting
  // for this org's next invoice. Apply it now that the invoice exists, then
  // clear it so it never discounts more than that single payment.
  if (payload.event === "PAYMENT_CREATED" && payload.payment?.subscription) {
    // "as any": referral_credit_balance e referral_credit_ledger são novos,
    // ainda não presentes nos tipos gerados do Supabase até a migração rodar.
    const db = supabaseAdmin as any;
    const { data: org } = await db
      .from("orgs")
      .select("id, promotion_code_id, referral_credit_balance")
      .eq("asaas_subscription_id", payload.payment.subscription)
      .maybeSingle();

    // Saldo de indicação tem prioridade sobre cupom — mês grátis de verdade
    // é melhor que um desconto parcial no mesmo mês.
    let creditConsumed = false;
    if (org && org.referral_credit_balance > 0) {
      try {
        const { deleteAsaasPayment } = await import("./asaas.server");
        await deleteAsaasPayment(payload.payment.id);
        const newBalance = org.referral_credit_balance - 1;
        await db.from("orgs").update({ referral_credit_balance: newBalance }).eq("id", org.id);
        await db.from("referral_credit_ledger").insert({
          org_id: org.id, delta: -1, reason: "billing_cycle_consumed", balance_after: newBalance,
        });
        const { notifyOrgMasters } = await import("./promotion-affiliate.functions");
        await notifyOrgMasters(org.id, "Sua cobrança deste mês foi coberta pelo seu saldo de indicação!", "referral_credit_used");
        creditConsumed = true;
      } catch (err) {
        console.error("[asaas-webhook] failed to consume referral credit", err);
      }
    }

    if (!creditConsumed && org?.promotion_code_id) {
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
