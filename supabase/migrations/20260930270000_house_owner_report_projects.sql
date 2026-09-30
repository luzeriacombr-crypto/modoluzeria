-- House (Fase 4): painel do dono, relatório mensal e projetos de marketing.
--
-- house_daily_stats: o Instagram só devolve os stories das últimas 24h —
-- pra ter "stories publicados no mês" o app grava um retrato por dia
-- (sempre que alguém abre o Meu dia e num cron às 23h50 de Brasília).
-- monthly_reports: o texto do relatório (o que funcionou / aprendemos /
-- muda) + um retrato dos números no momento do envio.
-- marketing_projects/_tasks: projetos com etapas (stage), responsável,
-- prazo e checklist próprio; modelos prontos ficam no código.

CREATE TABLE IF NOT EXISTS public.house_daily_stats (
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  day date NOT NULL,
  stories int NOT NULL DEFAULT 0,
  feed int NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'instagram',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, day)
);
GRANT SELECT ON public.house_daily_stats TO authenticated;
GRANT ALL ON public.house_daily_stats TO service_role;
ALTER TABLE public.house_daily_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily stats org read" ON public.house_daily_stats;
CREATE POLICY "daily stats org read" ON public.house_daily_stats FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()));

-- Metas de leads e a variável (opcional, configurada pelo dono).
ALTER TABLE public.house_settings
  ADD COLUMN IF NOT EXISTS leads_goal_month int NOT NULL DEFAULT 20 CHECK (leads_goal_month BETWEEN 0 AND 10000),
  ADD COLUMN IF NOT EXISTS scheduled_goal_month int NOT NULL DEFAULT 8 CHECK (scheduled_goal_month BETWEEN 0 AND 10000),
  ADD COLUMN IF NOT EXISTS variable_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS variable_max_cents int NOT NULL DEFAULT 0 CHECK (variable_max_cents BETWEEN 0 AND 100000000),
  ADD COLUMN IF NOT EXISTS variable_weights jsonb NOT NULL DEFAULT '{"goals": 30, "leads": 30, "scheduled": 40}'::jsonb;

CREATE TABLE IF NOT EXISTS public.monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  month_key text NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
  what_worked text CHECK (what_worked IS NULL OR length(what_worked) <= 5000),
  learned text CHECK (learned IS NULL OR length(learned) <= 5000),
  next_changes text CHECK (next_changes IS NULL OR length(next_changes) <= 5000),
  numbers jsonb,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'enviado')),
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, month_key)
);
GRANT SELECT, INSERT, UPDATE ON public.monthly_reports TO authenticated;
GRANT ALL ON public.monthly_reports TO service_role;
ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reports org read" ON public.monthly_reports;
CREATE POLICY "reports org read" ON public.monthly_reports FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()));
DROP POLICY IF EXISTS "reports org write" ON public.monthly_reports;
CREATE POLICY "reports org write" ON public.monthly_reports FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()));
DROP POLICY IF EXISTS "reports org update" ON public.monthly_reports;
CREATE POLICY "reports org update" ON public.monthly_reports FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()))
  WITH CHECK (org_id = public.current_org_id());

CREATE TABLE IF NOT EXISTS public.marketing_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  template text NOT NULL DEFAULT 'livre' CHECK (template IN ('evento', 'radio', 'campanha', 'livre')),
  description text CHECK (description IS NULL OR length(description) <= 5000),
  status text NOT NULL DEFAULT 'andamento' CHECK (status IN ('planejado', 'andamento', 'concluido', 'cancelado')),
  -- Data principal (dia do evento, do programa, início da campanha).
  event_date date,
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_projects_org ON public.marketing_projects(org_id, status, event_date);

CREATE TABLE IF NOT EXISTS public.marketing_project_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.marketing_projects(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (length(btrim(stage)) BETWEEN 1 AND 60),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  responsible_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_date date,
  done_at timestamptz,
  done_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_marketing_project_tasks_project ON public.marketing_project_tasks(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_marketing_project_tasks_org_due ON public.marketing_project_tasks(org_id, due_date) WHERE done_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_projects, public.marketing_project_tasks TO authenticated;
GRANT ALL ON public.marketing_projects, public.marketing_project_tasks TO service_role;
ALTER TABLE public.marketing_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_project_tasks ENABLE ROW LEVEL SECURITY;

-- Toda a equipe da org cria e toca projetos; apagar é do dono ou de quem criou.
DROP POLICY IF EXISTS "projects org read" ON public.marketing_projects;
CREATE POLICY "projects org read" ON public.marketing_projects FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()));
DROP POLICY IF EXISTS "projects org insert" ON public.marketing_projects;
CREATE POLICY "projects org insert" ON public.marketing_projects FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()) AND created_by = auth.uid());
DROP POLICY IF EXISTS "projects org update" ON public.marketing_projects;
CREATE POLICY "projects org update" ON public.marketing_projects FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()))
  WITH CHECK (org_id = public.current_org_id());
DROP POLICY IF EXISTS "projects delete owner" ON public.marketing_projects;
CREATE POLICY "projects delete owner" ON public.marketing_projects FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND (public.is_master(auth.uid()) OR created_by = auth.uid()));

DROP POLICY IF EXISTS "project tasks org all" ON public.marketing_project_tasks;
CREATE POLICY "project tasks org all" ON public.marketing_project_tasks FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()))
  WITH CHECK (
    org_id = public.current_org_id() AND public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.marketing_projects p WHERE p.id = project_id AND p.org_id = public.current_org_id())
  );
