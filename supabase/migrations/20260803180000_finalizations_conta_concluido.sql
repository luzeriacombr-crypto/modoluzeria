-- Two fixes to the "Top Membros" ranking, both reported today:
--
-- 1. finalizations.item_id is set to NULL (not row-deleted) when its
--    content_item is removed — e.g. an item created for testing, marked
--    done, then deleted. Those orphaned rows kept counting forever
--    (getTopMembers didn't filter them; fixed on the TS side too).
--
-- 2. record_finalizations() only ever fired for PRONTO_PARA_PUBLICAR
--    (posts/reels) — activity items (gravação/roteiro/sistema/outros),
--    whose pipeline ends at CONCLUIDO instead, never generated a
--    finalization at all, so that work was never credited.
CREATE OR REPLACE FUNCTION public.record_finalizations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
BEGIN
  IF (NEW.status = 'PRONTO_PARA_PUBLICAR' AND OLD.status IS DISTINCT FROM 'PRONTO_PARA_PUBLICAR')
     OR (NEW.status = 'CONCLUIDO' AND OLD.status IS DISTINCT FROM 'CONCLUIDO') THEN
    FOR rec IN SELECT user_id FROM public.item_assignees WHERE item_id = NEW.id LOOP
      INSERT INTO public.finalizations (user_id, item_id, finalized_at)
      VALUES (rec.user_id, NEW.id, now());
    END LOOP;
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

-- Same backfill query as 20260721071500, re-run to catch any CONCLUIDO
-- activity items finished since then that the trigger (pre-fix) missed.
INSERT INTO public.finalizations (user_id, item_id, finalized_at)
SELECT ia.user_id, ci.id, ci.updated_at
FROM public.content_items ci
JOIN public.item_assignees ia ON ia.item_id = ci.id
WHERE ci.status IN ('CONCLUIDO', 'PRONTO_PARA_PUBLICAR')
  AND NOT EXISTS (SELECT 1 FROM public.finalizations f WHERE f.item_id = ci.id);

INSERT INTO public.finalizations (user_id, item_id, finalized_at)
SELECT ci.editor_id, ci.id, ci.updated_at
FROM public.content_items ci
WHERE ci.status IN ('CONCLUIDO', 'PRONTO_PARA_PUBLICAR')
  AND ci.editor_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.finalizations f WHERE f.item_id = ci.id AND f.user_id = ci.editor_id)
  AND NOT EXISTS (SELECT 1 FROM public.item_assignees ia WHERE ia.item_id = ci.id AND ia.user_id = ci.editor_id);
