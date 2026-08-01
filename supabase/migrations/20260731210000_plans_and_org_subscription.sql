-- Fase 2: planos e limites por agência. Puramente estrutural — não cobra
-- nada ainda (isso vem com a integração de pagamento depois). Serve pra:
--  1) mostrar "X de Y clientes usados" pra cada agência,
--  2) bloquear criação de cliente/colaborador acima do teto do plano,
--  3) ter um lugar único (plans.features) pra "ligar" benefícios por plano
--     conforme forem sendo construídos (ex.: automações configuráveis).

CREATE TABLE public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  price_cents integer,           -- null = "sob consulta" (ex.: Enterprise)
  max_clients integer,           -- null = ilimitado
  max_collaborators integer,     -- null = ilimitado
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read plans" ON public.plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "luzeria manages plans" ON public.plans FOR ALL TO authenticated
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');

INSERT INTO public.plans (id, name, price_cents, max_clients, max_collaborators, features, sort_order) VALUES
  ('solo', 'Solo', 4990, 5, 2,
    '{"automations": false, "reports_tier": "basico", "support_tier": "normal"}'::jsonb, 1),
  ('pro', 'Pro', 8990, 10, 8,
    '{"automations": true, "reports_tier": "completo", "support_tier": "prioritario"}'::jsonb, 2),
  ('agencia', 'Agência', 14990, 20, 20,
    '{"automations": true, "reports_tier": "avancado", "support_tier": "prioritario"}'::jsonb, 3),
  ('enterprise', 'Enterprise', NULL, NULL, NULL,
    '{"automations": true, "reports_tier": "personalizado", "support_tier": "dedicado"}'::jsonb, 4);

ALTER TABLE public.orgs ADD COLUMN plan_id text NOT NULL DEFAULT 'solo' REFERENCES public.plans(id);
ALTER TABLE public.orgs ADD COLUMN subscription_status text NOT NULL DEFAULT 'trialing';
ALTER TABLE public.orgs ADD COLUMN trial_ends_at timestamptz DEFAULT (now() + interval '14 days');

-- Luzeria não é cliente da própria plataforma — sem teto, sem trial.
UPDATE public.orgs
SET plan_id = 'enterprise', subscription_status = 'active', trial_ends_at = NULL
WHERE id = '00000000-0000-0000-0000-000000000001';
