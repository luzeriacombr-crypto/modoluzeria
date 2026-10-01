-- Auditoria de exposição de dados — só leitura, roda contra o banco real
-- (scripts/security/audit.sh, workflow security-audit.yml).
-- Cada linha é um achado "FINDING:<tipo>:<objeto>". Achado conhecido e
-- aceito fica em supabase/security/baseline.txt; qualquer outro faz o
-- workflow falhar. Motivação: pesquisa da UpGuard (set/2026) — bancos
-- Supabase expostos quase sempre por tabela sem RLS ou política frouxa,
-- e o Lovable cria tabela nova o tempo todo.
WITH findings(f) AS (
  -- Tabela em public sem RLS: a chave pública (que vai pro navegador) lê tudo.
  SELECT 'no-rls:' || c.relname
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity

  -- Política que libera tudo (USING/WITH CHECK true) — equivale a não ter RLS.
  UNION ALL
  SELECT 'policy-true:' || p.schemaname || '.' || p.tablename || ':' || p.policyname
  FROM pg_policies p
  WHERE p.schemaname IN ('public', 'storage') AND (p.qual = 'true' OR p.with_check = 'true')

  -- Política que vale pra anon/public (gente deslogada), a não ser "nega tudo".
  UNION ALL
  SELECT 'policy-anon:' || p.schemaname || '.' || p.tablename || ':' || p.policyname
  FROM pg_policies p
  WHERE p.schemaname IN ('public', 'storage')
    AND p.roles && ARRAY['anon', 'public']::name[]
    AND coalesce(p.qual, '') <> 'false'

  -- View sem security_invoker ignora a RLS das tabelas por baixo.
  UNION ALL
  SELECT 'view-no-invoker:' || c.relname
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm')
    AND NOT coalesce(c.reloptions::text[] && ARRAY['security_invoker=true', 'security_invoker=on'], false)

  -- SECURITY DEFINER sem search_path fixo: dá pra sequestrar via schema.
  UNION ALL
  SELECT 'definer-no-search-path:' || p.proname
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
    AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg WHERE cfg LIKE 'search_path=%')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')

  -- SECURITY DEFINER que gente deslogada consegue chamar (roda como dono,
  -- sem RLS). Os de link público (token) são esperados; função nova aqui
  -- precisa de revisão.
  UNION ALL
  SELECT 'definer-anon:' || p.proname
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')

  -- Coluna com cara de segredo/dado pessoal legível pela sessão do usuário.
  -- A RLS ainda filtra as linhas, mas coluna nova assim merece revisão
  -- (o token de rede social ficou meses exposto à equipe toda).
  UNION ALL
  SELECT 'sensitive-column:' || c.relname || '.' || a.attname
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm') AND a.attnum > 0 AND NOT a.attisdropped
    AND a.attname ~* '(token|secret|password|cpf|cnpj|api_?key|private_key|pix)'
    AND a.attname !~* '(expires|_at$|_count$)'
    AND has_column_privilege('authenticated', c.oid, a.attnum, 'SELECT')

  -- Bucket público: qualquer um com a URL baixa o arquivo.
  UNION ALL
  SELECT 'public-bucket:' || b.id FROM storage.buckets b WHERE b.public
)
SELECT 'FINDING:' || regexp_replace(f, '[^A-Za-z0-9_.:@/-]', '_', 'g') AS finding
FROM findings
UNION ALL
-- Lista de tabelas pra sondagem com a chave pública (audit.sh).
SELECT 'TABLE:' || c.relname
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
UNION ALL
SELECT 'BUCKET:' || b.id FROM storage.buckets b
ORDER BY 1;
