-- run_automation_rules() compared trigger_status (text) directly against
-- NEW.status (content_status enum) with no cast — Postgres has no
-- `text = content_status` operator, so this raised "operator does not
-- exist: text = content_status" on EVERY status change on EVERY content
-- item, rolling back the update. Fix: cast NEW.status to text for the
-- comparison (the enum->text assignment on the action_status side already
-- worked fine, since PL/pgSQL assignment casts are more permissive).

CREATE OR REPLACE FUNCTION public.run_automation_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rule record;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    FOR rule IN
      SELECT * FROM public.automation_rules
       WHERE org_id = NEW.org_id AND active AND trigger_status = NEW.status::text
    LOOP
      IF rule.action_type = 'set_status' THEN
        NEW.status := rule.action_status;
      ELSIF rule.action_type = 'assign_member' THEN
        INSERT INTO public.item_assignees (item_id, user_id) VALUES (NEW.id, rule.action_user_id)
          ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
