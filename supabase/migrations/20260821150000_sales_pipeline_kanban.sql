-- Segundo ajuste no mesmo dia: o time queria controle manual (arrastar o
-- card ele mesmo entre colunas), não filas 100% automáticas. Fechado e
-- Perdido viram colunas reais e visíveis (não só ações que somem da
-- tela). Follow-up continua sendo uma coluna só, ordenada por data —
-- a divisão "hoje vs próximos" fica por conta do front, não do schema.

ALTER TABLE public.leads
  ADD COLUMN status text NOT NULL DEFAULT 'novo'
    CHECK (status IN ('novo', 'responder', 'followup', 'fechado', 'perdido'));

-- Migra os 5 leads reais criados testando a versão anterior (awaiting_reply
-- e next_followup_at já preenchidos por eles) pro status equivalente.
UPDATE public.leads SET status = CASE
  WHEN archived AND won_client_id IS NOT NULL THEN 'fechado'
  WHEN archived THEN 'perdido'
  WHEN awaiting_reply THEN 'responder'
  WHEN next_followup_at IS NOT NULL THEN 'followup'
  ELSE 'novo'
END;

DROP INDEX IF EXISTS idx_leads_awaiting_reply;
DROP INDEX IF EXISTS idx_leads_last_contact;
ALTER TABLE public.leads DROP COLUMN awaiting_reply;
ALTER TABLE public.leads DROP COLUMN last_contact_at;

CREATE INDEX idx_leads_status ON public.leads(org_id, status);
