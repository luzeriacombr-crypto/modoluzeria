import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";
import type { PromotionCode, AffiliateProgram } from "./types";

function mapPromotionCode(p: any): PromotionCode {
  return {
    id: p.id,
    orgId: p.org_id,
    name: p.name,
    code: p.code,
    slug: p.slug,
    discountPercent: p.discount_percent,
    description: p.description ?? undefined,
    active: p.active,
    validFrom: p.valid_from ?? undefined,
    validUntil: p.valid_until ?? undefined,
    maxUses: p.max_uses ?? undefined,
    usedCount: p.used_count,
    createdBy: p.created_by,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

function mapAffiliateProgram(a: any): AffiliateProgram {
  return {
    id: a.id,
    orgId: a.org_id,
    userId: a.user_id,
    referralCode: a.referral_code,
    commissionPercent: a.commission_percent,
    commissionValidMonths: a.commission_valid_months,
    active: a.active,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  };
}

// ============ PROMOTION CODES ============

export const createPromotionCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event) => {
    const data = event.data as {
      name: string;
      code: string;
      slug: string;
      discountPercent: number;
      description?: string;
      validFrom?: string;
      validUntil?: string;
      maxUses?: number;
    };
    const { orgId, userId } = event.context as any;
    const { supabase } = event.context;

    // Validate is_master
    const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
    if (!isMaster) throw new Error("Acesso negado");

    // Validate slug format (alphanumeric + hyphen only)
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) {
      throw new Error("Slug inválido. Use apenas letras minúsculas, números e hífen.");
    }

    const { data: promo, error } = await supabase
      .from("promotion_codes")
      .insert({
        org_id: orgId,
        name: data.name,
        code: data.code.toUpperCase(),
        slug: data.slug.toLowerCase(),
        discount_percent: data.discountPercent,
        description: data.description,
        valid_from: data.validFrom ? new Date(data.validFrom).toISOString() : undefined,
        valid_until: data.validUntil ? new Date(data.validUntil).toISOString() : undefined,
        max_uses: data.maxUses,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes("unique")) {
        throw new Error("Código ou slug já existe nesta agência.");
      }
      throw error;
    }

    return mapPromotionCode(promo);
  });

export const updatePromotionCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event) => {
    const data = event.data as {
      id: string;
      name?: string;
      discountPercent?: number;
      description?: string;
      validFrom?: string;
      validUntil?: string;
      maxUses?: number | null;
      active?: boolean;
    };
    const { orgId, userId } = event.context as any;
    const { supabase } = event.context;

    // Validate is_master
    const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
    if (!isMaster) throw new Error("Acesso negado");

    const updates: any = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.discountPercent !== undefined) updates.discount_percent = data.discountPercent;
    if (data.description !== undefined) updates.description = data.description;
    if (data.validFrom !== undefined) updates.valid_from = new Date(data.validFrom).toISOString();
    if (data.validUntil !== undefined) updates.valid_until = new Date(data.validUntil).toISOString();
    if (data.maxUses !== undefined) updates.max_uses = data.maxUses;
    if (data.active !== undefined) updates.active = data.active;
    updates.updated_at = new Date().toISOString();

    const { data: promo, error } = await supabase
      .from("promotion_codes")
      .update(updates)
      .eq("id", data.id)
      .eq("org_id", orgId)
      .select()
      .single();

    if (error) throw error;
    return mapPromotionCode(promo);
  });

export const listPromotionCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event) => {
    const { orgId, userId } = event.context as any;
    const { supabase } = event.context;

    // Validate is_master
    const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
    if (!isMaster) throw new Error("Acesso negado");

    const { data, error } = await supabase
      .from("promotion_codes")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapPromotionCode);
  });

