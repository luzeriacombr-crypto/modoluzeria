-- Datas comemorativas e aniversários por cliente/marca.
--  * commemorative_dates: a lista de cada cliente (agência) ou marca (House).
--    Cada data diz com quantos dias de antecedência quer ser lembrada.
--  * commemorative_occurrences: o que já aconteceu em cada ano (virou post,
--    foi ignorada, já foi avisada), pra não lembrar duas vezes.
--  * notify_commemorative_dates(): roda todo dia às 8h de Brasília e avisa
--    gestores (master e setor) das datas que entraram na janela de aviso.
-- Datas móveis (Páscoa, Carnaval, Dia das Mães...) são calculadas aqui e no
-- TypeScript (src/lib/luzeria/commemorative.ts) com as mesmas regras.

CREATE TABLE IF NOT EXISTS public.commemorative_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  kind text NOT NULL DEFAULT 'personalizada' CHECK (kind IN ('fixa', 'movel', 'personalizada', 'aniversario')),
  rule text CHECK (rule IS NULL OR rule IN ('easter', 'carnival', 'mothers_day', 'fathers_day', 'black_friday', 'cyber_monday')),
  month smallint CHECK (month BETWEEN 1 AND 12),
  day smallint CHECK (day BETWEEN 1 AND 31),
  segment text,
  note text CHECK (note IS NULL OR length(note) <= 500),
  notify_days_before int NOT NULL DEFAULT 14 CHECK (notify_days_before BETWEEN 0 AND 365),
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((rule IS NOT NULL) OR (month IS NOT NULL AND day IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_commemorative_dates_client ON public.commemorative_dates(client_id);
CREATE INDEX IF NOT EXISTS idx_commemorative_dates_org ON public.commemorative_dates(org_id) WHERE active;

CREATE TABLE IF NOT EXISTS public.commemorative_occurrences (
  date_id uuid NOT NULL REFERENCES public.commemorative_dates(id) ON DELETE CASCADE,
  year int NOT NULL,
  content_item_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL,
  dismissed boolean NOT NULL DEFAULT false,
  notified_at timestamptz,
  PRIMARY KEY (date_id, year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commemorative_dates, public.commemorative_occurrences TO authenticated;
GRANT ALL ON public.commemorative_dates, public.commemorative_occurrences TO service_role;
ALTER TABLE public.commemorative_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commemorative_occurrences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commemorative read" ON public.commemorative_dates;
CREATE POLICY "commemorative read" ON public.commemorative_dates FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()) AND public.has_client_access(auth.uid(), client_id));
DROP POLICY IF EXISTS "commemorative admin write" ON public.commemorative_dates;
CREATE POLICY "commemorative admin write" ON public.commemorative_dates FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin(auth.uid()) AND public.has_client_access(auth.uid(), client_id))
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin(auth.uid()) AND public.has_client_access(auth.uid(), client_id)
              AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.org_id = public.current_org_id()));

DROP POLICY IF EXISTS "commemorative occurrences read" ON public.commemorative_occurrences;
CREATE POLICY "commemorative occurrences read" ON public.commemorative_occurrences FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.commemorative_dates d WHERE d.id = date_id AND d.org_id = public.current_org_id()
                 AND public.has_client_access(auth.uid(), d.client_id)));
DROP POLICY IF EXISTS "commemorative occurrences write" ON public.commemorative_occurrences;
CREATE POLICY "commemorative occurrences write" ON public.commemorative_occurrences FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.commemorative_dates d WHERE d.id = date_id AND d.org_id = public.current_org_id()
                 AND public.has_client_access(auth.uid(), d.client_id) AND (public.is_admin(auth.uid()) OR public.is_house_team(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.commemorative_dates d WHERE d.id = date_id AND d.org_id = public.current_org_id()
                 AND public.has_client_access(auth.uid(), d.client_id) AND (public.is_admin(auth.uid()) OR public.is_house_team(auth.uid()))));

-- Data de uma ocorrência num ano. 29/02 cai em 28/02 nos anos não bissextos.
CREATE OR REPLACE FUNCTION public.commemorative_occurrence_date(_rule text, _month int, _day int, _year int)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int;
  easter date; first date; last_day int;
