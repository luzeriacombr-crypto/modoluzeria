-- Correção do trigger anterior (20260814050000): ele era FOR EACH ROW, então
-- inserir várias linhas de changelog na mesma leva (uma por novidade real,
-- como a Atualizações já mostra em cards separados) disparava uma
-- notificação por linha × por perfil ativo — spam. O pedido nunca foi juntar
-- as NOVIDADES num card só; era juntar as NOTIFICAÇÕES quando várias
-- novidades sobem juntas. Virou trigger por STATEMENT com transition table:
-- uma notificação por perfil ativo por INSERT, não por linha inserida.
CREATE OR REPLACE FUNCTION public.notify_platform_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec record;
  msg text;
  cnt integer;
BEGIN
  SELECT count(*) INTO cnt FROM new_rows;
  IF cnt = 1 THEN
    SELECT title INTO msg FROM new_rows LIMIT 1;
  ELSE
    msg := cnt || ' novidades no Modo Criador!';
  END IF;
  FOR rec IN SELECT id FROM public.profiles WHERE active = true LOOP
    INSERT INTO public.notifications (user_id, type, message)
    VALUES (rec.id, 'platform_update', msg);
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_platform_update ON public.platform_updates;
CREATE TRIGGER trg_notify_platform_update
  AFTER INSERT ON public.platform_updates
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION public.notify_platform_update();
