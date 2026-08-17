-- Correção da 20260817160000: testado ao vivo, o REVOKE SELECT (coluna) em
-- `profiles` não pegou nesse projeto (attacl fica null mesmo depois do
-- REVOKE rodar sem erro — o mesmo já acontecia com a coluna "email" hoje,
-- um gap pré-existente, não causado por essa migração). Column-level REVOKE
-- não é confiável aqui; RLS por linha é o mecanismo que já funciona em todo
-- o resto do app. Solução: mover salário/escala pra uma tabela própria
-- (member_pay), protegida só por RLS (mesmo padrão comprovado de
-- bug_reports_platform_owner_read etc.), sem depender de REVOKE nenhum.

DROP FUNCTION IF EXISTS public.admin_list_member_pay();
DROP FUNCTION IF EXISTS public.admin_list_member_hourly_cost();
GRANT SELECT (monthly_salary, work_schedule) ON public.profiles TO authenticated, anon;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS monthly_salary;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS work_schedule;

CREATE TABLE public.member_pay (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  monthly_salary numeric,
  work_schedule jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.member_pay TO authenticated;
GRANT ALL ON public.member_pay TO service_role;
ALTER TABLE public.member_pay ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_member_pay_org ON public.member_pay(org_id);

CREATE POLICY "member_pay_master_only" ON public.member_pay FOR ALL TO authenticated
  USING (public.is_master(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_master(auth.uid()) AND org_id = public.current_org_id());

-- Custo-hora calculado (master OU setor podem ler isso pra Margem por
-- cliente) — SECURITY DEFINER só pra atravessar a RLS master-only acima
-- de forma controlada; nunca devolve salário/escala em si, só o número
-- final já dividido.
CREATE OR REPLACE FUNCTION public.admin_list_member_hourly_cost()
RETURNS TABLE(id uuid, hourly_cost numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mp.user_id,
    CASE
      WHEN mp.monthly_salary IS NULL OR mp.monthly_salary <= 0 OR mp.work_schedule IS NULL THEN NULL
      ELSE mp.monthly_salary / NULLIF(
        (
          COALESCE((mp.work_schedule->>'mon')::numeric, 0) +
          COALESCE((mp.work_schedule->>'tue')::numeric, 0) +
          COALESCE((mp.work_schedule->>'wed')::numeric, 0) +
          COALESCE((mp.work_schedule->>'thu')::numeric, 0) +
          COALESCE((mp.work_schedule->>'fri')::numeric, 0) +
          COALESCE((mp.work_schedule->>'sat')::numeric, 0) +
          COALESCE((mp.work_schedule->>'sun')::numeric, 0)
        ) * 4 * 52.0 / 12,
        0
      )
    END AS hourly_cost
  FROM public.member_pay mp
  WHERE public.is_admin(auth.uid()) AND mp.org_id = public.current_org_id();
$$;
REVOKE ALL ON FUNCTION public.admin_list_member_hourly_cost() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_member_hourly_cost() TO authenticated;