BEGIN
  IF _rule IS NULL THEN
    last_day := EXTRACT(DAY FROM (make_date(_year, _month, 1) + interval '1 month - 1 day'))::int;
    RETURN make_date(_year, _month, LEAST(_day, last_day));
  END IF;
  IF _rule IN ('easter', 'carnival') THEN
    a := _year % 19; b := _year / 100; c := _year % 100; d := b / 4; e := b % 4;
    f := (b + 8) / 25; g := (b - f + 1) / 3; h := (19 * a + b - d - g + 15) % 30;
    i := c / 4; k := c % 4; l := (32 + 2 * e + 2 * i - h - k) % 7; m := (a + 11 * h + 22 * l) / 451;
    easter := make_date(_year, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
    RETURN CASE WHEN _rule = 'easter' THEN easter ELSE easter - 47 END;
  END IF;
  IF _rule = 'mothers_day' THEN
    first := make_date(_year, 5, 1);
    RETURN first + ((7 - EXTRACT(DOW FROM first)::int) % 7) + 7;
  END IF;
  IF _rule = 'fathers_day' THEN
    first := make_date(_year, 8, 1);
    RETURN first + ((7 - EXTRACT(DOW FROM first)::int) % 7) + 7;
  END IF;
  IF _rule IN ('black_friday', 'cyber_monday') THEN
    first := make_date(_year, 11, 1);
    -- 4ª quinta-feira de novembro + 1 dia = Black Friday; +3 = Cyber Monday.
    first := first + ((4 - EXTRACT(DOW FROM first)::int + 7) % 7) + 21;
    RETURN first + CASE WHEN _rule = 'black_friday' THEN 1 ELSE 4 END;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_commemorative_dates()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_count int := 0;
  rec record;
  v_year int;
  v_occ date;
  v_days int;
  v_when text;
BEGIN
  FOR rec IN
    SELECT d.*, c.name AS client_name, c.archived
      FROM public.commemorative_dates d
      JOIN public.clients c ON c.id = d.client_id
     WHERE d.active AND NOT c.archived
  LOOP
    FOREACH v_year IN ARRAY ARRAY[EXTRACT(YEAR FROM v_today)::int, EXTRACT(YEAR FROM v_today)::int + 1] LOOP
      v_occ := public.commemorative_occurrence_date(rec.rule, rec.month, rec.day, v_year);
      CONTINUE WHEN v_occ IS NULL OR v_occ < v_today OR v_occ - rec.notify_days_before > v_today;
      -- Já virou post, foi ignorada ou já foi avisada neste ano?
      CONTINUE WHEN EXISTS (
        SELECT 1 FROM public.commemorative_occurrences o
         WHERE o.date_id = rec.id AND o.year = v_year
           AND (o.content_item_id IS NOT NULL OR o.dismissed OR o.notified_at IS NOT NULL)
      );
      INSERT INTO public.commemorative_occurrences (date_id, year, notified_at)
      VALUES (rec.id, v_year, now())
      ON CONFLICT (date_id, year) DO UPDATE SET notified_at = now();

      v_days := v_occ - v_today;
      v_when := CASE v_days WHEN 0 THEN 'é hoje' WHEN 1 THEN 'é amanhã' ELSE 'é em ' || v_days || ' dias' END;
      INSERT INTO public.notifications (user_id, type, message)
      SELECT DISTINCT p.id, 'commemorative_date',
             rec.title || ' (' || to_char(v_occ, 'DD/MM') || ') ' || v_when || ' · ' || rec.client_name || '. Ainda não virou post.'
        FROM public.profiles p
        JOIN public.user_roles r ON r.user_id = p.id AND r.role IN ('master', 'setor')
       WHERE p.org_id = rec.org_id AND p.active
         AND public.has_client_access(p.id, rec.client_id);
      v_count := v_count + 1;
    END LOOP;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_commemorative_dates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_commemorative_dates() TO service_role;

DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'commemorative-dates-daily';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;
-- 11:00 UTC = 8h em Brasília.
SELECT cron.schedule('commemorative-dates-daily', '0 11 * * *', $$SELECT public.notify_commemorative_dates();$$);
