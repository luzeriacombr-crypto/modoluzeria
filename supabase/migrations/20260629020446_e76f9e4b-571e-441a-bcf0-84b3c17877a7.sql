
-- ============================================================
-- Bloco A — Roadmap fases 2/3/4
-- ============================================================

-- 1. Expand content_items
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rework_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quality_rating smallint,
  ADD COLUMN IF NOT EXISTS last_status_change_at timestamptz;

ALTER TABLE public.content_items
  DROP CONSTRAINT IF EXISTS content_items_quality_rating_check;
ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_quality_rating_check
  CHECK (quality_rating IS NULL OR (quality_rating BETWEEN 1 AND 5));

-- ============================================================
-- 2. status_transitions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  duration_ms bigint,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS status_transitions_item_idx ON public.status_transitions(item_id);
CREATE INDEX IF NOT EXISTS status_transitions_at_idx ON public.status_transitions(at);

GRANT SELECT ON public.status_transitions TO authenticated;
GRANT ALL ON public.status_transitions TO service_role;

ALTER TABLE public.status_transitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read transitions" ON public.status_transitions;
CREATE POLICY "auth read transitions"
  ON public.status_transitions
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 3. activity_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_entity_idx ON public.activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS activity_log_at_idx ON public.activity_log(at DESC);

GRANT SELECT, INSERT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin read activity" ON public.activity_log;
CREATE POLICY "admin read activity"
  ON public.activity_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()) OR actor_id = auth.uid());

DROP POLICY IF EXISTS "auth insert activity" ON public.activity_log;
CREATE POLICY "auth insert activity"
  ON public.activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- ============================================================
-- 4. mentions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.content_items(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS mentions_user_idx ON public.mentions(mentioned_user_id);

GRANT SELECT, UPDATE ON public.mentions TO authenticated;
GRANT ALL ON public.mentions TO service_role;

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentions self read" ON public.mentions;
CREATE POLICY "mentions self read"
  ON public.mentions
  FOR SELECT
  TO authenticated
  USING (mentioned_user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "mentions self update" ON public.mentions;
CREATE POLICY "mentions self update"
  ON public.mentions
  FOR UPDATE
  TO authenticated
  USING (mentioned_user_id = auth.uid())
  WITH CHECK (mentioned_user_id = auth.uid());

-- ============================================================
-- 5. member_goals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.member_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_key text NOT NULL,
  posts_goal integer NOT NULL DEFAULT 0,
  reels_goal integer NOT NULL DEFAULT 0,
  stories_goal integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_goals TO authenticated;
GRANT ALL ON public.member_goals TO service_role;

ALTER TABLE public.member_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "goals read auth" ON public.member_goals;
CREATE POLICY "goals read auth"
  ON public.member_goals
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "goals master write" ON public.member_goals;
CREATE POLICY "goals master write"
  ON public.member_goals
  FOR ALL
  TO authenticated
  USING (public.is_master(auth.uid()))
  WITH CHECK (public.is_master(auth.uid()));

-- ============================================================
-- 6. recurring_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recurring_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  cadence text NOT NULL,
  day_of_week smallint,
  day_of_month smallint,
  default_assignees uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  active boolean NOT NULL DEFAULT true,
  last_generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recurring_templates_client_idx ON public.recurring_templates(client_id);

GRANT SELECT ON public.recurring_templates TO authenticated;
GRANT ALL ON public.recurring_templates TO service_role;

ALTER TABLE public.recurring_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recurring read auth" ON public.recurring_templates;
CREATE POLICY "recurring read auth"
  ON public.recurring_templates
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "recurring admin write" ON public.recurring_templates;
CREATE POLICY "recurring admin write"
  ON public.recurring_templates
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- 7. client_onboarding
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  checklist jsonb NOT NULL DEFAULT '[
    {"id":"briefing","text":"Briefing inicial","done":false},
    {"id":"acessos","text":"Acessos das redes coletados","done":false},
    {"id":"paleta","text":"Paleta de marca definida","done":false},
    {"id":"tom","text":"Tom de voz documentado","done":false},
    {"id":"reuniao","text":"Primeira reunião de alinhamento","done":false}
  ]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_onboarding TO authenticated;
GRANT ALL ON public.client_onboarding TO service_role;

ALTER TABLE public.client_onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboarding read auth" ON public.client_onboarding;
CREATE POLICY "onboarding read auth"
  ON public.client_onboarding
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "onboarding admin write" ON public.client_onboarding;
CREATE POLICY "onboarding admin write"
  ON public.client_onboarding
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- 8. Triggers — status transitions + rework
-- ============================================================
CREATE OR REPLACE FUNCTION public.track_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dur_ms bigint := NULL;
  is_rework boolean := false;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.last_status_change_at IS NOT NULL THEN
      dur_ms := (EXTRACT(EPOCH FROM (now() - OLD.last_status_change_at)) * 1000)::bigint;
    END IF;

    INSERT INTO public.status_transitions (item_id, from_status, to_status, actor_id, duration_ms)
    VALUES (NEW.id, OLD.status::text, NEW.status::text, auth.uid(), dur_ms);

    IF (OLD.status = 'FINALIZADO' AND NEW.status <> 'FINALIZADO')
       OR (OLD.status::text LIKE 'REVISAO%' AND NEW.status::text IN ('PLANEJAMENTO','COPY','CRIACAO','EM_GRAVACAO','EM_EDICAO')) THEN
      is_rework := true;
    END IF;

    IF is_rework THEN
      NEW.rework_count := COALESCE(OLD.rework_count, 0) + 1;
    END IF;

    NEW.last_status_change_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_status_transition ON public.content_items;
CREATE TRIGGER trg_track_status_transition
  BEFORE UPDATE OF status ON public.content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.track_status_transition();

-- ============================================================
-- 9. Trigger — activity log helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_item_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log (actor_id, entity_type, entity_id, action, meta)
    VALUES (auth.uid(), 'content_item', NEW.id, 'created',
            jsonb_build_object('title', NEW.title, 'type', NEW.type));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
      INSERT INTO public.activity_log (actor_id, entity_type, entity_id, action, meta)
      VALUES (auth.uid(), 'content_item', NEW.id, 'due_date_changed',
              jsonb_build_object('from', OLD.due_date, 'to', NEW.due_date));
    END IF;
    IF NEW.quality_rating IS DISTINCT FROM OLD.quality_rating AND NEW.quality_rating IS NOT NULL THEN
      INSERT INTO public.activity_log (actor_id, entity_type, entity_id, action, meta)
      VALUES (auth.uid(), 'content_item', NEW.id, 'rated',
              jsonb_build_object('rating', NEW.quality_rating));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_item_activity ON public.content_items;
CREATE TRIGGER trg_log_item_activity
  AFTER INSERT OR UPDATE ON public.content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_item_activity();

-- ============================================================
-- 10. Backfill last_status_change_at — content_items só tem updated_at
-- ============================================================
UPDATE public.content_items
SET last_status_change_at = updated_at
WHERE last_status_change_at IS NULL;

-- ============================================================
-- 11. updated-at trigger helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_member_goals ON public.member_goals;
CREATE TRIGGER trg_touch_member_goals
  BEFORE UPDATE ON public.member_goals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_touch_client_onboarding ON public.client_onboarding;
CREATE TRIGGER trg_touch_client_onboarding
  BEFORE UPDATE ON public.client_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
