-- Custo por colaborador: cada pessoa pode ganhar diferente e trabalhar carga
-- horária diferente (período integral = 8h/dia, meio período = 4h/dia, com
-- possibilidade de variar por dia da semana — ex: sábado só de manhã). Isso
-- substitui o custo-hora único e flat usado até aqui na Margem por cliente
-- por um custo-hora calculado por pessoa: salário mensal / horas mensais
-- estimadas (horas semanais × 52/12).
--
-- work_schedule shape: {"mon":0|1|2, "tue":..., "wed":..., "thu":..., "fri":...,
-- "sat":..., "sun":...} — 0 = não trabalha, 1 = meio período (4h), 2 = período
-- integral (8h).
--
-- Salário e escala são dados sensíveis (RH) — protegidos por column-level
-- REVOKE, igual ao "email" já é hoje (ver 20260629025625). Só chegam ao
-- app via funções SECURITY DEFINER:
--   admin_list_member_pay()          -> master only, dados brutos (edição em Equipe)
--   admin_list_member_hourly_cost()  -> master OU setor, só o valor calculado
--                                        (usado pela Margem por cliente, nunca
--                                        expõe salário/escala em si)

ALTER TABLE public.profiles
  ADD COLUMN monthly_salary numeric,
  ADD COLUMN work_schedule jsonb;

REVOKE SELECT (monthly_salary, work_schedule) ON public.profiles FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.admin_list_member_pay()
RETURNS TABLE(id uuid, monthly_salary numeric, work_schedule jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.monthly_salary, p.work_schedule
  FROM public.profiles p
  WHERE public.is_master(auth.uid()) AND p.org_id = public.current_org_id();
$$;
REVOKE ALL ON FUNCTION public.admin_list_member_pay() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_member_pay() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_member_hourly_cost()
RETURNS TABLE(id uuid, hourly_cost numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    CASE
      WHEN p.monthly_salary IS NULL OR p.monthly_salary <= 0 OR p.work_schedule IS NULL THEN NULL
      ELSE p.monthly_salary / NULLIF(
        (
          COALESCE((p.work_schedule->>'mon')::numeric, 0) +
          COALESCE((p.work_schedule->>'tue')::numeric, 0) +
          COALESCE((p.work_schedule->>'wed')::numeric, 0) +
          COALESCE((p.work_schedule->>'thu')::numeric, 0) +
          COALESCE((p.work_schedule->>'fri')::numeric, 0) +
          COALESCE((p.work_schedule->>'sat')::numeric, 0) +
          COALESCE((p.work_schedule->>'sun')::numeric, 0)
        ) * 4 * 52.0 / 12,
        0
      )
    END AS hourly_cost
  FROM public.profiles p
  WHERE public.is_admin(auth.uid()) AND p.org_id = public.current_org_id();
$$;
REVOKE ALL ON FUNCTION public.admin_list_member_hourly_cost() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_member_hourly_cost() TO authenticated;
