CREATE TABLE public.client_drive_map (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  drive_folder_id text NOT NULL,
  deliveries_folder_id text,
  confirmed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_drive_map TO authenticated;
GRANT ALL ON public.client_drive_map TO service_role;

ALTER TABLE public.client_drive_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read drive map"
  ON public.client_drive_map FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can write drive map"
  ON public.client_drive_map FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_client_drive_map_updated
  BEFORE UPDATE ON public.client_drive_map
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();