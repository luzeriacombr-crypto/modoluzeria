-- Per-roteiro workflow state for the "Roteiros" client doc: approved/needs
-- adjustment (with a note), recorded, and a link to the Reel content_item
-- once the team pushes it into the client's board. Keyed by (doc_id,
-- roteiro_title) since roteiros aren't individual rows — they're "## " H2
-- sections inside client_docs.content (see markdown-lite.ts). Editing a
-- roteiro's title in the pasted doc naturally resets its workflow state,
-- which is acceptable: a changed roteiro should be re-reviewed anyway.
CREATE TABLE public.client_doc_roteiro_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid NOT NULL REFERENCES public.client_docs(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  roteiro_title text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'aprovado', 'ajustar')),
  adjust_note text,
  gravado boolean NOT NULL DEFAULT false,
  content_item_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (doc_id, roteiro_title)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_doc_roteiro_status TO authenticated;
GRANT ALL ON public.client_doc_roteiro_status TO service_role;
ALTER TABLE public.client_doc_roteiro_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage roteiro status" ON public.client_doc_roteiro_status FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_client_doc_roteiro_status_doc ON public.client_doc_roteiro_status(doc_id);

CREATE TRIGGER client_doc_roteiro_status_touch_updated_at BEFORE UPDATE ON public.client_doc_roteiro_status
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