export const getPromotionCodeBySlug = createServerFn({ method: "POST" })
  .inputValidator((d: { slug: string; orgId?: string }) =>
    z.object({ slug: z.string(), orgId: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
    // This is public - anyone can get promo code details by slug
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    let query = supabase
      .from("promotion_codes")
      .select("id, name, code, discount_percent, description, active, valid_from, valid_until, max_uses, used_count")
      .eq("slug", data.slug);

    if (data.orgId) {
      query = query.eq("org_id", data.orgId);
    }

    const { data: promo, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      throw error;
    }

    // Check if promo is still valid
    const now = new Date();
    if (!promo.active) return null;
    if (promo.valid_from && new Date(promo.valid_from) > now) return null;
    if (promo.valid_until && new Date(promo.valid_until) < now) return null;
    if (promo.max_uses && promo.used_count >= promo.max_uses) return null;

    return {
      id: promo.id,
      name: promo.name,
      code: promo.code,
      discountPercent: promo.discount_percent,
      description: promo.description ?? undefined,
      validUntil: promo.valid_until ?? undefined,
      maxUses: promo.max_uses ?? undefined,
      usedCount: promo.used_count,
    };
  });

export const deletePromotionCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event) => {
    const data = event.data as { id: string };
    const { orgId, userId } = event.context as any;
    const { supabase } = event.context;

    // Validate is_master
    const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
    if (!isMaster) throw new Error("Acesso negado");

    const { error } = await supabase
      .from("promotion_codes")
      .delete()
      .eq("id", data.id)
      .eq("org_id", orgId);

    if (error) throw error;
    return { success: true };
  });

// ============ AFFILIATE PROGRAMS ============

export const createAffiliateProgram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event) => {
    const data = event.data as {
      referralCode: string;
      commissionPercent?: number;
      commissionValidMonths?: number;
    };
    const { orgId, userId } = event.context as any;
    const { supabase } = event.context;

    // Validate referral code format
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.referralCode)) {
      throw new Error("Código de referência inválido. Use apenas letras minúsculas, números e hífen.");
    }

    const { data: affiliate, error } = await supabase
      .from("affiliate_programs")
      .insert({
        org_id: orgId,
        user_id: userId,
        referral_code: data.referralCode.toLowerCase(),
        commission_percent: data.commissionPercent ?? 10,
        commission_valid_months: data.commissionValidMonths ?? 12,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes("unique")) {
        throw new Error("Você já tem um programa de afiliado ou este código já está em uso.");
      }
      throw error;
    }

    return mapAffiliateProgram(affiliate);
  });

export const getMyAffiliateProgram = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event) => {
    const { orgId, userId } = event.context as any;
    const { supabase } = event.context;

    const { data, error } = await supabase
      .from("affiliate_programs")
      .select("*")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data ? mapAffiliateProgram(data) : null;
  });

export const listAffiliatePrograms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event) => {
    const { orgId, userId } = event.context as any;
    const { supabase } = event.context;

    // Validate is_master
    const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
    if (!isMaster) throw new Error("Acesso negado");

    // The Luzeria platform admin tracks affiliates across every agency
    // (RLS grants it via platform_admin_affiliate_programs_read); any other
    // org's master only sees affiliates within their own org.
    let query = supabase
      .from("affiliate_programs")
      .select("*, user:user_id(id, name, avatar_url), org:org_id(id, name)")
      .order("created_at", { ascending: false });
    if (orgId !== LUZERIA_ORG_ID) {
      query = query.eq("org_id", orgId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  });

export const listAllAffiliateReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event) => {
    const { orgId, userId } = event.context as any;
    const { supabase } = event.context;

    const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
    if (!isMaster || orgId !== LUZERIA_ORG_ID) throw new Error("Acesso negado");

    const { data, error } = await supabase
      .from("affiliate_referrals")
      .select(
        "*, affiliate:affiliate_id(id, referral_code, org:org_id(id, name), user:user_id(id, name)), referred_user:referred_user_id(id, name, email)",
      )
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  });

