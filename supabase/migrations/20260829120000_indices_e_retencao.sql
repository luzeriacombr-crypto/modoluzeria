-- Índices que faltavam, confirmados com EXPLAIN em produção (auditoria
-- 29/08). Os três primeiros davam Seq Scan em caminho quente.

-- 1) getTopMembers/getReport filtram finalizations SÓ por data. O índice
-- que existe é (user_id, finalized_at) — com user_id na frente, um filtro
-- só por data não usa ele. Roda no dashboard, a cada abertura.
CREATE INDEX IF NOT EXISTS idx_finalizations_at
  ON public.finalizations (finalized_at)
  WHERE item_id IS NOT NULL;

-- 2) content_items.updated_at não tinha índice nenhum, e todo relatório
-- (getProductivity, getReportExtras, getDeliveryTrend) filtra por ele.
CREATE INDEX IF NOT EXISTS idx_content_items_org_updated
  ON public.content_items (org_id, updated_at DESC);

-- 3) months.key idem: o único índice é UNIQUE (client_id, key), e o
-- primeiro passo do getAdminDashboard busca só por key.
CREATE INDEX IF NOT EXISTS idx_months_key
  ON public.months (key);

-- 4) O índice de notificações tem `read` no meio (user_id, read,
-- created_at), o que quebra o uso dele pra ordenar. O plano lia TODAS as
-- notificações da pessoa (medido: 1.504 no maior caso) pra devolver 50 —
-- a cada 60 segundos, por usuário.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- Índice duplicado: status_transitions tinha DOIS índices idênticos em
-- (item_id). A tabela recebe ~2.400 inserções/mês e mantinha os dois a
-- cada uma — custo de escrita puro, sem ganho de leitura.
DROP INDEX IF EXISTS public.status_transitions_item_idx;

-- Retenção. Nada limpava notifications, que saltou de 965 (jul) pra 6.576
-- (ago) sem nenhuma rotina — e a lixeira só era purgada quando alguém
-- abria a página, então a promessa de "7 dias" não era garantida.
CREATE OR REPLACE FUNCTION public.run_retention_cleanup()
RETURNS TABLE (notificacoes_apagadas integer, itens_purgados integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n_notif integer;
  n_itens integer;
BEGIN
  -- Notificação lida com mais de 90 dias não serve mais pra nada; a não
  -- lida fica, por mais velha que seja (pode ser algo que a pessoa quis
  -- deixar marcado).
  WITH apagadas AS (
    DELETE FROM public.notifications
    WHERE read = true AND created_at < now() - interval '90 days'
    RETURNING 1
  )
  SELECT count(*)::integer INTO n_notif FROM apagadas;

  -- Lixeira: purga o que passou dos 7 dias, independente de alguém abrir
  -- a página. Espelha exatamente o RETENTION_DAYS de trash.functions.ts.
  WITH purgados AS (
    DELETE FROM public.content_items
    WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '7 days'
    RETURNING 1
  )
  SELECT count(*)::integer INTO n_itens FROM purgados;

  RETURN QUERY SELECT n_notif, n_itens;
END;
$$;

REVOKE ALL ON FUNCTION public.run_retention_cleanup() FROM public, anon, authenticated;
