ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS editor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS content_items_editor_id_idx ON public.content_items(editor_id);