export const getAffiliateStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event) => {
    const { userId } = event.context as any;
    const { supabase } = event.context;

    // Get affiliate program
    const { data: affiliate, error: afError } = await supabase
      .from("affiliate_programs")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (afError || !affiliate) throw new Error("Você não tem um programa de afiliado.");

    // Get referral stats
    const { data: referrals, error: refError } = await supabase
      .from("affiliate_referrals")
      .select("*")
      .eq("affiliate_id", affiliate.id);

    if (refError) throw refError;

    const totalCommission = referrals?.reduce((sum, r) => sum + r.commission_earned, 0) || 0;
    const paidCommission = referrals
      ?.filter((r) => r.commission_paid)
      .reduce((sum, r) => sum + r.commission_earned, 0) || 0;
    const pendingCommission = totalCommission - paidCommission;

    return {
      referralCode: affiliate.referral_code,
      totalReferrals: referrals?.length || 0,
      totalCommission,
      paidCommission,
      pendingCommission,
      referrals: referrals || [],
    };
  });

export const getAffiliateReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event) => {
    const { userId } = event.context as any;
    const { supabase } = event.context;

    // Get affiliate program
    const { data: affiliate, error: afError } = await supabase
      .from("affiliate_programs")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (afError || !affiliate) throw new Error("Você não tem um programa de afiliado.");

    // Get detailed referral info
    const { data: referrals, error: refError } = await supabase
      .from("affiliate_referrals")
      .select("*, referred_user:referred_user_id(id, name, email)")
      .eq("affiliate_id", affiliate.id)
      .order("created_at", { ascending: false });

    if (refError) throw refError;
    return referrals || [];
  });

export const markAffiliateCommissionAsPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event) => {
    const data = event.data as { referralId: string };
    const { orgId, userId } = event.context as any;
    const { supabase } = event.context;

    // Validate is_master
    const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
    if (!isMaster) throw new Error("Acesso negado");

    // Verify this referral belongs to an affiliate in this org — or that
    // the caller is the Luzeria platform admin, who can pay out any agency's
    // affiliate (RLS grants that cross-org read/update explicitly).
    const { data: referral, error: refError } = await supabase
      .from("affiliate_referrals")
      .select("*, affiliate:affiliate_id(org_id)")
      .eq("id", data.referralId)
      .single();

    if (refError || !referral || (referral.affiliate.org_id !== orgId && orgId !== LUZERIA_ORG_ID)) {
      throw new Error("Referência não encontrada.");
    }

    const { error } = await supabase
      .from("affiliate_referrals")
      .update({
        commission_paid: true,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.referralId);

    if (error) throw error;
    return { success: true };
  });

// ============ PUBLIC HELPERS ============

export const validatePromotionCode = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string }) => z.object({ code: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Find promotion code by code (case-insensitive)
    const { data: promo, error } = await supabase
      .from("promotion_codes")
      .select("id, name, discount_percent, description, active, valid_from, valid_until, max_uses, used_count, org_id")
      .eq("code", data.code.toUpperCase())
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    // Check if promo is valid
    const now = new Date();
    if (!promo.active) return null;
    if (promo.valid_from && new Date(promo.valid_from) > now) return null;
    if (promo.valid_until && new Date(promo.valid_until) < now) return null;
    if (promo.max_uses && promo.used_count >= promo.max_uses) return null;

    return {
      id: promo.id,
      name: promo.name,
      discountPercent: promo.discount_percent,
      description: promo.description,
    };
  });

export const getAffiliateByReferralCode = createServerFn({ method: "POST" })
  .inputValidator((d: { referralCode: string }) => z.object({ referralCode: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: affiliate, error } = await supabase
      .from("affiliate_programs")
      .select("id, org_id, commission_percent, commission_valid_months, active")
      .eq("referral_code", data.referralCode)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    if (!affiliate.active) return null;

    return affiliate;
  });

// ============ PURCHASE TRACKING ============

