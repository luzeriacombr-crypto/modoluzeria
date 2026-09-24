-- Etapas do CRM de Vendas voltam a ser customizáveis por agência — pedido
-- real numa demo de vendas ("tem como editar ou adicionar novas etapas?").
-- Uma tabela chamada sales_stages com essa mesma finalidade já existiu
-- (20260821130000_sales_pipeline.sql) e foi removida no mesmo dia por não
-- ter sido usada (20260821140000_sales_pipeline_urgency.sql) — dessa vez
-- reconstruída no padrão de client_journey_stages (id referenciado, não
-- string fixa), com uma diferença: `kind` marca as 3 etapas que carregam
-- lógica de negócio (won/lost/followup) independente do nome escolhido
-- pela agência, do mesmo jeito que client_journey_stages usa
-- milestone_type — assim renomear ou adicionar etapas nunca quebra o
-- fluxo de "Ganho"/"Perdido"/"Follow-up".

CREATE TABLE public.sales_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  kind text CHECK (kind IN ('followup', 'won', 'lost')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sales_stages TO authenticated;
GRANT ALL ON public.sales_stages TO service_role;
ALTER TABLE public.sales_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read sales stages" ON public.sales_stages FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "admin manage sales stages" ON public.sales_stages FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_sales_stages_org ON public.sales_stages(org_id, sort_order);

-- Semeia toda agência já existente com as 5 etapas fixas atuais, na mesma
-- ordem e com o `kind` certo — o nome continua editável depois.
INSERT INTO public.sales_stages (org_id, name, sort_order, kind)
SELECT o.id, v.name, v.sort_order, v.kind
FROM public.orgs o
CROSS JOIN (VALUES
  ('Novos', 0, NULL),
  ('Responder agora', 1, NULL),
  ('Follow-up', 2, 'followup'),
  ('Fechado', 3, 'won'),
  ('Perdido', 4, 'lost')
) AS v(name, sort_order, kind);

ALTER TABLE public.leads ADD COLUMN stage_id uuid REFERENCES public.sales_stages(id) ON DELETE SET NULL;

-- Casa cada lead existente com a etapa recém-semeada da própria org, pelo
-- status antigo (nesse instante nome e kind ainda batem 1:1 com ele).
UPDATE public.leads l
SET stage_id = s.id
FROM public.sales_stages s
WHERE s.org_id = l.org_id
  AND (
    (l.status = 'novo' AND s.name = 'Novos') OR
    (l.status = 'responder' AND s.name = 'Responder agora') OR
    (l.status = 'followup' AND s.kind = 'followup') OR
    (l.status = 'fechado' AND s.kind = 'won') OR
    (l.status = 'perdido' AND s.kind = 'lost')
  );

-- Rede de segurança: se por algum motivo algum lead não casou (não deveria
-- acontecer), cai na primeira etapa "normal" da própria org.
UPDATE public.leads l
SET stage_id = (
  SELECT s.id FROM public.sales_stages s
  WHERE s.org_id = l.org_id AND s.kind IS NULL
  ORDER BY s.sort_order LIMIT 1
)
WHERE l.stage_id IS NULL;

ALTER TABLE public.leads ALTER COLUMN stage_id SET NOT NULL;
ALTER TABLE public.leads DROP COLUMN status;

CREATE INDEX idx_leads_stage ON public.leads(org_id, stage_id);
