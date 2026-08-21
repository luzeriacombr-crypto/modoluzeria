-- Pivot do CRM de vendas: em vez de colunas de etapa (kanban clássico),
-- a referência real que o Junior queria (ferramenta concorrente "Rapoza")
-- organiza leads em filas por urgência/tempo parado. Como não temos
-- integração de mensagens do WhatsApp pra detectar resposta automática,
-- os campos abaixo são atualizados manualmente pelo time com um clique
-- (ex: "Marquei contato", "Agendar follow-up", "Preciso responder").
-- sales_stages nunca chegou a ser usado (0 leads com stage_id até aqui)
-- — removido antes de virar dívida técnica.

ALTER TABLE public.leads DROP COLUMN IF EXISTS stage_id;
DROP TABLE IF EXISTS public.sales_stages;

ALTER TABLE public.leads
  ADD COLUMN awaiting_reply boolean NOT NULL DEFAULT false,
  ADD COLUMN last_contact_at timestamptz,
  ADD COLUMN next_followup_at timestamptz,
  ADD COLUMN follow_up_note text;

CREATE INDEX idx_leads_awaiting_reply ON public.leads(org_id, awaiting_reply) WHERE archived = false;
CREATE INDEX idx_leads_next_followup ON public.leads(org_id, next_followup_at) WHERE archived = false;
CREATE INDEX idx_leads_last_contact ON public.leads(org_id, last_contact_at) WHERE archived = false;
