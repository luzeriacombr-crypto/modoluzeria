-- Virada de mês automática.
--
-- Hoje "Duplicar mês" é um botão que alguém precisa lembrar de apertar pra
-- cada cliente. Quando ninguém lembra, o mês novo começa sem board e o
-- trabalho aparece atrasado. Aqui a agência escolhe um dia do mês e o
-- sistema faz sozinho — ou só avisa, pra quem prefere continuar no manual.
--
-- Pra reverter:
--   SELECT cron.unschedule('luzeria_month_rollover');
--   DROP FUNCTION public.run_month_rollover();
--   ALTER TABLE public.orgs DROP COLUMN month_rollover_day, DROP COLUMN month_rollover_mode;

ALTER TABLE public.orgs ADD COLUMN month_rollover_day smallint
  CHECK (month_rollover_day BETWEEN 1 AND 28);
ALTER TABLE public.orgs ADD COLUMN month_rollover_mode text NOT NULL DEFAULT 'criar'
  CHECK (month_rollover_mode IN ('criar', 'avisar'));

-- Dia 1 a 28 só: 29/30/31 não existem em todo mês, e uma virada que pula
-- fevereiro é pior do que não ter virada.

COMMENT ON COLUMN public.orgs.month_rollover_day IS
  'Dia do mês em que a virada roda. NULL = desligado (padrão de toda agência).';

/**
 * Roda todo dia; só faz algo nas orgs cujo dia configurado é hoje.
 *
 * Copia do mês corrente pro mês seguinte apenas a QUANTIDADE de itens por
 * tipo — sem título, responsável, prazo, comentário ou arquivo. É a mesma
 * regra do botão "Duplicar mês" (duplicateMonth), de propósito: se um dia
 * uma das duas mudar, a outra precisa mudar junto.
 */
CREATE OR REPLACE FUNCTION public.run_month_rollover()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org record;
  v_client record;
  v_de_key text;
  v_para_key text;
  v_mes_de uuid;
  v_mes_novo uuid;
  v_tipo text;
  v_qtd int;
  v_status text;
  v_criados int;
  v_faltando int;
  v_admin record;
  i int;
BEGIN
  FOR v_org IN
    SELECT id, name, month_rollover_day, month_rollover_mode
      FROM public.orgs
     WHERE month_rollover_day IS NOT NULL
       AND month_rollover_day = EXTRACT(DAY FROM CURRENT_DATE)::int
  LOOP
    v_de_key := to_char(CURRENT_DATE, 'YYYY-MM');
    v_para_key := to_char(CURRENT_DATE + INTERVAL '1 month', 'YYYY-MM');
    v_criados := 0;
    v_faltando := 0;

    FOR v_client IN
      SELECT id, name FROM public.clients
       WHERE org_id = v_org.id
         AND NOT archived
         AND COALESCE(category, 'Social Media') NOT IN ('Ex-clientes', 'Avulsos')
    LOOP
      -- Já existe o mês que viria? Então não há nada a fazer nesse cliente.
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM public.months WHERE client_id = v_client.id AND key = v_para_key
      );

      IF v_org.month_rollover_mode = 'avisar' THEN
        v_faltando := v_faltando + 1;
        CONTINUE;
      END IF;

      SELECT id INTO v_mes_de FROM public.months
       WHERE client_id = v_client.id AND key = v_de_key;

      INSERT INTO public.months (client_id, key, org_id)
      VALUES (v_client.id, v_para_key, v_org.id)
      RETURNING id INTO v_mes_novo;

      -- Sem mês de origem, o mês novo nasce vazio de propósito: inventar
      -- itens aqui já foi bug de verdade no "Duplicar mês".
      IF v_mes_de IS NOT NULL THEN
        FOR v_tipo, v_qtd IN
          SELECT type::text, count(*) FROM public.content_items
           WHERE month_id = v_mes_de GROUP BY type
        LOOP
          v_status := CASE WHEN v_tipo IN ('gravacao', 'roteiro', 'sistema', 'outros')
                           THEN 'PENDENTE' ELSE 'PLANEJAMENTO' END;
          FOR i IN 1..v_qtd LOOP
            INSERT INTO public.content_items (month_id, type, idx, title, status)
            VALUES (v_mes_novo, v_tipo::public.content_type, i, '', v_status::public.content_status);
          END LOOP;
        END LOOP;
      END IF;

      v_criados := v_criados + 1;
    END LOOP;

    -- Um aviso por org, não um por cliente.
    IF v_criados > 0 OR v_faltando > 0 THEN
      FOR v_admin IN
        SELECT p.id FROM public.profiles p
          JOIN public.user_roles r ON r.user_id = p.id
         WHERE p.org_id = v_org.id AND p.active AND r.role IN ('master', 'setor')
      LOOP
        INSERT INTO public.notifications (user_id, type, message)
        VALUES (
          v_admin.id,
          'month_rollover',
          CASE WHEN v_org.month_rollover_mode = 'criar'
               THEN 'Mês ' || v_para_key || ' criado em ' || v_criados || ' cliente(s).'
               ELSE v_faltando || ' cliente(s) ainda sem o mês ' || v_para_key || ' criado.'
          END
        );
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- 12:05, um pouco antes das automações por tempo (12:30), pra que uma
-- regra de prazo que olhe o mês novo já o encontre criado.
SELECT cron.schedule('luzeria_month_rollover', '5 12 * * *', $$SELECT public.run_month_rollover();$$);
