-- Raiz do problema reportado pelo Junior (02/10): qualquer cadastro no
-- Supabase Auth (ex: "Entrar com Google") sem e-mail pré-autorizado em
-- email_role_assignments caía dentro da PRÓPRIA agência dele (Luzeria,
-- 00000000-0000-0000-0000-000000000001), como inativo — por isso
-- "Cadastros travados" (Configurações → Equipe) nunca parava de mostrar
-- gente estranha pedindo pra "entrar" na agência dele. O conserto anterior
-- (renomear a seção, tirar o botão "Aprovar" enganoso) só deixou a tela
-- menos confusa; não impedia gente nova de continuar caindo lá.
--
-- Agora handle_new_user() usa uma organização dedicada só pra isso — nunca
-- uma agência de cliente de verdade — então nenhuma agência (nem a
-- Luzeria) volta a ver cadastro estranho de outra pessoa na sua própria
-- equipe.
INSERT INTO public.orgs (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000002', '(Cadastros incompletos — sistema)', 'cadastros-incompletos-sistema')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  assigned_role public.app_role;
  assigned_name text;
  assigned_org uuid;
  pre_authorized boolean;
BEGIN
  SELECT role, name, org_id INTO assigned_role, assigned_name, assigned_org
  FROM public.email_role_assignments WHERE lower(email) = lower(NEW.email);
  pre_authorized := assigned_role IS NOT NULL;
  IF assigned_role IS NULL THEN assigned_role := 'member'; END IF;
  IF assigned_name IS NULL THEN
    assigned_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  END IF;
  IF assigned_org IS NULL THEN assigned_org := '00000000-0000-0000-0000-000000000002'; END IF;
  INSERT INTO public.profiles (id, email, name, org_id, active)
  VALUES (NEW.id, NEW.email, assigned_name, assigned_org, pre_authorized);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$function$;

-- O "Pedro Henrique Ramos" que já tinha caído na Luzeria antes desse
-- conserto some da equipe dela e vai pra organização certa (ele pode
-- confirmar/apagar normalmente, só que agora no lugar certo).
UPDATE public.profiles
SET org_id = '00000000-0000-0000-0000-000000000002'
WHERE org_id = '00000000-0000-0000-0000-000000000001' AND active = false;
