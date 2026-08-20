-- Custo fixo médio mensal da agência (aluguel, pró-labore, tarifas, folha
-- administrativa etc. — tudo que não é mão de obra de produção, já contada
-- via hourly_cost), usado pelo painel de margem pra ratear entre os
-- clientes ativos proporcional ao valor de contrato de cada um.
--
-- Reversível: ALTER TABLE public.orgs DROP COLUMN fixed_monthly_cost;
ALTER TABLE public.orgs
  ADD COLUMN fixed_monthly_cost numeric;
