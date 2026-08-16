-- "Última gravação" deixa de ser derivada do histórico de etapas (o dia em
-- que a etapa muda nem sempre é o dia real da gravação) e passa a ser um
-- campo manual por cliente. "Próxima prevista" passa a ser calculada a
-- partir da quantidade de vídeos gravados naquele mês (registrados em Mais
-- Atividades), não mais de uma cadência fixa digitada à mão.
ALTER TABLE public.clients ADD COLUMN last_gravacao_at date;

-- gravacao_cadence_days nunca chegou a ser usado de verdade (1 linha
-- preenchida, feature recém-lançada) — reversível: ALTER TABLE public.clients ADD COLUMN gravacao_cadence_days integer;
ALTER TABLE public.clients DROP COLUMN gravacao_cadence_days;

-- milestone_type 'gravacao' também deixa de ser usado (a etapa da Jornada
-- não é mais a fonte de "última gravação") — só 'analise' continua válido.
-- Reversível: ALTER TABLE public.client_journey_stages DROP CONSTRAINT client_journey_stages_milestone_type_check;
--             ALTER TABLE public.client_journey_stages ADD CONSTRAINT client_journey_stages_milestone_type_check CHECK (milestone_type = ANY (ARRAY['gravacao','analise']));
UPDATE public.client_journey_stages SET milestone_type = NULL WHERE milestone_type = 'gravacao';
ALTER TABLE public.client_journey_stages DROP CONSTRAINT client_journey_stages_milestone_type_check;
ALTER TABLE public.client_journey_stages ADD CONSTRAINT client_journey_stages_milestone_type_check CHECK (milestone_type = ANY (ARRAY['analise']));
