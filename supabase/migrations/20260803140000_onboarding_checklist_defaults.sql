-- Junior wants a "Salvar como padrão" option when adding an onboarding
-- checklist item: add it just for this client, or save it as a default so
-- it appears for every client (existing ones now, new ones going forward).
-- client_onboarding.checklist stays a plain per-client jsonb array (as
-- before) — this table is only the org-level template that seeds new
-- clients and gets backfilled onto existing ones when a default is added.
CREATE TABLE public.onboarding_checklist_defaults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.onboarding_checklist_defaults TO authenticated;
GRANT ALL ON public.onboarding_checklist_defaults TO service_role;
ALTER TABLE public.onboarding_checklist_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read onboarding defaults" ON public.onboarding_checklist_defaults FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "admin manage onboarding defaults" ON public.onboarding_checklist_defaults FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_onboarding_checklist_defaults_org ON public.onboarding_checklist_defaults(org_id);

-- Seed every existing org with the same 5 starter items client_onboarding's
-- own column default already gives new rows, so "defaults" stays consistent
-- with what every client already has instead of starting empty.
INSERT INTO public.onboarding_checklist_defaults (org_id, label, sort_order)
SELECT o.id, v.label, v.sort_order
FROM public.orgs o
CROSS JOIN (VALUES
  ('Briefing inicial', 0),
  ('Acessos das redes coletados', 1),
  ('Paleta de marca definida', 2),
  ('Tom de voz documentado', 3),
  ('Primeira reunião de alinhamento', 4)
) AS v(label, sort_order);

-- Adds a new default item: records it in the org's template AND appends it
-- (with the same id, harmless since each client's array is independent) to
-- every existing client's checklist so it "appears in all clients" now too.
CREATE OR REPLACE FUNCTION public.add_onboarding_default_item(_label text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := public.current_org_id();
  v_new_id text := gen_random_uuid()::text;
  v_next_order integer;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT COALESCE(MAX(sort_order), -1) + 1 INTO v_next_order
    FROM public.onboarding_checklist_defaults WHERE org_id = v_org_id;

  INSERT INTO public.onboarding_checklist_defaults (org_id, label, sort_order)
  VALUES (v_org_id, _label, v_next_order);

  UPDATE public.client_onboarding co
  SET checklist = co.checklist || jsonb_build_array(
    jsonb_build_object('id', v_new_id, 'text', _label, 'done', false)
  )
  FROM public.clients c
  WHERE c.id = co.client_id AND c.org_id = v_org_id;
END;
$$;
REVOKE ALL ON FUNCTION public.add_onboarding_default_item(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_onboarding_default_item(text) TO authenticated;
