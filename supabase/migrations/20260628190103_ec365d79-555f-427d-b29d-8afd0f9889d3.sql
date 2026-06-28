
ALTER TABLE public.content_items ALTER COLUMN status SET DEFAULT 'PLANEJAMENTO';

CREATE TABLE IF NOT EXISTS public.finalizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
  finalized_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS finalizations_user_at_idx ON public.finalizations(user_id, finalized_at);

GRANT SELECT ON public.finalizations TO authenticated;
GRANT ALL ON public.finalizations TO service_role;

ALTER TABLE public.finalizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "finalizations_own_or_admin"
  ON public.finalizations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.record_finalizations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
BEGIN
  IF NEW.status = 'FINALIZADO' AND (OLD.status IS DISTINCT FROM 'FINALIZADO') THEN
    FOR rec IN SELECT user_id FROM public.item_assignees WHERE item_id = NEW.id LOOP
      INSERT INTO public.finalizations (user_id, item_id, finalized_at)
      VALUES (rec.user_id, NEW.id, now());
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_finalizations ON public.content_items;
CREATE TRIGGER trg_record_finalizations
  AFTER UPDATE OF status ON public.content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.record_finalizations();
