-- House com várias marcas do mesmo grupo (ex.: Levive + Doctor Fit).
-- Tudo aditivo: o código que já está no ar continua funcionando (marca
-- ausente = marca principal da House).
--
--  * house_activity_logs ("Postei agora"), marketing_projects e
--    instagram_leads passam a ter a marca (client_id).
--  * house_brand_settings: metas de stories/posts/leads por marca.
--  * house_brand_daily_stats: retrato diário do Instagram por marca (a
--    tabela antiga house_daily_stats era uma por org; fica de lado).
--  * RLS: quem tem acesso restrito a certas marcas (client_access) só vê
--    leads, registros e projetos dessas marcas.

-- ===== Registros "Postei agora" por marca =====
ALTER TABLE public.house_activity_logs ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
UPDATE public.house_activity_logs l SET client_id = o.house_client_id
  FROM public.orgs o WHERE o.id = l.org_id AND l.client_id IS NULL AND o.house_client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_house_activity_logs_client_day ON public.house_activity_logs(client_id, day);

DROP POLICY IF EXISTS "activity logs org read" ON public.house_activity_logs;
CREATE POLICY "activity logs org read" ON public.house_activity_logs FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid())
         AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id)));
DROP POLICY IF EXISTS "activity logs own insert" ON public.house_activity_logs;
CREATE POLICY "activity logs own insert" ON public.house_activity_logs FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND user_id = auth.uid() AND public.is_active_profile(auth.uid())
              AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id)));

-- ===== Retrato diário do Instagram por marca =====
CREATE TABLE IF NOT EXISTS public.house_brand_daily_stats (
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  day date NOT NULL,
  stories int NOT NULL DEFAULT 0,
  feed int NOT NULL DEFAULT 0,
  source text NOT NULL DEFAULT 'instagram',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, day)
);
CREATE INDEX IF NOT EXISTS idx_house_brand_daily_stats_org ON public.house_brand_daily_stats(org_id, day);
INSERT INTO public.house_brand_daily_stats (org_id, client_id, day, stories, feed, source, updated_at)
SELECT s.org_id, o.house_client_id, s.day, s.stories, s.feed, s.source, s.updated_at
  FROM public.house_daily_stats s JOIN public.orgs o ON o.id = s.org_id
 WHERE o.house_client_id IS NOT NULL
ON CONFLICT (client_id, day) DO NOTHING;
GRANT SELECT ON public.house_brand_daily_stats TO authenticated;
GRANT ALL ON public.house_brand_daily_stats TO service_role;
ALTER TABLE public.house_brand_daily_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brand daily stats read" ON public.house_brand_daily_stats;
CREATE POLICY "brand daily stats read" ON public.house_brand_daily_stats FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()) AND public.has_client_access(auth.uid(), client_id));

-- ===== Metas por marca =====
-- A marca principal continua lendo house_settings; as demais usam esta
-- tabela (sem linha = padrão). Uma linha aqui também vale pra principal.
CREATE TABLE IF NOT EXISTS public.house_brand_settings (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  stories_per_workday int NOT NULL DEFAULT 3 CHECK (stories_per_workday BETWEEN 0 AND 50),
  feed_posts_per_week int NOT NULL DEFAULT 3 CHECK (feed_posts_per_week BETWEEN 0 AND 50),
  leads_goal_month int NOT NULL DEFAULT 20 CHECK (leads_goal_month BETWEEN 0 AND 10000),
  scheduled_goal_month int NOT NULL DEFAULT 8 CHECK (scheduled_goal_month BETWEEN 0 AND 10000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.house_brand_settings TO authenticated;
GRANT ALL ON public.house_brand_settings TO service_role;
ALTER TABLE public.house_brand_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "brand settings read" ON public.house_brand_settings;
CREATE POLICY "brand settings read" ON public.house_brand_settings FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()) AND public.has_client_access(auth.uid(), client_id));
DROP POLICY IF EXISTS "brand settings master write" ON public.house_brand_settings;
CREATE POLICY "brand settings master write" ON public.house_brand_settings FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_master(auth.uid()))
  WITH CHECK (org_id = public.current_org_id() AND public.is_master(auth.uid())
              AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.org_id = public.current_org_id()));

-- ===== Leads e projetos por marca =====
CREATE INDEX IF NOT EXISTS idx_instagram_leads_client ON public.instagram_leads(client_id, created_at DESC);
DROP POLICY IF EXISTS "leads org read" ON public.instagram_leads;
CREATE POLICY "leads org read" ON public.instagram_leads FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid())
         AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id)));
DROP POLICY IF EXISTS "leads org insert" ON public.instagram_leads;
CREATE POLICY "leads org insert" ON public.instagram_leads FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()) AND created_by = auth.uid()
              AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id)));
DROP POLICY IF EXISTS "leads org update" ON public.instagram_leads;
CREATE POLICY "leads org update" ON public.instagram_leads FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid())
         AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id)))
  WITH CHECK (org_id = public.current_org_id());

ALTER TABLE public.marketing_projects ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
UPDATE public.marketing_projects p SET client_id = o.house_client_id
  FROM public.orgs o WHERE o.id = p.org_id AND p.client_id IS NULL AND o.house_client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_projects_client ON public.marketing_projects(client_id);
DROP POLICY IF EXISTS "projects org read" ON public.marketing_projects;
CREATE POLICY "projects org read" ON public.marketing_projects FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid())
         AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id)));
