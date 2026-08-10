-- Ex-clientes (category = 'Ex-clientes', distinto de archived) não devem
-- entrar no lembrete semanal — mesmo padrão de exclusão já usado em
-- api.functions.ts (getOrgPlanStatus, listOrgsBilling etc.):
-- .eq('archived', false).neq('category', 'Ex-clientes').

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
      AND c.category IS DISTINCT FROM 'Ex-clientes'
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
