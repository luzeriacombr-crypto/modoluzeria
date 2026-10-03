-- Novidades por público (pedido do Junior, 02/10): cada atualização é pra todos,
-- só pra agências ou só pra houses; a lista e a notificação respeitam isso.
-- Aditivo: tudo que já existe continua "all".
ALTER TABLE public.platform_updates
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'all'
  CHECK (audience IN ('all', 'agency', 'house'));
