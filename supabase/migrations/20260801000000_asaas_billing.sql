-- Fase 3: cobrança recorrente via Asaas. Guarda o vínculo entre cada
-- agência e seu cliente/assinatura no Asaas, o CPF/CNPJ necessário pra criar
-- o cliente lá, e um log de eventos de webhook (evita processar o mesmo
-- evento duas vezes se o Asaas reenviar por timeout).

ALTER TABLE public.orgs ADD COLUMN tax_id text;
ALTER TABLE public.orgs ADD COLUMN asaas_customer_id text;
ALTER TABLE public.orgs ADD COLUMN asaas_subscription_id text;

CREATE TABLE public.asaas_webhook_events (
  id text PRIMARY KEY,
  event text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.asaas_webhook_events TO service_role;
ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;
-- Sem policies: só o webhook handler (service_role, ignora RLS) mexe aqui.
