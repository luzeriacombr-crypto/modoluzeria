-- Além de afinar o tamanho (logo_size_adjust_px), o Junior quer poder
-- empurrar a logo pra esquerda/direita manualmente também.
ALTER TABLE public.orgs ADD COLUMN logo_position_adjust_px integer NOT NULL DEFAULT 0;

-- Zera o valor estranho que apareceu em teste nessa coluna nova antes dela
-- ter UI pra editar de propósito (não foi um ajuste real do Junior).
UPDATE public.orgs SET logo_size_adjust_px = 0 WHERE id = '00000000-0000-0000-0000-000000000001';
