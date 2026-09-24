-- A notificação de feedback do cliente sempre dizia "comentou em ...", até
-- pra uma aprovação — sem diferenciar, e sem avisar quando o post já saiu
-- direto pra "programado" (auto-agendar na aprovação, adicionado em
-- 20260924060000...sql). Detecta se vai ficar auto-agendado pela MESMA
-- condição usada lá (scheduled_at preenchido + tipo post/reel/story) — não
-- depende de ler ig_auto_publish, que só é atualizado DEPOIS do insert que
-- dispara esse trigger (evita problema de ordem sem precisar reordenar
-- add_public_feedback).
CREATE OR REPLACE FUNCTION public.notify_on_client_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  item_title text;
  item_scheduled_at timestamptz;
  item_type text;
  v_message text;
BEGIN
  SELECT title, scheduled_at, type INTO item_title, item_scheduled_at, item_type
  FROM public.content_items WHERE id = NEW.item_id;

  IF NEW.kind = 'approval' AND item_scheduled_at IS NOT NULL AND item_type IN ('post', 'reel', 'story') THEN
    v_message := 'Cliente (' || NEW.author_name || ') aprovou "' || COALESCE(item_title,'') || '" — já está programado.';
  ELSIF NEW.kind = 'approval' THEN
    v_message := 'Cliente (' || NEW.author_name || ') aprovou "' || COALESCE(item_title,'') || '"';
  ELSE
    v_message := 'Cliente (' || NEW.author_name || ') comentou em "' || COALESCE(item_title,'') || '"';
  END IF;

  FOR rec IN SELECT user_id FROM public.item_assignees WHERE item_id = NEW.item_id LOOP
    INSERT INTO public.notifications (user_id, type, item_id, message)
    VALUES (rec.user_id, 'client_feedback', NEW.item_id, v_message);
  END LOOP;
  RETURN NEW;
END;
$$;
