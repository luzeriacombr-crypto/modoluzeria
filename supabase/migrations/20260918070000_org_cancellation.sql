-- Cancelamento self-service de assinatura pelo próprio master da agência
-- (antes só existia via deleteOrg, restrito a admin da plataforma, que
-- apaga a agência inteira). Guarda quando e por quê, pra dar visibilidade
-- de churn.
ALTER TABLE public.orgs ADD COLUMN canceled_at timestamptz;
ALTER TABLE public.orgs ADD COLUMN cancellation_reason text;
