-- Visão Geral operacional dos clientes: rastreia quando cada cliente
-- passou pela etapa de "gravação" e de "análise do mês anterior" da
-- jornada, pra calcular "última gravação" / "próxima prevista" sem
-- depender do log de mensagens enviadas (client_stage_updates só registra
-- quando a mensagem é de fato enviada, não toda troca de etapa).

-- Etapas customizáveis por agência não podem ser identificadas pelo nome —
-- milestone_type deixa cada agência apontar livremente qual etapa própria
-- representa "gravação" e qual representa "análise".
ALTER TABLE public.client_journey_stages
  ADD COLUMN milestone_type text CHECK (milestone_type IN ('gravacao', 'analise'));

UPDATE public.client_journey_stages SET milestone_type = 'gravacao' WHERE name = 'Gravação de conteúdo';
UPDATE public.client_journey_stages SET milestone_type = 'analise' WHERE name = 'Análise do mês anterior';

-- Cadência de gravação em dias, por cliente (varia entre clientes — alguns
-- gravam a cada 30 dias, outros a cada 60).
ALTER TABLE public.clients ADD COLUMN gravacao_cadence_days integer;

CREATE TABLE public.client_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.client_journey_stages(id) ON DELETE CASCADE,
  entered_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.client_stage_history TO authenticated;
GRANT ALL ON public.client_stage_history TO service_role;
ALTER TABLE public.client_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read stage history" ON public.client_stage_history FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_client_stage_history_client_stage ON public.client_stage_history(client_id, stage_id, entered_at DESC);

-- Registra toda troca de etapa automaticamente, independente de mensagem
-- ter sido enviada ao cliente (diferente de client_stage_updates).
CREATE OR REPLACE FUNCTION public.log_client_stage_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.current_stage_id IS NOT NULL AND NEW.current_stage_id IS DISTINCT FROM OLD.current_stage_id THEN
    INSERT INTO public.client_stage_history (org_id, client_id, stage_id, entered_at)
    VALUES (NEW.org_id, NEW.id, NEW.current_stage_id, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_client_stage_history
  AFTER UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.log_client_stage_history();

-- Baseline pra quem já está com uma etapa definida hoje — sem isso, o
-- histórico ficaria vazio até a próxima troca de etapa de cada cliente.
-- Limitação sabida: reflete a etapa ATUAL na data da migração, não quando o
-- cliente entrou nela de verdade.
INSERT INTO public.client_stage_history (org_id, client_id, stage_id, entered_at)
SELECT org_id, id, current_stage_id, now()
FROM public.clients
WHERE current_stage_id IS NOT NULL AND archived = false;

-- Reversível:
-- DROP TRIGGER trg_log_client_stage_history ON public.clients;
-- DROP FUNCTION public.log_client_stage_history();
-- DROP TABLE public.client_stage_history;
-- ALTER TABLE public.clients DROP COLUMN gravacao_cadence_days;
-- ALTER TABLE public.client_journey_stages DROP COLUMN milestone_type;
