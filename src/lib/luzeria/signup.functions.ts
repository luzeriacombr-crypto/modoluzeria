// Public, unauthenticated server functions for the self-service signup flow
// at /assinar. No requireActiveProfile middleware — there is no logged-in
// user yet. Writes go through supabaseAdmin (service role) since RLS has
// nothing to authenticate against at this point.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPublicPlans = createServerFn({ method: "GET" })
  .handler(async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
    const { data, error } = await supabase.from("plans").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map((p: any) => ({
      id: p.id as string,
      name: p.name as string,
      priceCents: p.price_cents as number | null,
      maxClients: p.max_clients as number | null,
      maxCollaborators: p.max_collaborators as number | null,
      sortOrder: p.sort_order as number,
    }));
  });

const TRIAL_DAYS = 7;

export const publicSignup = createServerFn({ method: "POST" })
  .inputValidator((d: {
    agencyName: string; name: string; email: string; password: string;
    planId: string; taxId: string; website?: string; promoCode?: string; affiliateCode?: string;
    billingType?: "CREDIT_CARD" | "UNDEFINED";
  }) =>
    z.object({
      agencyName: z.string().trim().min(2).max(80),
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().toLowerCase().email(),
      password: z.string().min(8).max(72),
      planId: z.string().min(1),
      taxId: z.string().trim().regex(/^\d{11}$|^\d{14}$/, "CNPJ ou CPF inválido."),
      website: z.string().max(0).optional().or(z.literal("")), // honeypot — must stay empty
      promoCode: z.string().optional(),
      affiliateCode: z.string().optional(),
      // UNDEFINED lets the customer pick PIX/Boleto/Cartão on Asaas's own
      // invoice page — for whoever doesn't have a card. Defaults to
      // CREDIT_CARD so existing behavior (auto-recurring charge) is unchanged.
      billingType: z.enum(["CREDIT_CARD", "UNDEFINED"]).optional(),
    }).parse(d))
  .handler(async ({ data }) => {
    if (data.website) {
      // Bot filled the honeypot field — pretend success, do nothing.
      return { invoiceUrl: null };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkSignupRateLimit } = await import("./signup-rate-limit.server");
    await checkSignupRateLimit(supabaseAdmin);

    const { data: plan } = await supabaseAdmin
      .from("plans").select("id, name, price_cents").eq("id", data.planId).maybeSingle();
    if (!plan) throw new Error("Plano não encontrado.");
    if (plan.price_cents == null) throw new Error("Este plano é sob consulta — fale com a gente pra contratar.");

    // Check email_role_assignments (the table whose primary key this would
    // collide on) directly — auth.admin.listUsers() is paginated (50/page
    // by default) and silently misses existing accounts once the project
    // has more users than that, letting duplicate signups reach the insert
    // and fail with a raw Postgres constraint error instead of this message.
    const { data: existingAssignment } = await supabaseAdmin
      .from("email_role_assignments")
      .select("email")
      .eq("email", data.email)
      .maybeSingle();
    if (existingAssignment) {
      throw new Error("Já existe uma conta com esse e-mail.");
    }

    const slugBase = data.agencyName.trim().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "agencia";
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("orgs")
      .insert({
        name: data.agencyName.trim(),
        slug: `${slugBase}-${Date.now().toString(36)}`,
        plan_id: plan.id,
        subscription_status: "trialing",
        trial_ends_at: trialEndsAt.toISOString(),
        tax_id: data.taxId,
      })
      .select("id").single();
    if (orgErr) throw new Error(orgErr.message);

    let earInserted = false;
    try {
      const { error: earErr } = await supabaseAdmin.from("email_role_assignments").insert({
        email: data.email, role: "master", name: data.name.trim(), org_id: org.id,
      });
      if (earErr) throw new Error(earErr.message);
      earInserted = true;

      const { data: created, error: userErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: false,
        user_metadata: { name: data.name.trim() },
      });
      if (userErr || !created?.user) throw new Error(userErr?.message ?? "Não foi possível criar sua conta.");

      // admin.createUser() never sends the confirmation email itself — trigger it explicitly.
      const { error: resendErr } = await supabaseAdmin.auth.resend({ type: "signup", email: data.email });
      if (resendErr) console.error("Falha ao enviar e-mail de confirmação:", resendErr.message);

      let promotionCodeId: string | undefined;
      let affiliateReferralId: string | undefined;
      let discountedValueCents = plan.price_cents;

      // Resolve promotion code if provided — must happen before the Asaas
      // subscription is created so the discount actually reaches the charge.
      if (data.promoCode) {
        try {
          const { validatePromotionCode } = await import("./promotion-affiliate.functions");
          const promo = await validatePromotionCode({ data: { code: data.promoCode } });
          if (promo) {
            promotionCodeId = promo.id;
            discountedValueCents = Math.round(plan.price_cents * (1 - promo.discountPercent / 100));
          }
        } catch (err) {
          console.error("Failed to validate promo code:", err);
        }
      }

      // Resolve affiliate program (referral record is created after the
      // user/org exist, further below).
      let affiliateId: string | undefined;
      if (data.affiliateCode) {
        try {
          const { getAffiliateByReferralCode } = await import("./promotion-affiliate.functions");
          const affiliate = await getAffiliateByReferralCode({ data: { referralCode: data.affiliateCode } });
          if (affiliate) affiliateId = affiliate.id;
        } catch (err) {
          console.error("Failed to resolve affiliate code:", err);
        }
      }

      const { createAsaasCustomer, createAsaasSubscription } = await import("./asaas.server");
      const customer = await createAsaasCustomer({ name: data.agencyName.trim(), cpfCnpj: data.taxId, email: data.email });
      const { subscriptionId, invoiceUrl } = await createAsaasSubscription({
        customerId: customer.id,
        valueCents: discountedValueCents,
        description: `Modo Criador — Plano ${plan.name}`,
        billingType: data.billingType ?? "CREDIT_CARD",
        trialDays: TRIAL_DAYS,
      });

      if (affiliateId) {
        const { data: referral, error: refErr } = await supabaseAdmin
          .from("affiliate_referrals")
          .insert({
            affiliate_id: affiliateId,
            referred_user_id: created.user.id,
            referred_org_id: org.id,
          })
          .select("id")
          .single();
        if (!refErr && referral) affiliateReferralId = referral.id;
      }

      await supabaseAdmin.from("orgs")
        .update({
          asaas_customer_id: customer.id,
          asaas_subscription_id: subscriptionId,
          promotion_code_id: promotionCodeId,
          affiliate_referral_id: affiliateReferralId,
        })
        .eq("id", org.id);

      return { invoiceUrl };
    } catch (e) {
      // Best-effort cleanup so a failed signup doesn't leave an orphaned org behind.
      await supabaseAdmin.from("orgs").delete().eq("id", org.id);
      // Only remove the email_role_assignments row if THIS attempt created
      // it (earInserted). If the insert itself is what failed — e.g. a
      // duplicate-key error because the email already had a row from a
      // different, unrelated account — deleting by e-mail here would wipe
      // out that pre-existing row instead of anything this attempt made.
      if (earInserted) {
        await supabaseAdmin.from("email_role_assignments").delete().eq("email", data.email).eq("org_id", org.id);
      }
      throw e;
    }
  });

