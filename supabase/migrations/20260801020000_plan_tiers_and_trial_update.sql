-- Updated pricing tiers: bump Solo/Pro/Agência client caps, and
-- consolidate the top of the table back to a single "sob consulta"
-- Enterprise plan (dropping the short-lived "Criador" tier — having two
-- sob-consulta plans back to back was redundant).
UPDATE public.plans SET max_clients = 10 WHERE id = 'solo';
UPDATE public.plans SET max_clients = 20 WHERE id = 'pro';
UPDATE public.plans SET max_clients = 30 WHERE id = 'agencia';
UPDATE public.plans SET price_cents = NULL, max_clients = 50, max_collaborators = 50 WHERE id = 'enterprise';

-- Luzeria's own org was on 'criador' — move it to 'enterprise' before
-- dropping the row (plans.id is a FK target on orgs.plan_id).
UPDATE public.orgs SET plan_id = 'enterprise' WHERE plan_id = 'criador';
DELETE FROM public.plans WHERE id = 'criador';

-- Trial length: standardize on 7 days everywhere. The column default was
-- still 14 days from before the public /assinar signup flow existed (which
-- already correctly uses 7) — orgs created via the admin "criar agência"
-- flow inherited the stale 14-day default instead.
ALTER TABLE public.orgs ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval '7 days');

-- Recompute for any org still mid-trial so nobody sees the old 14-day badge.
UPDATE public.orgs
SET trial_ends_at = created_at + interval '7 days'
WHERE subscription_status = 'trialing';
