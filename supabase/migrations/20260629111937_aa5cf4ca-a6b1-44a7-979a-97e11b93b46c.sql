DROP POLICY IF EXISTS "Authenticated users can write drive map" ON public.client_drive_map;

CREATE POLICY "Active members can insert drive map"
  ON public.client_drive_map FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true));

CREATE POLICY "Active members can update drive map"
  ON public.client_drive_map FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true));

CREATE POLICY "Admins can delete drive map"
  ON public.client_drive_map FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));