/** Second half of the self-service trial signup for people who chose
 * "Entrar com Google" on /assinar instead of e-mail+senha. By the time this
 * runs, Supabase already created their auth.users/profiles row via OAuth —
 * handle_new_user() found no email_role_assignments match yet, so it landed
 * inactive on the Luzeria fallback org (see 20260803220000 migration). This
 * provisions the real org/plan/subscription, same as publicSignup, then
 * activates that existing profile into it instead of creating a new user. */
export const completeGoogleSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { agencyName: string; name: string; taxId: string; planId: string; promoCode?: string; affiliateCode?: string; billingType?: "CREDIT_CARD" | "UNDEFINED" }) =>
    z.object({
      agencyName: z.string().trim().min(2).max(80),
      name: z.string().trim().min(2).max(80),
      taxId: z.string().trim().regex(/^\d{11}$|^\d{14}$/, "CNPJ ou CPF inválido."),
      planId: z.string().min(1),
      promoCode: z.string().optional(),
      affiliateCode: z.string().optional(),
      billingType: z.enum(["CREDIT_CARD", "UNDEFINED"]).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const email = (context.claims.email as string | undefined)?.toLowerCase();
    if (!email) throw new Error("Não foi possível identificar seu e-mail do Google.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkSignupRateLimit } = await import("./signup-rate-limit.server");
    await checkSignupRateLimit(supabaseAdmin);

    const { data: plan } = await supabaseAdmin
      .from("plans").select("id, name, price_cents").eq("id", data.planId).maybeSingle();
    if (!plan) throw new Error("Plano não encontrado.");
    if (plan.price_cents == null) throw new Error("Este plano é sob consulta — fale com a gente pra contratar.");

    const { data: existingAssignment } = await supabaseAdmin
      .from("email_role_assignments")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (existingAssignment) {
      throw new Error("Essa conta do Google já está vinculada a uma agência.");
    }

    const slugBase = data.agencyName.trim().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "agencia";
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DAYS);

    const { data: org, error: orgErr } = await supabaseAdmin
      .from("orgs")
      .insert({
        name: data.agencyName.trim(),
        slug: `${slugBase}-${Date.now().toString(36)}`,
        plan_id: plan.id,
        subscription_status: "trialing",
        trial_ends_at: trialEndsAt.toISOString(),
        tax_id: data.taxId,
      })
      .select("id").single();
    if (orgErr) throw new Error(orgErr.message);

    let earInserted = false;
    try {
      const { error: earErr } = await supabaseAdmin.from("email_role_assignments").insert({
        email, role: "master", name: data.name.trim(), org_id: org.id,
      });
      if (earErr) throw new Error(earErr.message);
      earInserted = true;

      let promotionCodeId: string | undefined;
      let affiliateReferralId: string | undefined;
      let discountedValueCents = plan.price_cents;

      // Resolve promotion code if provided — must happen before the Asaas
      // subscription is created so the discount actually reaches the charge.
      if (data.promoCode) {
        try {
          const { validatePromotionCode } = await import("./promotion-affiliate.functions");
          const promo = await validatePromotionCode({ data: { code: data.promoCode } });
          if (promo) {
            promotionCodeId = promo.id;
            discountedValueCents = Math.round(plan.price_cents * (1 - promo.discountPercent / 100));
          }
        } catch (err) {
          console.error("Failed to validate promo code:", err);
        }
      }

      // Resolve affiliate program (referral record is created after the
      // user/org exist, further below).
      let affiliateId: string | undefined;
      if (data.affiliateCode) {
        try {
          const { getAffiliateByReferralCode } = await import("./promotion-affiliate.functions");
          const affiliate = await getAffiliateByReferralCode({ data: { referralCode: data.affiliateCode } });
          if (affiliate) affiliateId = affiliate.id;
        } catch (err) {
          console.error("Failed to resolve affiliate code:", err);
        }
      }

      const { createAsaasCustomer, createAsaasSubscription } = await import("./asaas.server");
      const customer = await createAsaasCustomer({ name: data.agencyName.trim(), cpfCnpj: data.taxId, email });
      const { subscriptionId, invoiceUrl } = await createAsaasSubscription({
        customerId: customer.id,
        valueCents: discountedValueCents,
        description: `Modo Criador — Plano ${plan.name}`,
        billingType: data.billingType ?? "CREDIT_CARD",
        trialDays: TRIAL_DAYS,
      });

      if (affiliateId) {
        const { data: referral, error: refErr } = await supabaseAdmin
          .from("affiliate_referrals")
          .insert({
            affiliate_id: affiliateId,
            referred_user_id: context.userId,
            referred_org_id: org.id,
          })
          .select("id")
          .single();
        if (!refErr && referral) affiliateReferralId = referral.id;
      }

      await supabaseAdmin.from("orgs")
        .update({
          asaas_customer_id: customer.id,
          asaas_subscription_id: subscriptionId,
          promotion_code_id: promotionCodeId,
          affiliate_referral_id: affiliateReferralId,
        })
        .eq("id", org.id);

      const { error: profileErr } = await supabaseAdmin.from("profiles")
        .update({ org_id: org.id, active: true, name: data.name.trim() })
        .eq("id", context.userId);
      if (profileErr) throw new Error(profileErr.message);

      const { error: roleErr } = await supabaseAdmin.from("user_roles")
        .update({ role: "master" })
        .eq("user_id", context.userId);
      if (roleErr) throw new Error(roleErr.message);

      return { invoiceUrl };
    } catch (e) {
      await supabaseAdmin.from("orgs").delete().eq("id", org.id);
      if (earInserted) {
        await supabaseAdmin.from("email_role_assignments").delete().eq("email", email).eq("org_id", org.id);
      }
      throw e;
    }
  });
