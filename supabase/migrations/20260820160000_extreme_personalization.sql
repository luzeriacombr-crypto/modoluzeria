-- "Personalização extrema" — renomear/reordenar itens do menu lateral,
-- tela padrão ao abrir o sistema (por pessoa) e raio de borda (por agência).
-- Tudo aditivo, com default que preserva o comportamento de hoje.

ALTER TABLE public.orgs ADD COLUMN nav_labels jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.orgs ADD COLUMN nav_order jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.orgs ADD COLUMN border_radius integer NOT NULL DEFAULT 12;

-- Por pessoa, não por agência — cada colaborador tem uma rotina diferente
-- (quem grava quer cair direto no calendário, quem edita quer minhas
-- demandas, etc.). NULL = comportamento de hoje (Minhas Demandas).
ALTER TABLE public.profiles ADD COLUMN default_landing jsonb;
