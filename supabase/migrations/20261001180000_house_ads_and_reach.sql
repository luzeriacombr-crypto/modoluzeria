-- House: tráfego pago.
--  * Nova origem de lead: "anuncio" (lead que veio de anúncio pago).
--  * house_ad_spend: quanto foi investido em anúncios, por marca e mês
--    (lançado à mão pelo gestor) — base do custo por lead/agendamento.

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.instagram_leads'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%origin%'
  LOOP
    EXECUTE format('ALTER TABLE public.instagram_leads DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.instagram_leads ADD CONSTRAINT instagram_leads_origin_check
  CHECK (origin IN ('story', 'caixinha', 'comentario', 'direct', 'anuncio', 'outro'));

CREATE TABLE IF NOT EXISTS public.house_ad_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  month_key text NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
  amount_cents int NOT NULL CHECK (amount_cents >= 0 AND amount_cents <= 1000000000),
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_house_ad_spend_org_month ON public.house_ad_spend(org_id, month_key);
GRANT SELECT, INSERT, DELETE ON public.house_ad_spend TO authenticated;
GRANT ALL ON public.house_ad_spend TO service_role;
ALTER TABLE public.house_ad_spend ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ad spend read" ON public.house_ad_spend;
CREATE POLICY "ad spend read" ON public.house_ad_spend FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()) AND public.has_client_access(auth.uid(), client_id));
DROP POLICY IF EXISTS "ad spend master write" ON public.house_ad_spend;
CREATE POLICY "ad spend master write" ON public.house_ad_spend FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_master(auth.uid())
              AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.org_id = public.current_org_id()));
DROP POLICY IF EXISTS "ad spend master delete" ON public.house_ad_spend;
CREATE POLICY "ad spend master delete" ON public.house_ad_spend FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_master(auth.uid()));
