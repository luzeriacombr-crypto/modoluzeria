-- Adds a second trigger mode to automation_rules: "quando o item for criado"
-- (on_create), alongside the existing "quando o status virar X"
-- (trigger_status). Lets an agency auto-assign a fixed responsible person
-- to every new item, not just on a status transition.
ALTER TABLE public.automation_rules ALTER COLUMN trigger_status DROP NOT NULL;
ALTER TABLE public.automation_rules ADD COLUMN on_create boolean NOT NULL DEFAULT false;

ALTER TABLE public.automation_rules DROP CONSTRAINT IF EXISTS automation_rules_check;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_check CHECK (
  ((on_create AND trigger_status IS NULL) OR (NOT on_create AND trigger_status IS NOT NULL))
  AND (
    (action_type = 'set_status' AND action_status IS NOT NULL AND action_user_id IS NULL)
    OR (action_type = 'assign_member' AND action_user_id IS NOT NULL AND action_status IS NULL)
  )
);

CREATE INDEX idx_automation_rules_org_oncreate ON public.automation_rules(org_id) WHERE active AND on_create;

-- Looks org_id up independently (rather than relying on trigger execution
-- order against trg_set_content_item_org_id) so this works regardless of
-- alphabetical trigger ordering.
CREATE OR REPLACE FUNCTION public.run_automation_rules_on_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rule record;
  v_org_id uuid := NEW.org_id;
BEGIN
  IF v_org_id IS NULL THEN
    SELECT org_id INTO v_org_id FROM public.months WHERE id = NEW.month_id;
  END IF;

  FOR rule IN
    SELECT * FROM public.automation_rules
     WHERE org_id = v_org_id AND active AND on_create
  LOOP
    IF rule.action_type = 'set_status' THEN
      NEW.status := rule.action_status;
    ELSIF rule.action_type = 'assign_member' THEN
      INSERT INTO public.item_assignees (item_id, user_id) VALUES (NEW.id, rule.action_user_id)
        ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_run_automation_rules_on_create ON public.content_items;
CREATE TRIGGER trg_run_automation_rules_on_create
  BEFORE INSERT ON public.content_items
  FOR EACH ROW
  EXECUTE FUNCTION public.run_automation_rules_on_create();
