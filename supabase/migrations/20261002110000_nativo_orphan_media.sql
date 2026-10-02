-- Nativo: lista as fotos de projeto que ficaram sem uso (nenhum projeto/modelo aponta pra elas)
-- há mais de N dias, pra rotina diária de limpeza (/api/cron/retention-cleanup) apagar pelo
-- Storage. Cumpre o que a Política de Privacidade promete (fotos fora de qualquer projeto somem
-- em 30 dias). Só entram fotos de projeto: <agência>/<pessoa>/<id>.jpg. Ficam de fora a foto
-- de perfil (perfil-*), os elementos da agência (elementos/) e os logos dos kits (marca/).
-- Só o service_role chama (a rotina do servidor); ninguém logado consegue.
-- Pra reverter: DROP FUNCTION public.nativo_orphan_media(integer, integer);

CREATE OR REPLACE FUNCTION public.nativo_orphan_media(p_days integer DEFAULT 30, p_limit integer DEFAULT 500)
RETURNS TABLE (name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, storage
AS $$
  WITH usadas AS (
    SELECT DISTINCT m[1] AS path
    FROM public.nativo_projects p,
         LATERAL regexp_matches(p.doc::text, '"path": "([^"]+)"', 'g') AS m
  )
  SELECT o.name
  FROM storage.objects o
  WHERE o.bucket_id = 'nativo-media'
    AND o.created_at < now() - make_interval(days => GREATEST(p_days, 7))
    AND o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
    AND NOT EXISTS (SELECT 1 FROM usadas u WHERE u.path = o.name)
  ORDER BY o.created_at
  LIMIT LEAST(GREATEST(p_limit, 1), 1000);
$$;

REVOKE ALL ON FUNCTION public.nativo_orphan_media(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nativo_orphan_media(integer, integer) TO service_role;
