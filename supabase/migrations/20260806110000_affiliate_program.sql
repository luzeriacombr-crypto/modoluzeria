-- Affiliate program
CREATE TABLE public.affiliate_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code text NOT NULL UNIQUE, -- Unique identifier (e.g., 'orim-partner')
  commission_percent numeric NOT NULL DEFAULT 10 CHECK (commission_percent > 0 AND commission_percent <= 100),
  commission_valid_months integer NOT NULL DEFAULT 12, -- How many months affiliate gets 10%
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id), -- One affiliate program per user per org
  UNIQUE(org_id, referral_code)
);

CREATE INDEX idx_affiliate_programs_org_id ON public.affiliate_programs(org_id);
CREATE INDEX idx_affiliate_programs_user_id ON public.affiliate_programs(user_id);
CREATE INDEX idx_affiliate_programs_referral_code ON public.affiliate_programs(referral_code);
CREATE INDEX idx_affiliate_programs_active ON public.affiliate_programs(org_id, active);

-- Enable RLS
ALTER TABLE public.affiliate_programs ENABLE ROW LEVEL SECURITY;

-- Users can see their own affiliate program
CREATE POLICY "user_affiliate_read" ON public.affiliate_programs
  FOR SELECT USING (user_id = auth.uid());

-- Org admins can see all affiliate programs in their org
CREATE POLICY "org_admin_affiliate_read" ON public.affiliate_programs
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.org_members om
      WHERE om.org_id = affiliate_programs.org_id AND om.user_id = auth.uid() AND om.is_master)
  );

-- Users can insert their own affiliate program
CREATE POLICY "user_affiliate_insert" ON public.affiliate_programs
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Org admins can manage affiliate programs
CREATE POLICY "org_admin_affiliate_insert" ON public.affiliate_programs
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_master)
  );

-- Track affiliate referrals
CREATE TABLE public.affiliate_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.affiliate_programs(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  subscription_id text, -- Reference to Asaas subscription
  commission_earned numeric NOT NULL DEFAULT 0,
  commission_paid boolean NOT NULL DEFAULT false,
  paid_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_affiliate_referrals_affiliate_id ON public.affiliate_referrals(affiliate_id);
CREATE INDEX idx_affiliate_referrals_referred_user_id ON public.affiliate_referrals(referred_user_id);
CREATE INDEX idx_affiliate_referrals_paid ON public.affiliate_referrals(affiliate_id, commission_paid);

-- Enable RLS
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

-- Affiliates can see their own referrals
CREATE POLICY "affiliate_referral_read" ON public.affiliate_referrals
  FOR SELECT USING (
    affiliate_id IN (
      SELECT id FROM public.affiliate_programs WHERE user_id = auth.uid()
    )
  );

-- Org admins can see all referrals
CREATE POLICY "org_admin_referral_read" ON public.affiliate_referrals
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM public.affiliate_programs ap
      JOIN public.org_members om ON om.org_id = (SELECT org_id FROM public.affiliate_programs WHERE id = affiliate_referrals.affiliate_id)
      WHERE ap.id = affiliate_referrals.affiliate_id
      AND om.user_id = auth.uid() AND om.is_master
    )
  );
