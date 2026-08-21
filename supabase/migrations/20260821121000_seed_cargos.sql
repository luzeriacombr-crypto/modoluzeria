-- Semeia os cargos padrão (atômicos, editáveis depois) pra toda agência já
-- existente quando a tabela cargos foi criada — igual o CROSS JOIN de
-- client_journey_stages fez pra jornada do cliente. Agências novas são
-- semeadas via seedCargosForOrg() (cargos.functions.ts) no signup.
INSERT INTO public.cargos (org_id, name, permissions)
SELECT o.id, v.name, v.permissions
FROM public.orgs o
CROSS JOIN (VALUES
  ('Editor', ARRAY[]::text[]),
  ('Videomaker', ARRAY[]::text[]),
  ('Redator(a)', ARRAY[]::text[]),
  ('Social Media', ARRAY['instagram_publish', 'approve_finalize']::text[]),
  ('Financeiro', ARRAY['view_financeiro']::text[]),
  ('Atendimento/Vendas', ARRAY['sales_pipeline']::text[]),
  ('Adm Master', ARRAY[]::text[])
) AS v(name, permissions);
