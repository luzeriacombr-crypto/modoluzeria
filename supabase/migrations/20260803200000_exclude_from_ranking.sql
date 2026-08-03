-- Lets a master opt a member out of the "Top Membros" ranking — e.g. an
-- automation-only account auto-assigned to everything, which shouldn't
-- compete in an agency's internal bonus program.
ALTER TABLE public.profiles ADD COLUMN exclude_from_ranking boolean NOT NULL DEFAULT false;
