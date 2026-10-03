-- Nativo: pasta por cliente com o acervo de modelos gerado por IA.
--  * nativo_projects ganha client_id: um template com client_id é um modelo do acervo daquele cliente
--    (aparece só pra quem tem acesso ao cliente no Modo Criador, em vez de pra agência inteira).
--  * nativo_client_refs: as publicações de referência que a pessoa envia (posts e carrossel).
--    A pessoa escreve aqui.
--  * nativo_client_acervo: o perfil que a IA entendeu + contador das gerações feitas com a chave da
--    plataforma (teste grátis). Só o servidor escreve; a pessoa só lê. Fica em tabela separada de
--    propósito (REVOKE por coluna não funciona neste projeto) pra ninguém zerar o próprio contador.
-- Pra reverter: DROP TABLE nativo_client_acervo, nativo_client_refs; ALTER TABLE nativo_projects DROP COLUMN client_id
-- (e recriar as 4 políticas "nativo ... " da migração 20260926120000 / 20260926130000).

ALTER TABLE public.nativo_projects
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE public.nativo_projects
  ADD CONSTRAINT nativo_projects_client_only_template CHECK (client_id IS NULL OR kind = 'template');
CREATE INDEX IF NOT EXISTS idx_nativo_projects_client ON public.nativo_projects(client_id, updated_at DESC) WHERE client_id IS NOT NULL;

-- Agência e cliente não mudam depois de criados (o cliente passa a valer igual ao dono e à agência).
CREATE OR REPLACE FUNCTION public.nativo_projects_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  NEW.owner_id := OLD.owner_id;
  NEW.org_id := OLD.org_id;
  NEW.client_id := OLD.client_id;
  RETURN NEW;
END;
$$;

-- Ler: modelo de cliente só com acesso ao cliente.
DROP POLICY IF EXISTS "nativo read own projects and org templates" ON public.nativo_projects;
CREATE POLICY "nativo read own projects and org templates" ON public.nativo_projects FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND org_id = public.current_org_id()
    AND (owner_id = auth.uid() OR kind = 'template')
    AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id))
  );

-- Criar: modelo de cliente só em cliente da própria agência a que a pessoa tem acesso.
DROP POLICY IF EXISTS "nativo insert own" ON public.nativo_projects;
CREATE POLICY "nativo insert own" ON public.nativo_projects FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_profile(auth.uid())
    AND owner_id = auth.uid()
    AND org_id = public.current_org_id()
    AND (kind <> 'official' OR public.nativo_can_publish_official())
    AND (client_id IS NULL OR (
      kind = 'template'
      AND public.has_client_access(auth.uid(), client_id)
      AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.org_id = public.current_org_id())
    ))
  );

-- Editar e apagar: além do que já valia, quem tem acesso ao cliente mexe nos modelos dele (são da equipe).
DROP POLICY IF EXISTS "nativo update own or org admin template" ON public.nativo_projects;
CREATE POLICY "nativo update own or org admin template" ON public.nativo_projects FOR UPDATE TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND org_id = public.current_org_id()
    AND (
      (kind = 'official' AND public.nativo_can_publish_official())
      OR (kind <> 'official' AND (owner_id = auth.uid() OR (kind = 'template' AND public.is_admin(auth.uid()))))
      OR (kind = 'template' AND client_id IS NOT NULL AND public.has_client_access(auth.uid(), client_id))
    )
  )
  WITH CHECK (org_id = public.current_org_id() AND (kind <> 'official' OR public.nativo_can_publish_official()));

DROP POLICY IF EXISTS "nativo delete own or org admin template" ON public.nativo_projects;
CREATE POLICY "nativo delete own or org admin template" ON public.nativo_projects FOR DELETE TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND org_id = public.current_org_id()
    AND (
      (kind = 'official' AND public.nativo_can_publish_official())
      OR (kind <> 'official' AND (owner_id = auth.uid() OR (kind = 'template' AND public.is_admin(auth.uid()))))
      OR (kind = 'template' AND client_id IS NOT NULL AND public.has_client_access(auth.uid(), client_id))
    )
  );

-- Referências enviadas pela pessoa (caminhos no bucket nativo-media + tipo).
CREATE TABLE public.nativo_client_refs (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.orgs(id) ON DELETE CASCADE,
  -- [{ "path": "<org>/<user>/refs/<cliente>/<id>.jpg", "tipo": "post" | "carrossel" }]
  refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(refs) = 'array' AND jsonb_array_length(refs) <= 24),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.nativo_client_refs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nativo_client_refs TO authenticated;
GRANT ALL ON public.nativo_client_refs TO service_role;
ALTER TABLE public.nativo_client_refs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nativo refs read" ON public.nativo_client_refs FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), client_id));
CREATE POLICY "nativo refs insert" ON public.nativo_client_refs FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), client_id)
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.org_id = public.current_org_id())
  );
CREATE POLICY "nativo refs update" ON public.nativo_client_refs FOR UPDATE TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), client_id))
  WITH CHECK (org_id = public.current_org_id());
CREATE POLICY "nativo refs delete" ON public.nativo_client_refs FOR DELETE TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), client_id));

CREATE OR REPLACE FUNCTION public.nativo_client_refs_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  NEW.org_id := OLD.org_id;
  NEW.client_id := OLD.client_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER nativo_client_refs_touch BEFORE UPDATE ON public.nativo_client_refs
  FOR EACH ROW EXECUTE FUNCTION public.nativo_client_refs_touch();

-- Perfil entendido pela IA + contador do teste grátis. Escrita só pelo servidor (service_role).
CREATE TABLE public.nativo_client_acervo (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  perfil jsonb,
  generations integer NOT NULL DEFAULT 0,
  last_generated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.nativo_client_acervo FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.nativo_client_acervo TO authenticated;
GRANT ALL ON public.nativo_client_acervo TO service_role;
ALTER TABLE public.nativo_client_acervo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nativo acervo read" ON public.nativo_client_acervo FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), client_id));
