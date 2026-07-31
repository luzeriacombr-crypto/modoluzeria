-- Multi-tenant Fase 1, passo 1: introduz o conceito de "organização" (agência)
-- sem mudar nenhum comportamento existente. Só adiciona estrutura + backfill +
-- gatilhos de propagação. Nenhuma política de segurança (RLS) é alterada
-- aqui — isso vem numa migration separada, depois que o backfill for
-- confirmado. Seguro de rodar a qualquer momento, mesmo antes do deploy do
-- código que passa a usar isso.

CREATE TABLE public.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.orgs TO authenticated;
GRANT ALL ON public.orgs TO service_role;
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read orgs" ON public.orgs FOR SELECT TO authenticated USING (true);
CREATE POLICY "master manage orgs" ON public.orgs FOR ALL TO authenticated
  USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

-- ID fixo pra "Luzeria Estúdio" (a agência original) — facilita referenciar
-- esse valor em migrations futuras sem precisar consultar antes.
INSERT INTO public.orgs (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'Luzeria Estúdio', 'luzeria');

-- Colunas novas (nullable por enquanto — viram NOT NULL numa migration
-- separada, depois que o backfill abaixo rodar e o código que já popula
-- org_id em novos registros estiver no ar).
ALTER TABLE public.profiles ADD COLUMN org_id uuid REFERENCES public.orgs(id);
ALTER TABLE public.clients ADD COLUMN org_id uuid REFERENCES public.orgs(id);
ALTER TABLE public.months ADD COLUMN org_id uuid REFERENCES public.orgs(id);
ALTER TABLE public.content_items ADD COLUMN org_id uuid REFERENCES public.orgs(id);

-- Backfill: tudo que já existe pertence à Luzeria.
UPDATE public.profiles SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.clients SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.months SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
UPDATE public.content_items SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

CREATE INDEX idx_profiles_org ON public.profiles(org_id);
CREATE INDEX idx_clients_org ON public.clients(org_id);
CREATE INDEX idx_months_org ON public.months(org_id);
CREATE INDEX idx_content_items_org ON public.content_items(org_id);

-- Gatilhos: todo mês novo herda org_id do cliente; todo item novo herda
-- org_id do mês. Assim `months`/`content_items` nunca dependem do código do
-- app lembrar de setar org_id — funciona pra qualquer INSERT, inclusive os
-- que já existem hoje (seedMonth em api.functions.ts).
CREATE OR REPLACE FUNCTION public.set_month_org_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO NEW.org_id FROM public.clients WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_month_org_id BEFORE INSERT ON public.months
  FOR EACH ROW EXECUTE FUNCTION public.set_month_org_id();

CREATE OR REPLACE FUNCTION public.set_content_item_org_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    SELECT org_id INTO NEW.org_id FROM public.months WHERE id = NEW.month_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_content_item_org_id BEFORE INSERT ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.set_content_item_org_id();

-- `months`/`content_items` já ficam garantidos pelo gatilho acima
-- independente do código do app, então já podem virar NOT NULL agora.
ALTER TABLE public.months ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.content_items ALTER COLUMN org_id SET NOT NULL;

-- `profiles`/`clients` ficam nullable por enquanto: `clients` é criado
-- direto pelo código do app (sem gatilho de herança possível, é o topo da
-- hierarquia), e `profiles` é criado pelo gatilho `handle_new_user`. Os dois
-- só viram NOT NULL depois que esse código for atualizado pra sempre setar
-- org_id (próxima migration + deploy).

-- Helper de escopo, mesmo padrão de is_admin/is_active_profile.
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE ALL ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;

-- `email_role_assignments` ganha org_id (nullable = "atribuir à Luzeria por
-- padrão", já que hoje as 5 linhas existentes são todas da equipe Luzeria).
-- `handle_new_user` passa a gravar org_id no profile: usa o da linha de
-- email_role_assignments se houver, senão cai na Luzeria (mantém o
-- comportamento de hoje pra qualquer conta criada antes da tela de
-- seleção de agência existir).
ALTER TABLE public.email_role_assignments ADD COLUMN org_id uuid REFERENCES public.orgs(id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  assigned_role public.app_role;
  assigned_name text;
  assigned_org uuid;
BEGIN
  SELECT role, name, org_id INTO assigned_role, assigned_name, assigned_org
  FROM public.email_role_assignments WHERE lower(email) = lower(NEW.email);
  IF assigned_role IS NULL THEN assigned_role := 'member'; END IF;
  IF assigned_name IS NULL THEN
    assigned_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  END IF;
  IF assigned_org IS NULL THEN assigned_org := '00000000-0000-0000-0000-000000000001'; END IF;
  INSERT INTO public.profiles (id, email, name, org_id) VALUES (NEW.id, NEW.email, assigned_name, assigned_org);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;
