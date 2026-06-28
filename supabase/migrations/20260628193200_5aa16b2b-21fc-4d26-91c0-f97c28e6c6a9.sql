DROP POLICY IF EXISTS finalizations_own_or_admin ON public.finalizations;
CREATE POLICY finalizations_read_authenticated ON public.finalizations
  FOR SELECT TO authenticated USING (true);