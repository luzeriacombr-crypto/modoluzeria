-- Quando a importação por IA traz mais clientes do que o plano atual
-- permite, a agência não é bloqueada na hora — ganha um prazo pra fazer
-- upgrade. Gravado só uma vez (a primeira vez que passa do limite);
-- limpo sozinho (null) assim que a contagem volta a caber no plano —
-- ver getOrgPlanStatus.
ALTER TABLE public.orgs ADD COLUMN client_limit_grace_until timestamptz;
