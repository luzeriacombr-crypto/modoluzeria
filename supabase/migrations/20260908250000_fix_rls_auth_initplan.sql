-- Corrige o aviso "Auth RLS Initialization Plan" do Supabase Advisor,
-- espalhado por dezenas de tabelas: toda política de RLS que chama
-- auth.uid()/auth.jwt()/auth.role() direto (sem envolver num `(select ...)`)
-- faz o Postgres recalcular essa função LINHA POR LINHA em vez de uma vez
-- só por consulta. Envolver em `(select ...)` deixa o Postgres tratar como
-- um InitPlan (calculado uma vez, reaproveitado) — mesmo resultado, muito
-- mais rápido em tabelas grandes. É o motivo mais provável do CPU/Disk IO
-- do banco estar no talo.
--
-- Em vez de reescrever manualmente cada política (arriscado, são dezenas
-- espalhadas pelo schema todo), isso aqui lê direto de pg_policies, faz a
-- troca textual auth.uid() -> (select auth.uid()) (idem jwt/role, sem
-- duplicar quem já estiver certo) e reaplica com ALTER POLICY. Não muda
-- NENHUMA regra de segurança — só a forma como o Postgres calcula, o
-- resultado lógico é idêntico.
DO $$
DECLARE
  pol RECORD;
  new_qual text;
  new_check text;
  stmt text;
  fixed_count int := 0;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual IS NOT NULL AND qual ~ 'auth\.(uid|jwt|role)\(\)' AND qual !~ '\(select auth\.')
        OR
        (with_check IS NOT NULL AND with_check ~ 'auth\.(uid|jwt|role)\(\)' AND with_check !~ '\(select auth\.')
      )
  LOOP
    new_qual := pol.qual;
    new_check := pol.with_check;

    IF new_qual IS NOT NULL THEN
      new_qual := replace(new_qual, '(select auth.uid())', '__W_UID__');
      new_qual := replace(new_qual, '(select auth.jwt())', '__W_JWT__');
      new_qual := replace(new_qual, '(select auth.role())', '__W_ROLE__');
      new_qual := replace(new_qual, 'auth.uid()', '(select auth.uid())');
      new_qual := replace(new_qual, 'auth.jwt()', '(select auth.jwt())');
      new_qual := replace(new_qual, 'auth.role()', '(select auth.role())');
      new_qual := replace(new_qual, '__W_UID__', '(select auth.uid())');
      new_qual := replace(new_qual, '__W_JWT__', '(select auth.jwt())');
      new_qual := replace(new_qual, '__W_ROLE__', '(select auth.role())');
    END IF;

    IF new_check IS NOT NULL THEN
      new_check := replace(new_check, '(select auth.uid())', '__W_UID__');
      new_check := replace(new_check, '(select auth.jwt())', '__W_JWT__');
      new_check := replace(new_check, '(select auth.role())', '__W_ROLE__');
      new_check := replace(new_check, 'auth.uid()', '(select auth.uid())');
      new_check := replace(new_check, 'auth.jwt()', '(select auth.jwt())');
      new_check := replace(new_check, 'auth.role()', '(select auth.role())');
      new_check := replace(new_check, '__W_UID__', '(select auth.uid())');
      new_check := replace(new_check, '__W_JWT__', '(select auth.jwt())');
      new_check := replace(new_check, '__W_ROLE__', '(select auth.role())');
    END IF;

    stmt := format('ALTER POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;

    EXECUTE stmt;
    fixed_count := fixed_count + 1;
  END LOOP;

  RAISE NOTICE 'Políticas corrigidas: %', fixed_count;
END $$;
