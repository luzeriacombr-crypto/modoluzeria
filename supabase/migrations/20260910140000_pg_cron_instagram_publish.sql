-- O cron externo (GitHub Actions, .github/workflows/publish-instagram-cron.yml)
-- que dispara /api/cron/publish-instagram estava rodando de forma muito
-- irregular — às vezes a cada 2 a 5 HORAS em vez de a cada 10 minutos
-- (confirmado no histórico de execuções do próprio GitHub), deixando
-- publicações programadas presas por horas. Move o disparo pra dentro do
-- Supabase via pg_cron + pg_net, que não depende do agendador do GitHub —
-- roda direto no banco, no mesmo lugar que já agenda
-- client_stale_updates_weekly (20260810040000...sql).
--
-- Mantém os workflows do GitHub Actions no ar como reforço (não faz mal
-- rodar os dois — publicar é idempotente: uma vez que o item sai do
-- Instagram, ig_auto_publish vira false e ninguém pega ele de novo).
--
-- ATENÇÃO Junior: antes de rodar essa migration, troca
-- 'COLOQUE_AQUI_O_CRON_SECRET' pelo valor real do CRON_SECRET — acha em
-- Vercel → Settings → Environment Variables → CRON_SECRET → ícone de olho
-- pra revelar → copiar. Sem isso os dois jobs abaixo vão sempre dar 401.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'publish_instagram_every_5min';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;
SELECT cron.schedule(
  'publish_instagram_every_5min',
  '*/5 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://www.modocriador.com.br/api/cron/publish-instagram',
    headers := jsonb_build_object('Authorization', 'Bearer COLOQUE_AQUI_O_CRON_SECRET')
  );
  $$
);

DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'refresh_instagram_tokens_daily';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;
SELECT cron.schedule(
  'refresh_instagram_tokens_daily',
  '17 6 * * *',
  $$
  SELECT net.http_get(
    url := 'https://www.modocriador.com.br/api/cron/refresh-instagram-tokens',
    headers := jsonb_build_object('Authorization', 'Bearer COLOQUE_AQUI_O_CRON_SECRET')
  );
  $$
);
