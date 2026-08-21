-- Cargos: papéis de trabalho customizáveis por agência (Editor, Videomaker,
-- Financeiro, Atendimento/Vendas, Social Media, Redator(a), Adm Master...),
-- atômicos e combináveis — uma pessoa pode ter vários ao mesmo tempo (ex:
-- Editor + Videomaker), por isso é muitos-pra-muitos em vez de uma coluna
-- única em profiles. Generaliza o mesmo padrão já usado em
-- orgs.setor_permissions/has_setor_permission, só que por cargo em vez de
-- só pro papel fixo "setor". master/setor/membro (user_roles/app_role)
-- continuam sendo a camada de segurança real no RLS — cargo é uma camada
-- de permissão de app por cima, não substitui nem afrouxa isso.
CREATE TABLE public.cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cargos TO authenticated;
GRANT ALL ON public.cargos TO service_role;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read cargos" ON public.cargos FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "admin manage cargos" ON public.cargos FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_cargos_org ON public.cargos(org_id);

CREATE TABLE public.profile_cargos (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cargo_id uuid NOT NULL REFERENCES public.cargos(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, cargo_id)
);

GRANT SELECT ON public.profile_cargos TO authenticated;
GRANT ALL ON public.profile_cargos TO service_role;
ALTER TABLE public.profile_cargos ENABLE ROW LEVEL SECURITY;

-- Igual a cargos: qualquer perfil ativo da própria org lê (precisa saber os
-- cargos dos colegas pra várias telas), só admin atribui/remove.
CREATE POLICY "active read profile cargos" ON public.profile_cargos FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.org_id = public.current_org_id())
  );

CREATE POLICY "admin manage profile cargos" ON public.profile_cargos FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.org_id = public.current_org_id())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.org_id = public.current_org_id())
  );

CREATE INDEX idx_profile_cargos_profile ON public.profile_cargos(profile_id);
CREATE INDEX idx_profile_cargos_cargo ON public.profile_cargos(cargo_id);

-- Generalização de has_setor_permission: true se QUALQUER cargo atribuído
-- à pessoa inclui essa permissão (união, não precisa ser um cargo só).
CREATE OR REPLACE FUNCTION public.has_cargo_permission(_user_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profile_cargos pc
    JOIN public.cargos c ON c.id = pc.cargo_id
    WHERE pc.profile_id = _user_id
      AND _perm = ANY(c.permissions)
  );
$$;

REVOKE ALL ON FUNCTION public.has_cargo_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_cargo_permission(uuid, text) TO authenticated;
