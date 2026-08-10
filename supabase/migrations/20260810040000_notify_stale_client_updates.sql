-- Lembrete semanal: se um cliente ativo não recebe uma atualização (via
-- troca de etapa ou mensagem manual, registrada em client_stage_updates) há
-- mais de 7 dias, notifica todo mundo com acesso administrativo/setor
-- daquela agência. Segue exatamente o padrão idempotente de cron já usado
-- em auto-mark-missed-daily (20260801180000...sql:131-141).

-- notifications hoje só resolve client_id via content_items -> months ->
-- clients (listNotifications em api.functions.ts) — o lembrete semanal não
-- tem post nenhum associado, então precisa de uma referência direta.
ALTER TABLE public.notifications
  ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
CREATE INDEX idx_notifications_client ON public.notifications(client_id) WHERE client_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_stale_client_updates()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  admin_rec RECORD;
  sent int := 0;
BEGIN
  FOR rec IN
    SELECT c.id AS client_id, c.name, c.org_id
    FROM public.clients c
    WHERE c.archived = false
      AND COALESCE(
        (SELECT MAX(su.sent_at) FROM public.client_stage_updates su WHERE su.client_id = c.id),
        c.created_at
      ) < now() - interval '7 days'
  LOOP
    FOR admin_rec IN
      SELECT pr.id AS profile_id
      FROM public.profiles pr
      JOIN public.user_roles ur ON ur.user_id = pr.id AND ur.role IN ('master', 'setor')
      WHERE pr.org_id = rec.org_id AND pr.active = true
    LOOP
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = admin_rec.profile_id AND n.client_id = rec.client_id
          AND n.type = 'client_stale_update' AND n.created_at > now() - interval '6 days'
      );
      INSERT INTO public.notifications (user_id, type, client_id, message)
      VALUES (
        admin_rec.profile_id, 'client_stale_update', rec.client_id,
        'Já faz mais de uma semana sem atualização pra "' || rec.name || '" — que tal mandar um status?'
      );
      sent := sent + 1;
    END LOOP;
  END LOOP;
  RETURN sent;
END $$;

REVOKE ALL ON FUNCTION public.notify_stale_client_updates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_stale_client_updates() TO service_role;

DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'client_stale_updates_weekly';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;
SELECT cron.schedule(
  'client_stale_updates_weekly',
  '0 12 * * 3',
  $$SELECT public.notify_stale_client_updates();$$
);
