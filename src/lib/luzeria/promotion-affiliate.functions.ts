import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireActiveProfile } from "./require-active";

// ============ PROMOTION CODES ============

export const createPromotionCode = createServerFn()
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event, data: {
    name: string;
    code: string;
    slug: string;
    discountPercent: number;
    description?: string;
    validFrom?: string;
    validUntil?: string;
    maxUses?: number;
  }) => {
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

    return promo;
  });

export const updatePromotionCode = createServerFn()
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event, data: {
    id: string;
    name?: string;
    discountPercent?: number;
    description?: string;
    validFrom?: string;
    validUntil?: string;
    maxUses?: number | null;
    active?: boolean;
  }) => {
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
    return promo;
  });

export const listPromotionCodes = createServerFn()
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
    return data || [];
  });

export const getPromotionCodeBySlug = createServerFn()
  .handler(async (event, data: { slug: string; orgId?: string }) => {
    // This is public - anyone can get promo code details by slug
    const { supabase } = event.context;

    let query = supabase
      .from("promotion_codes")
      .select("id, name, discount_percent, description, active, valid_from, valid_until, max_uses, used_count")
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

    return promo;
  });

export const deletePromotionCode = createServerFn()
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event, data: { id: string }) => {
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

export const createAffiliateProgram = createServerFn()
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event, data: {
    referralCode: string;
    commissionPercent?: number;
    commissionValidMonths?: number;
  }) => {
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

    return affiliate;
  });

export const getMyAffiliateProgram = createServerFn()
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
    return data || null;
  });

export const listAffiliatePrograms = createServerFn()
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event) => {
    const { orgId, userId } = event.context as any;
    const { supabase } = event.context;

    // Validate is_master
    const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
    if (!isMaster) throw new Error("Acesso negado");

    const { data, error } = await supabase
      .from("affiliate_programs")
      .select("*, user:user_id(id, name, avatar_url)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  });

export const getAffiliateStats = createServerFn()
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

export const getAffiliateReferrals = createServerFn()
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

export const markAffiliateCommissionAsPaid = createServerFn()
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event, data: { referralId: string }) => {
    const { orgId, userId } = event.context as any;
    const { supabase } = event.context;

    // Validate is_master
    const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
    if (!isMaster) throw new Error("Acesso negado");

    // Verify this referral belongs to an affiliate in this org
    const { data: referral, error: refError } = await supabase
      .from("affiliate_referrals")
      .select("*, affiliate:affiliate_id(org_id)")
      .eq("id", data.referralId)
      .single();

    if (refError || referral.affiliate.org_id !== orgId) {
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

export const validatePromotionCode = createServerFn()
  .handler(async (event, data: { code: string }) => {
    const { supabase } = event.context;

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

export const getAffiliateByReferralCode = createServerFn()
  .handler(async (event, data: { referralCode: string }) => {
    const { supabase } = event.context;

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

export const recordPurchaseEvent = createServerFn()
  .middleware([requireSupabaseAuth])
  .handler(async (event, data: {
    orgId: string;
    planId: string;
    promotionCodeId?: string;
    affiliateReferralId?: string;
    amountCents?: number;
  }) => {
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

export const applyPromotionCodeToOrg = createServerFn()
  .middleware([requireSupabaseAuth, requireActiveProfile])
  .handler(async (event, data: {
    promotionCodeId: string;
    orgId: string;
  }) => {
    const { userId } = event.context as any;
    const { supabase } = event.context;

    // Validate is_master
    const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
    if (!isMaster) throw new Error("Acesso negado");

    // Apply promotion code to org
    const { error } = await supabase
      .from("orgs")
      .update({ promotion_code_id: data.promotionCodeId })
      .eq("id", data.orgId);

    if (error) throw error;
    return { success: true };
  });

export const listOrgsForPromotion = createServerFn()
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
