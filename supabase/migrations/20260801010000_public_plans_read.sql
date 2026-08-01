-- The pricing page at /assinar is public (no login) and needs to list plans
-- and prices before anyone signs up. Plan data isn't sensitive, so it's
-- safe to expose to unauthenticated visitors too, same pattern already
-- used for anon reads on other public-facing tables.
GRANT SELECT ON public.plans TO anon;
CREATE POLICY "anon read plans" ON public.plans FOR SELECT TO anon USING (true);
