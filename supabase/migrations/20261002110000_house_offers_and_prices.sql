-- House: oferta comercial por conta (só a Luzeria define) e novos preços.
--  * billing_free_months: meses grátis depois dos 7 dias de teste (o 1º
--    pagamento só nasce no fim desse período: trial_ends_at já inclui os meses).
--  * billing_discount_pct: desconto percentual vitalício sobre o valor da
--    assinatura (plano + marcas extras).
--  * Preços: House R$ 79,00/mês e R$ 49,90 por marca adicional. A IA deixou
--    de ser plano; o 'house_ia' fica só pras contas antigas, com o mesmo preço.
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS billing_free_months int NOT NULL DEFAULT 0 CHECK (billing_free_months BETWEEN 0 AND 36);
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS billing_discount_pct int NOT NULL DEFAULT 0 CHECK (billing_discount_pct BETWEEN 0 AND 100);
ALTER TABLE public.house_invites ADD COLUMN IF NOT EXISTS free_months int NOT NULL DEFAULT 0 CHECK (free_months BETWEEN 0 AND 36);
ALTER TABLE public.house_invites ADD COLUMN IF NOT EXISTS discount_pct int NOT NULL DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100);

UPDATE public.plans
   SET price_cents = 7900,
       features = jsonb_set(features, '{extra_brand_cents}', '4990'::jsonb)
 WHERE id IN ('house', 'house_ia');
