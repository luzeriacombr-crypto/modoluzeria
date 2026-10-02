-- "Post extra"/"Reels extra": marca um item entregue além do Volume mensal
-- combinado com o cliente (ex: contratou 12 posts, entregou 13 — o 13º
-- pode ser marcado). Independe de campanha/campaign_internal (que esconde
-- do cliente); esse aqui não esconde nada, é só rótulo pra contabilizar
-- quanto foi entregue a mais por cliente/mês. Pedido do Junior (01/10).
ALTER TABLE public.content_items
  ADD COLUMN is_extra boolean NOT NULL DEFAULT false;
