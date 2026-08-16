-- record_finalizations(): passa a creditar o editor também quando ele é
-- (re)atribuído DEPOIS que o item já está em status terminal, não só quando
-- o status muda. Antes, o guard `OLD.status IS DISTINCT FROM NEW.status`
-- bloqueava o crédito nesse caso: se o editor era trocado num item que já
-- estava PRONTO_PARA_PUBLICAR/CONCLUIDO/FINALIZADO, o trigger não disparava
-- de novo e o novo editor nunca ganhava a linha em finalizations (ficava de
-- fora do ranking mesmo aparecendo como "Editor" no card).
--
-- Reversível: para voltar ao comportamento anterior, reaplique a definição
-- de supabase/migrations/20260805100500_finalizado_status_triggers.sql
-- (linhas 10-36).
CREATE OR REPLACE FUNCTION public.record_finalizations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
BEGIN
  IF NEW.status IN ('PRONTO_PARA_PUBLICAR', 'CONCLUIDO', 'FINALIZADO')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR rec IN SELECT user_id FROM public.item_assignees WHERE item_id = NEW.id LOOP
      IF NOT EXISTS (SELECT 1 FROM public.finalizations WHERE item_id = NEW.id AND user_id = rec.user_id) THEN
        INSERT INTO public.finalizations (user_id, item_id, finalized_at)
        VALUES (rec.user_id, NEW.id, now());
      END IF;
    END LOOP;
  END IF;

  IF NEW.status IN ('PRONTO_PARA_PUBLICAR', 'CONCLUIDO', 'FINALIZADO')
     AND NEW.editor_id IS NOT NULL
     AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.editor_id IS DISTINCT FROM NEW.editor_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.finalizations WHERE item_id = NEW.id AND user_id = NEW.editor_id
     ) THEN
    INSERT INTO public.finalizations (user_id, item_id, finalized_at)
    VALUES (NEW.editor_id, NEW.id, now());
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill único: cobre os itens que já estavam nessa situação antes do fix
-- (editor atribuído depois do status virar terminal, nunca creditado).
-- finalized_at usa now() porque não dá pra saber retroativamente quando a
-- troca de editor de fato aconteceu (updated_at reflete a última alteração
-- do row, que pode não ter sido a troca de editor).
INSERT INTO public.finalizations (user_id, item_id, finalized_at)
SELECT ci.editor_id, ci.id, now()
FROM public.content_items ci
WHERE ci.editor_id IS NOT NULL
  AND ci.status IN ('PRONTO_PARA_PUBLICAR', 'CONCLUIDO', 'FINALIZADO')
  AND NOT EXISTS (
    SELECT 1 FROM public.finalizations f WHERE f.item_id = ci.id AND f.user_id = ci.editor_id
  );
