-- Cada cliente hoje só tem status por post — nada que represente "em que pé
-- está" o cliente como um todo. Nova tabela por org (edítavel, como
-- onboarding_checklist_defaults) com duas listas ordenadas de etapas: uma
-- pro primeiro mês de um cliente novo (onboarding), outra pro ciclo mensal
-- de quem já está em operação (operational). Cada cliente referencia sua
-- etapa atual.

CREATE TABLE public.client_journey_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  track text NOT NULL CHECK (track IN ('onboarding', 'operational')),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.client_journey_stages TO authenticated;
GRANT ALL ON public.client_journey_stages TO service_role;
ALTER TABLE public.client_journey_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read journey stages" ON public.client_journey_stages FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "admin manage journey stages" ON public.client_journey_stages FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_client_journey_stages_org ON public.client_journey_stages(org_id, track, sort_order);

-- Seed de todas as agências já existentes com as 13 etapas de onboarding +
-- 10 de operação (texto padrão do Junior) — editável depois por cada agência.
INSERT INTO public.client_journey_stages (org_id, track, name, description, sort_order)
SELECT o.id, v.track, v.name, v.description, v.sort_order
FROM public.orgs o
CROSS JOIN (VALUES
  ('onboarding', 'Contrato e início do projeto', 'Contrato fechado e tudo certo para começarmos oficialmente o trabalho com a sua marca.', 0),
  ('onboarding', 'Onboarding e coleta de informações', 'Vamos entender sua marca, objetivos, público, serviços, diferenciais, referências e tudo que precisamos para construir a estratégia.', 1),
  ('onboarding', 'Organização dos materiais', 'Reunimos fotos, vídeos, identidade visual, acessos e outros materiais necessários para iniciar a produção.', 2),
  ('onboarding', 'Planejamento estratégico/Sistema de conteúdo', 'Com as informações em mãos, definimos posicionamento, pilares de conteúdo, formatos e direcionamento da comunicação.', 3),
  ('onboarding', 'Entrega do planejamento do primeiro mês', 'Escolhemos os temas e conteúdos que serão trabalhados durante o primeiro ciclo de produção.', 4),
  ('onboarding', 'Criação dos roteiros / Copys de Posts', 'Transformamos os temas planejados em roteiros prontos para orientar a gravação dos vídeos e Copys para os posts e carrosséis.', 5),
  ('onboarding', 'Gravação de conteúdo', 'Realizamos a captação dos vídeos e demais materiais necessários para produzir os conteúdos do bimestre (na maioria das vezes).', 6),
  ('onboarding', 'Edição dos conteúdos', 'Nossa equipe entra na fase de edição dos vídeos, criação das artes, carrosséis e demais peças planejadas.', 7),
  ('onboarding', 'Revisão interna', 'Antes de chegar até você, os conteúdos passam pela revisão da nossa equipe para conferir texto, design, edição e estratégia.', 8),
  ('onboarding', 'Aprovação do cliente', 'Enviamos os conteúdos para sua aprovação e realizamos os ajustes necessários dentro do processo combinado.', 9),
  ('onboarding', 'Programação das publicações', 'Com tudo aprovado, organizamos e programamos os conteúdos de acordo com o calendário definido.', 10),
  ('onboarding', 'Início das publicações', 'O planejamento começa oficialmente a rodar e os conteúdos passam a ser publicados.', 11),
  ('onboarding', 'Acompanhamento inicial', 'Acompanhamos o desempenho dos primeiros conteúdos e usamos essas informações para melhorar os próximos ciclos.', 12),
  ('operational', 'Análise do mês anterior', 'Avaliamos o desempenho dos conteúdos e identificamos o que funcionou melhor e o que precisa ser ajustado.', 0),
  ('operational', 'Planejamento do próximo ciclo', 'Definimos os temas, oportunidades e direcionamentos dos conteúdos que serão produzidos no novo mês.', 1),
  ('operational', 'Criação dos roteiros', 'Desenvolvemos os roteiros dos vídeos de acordo com o planejamento aprovado para o período.', 2),
  ('operational', 'Gravação de conteúdo', 'Realizamos a captação dos novos conteúdos que irão alimentar as próximas semanas.', 3),
  ('operational', 'Produção dos conteúdos', 'A equipe edita os vídeos e desenvolve as artes, carrosséis e demais materiais previstos.', 4),
  ('operational', 'Revisão interna', 'Todo o material passa pela conferência da nossa equipe antes de seguir para aprovação.', 5),
  ('operational', 'Aprovação do cliente', 'Os conteúdos são enviados para você conferir e solicitar eventuais ajustes.', 6),
  ('operational', 'Programação das publicações', 'Após a aprovação, organizamos os conteúdos no calendário e deixamos as publicações programadas.', 7),
  ('operational', 'Publicação e acompanhamento', 'Os conteúdos entram no ar e acompanhamos o desempenho para alimentar as decisões do próximo ciclo.', 8),
  ('operational', 'Recomeço do ciclo', 'Os resultados do período se tornam informação para o próximo planejamento, mantendo a produção em evolução contínua.', 9)
) AS v(track, name, description, sort_order);

ALTER TABLE public.clients
  ADD COLUMN current_stage_id uuid REFERENCES public.client_journey_stages(id) ON DELETE SET NULL;
