-- Rastreia quais atualizações já entraram numa notificação em lote, pra dar
-- pro admin escolher o destaque só entre as que ainda não foram avisadas
-- ("{destaque} e outras N novidades... Clica aqui!").
ALTER TABLE public.platform_updates
  ADD COLUMN IF NOT EXISTS notified_at timestamptz;
