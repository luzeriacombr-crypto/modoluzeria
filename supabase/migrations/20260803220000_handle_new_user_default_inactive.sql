-- Security fix: any auth.users insert with no matching email_role_assignments
-- row (e.g. someone signing in with Google without being invited, or via
-- any future auth method) previously landed as an ACTIVE member of the
-- Luzeria fallback org — meaning an uninvited Google sign-in could get real
-- access to Luzeria's own internal client data. Restores the pre-multi-tenant
-- behavior: unmatched signups land inactive (blocked by requireActiveProfile)
-- until something explicitly activates them (an admin, or completeGoogleSignup
-- provisioning a fresh org for a self-service trial).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  IF assigned_org IS NULL THEN assigned_org := '00000000-0000-0000-0000-000000000001'; END IF;
  INSERT INTO public.profiles (id, email, name, org_id, active)
  VALUES (NEW.id, NEW.email, assigned_name, assigned_org, pre_authorized);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;
