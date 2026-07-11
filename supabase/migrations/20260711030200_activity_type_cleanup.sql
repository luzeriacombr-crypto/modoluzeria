-- Step 2 of 2 — run after 20260711030105_activity_status_enum.sql has committed.

-- 'gravacao'/'roteiro'/'sistema' were being stored as type='outros' with the
-- subtype hidden in blocked_reason ('_sub:gravacao' etc) — a discriminator
-- that silently breaks if the item is ever actually blocked (TRAVADO) and
-- someone fills in a real blocking reason. The content_type enum already has
-- real values for these (see 20260702001300_add_content_types.sql), just
-- never wired up. Move existing data to the real type and drop the hack.
UPDATE public.content_items
  SET type = 'gravacao', blocked_reason = NULL
  WHERE type = 'outros' AND blocked_reason = '_sub:gravacao';

UPDATE public.content_items
  SET type = 'roteiro', blocked_reason = NULL
  WHERE type = 'outros' AND blocked_reason = '_sub:roteiro';

UPDATE public.content_items
  SET type = 'sistema', blocked_reason = NULL
  WHERE type = 'outros' AND blocked_reason = '_sub:sistema';

-- Normalize all activity items onto the new PENDENTE/CONCLUIDO status model.
UPDATE public.content_items
  SET status = 'CONCLUIDO'
  WHERE type IN ('gravacao','roteiro','sistema','outros') AND status = 'PRONTO_PARA_PUBLICAR';

UPDATE public.content_items
  SET status = 'PENDENTE'
  WHERE type IN ('gravacao','roteiro','sistema','outros') AND status <> 'CONCLUIDO';

ALTER TABLE public.content_items ALTER COLUMN status SET DEFAULT 'PLANEJAMENTO';

-- record_finalizations(): activities reaching CONCLUIDO now count toward a
-- member's monthly totals the same way posts/reels do at PRONTO_PARA_PUBLICAR
-- (same finalizations ledger, just a different triggering status).
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
