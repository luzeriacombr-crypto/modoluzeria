-- Backfill: 16 content_items reached a terminal status (CONCLUIDO or
-- PRONTO_PARA_PUBLICAR) without ever getting a matching row in
-- `finalizations` — likely rows touched outside the normal app update path
-- (e.g. direct data migration) that never fired trg_record_finalizations.
-- Mirrors record_finalizations()'s own logic: one row per assignee, plus the
-- editor if not already an assignee. Uses updated_at as the best available
-- approximation of when the item was actually finished.

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
