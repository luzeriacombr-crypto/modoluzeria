-- Junior: on the same day, Luzeria's own stories and a client's (e.g.
-- Selfit) stories can both be due, each with a different person
-- responsible. stories_schedule only allowed one row per (org, day) —
-- widen it to one row per (org, day, client) so several entries can
-- coexist on the same day. NULL client_id rows (no client picked yet)
-- stay independently unique under normal SQL NULL semantics.
ALTER TABLE public.stories_schedule DROP CONSTRAINT stories_schedule_org_day_key;
ALTER TABLE public.stories_schedule ADD CONSTRAINT stories_schedule_org_day_client_key UNIQUE (org_id, day, client_id);
