-- Padrão pedido pelo Junior pra notificação de lote de changelog: em vez de
-- só "N novidades no Modo Criador!", destaca a novidade mais legal do lote
-- (a primeira linha do INSERT — quem publica decide a ordem) seguida de
-- quantas outras vieram junto, com uma chamada pra ação.
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
  highlight text;
BEGIN
  SELECT count(*) INTO cnt FROM new_rows;
  IF cnt = 1 THEN
    SELECT title INTO msg FROM new_rows LIMIT 1;
  ELSE
    SELECT title INTO highlight FROM new_rows LIMIT 1;
    msg := highlight || ' e outras ' || (cnt - 1) || ' novidades no Modo Criador. Clica aqui!';
  END IF;
  FOR rec IN SELECT id FROM public.profiles WHERE active = true LOOP
    INSERT INTO public.notifications (user_id, type, message)
    VALUES (rec.id, 'platform_update', msg);
  END LOOP;
  RETURN NULL;
END;
$$;
