-- applyPromotionCodeToOrg (Configurações › Cupons e Afiliados) tries to
-- record which promo code was manually applied to an existing org, but no
-- column for that exists on orgs — the earlier promo_affiliate_tracking
-- migration added it to a table (org_subscriptions) that was never actually
-- created, so that write always failed silently.
ALTER TABLE public.orgs ADD COLUMN promotion_code_id uuid REFERENCES public.promotion_codes(id) ON DELETE SET NULL;
