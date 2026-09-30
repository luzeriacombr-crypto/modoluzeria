-- House: demandas avulsas e registro manual do que foi postado.
--
-- Demandas avulsas (banner, jingle, folder, convite…) são itens do fluxo de
-- produção da marca (content_items tipo "outros") marcados com o tipo da
-- demanda — assim ganham briefing, anexos, comentários, status e prazo do
-- painel de item que já existe, e aparecem no Meu dia.
--
-- house_activity_logs: a pessoa registra em um toque o que postou direto no
-- Instagram (story, post, reels). É o que dá o crédito no ranking da equipe
-- e conta nas metas quando o Instagram da marca não está conectado.

ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS demand_kind text;
DO $$ BEGIN
  ALTER TABLE public.content_items ADD CONSTRAINT content_items_demand_kind_check
    CHECK (demand_kind IS NULL OR demand_kind IN ('banner', 'jingle', 'folder', 'convite', 'cartao', 'video', 'arte', 'outro'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_content_items_demands ON public.content_items(org_id, due_date) WHERE demand_kind IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.house_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('story', 'post', 'reel')),
  qty int NOT NULL DEFAULT 1 CHECK (qty BETWEEN 1 AND 50),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_house_activity_logs_org_day ON public.house_activity_logs(org_id, day);

GRANT SELECT, INSERT, DELETE ON public.house_activity_logs TO authenticated;
GRANT ALL ON public.house_activity_logs TO service_role;
ALTER TABLE public.house_activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity logs org read" ON public.house_activity_logs;
CREATE POLICY "activity logs org read" ON public.house_activity_logs FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()));
DROP POLICY IF EXISTS "activity logs own insert" ON public.house_activity_logs;
CREATE POLICY "activity logs own insert" ON public.house_activity_logs FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND user_id = auth.uid() AND public.is_active_profile(auth.uid()));
DROP POLICY IF EXISTS "activity logs own delete" ON public.house_activity_logs;
CREATE POLICY "activity logs own delete" ON public.house_activity_logs FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND (user_id = auth.uid() OR public.is_master(auth.uid())));
