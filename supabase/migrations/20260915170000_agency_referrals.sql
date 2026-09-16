-- Programa de indicação entre agências ("Indique e Ganhe") — separado do
-- programa de afiliados existente (affiliate_programs/affiliate_referrals,
-- comissão % pra parceiros externos). Aqui: quem indica ganha saldo de
-- meses grátis, quem é indicado ganha dias extras de trial.

ALTER TABLE public.orgs
  ADD COLUMN referral_code text UNIQUE,
  ADD COLUMN referred_by_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  ADD COLUMN referral_credit_balance integer NOT NULL DEFAULT 0 CHECK (referral_credit_balance BETWEEN 0 AND 3),
  ADD COLUMN first_payment_confirmed_at timestamptz;

-- Uma linha por par indicador/indicado, rastreando o ciclo de vida da
-- indicação até confirmar (crédito concedido) ou expirar (não completou os
-- requisitos a tempo).
CREATE TABLE public.agency_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  referred_org_id uuid NOT NULL UNIQUE REFERENCES public.orgs(id) ON DELETE CASCADE,
  referral_code_used text NOT NULL,
  status text NOT NULL DEFAULT 'pending_validation'
    CHECK (status IN ('pending_validation','validated','pending_reactivation','confirmed','expired')),
  validated_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agency_referrals_status ON public.agency_referrals(status);
CREATE INDEX idx_agency_referrals_referrer ON public.agency_referrals(referrer_org_id);

-- Histórico auditável de cada lançamento de saldo (ganho ou consumido).
CREATE TABLE public.referral_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES public.agency_referrals(id) ON DELETE SET NULL,
  delta integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('referral_confirmed','billing_cycle_consumed')),
  balance_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_referral_credit_ledger_org ON public.referral_credit_ledger(org_id, created_at DESC);

GRANT SELECT ON public.agency_referrals TO authenticated;
GRANT ALL ON public.agency_referrals TO service_role;
ALTER TABLE public.agency_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org master reads own referrals" ON public.agency_referrals FOR SELECT TO authenticated
  USING (public.is_master(auth.uid()) AND (
    referrer_org_id = public.current_org_id() OR referred_org_id = public.current_org_id()
  ));

GRANT SELECT ON public.referral_credit_ledger TO authenticated;
GRANT ALL ON public.referral_credit_ledger TO service_role;
ALTER TABLE public.referral_credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org master reads own ledger" ON public.referral_credit_ledger FOR SELECT TO authenticated
  USING (public.is_master(auth.uid()) AND org_id = public.current_org_id());
