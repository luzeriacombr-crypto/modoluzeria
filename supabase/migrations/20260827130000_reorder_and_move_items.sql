-- Reordenar posts/reels dentro da grade (arrastar e soltar) e mover um
-- item pra outro mês. Espelha o padrão já usado em update_feed_order:
-- uma função em lote, sem SECURITY DEFINER, continua sujeita ao RLS de
-- quem chama.
CREATE OR REPLACE FUNCTION public.update_item_idx(p_updates jsonb)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.content_items AS ci
  SET idx = (u->>'idx')::int
  FROM jsonb_array_elements(p_updates) AS u
  WHERE ci.id = (u->>'id')::uuid;
$$;
