-- Antes: uma notificação por roteiro toda vez que o cliente aprovava/pedia
-- ajuste (trigger FOR EACH ROW, 20260814060000) — um cliente respondendo
-- 20 roteiros seguidos virava 20 notificações separadas pra cada
-- master/setor. Junior pediu pra virar uma só, tipo "fulano já olhou os
-- roteiros, confira as aprovações".
--
-- Sem cron nem coluna nova: se já existir uma notificação NÃO LIDA e
-- recente (últimas 12h) do mesmo cliente pra esse usuário, só "revive"
-- ela (sobe pro topo, mensagem genérica cobrindo aprovado + ajustar) em
-- vez de empilhar outra. Só cria uma nova quando a pessoa já leu a
-- anterior, ou já faz mais de 12h.
CREATE OR REPLACE FUNCTION public.notify_roteiro_client_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec record;
  v_client_id uuid;
  v_client_name text;
  v_message text;
  v_existing_id uuid;
BEGIN
  IF NEW.client_status NOT IN ('aprovado', 'ajustar') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.client_status IS NOT DISTINCT FROM NEW.client_status THEN RETURN NEW; END IF;

  SELECT c.id, c.name INTO v_client_id, v_client_name
  FROM public.client_docs cd JOIN public.clients c ON c.id = cd.client_id
  WHERE cd.id = NEW.doc_id;
  IF v_client_id IS NULL THEN RETURN NEW; END IF;

  v_message := COALESCE(v_client_name, 'Cliente') || ' respondeu aos roteiros — confira as aprovações e pedidos de ajuste.';

  FOR rec IN
    SELECT ur.user_id FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role IN ('master', 'setor') AND p.org_id = NEW.org_id AND p.active = true
  LOOP
    SELECT id INTO v_existing_id FROM public.notifications
    WHERE user_id = rec.user_id AND type = 'roteiro_client_status' AND client_id = v_client_id
      AND read = false AND created_at > now() - interval '12 hours'
    ORDER BY created_at DESC LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.notifications SET created_at = now(), message = v_message WHERE id = v_existing_id;
    ELSE
      INSERT INTO public.notifications (user_id, type, client_id, message)
      VALUES (rec.user_id, 'roteiro_client_status', v_client_id, v_message);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
