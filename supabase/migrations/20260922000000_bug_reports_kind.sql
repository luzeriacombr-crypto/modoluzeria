-- Distingue "reportar um problema" de "sugerir uma melhoria" na mesma tabela
-- (mesmo fluxo, mesma fila pro Junior, só muda o rótulo/ícone na tela).
ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'bug' CHECK (kind IN ('bug', 'suggestion'));

CREATE OR REPLACE FUNCTION public.platform_list_bug_reports()
RETURNS TABLE(
  id uuid, message text, page_url text, screenshot_path text, created_at timestamptz,
  org_name text, reporter_name text, status text, whatsapp text, kind text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT br.id, br.message, br.page_url, br.screenshot_path, br.created_at,
         o.name AS org_name, p.name AS reporter_name, br.status, br.whatsapp, br.kind
  FROM public.bug_reports br
  JOIN public.orgs o ON o.id = br.org_id
  JOIN public.profiles p ON p.id = br.reported_by
  WHERE public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001'
  ORDER BY br.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.platform_list_bug_reports() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_list_bug_reports() TO authenticated;
