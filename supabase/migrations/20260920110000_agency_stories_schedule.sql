-- Escala de Stories da própria agência — quem fica responsável pelos
-- Stories do perfil da agência em cada dia.
--
-- Fica junto da Rotina (escala de tarefas recorrentes da equipe), mas é
-- por DIA do calendário, não por dia da semana: a pessoa muda a cada dia,
-- e no dia dela o lembrete aparece nas demandas.
--
-- Pra reverter: DROP TABLE public.agency_stories_schedule;
--               DROP FUNCTION public.mark_agency_stories_done(uuid, boolean);

CREATE TABLE public.agency_stories_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  date date NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  done_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, date, user_id)
);

GRANT SELECT ON public.agency_stories_schedule TO authenticated;
GRANT ALL ON public.agency_stories_schedule TO service_role;
ALTER TABLE public.agency_stories_schedule ENABLE ROW LEVEL SECURITY;

-- Todo mundo da agência enxerga a escala (é uma escala de equipe), mas só
-- admin escala alguém.
CREATE POLICY "active read stories schedule" ON public.agency_stories_schedule FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "admin manage stories schedule" ON public.agency_stories_schedule FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_agency_stories_schedule_org_date ON public.agency_stories_schedule(org_id, date);
CREATE INDEX idx_agency_stories_schedule_user_date ON public.agency_stories_schedule(user_id, date);

-- Marcar como feito é a ÚNICA coisa que o escalado pode mudar na própria
-- linha. Por isso não existe policy de UPDATE pra ele: fosse por UPDATE
-- direto, daria pra mexer em date/user_id junto (limitar coluna por
-- REVOKE não é confiável aqui). A função abaixo só toca em done_at, e só
-- na linha de quem chamou.
CREATE OR REPLACE FUNCTION public.mark_agency_stories_done(_id uuid, _done boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agency_stories_schedule
     SET done_at = CASE WHEN _done THEN now() ELSE NULL END
   WHERE id = _id
     AND (
       user_id = auth.uid()
       OR (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
     );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_agency_stories_done(uuid, boolean) TO authenticated;
