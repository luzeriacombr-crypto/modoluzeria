-- Modelos de cliente por categoria — o que o sistema cria sozinho quando a
-- agência abre um cliente novo daquela categoria.
--
-- Hoje isso é fixo no código (seedMonth sempre cria 6 posts + 6 reels, e
-- "Avulsos" nasce só com o mês vazio), o que não serve pra agência que
-- fecha pacote de 3+3 ou de 12 posts — ela abre o cliente e arruma na mão
-- toda vez. Aqui cada agência define o próprio modelo por categoria.
--
-- Nasce vazia pra toda org (nenhum seed), igual client_categories: sem
-- linha aqui, o comportamento continua exatamente o de hoje.
--
-- Pra reverter: DROP TABLE public.client_templates; e restaurar o CHECK
-- antigo de client_docs.type (só 'roteiro' e 'planejamento').

CREATE TABLE public.client_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  category text NOT NULL,
  posts_count integer NOT NULL DEFAULT 6 CHECK (posts_count BETWEEN 0 AND 60),
  reels_count integer NOT NULL DEFAULT 6 CHECK (reels_count BETWEEN 0 AND 60),
  create_demands_page boolean NOT NULL DEFAULT false,
  welcome_message text,
  default_assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, category)
);

GRANT SELECT ON public.client_templates TO authenticated;
GRANT ALL ON public.client_templates TO service_role;
ALTER TABLE public.client_templates ENABLE ROW LEVEL SECURITY;

-- Leitura pra qualquer perfil ativo da org (a tela de criar cliente precisa
-- saber o que vai ser criado), escrita só pra admin — mesmo par de policies
-- de client_categories.
CREATE POLICY "active read client templates" ON public.client_templates FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "admin manage client templates" ON public.client_templates FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_client_templates_org ON public.client_templates(org_id, category);

-- ===================== Página de demandas =====================
-- client_docs hoje só aceita 'roteiro' e 'planejamento'. A página única
-- onde o cliente avulso pede tudo é um terceiro tipo — reaproveita o
-- compartilhamento por token que client_docs_share_tokens já faz, em vez
-- de inventar outra superfície pública.
ALTER TABLE public.client_docs DROP CONSTRAINT IF EXISTS client_docs_type_check;
ALTER TABLE public.client_docs ADD CONSTRAINT client_docs_type_check
  CHECK (type IN ('roteiro', 'planejamento', 'demandas'));
