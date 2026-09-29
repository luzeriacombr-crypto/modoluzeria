-- Modo avançado de customização de cores da agência: um jsonb estruturado
-- (mesmo padrão de nav_labels/nav_order/dashboard_layout) em vez de uma
-- coluna por categoria/tema — 8 categorias x 2 temas ficaria verboso demais
-- como colunas soltas. Cada chave é {light, dark} em hex; ausente = usa o
-- cálculo automático já existente (default do sistema de temas).
alter table public.orgs
  add column if not exists brand_advanced_colors jsonb not null default '{}'::jsonb;
