
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  assigned_role public.app_role;
  assigned_name text;
  pre_authorized boolean;
BEGIN
  SELECT role, name INTO assigned_role, assigned_name
  FROM public.email_role_assignments WHERE lower(email) = lower(NEW.email);

  pre_authorized := assigned_role IS NOT NULL;

  IF assigned_role IS NULL THEN
    assigned_role := 'member';
  END IF;
  IF assigned_name IS NULL THEN
    assigned_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  END IF;

  INSERT INTO public.profiles (id, email, name, active)
  VALUES (NEW.id, NEW.email, assigned_name, pre_authorized);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$function$;
