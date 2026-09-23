-- Data de início e fim de contrato por cliente — pedido recorrente em
-- onboardings reais (agência quer registrar quando o contrato começou e
-- quando vence, pra saber quando renovar). Master-only, igual contract_value
-- e payment_due_day.
ALTER TABLE public.clients ADD COLUMN contract_start_date date;
ALTER TABLE public.clients ADD COLUMN contract_end_date date;
