-- Nativo: "Modelos do Nativo" — templates oficiais que TODAS as agências veem
-- na tela inicial (kind = 'official'). Só leitura pra todo mundo; quem
-- publica, edita e apaga é apenas a conta do Junior (dono da plataforma).
-- Usar um modelo cria uma cópia (kind = 'project') na conta de quem usou,
-- então ninguém altera o original.
--
-- Mexe só em public.nativo_projects (criada em 20260925160000): amplia o
-- CHECK de kind, cria a função que diz quem publica e recria as policies de
-- insert/update/delete pra bloquear 'official' pra todo o resto.

ALTER TABLE public.nativo_projects DROP CONSTRAINT IF EXISTS nativo_projects_kind_check;
ALTER TABLE public.nativo_projects ADD CONSTRAINT nativo_projects_kind_check
  CHECK (kind IN ('project', 'template', 'official'));

-- Quem pode publicar modelos oficiais. Lista fechada por id de usuário; pra
-- liberar outra pessoa, recriar a função incluindo o id dela.
CREATE OR REPLACE FUNCTION public.nativo_can_publish_official()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IN ('93f0cbec-e009-48fb-ac88-6bf1fd8120de'::uuid)
$$;
REVOKE ALL ON FUNCTION public.nativo_can_publish_official() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nativo_can_publish_official() TO authenticated;

CREATE POLICY "nativo read official" ON public.nativo_projects FOR SELECT TO authenticated
  USING (kind = 'official' AND public.is_active_profile(auth.uid()));

DROP POLICY IF EXISTS "nativo insert own" ON public.nativo_projects;
CREATE POLICY "nativo insert own" ON public.nativo_projects FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_profile(auth.uid())
    AND owner_id = auth.uid()
    AND org_id = public.current_org_id()
    AND (kind <> 'official' OR public.nativo_can_publish_official())
  );

DROP POLICY IF EXISTS "nativo update own or org admin template" ON public.nativo_projects;
CREATE POLICY "nativo update own or org admin template" ON public.nativo_projects FOR UPDATE TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND org_id = public.current_org_id()
    AND (
      (kind = 'official' AND public.nativo_can_publish_official())
      OR (kind <> 'official' AND (owner_id = auth.uid() OR (kind = 'template' AND public.is_admin(auth.uid()))))
    )
  )
  WITH CHECK (
    org_id = public.current_org_id()
    AND (kind <> 'official' OR public.nativo_can_publish_official())
  );

DROP POLICY IF EXISTS "nativo delete own or org admin template" ON public.nativo_projects;
CREATE POLICY "nativo delete own or org admin template" ON public.nativo_projects FOR DELETE TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND org_id = public.current_org_id()
    AND (
      (kind = 'official' AND public.nativo_can_publish_official())
      OR (kind <> 'official' AND (owner_id = auth.uid() OR (kind = 'template' AND public.is_admin(auth.uid()))))
    )
  );

CREATE INDEX idx_nativo_projects_official ON public.nativo_projects(updated_at DESC) WHERE kind = 'official';

-- Pra reverter (DOWN), rodar:
--   DELETE FROM public.nativo_projects WHERE kind = 'official';
--   DROP INDEX IF EXISTS public.idx_nativo_projects_official;
--   DROP POLICY IF EXISTS "nativo read official" ON public.nativo_projects;
--   (recriar as policies "nativo insert own", "nativo update own or org admin
--   template" e "nativo delete own or org admin template" exatamente como em
--   20260925160000_nativo_projects.sql)
--   DROP FUNCTION IF EXISTS public.nativo_can_publish_official();
--   ALTER TABLE public.nativo_projects DROP CONSTRAINT IF EXISTS nativo_projects_kind_check;
--   ALTER TABLE public.nativo_projects ADD CONSTRAINT nativo_projects_kind_check CHECK (kind IN ('project', 'template'));
