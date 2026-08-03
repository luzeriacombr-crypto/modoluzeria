-- Junior wants "Salvar como padrão" to act on the WHOLE checklist he built
-- for a client, not one item at a time: he assembles the full list he
-- wants, then one click replaces the org's default template with it and
-- backfills any new items onto every other existing client (without
-- touching items those clients already have — never destructive).
DROP FUNCTION IF EXISTS public.add_onboarding_default_item(text);

CREATE OR REPLACE FUNCTION public.set_onboarding_defaults(_labels text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := public.current_org_id();
  v_label text;
  v_idx integer := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  DELETE FROM public.onboarding_checklist_defaults WHERE org_id = v_org_id;

  FOREACH v_label IN ARRAY _labels LOOP
    INSERT INTO public.onboarding_checklist_defaults (org_id, label, sort_order)
    VALUES (v_org_id, v_label, v_idx);
    v_idx := v_idx + 1;
  END LOOP;

  UPDATE public.client_onboarding co
  SET checklist = co.checklist || (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', gen_random_uuid()::text, 'text', lbl, 'done', false)), '[]'::jsonb)
    FROM unnest(_labels) AS lbl
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(co.checklist) AS item
      WHERE item->>'text' = lbl
    )
  )
  FROM public.clients c
  WHERE c.id = co.client_id AND c.org_id = v_org_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_onboarding_defaults(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_onboarding_defaults(text[]) TO authenticated;
