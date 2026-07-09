-- The editor set on an item (previously only exposed for reels, now also for
-- posts) should count toward that person's productivity/top-members numbers,
-- same as an assignee — not just whoever is in item_assignees.
CREATE OR REPLACE FUNCTION public.record_finalizations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
BEGIN
  IF NEW.status = 'PRONTO_PARA_PUBLICAR' AND (OLD.status IS DISTINCT FROM 'PRONTO_PARA_PUBLICAR') THEN
    FOR rec IN SELECT user_id FROM public.item_assignees WHERE item_id = NEW.id LOOP
      INSERT INTO public.finalizations (user_id, item_id, finalized_at)
      VALUES (rec.user_id, NEW.id, now());
    END LOOP;
    -- Editor gets credit too, unless already counted as an assignee above.
    IF NEW.editor_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.item_assignees WHERE item_id = NEW.id AND user_id = NEW.editor_id
    ) THEN
      INSERT INTO public.finalizations (user_id, item_id, finalized_at)
      VALUES (NEW.editor_id, NEW.id, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
