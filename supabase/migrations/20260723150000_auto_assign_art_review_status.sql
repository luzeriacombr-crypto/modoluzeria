-- Auto-assign specific people when a post/reel reaches certain statuses:
--   - CRIACAO (post-only, "Criação de arte"): Amaro becomes responsible + editor.
--   - REVISAO_ARTE (post-only) or REVISAO_INTERNA (post AND reel): Jordânia
--     becomes responsible. REVISAO_ARTE never happens on a reel, so this
--     single condition already matches "reels: only Revisão interna".
-- Adds to the existing assignee list rather than replacing it.
CREATE OR REPLACE FUNCTION public.auto_assign_on_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  amaro_id uuid := 'c6d74db9-ab7b-4002-89c7-02d5fa5cb662';
  jordania_id uuid := 'afd35d3a-b41c-4c78-8085-d9ff0fa9e96a';
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'CRIACAO' THEN
      INSERT INTO public.item_assignees (item_id, user_id) VALUES (NEW.id, amaro_id)
        ON CONFLICT DO NOTHING;
      NEW.editor_id := amaro_id;
    ELSIF NEW.status IN ('REVISAO_ARTE', 'REVISAO_INTERNA') THEN
      INSERT INTO public.item_assignees (item_id, user_id) VALUES (NEW.id, jordania_id)
        ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_on_status ON public.content_items;
CREATE TRIGGER trg_auto_assign_on_status
  BEFORE UPDATE ON public.content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_on_status();
