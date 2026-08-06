-- Add tracking columns to org_subscriptions for promotion codes and affiliate referrals
ALTER TABLE public.org_subscriptions ADD COLUMN promotion_code_id uuid REFERENCES public.promotion_codes(id) ON DELETE SET NULL;
ALTER TABLE public.org_subscriptions ADD COLUMN affiliate_referral_id uuid REFERENCES public.affiliate_referrals(id) ON DELETE SET NULL;

-- Add index for tracking
CREATE INDEX idx_org_subscriptions_promo_code ON public.org_subscriptions(promotion_code_id);
CREATE INDEX idx_org_subscriptions_affiliate_referral ON public.org_subscriptions(affiliate_referral_id);

-- Trigger to update promotion code usage count
CREATE OR REPLACE FUNCTION update_promo_code_usage()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.promotion_code_id IS NOT NULL THEN
    UPDATE public.promotion_codes
    SET used_count = used_count + 1,
        updated_at = now()
    WHERE id = NEW.promotion_code_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_promo_usage
AFTER INSERT ON public.org_subscriptions
FOR EACH ROW EXECUTE FUNCTION update_promo_code_usage();

-- Trigger to calculate affiliate commission when subscription is created
CREATE OR REPLACE FUNCTION calculate_affiliate_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_price numeric;
  v_commission_amount numeric;
BEGIN
  IF NEW.affiliate_referral_id IS NOT NULL THEN
    -- Get the plan price
    SELECT price INTO v_plan_price FROM public.plans WHERE id = NEW.plan_id;

    -- Calculate commission based on affiliate program commission_percent
    SELECT (v_plan_price * ap.commission_percent / 100)
    INTO v_commission_amount
    FROM public.affiliate_programs ap
    WHERE ap.id = (SELECT affiliate_id FROM public.affiliate_referrals WHERE id = NEW.affiliate_referral_id);

    -- Update the referral with calculated commission
    UPDATE public.affiliate_referrals
    SET commission_earned = v_commission_amount,
        updated_at = now()
    WHERE id = NEW.affiliate_referral_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_affiliate_commission
AFTER INSERT ON public.org_subscriptions
FOR EACH ROW EXECUTE FUNCTION calculate_affiliate_commission();