export const recordPurchaseEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (event) => {
    const data = event.data as {
      orgId: string;
      planId: string;
      promotionCodeId?: string;
      affiliateReferralId?: string;
      amountCents?: number;
    };
    const { supabase } = event.context;

    const { data: purchase, error } = await supabase
      .from("purchase_events")
      .insert({
        org_id: data.orgId,
        plan_id: data.planId,
        promotion_code_id: data.promotionCodeId,
        affiliate_referral_id: data.affiliateReferralId,
        amount_cents: data.amountCents,
      })
      .select()
      .single();

    if (error) throw error;
    return purchase;
  });

/** Notify every master of an org with an in-app notification (bell icon). */
export async function notifyOrgMasters(orgId: string, message: string, type = "promo_gift") {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profiles } = await supabaseAdmin.from("profiles").select("id").eq("org_id", orgId);
  if (!profiles?.length) return;
  const { data: masters } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "master")
    .in("user_id", profiles.map((p) => p.id));
  if (!masters?.length) return;
  await supabaseAdmin
    .from("notifications")
    .insert(masters.map((m) => ({ user_id: m.user_id, type, message })));
}

export const applyPromotionCodeToOrg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event) => {
    const data = event.data as {
      promotionCodeId: string;
      orgId: string;
    };
    const { userId } = event.context as any;
    const { supabase } = event.context;

    // Validate is_master
    const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
    if (!isMaster) throw new Error("Acesso negado");

    const { data: promo, error: promoErr } = await supabase
      .from("promotion_codes")
      .select("discount_percent")
      .eq("id", data.promotionCodeId)
      .single();
    if (promoErr || !promo) throw new Error("Cupom não encontrado.");

    const { data: org, error: orgErr } = await supabase
      .from("orgs")
      .select("asaas_subscription_id")
      .eq("id", data.orgId)
      .single();
    if (orgErr || !org) throw new Error("Agência não encontrada.");

    // If there's already a pending invoice, discount it immediately — this
    // is a one-time gift, so nothing is persisted on the org afterward.
    if (org.asaas_subscription_id) {
      const { getNextPendingPayment, updateAsaasPaymentValue } = await import("./asaas.server");
      const payment = await getNextPendingPayment(org.asaas_subscription_id);
      if (payment) {
        const discountedValueCents = Math.round(payment.value * 100 * (1 - promo.discount_percent / 100));
        await updateAsaasPaymentValue(payment.id, discountedValueCents);
        await notifyOrgMasters(
          data.orgId,
          `Você ganhou ${promo.discount_percent}% de desconto! Sua fatura deste mês foi atualizada para R$ ${(discountedValueCents / 100).toFixed(2)}.`,
        );
        return { success: true, appliedNow: true, newValueCents: discountedValueCents };
      }
    }

    // No pending invoice yet (still trialing, or between cycles) — record
    // the promo on the org so the Asaas webhook can discount it the moment
    // the next invoice is actually generated (PAYMENT_CREATED event), then
    // clear it right after so it never discounts more than that one invoice.
    const { error } = await supabase
      .from("orgs")
      .update({ promotion_code_id: data.promotionCodeId })
      .eq("id", data.orgId);
    if (error) throw error;
    await notifyOrgMasters(
      data.orgId,
      `Você ganhou ${promo.discount_percent}% de desconto na sua próxima fatura!`,
    );
    return { success: true, appliedNow: false };
  });

export const listOrgsForPromotion = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event) => {
    const { orgId: currentOrgId, userId } = event.context as any;
    const { supabase } = event.context;

    // Validate is_master
    const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
    if (!isMaster) throw new Error("Acesso negado");

    // List all orgs except current one
    const { data, error } = await supabase
      .from("orgs")
      .select("id, name, slug")
      .neq("id", currentOrgId)
      .order("name");

    if (error) throw error;
    return data || [];
  });
