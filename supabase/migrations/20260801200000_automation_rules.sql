-- Configurable automations: "quando o status virar X, então [alterar status
-- para Y / atribuir para Z]". Generalizes the existing hardcoded
-- auto_assign_on_status() trigger (20260723150000) into a per-org rules
-- table, following the same BEFORE UPDATE trigger pattern.

CREATE TABLE public.automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  trigger_status text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('set_status', 'assign_member')),
  action_status text,
  action_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CHECK (
    (action_type = 'set_status' AND action_status IS NOT NULL AND action_user_id IS NULL)
    OR (action_type = 'assign_member' AND action_user_id IS NOT NULL AND action_status IS NULL)
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automation_rules TO authenticated;
GRANT ALL ON public.automation_rules TO service_role;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_rules_org_read" ON public.automation_rules FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "automation_rules_master_write" ON public.automation_rules FOR ALL TO authenticated
  USING (public.is_master(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_master(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_automation_rules_org_trigger ON public.automation_rules(org_id, trigger_status) WHERE active;

-- Runs after the existing hardcoded auto_assign_on_status trigger (registered
-- later in trigger-name alpha order: trg_run_automation_rules > trg_auto_assign_on_status
-- is irrelevant here since both are BEFORE UPDATE and don't depend on each
-- other's output — order between them doesn't matter).
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
       WHERE org_id = NEW.org_id AND active AND trigger_status = NEW.status
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

DROP TRIGGER IF EXISTS trg_run_automation_rules ON public.content_items;
CREATE TRIGGER trg_run_automation_rules
  BEFORE UPDATE ON public.content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.run_automation_rules();
