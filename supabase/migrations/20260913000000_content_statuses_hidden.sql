-- Permite ocultar (não só renomear) um status builtin customizável do
-- seletor de posts/reels/stories — pedido do Junior. A key continua
-- válida pra itens antigos que já estavam nesse status; só deixa de
-- ser oferecida como opção nova pra essa agência.
ALTER TABLE public.content_statuses ADD COLUMN hidden boolean NOT NULL DEFAULT false;
