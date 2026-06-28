ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS reel_type text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_items_reel_type_chk') THEN
    ALTER TABLE public.content_items
      ADD CONSTRAINT content_items_reel_type_chk
      CHECK (reel_type IS NULL OR reel_type IN ('lofi','facil','basico','avancado'));
  END IF;
END $$;