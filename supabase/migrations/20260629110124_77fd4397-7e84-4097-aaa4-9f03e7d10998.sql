-- 1) Table
CREATE TABLE public.item_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  drive_file_id text NOT NULL,
  name text NOT NULL,
  mime_type text,
  icon_url text,
  thumbnail_url text,
  web_view_url text NOT NULL,
  size_bytes bigint,
  added_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, drive_file_id)
);

CREATE INDEX idx_item_files_item ON public.item_files(item_id, sort_order);

-- 2) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_files TO authenticated;
GRANT ALL ON public.item_files TO service_role;

-- 3) RLS
ALTER TABLE public.item_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "item_files_read_all_auth"
  ON public.item_files FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "item_files_write_assignee_or_admin"
  ON public.item_files FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.item_assignees ia
      WHERE ia.item_id = item_files.item_id AND ia.user_id = auth.uid()
    )
  );

CREATE POLICY "item_files_update_assignee_or_admin"
  ON public.item_files FOR UPDATE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.item_assignees ia
      WHERE ia.item_id = item_files.item_id AND ia.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.item_assignees ia
      WHERE ia.item_id = item_files.item_id AND ia.user_id = auth.uid()
    )
  );

CREATE POLICY "item_files_delete_assignee_or_admin"
  ON public.item_files FOR DELETE
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.item_assignees ia
      WHERE ia.item_id = item_files.item_id AND ia.user_id = auth.uid()
    )
  );

-- 4) Touch updated_at
CREATE TRIGGER touch_item_files_updated_at
  BEFORE UPDATE ON public.item_files
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) Migrate existing drive_link values
INSERT INTO public.item_files (item_id, drive_file_id, name, web_view_url, sort_order)
SELECT
  ci.id,
  COALESCE(
    (regexp_match(ci.drive_link, '/(?:file/d|folders)/([a-zA-Z0-9_-]+)'))[1],
    (regexp_match(ci.drive_link, '[?&]id=([a-zA-Z0-9_-]+)'))[1],
    'legacy-' || ci.id::text
  ),
  'Link do Drive',
  ci.drive_link,
  0
FROM public.content_items ci
WHERE ci.drive_link IS NOT NULL
  AND length(trim(ci.drive_link)) > 0
ON CONFLICT (item_id, drive_file_id) DO NOTHING;