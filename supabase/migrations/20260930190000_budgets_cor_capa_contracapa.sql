-- Orçamentos (30/09): capa e contracapa sem imagem deixam de usar o
-- degradê gerado na hora (pedido do Junior — "degradê feio") e passam a
-- ser uma cor sólida escolhida por orçamento. Null = cor da barra lateral
-- da agência (orgs.color_sidebar). gradient_from/gradient_to ficam na
-- tabela sem uso novo (orçamentos antigos não dependem deles pra abrir).
--
-- Pra reverter (DOWN), rodar:
--   ALTER TABLE public.budgets DROP COLUMN IF EXISTS cover_color, DROP COLUMN IF EXISTS back_color;

ALTER TABLE public.budgets
  ADD COLUMN cover_color text CHECK (cover_color ~ '^#[0-9A-Fa-f]{6}$'),
  ADD COLUMN back_color text CHECK (back_color ~ '^#[0-9A-Fa-f]{6}$');
