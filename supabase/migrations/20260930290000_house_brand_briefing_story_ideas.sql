-- House: briefing da marca (estruturado) e ideias de stories geradas por IA.
--
-- clients.brand_briefing guarda as respostas do bloco "Briefing da marca"
-- da ficha (serviços, público, diferenciais, tom de voz, o que evitar…).
-- Ao salvar, o app também monta o texto em clients.content_briefing — que
-- a prévia de planejamento por IA já lê — então as duas IAs usam o mesmo
-- briefing sem duplicar nada.
--
-- house_story_ideas: cada ideia gerada fica salva pra equipe usar no dia;
-- "Usei essa" marca used_at (e conta +1 story pra quem usou).

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS brand_briefing jsonb;

CREATE TABLE IF NOT EXISTS public.house_story_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL,
  idea jsonb NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  used_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  dismissed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_house_story_ideas_org ON public.house_story_ideas(org_id, created_at DESC);

GRANT SELECT, UPDATE ON public.house_story_ideas TO authenticated;
GRANT ALL ON public.house_story_ideas TO service_role;
ALTER TABLE public.house_story_ideas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "story ideas org read" ON public.house_story_ideas;
CREATE POLICY "story ideas org read" ON public.house_story_ideas FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()));
DROP POLICY IF EXISTS "story ideas org update" ON public.house_story_ideas;
CREATE POLICY "story ideas org update" ON public.house_story_ideas FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()))
  WITH CHECK (org_id = public.current_org_id());
