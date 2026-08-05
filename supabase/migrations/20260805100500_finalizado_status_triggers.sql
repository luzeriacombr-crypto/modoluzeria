-- Segunda parte do status "Finalizado" — precisa rodar depois de
-- 20260805100000 (que criou o valor do enum) numa transação separada.
--
-- record_finalizations(): passa a disparar também ao entrar em FINALIZADO,
-- não só PRONTO_PARA_PUBLICAR/CONCLUIDO — cobre o caso raro de alguém pular
-- direto pra FINALIZADO sem passar por PRONTO_PARA_PUBLICAR antes. Ganhou
-- uma guarda NOT EXISTS pra nunca contar duas vezes o mesmo item pro mesmo
-- responsável (o caminho normal é PRONTO_PARA_PUBLICAR -> FINALIZADO, que
-- já teria sido creditado na primeira transição).
CREATE OR REPLACE FUNCTION public.record_finalizations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
BEGIN
  IF NEW.status IN ('PRONTO_PARA_PUBLICAR', 'CONCLUIDO', 'FINALIZADO')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    FOR rec IN SELECT user_id FROM public.item_assignees WHERE item_id = NEW.id LOOP
      IF NOT EXISTS (SELECT 1 FROM public.finalizations WHERE item_id = NEW.id AND user_id = rec.user_id) THEN
        INSERT INTO public.finalizations (user_id, item_id, finalized_at)
        VALUES (rec.user_id, NEW.id, now());
      END IF;
    END LOOP;
    IF NEW.editor_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.finalizations WHERE item_id = NEW.id AND user_id = NEW.editor_id
    ) THEN
      INSERT INTO public.finalizations (user_id, item_id, finalized_at)
      VALUES (NEW.editor_id, NEW.id, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- track_lead_time(): PRONTO_PARA_PUBLICAR e FINALIZADO agora contam como um
-- único estado "terminal" pra fins de started_at/finished_at — mover entre
-- os dois não zera finished_at (antes isso limpava o prazo de entrega
-- assim que o item saía de PRONTO_PARA_PUBLICAR, mesmo indo pra FINALIZADO).
CREATE OR REPLACE FUNCTION public.track_lead_time()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'PLANEJAMENTO' AND NEW.status <> 'PLANEJAMENTO' AND NEW.started_at IS NULL THEN
      NEW.started_at := now();
    END IF;
    IF NEW.status IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO') AND OLD.status NOT IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO') THEN
      NEW.finished_at := now();
    END IF;
    IF OLD.status IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO') AND NEW.status NOT IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO') THEN
      NEW.finished_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- track_status_transition(): sair de PRONTO_PARA_PUBLICAR direto pra
-- FINALIZADO é avançar, não retrabalho — não deve mais contar como rework.
CREATE OR REPLACE FUNCTION public.track_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  dur_ms bigint := NULL;
  is_rework boolean := false;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.last_status_change_at IS NOT NULL THEN
      dur_ms := (EXTRACT(EPOCH FROM (now() - OLD.last_status_change_at)) * 1000)::bigint;
    END IF;

    INSERT INTO public.status_transitions (item_id, from_status, to_status, actor_id, duration_ms)
    VALUES (NEW.id, OLD.status::text, NEW.status::text, auth.uid(), dur_ms);

    IF (OLD.status = 'PRONTO_PARA_PUBLICAR' AND NEW.status NOT IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO'))
       OR (OLD.status::text LIKE 'REVISAO%' AND NEW.status::text IN ('PLANEJAMENTO','COPY','CRIACAO','EM_GRAVACAO','EM_EDICAO')) THEN
      is_rework := true;
    END IF;

    IF is_rework THEN
      NEW.rework_count := COALESCE(OLD.rework_count, 0) + 1;
    END IF;

    NEW.last_status_change_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

-- set_item_status(): FINALIZADO ganha a mesma trava de PRONTO_PARA_PUBLICAR
-- — só admin pode marcar (defesa em profundidade, além do filtro na UI).
CREATE OR REPLACE FUNCTION public.set_item_status(p_item_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'Conta inativa.';
  END IF;
  IF p_status IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO') AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem marcar como pronto para publicar ou finalizado.';
  END IF;
  UPDATE public.content_items SET status = p_status::content_status WHERE id = p_item_id;
END;
$$;

-- send_deadline_reminders(): um item FINALIZADO é mais que "pronto pra
-- publicar" — sem essa exclusão, um item arquivado atrasado geraria o
-- lembrete "🚨 Atrasado" pra sempre (mesmo bug que já foi corrigido uma vez
-- pra CONCLUIDO, reaparecendo agora pra FINALIZADO).
CREATE OR REPLACE FUNCTION public.send_deadline_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  kind_text text;
  msg text;
  sent int := 0;
  pref_enabled boolean;
BEGIN
  FOR rec IN
    SELECT ci.id AS item_id, ci.title, ci.due_date, ia.user_id,
           CASE
             WHEN ci.due_date < CURRENT_DATE THEN 'overdue'
             WHEN ci.due_date = CURRENT_DATE THEN 'today'
             WHEN ci.due_date = CURRENT_DATE + 1 THEN 'tomorrow'
           END AS kind
    FROM public.content_items ci
    JOIN public.item_assignees ia ON ia.item_id = ci.id
    WHERE ci.due_date IS NOT NULL
      AND ci.status NOT IN ('PRONTO_PARA_PUBLICAR', 'CONCLUIDO', 'FINALIZADO')
      AND ci.due_date <= CURRENT_DATE + 1
  LOOP
    kind_text := rec.kind;
    IF kind_text IS NULL THEN CONTINUE; END IF;

    SELECT COALESCE(deadline_alerts, true) INTO pref_enabled
      FROM public.notification_preferences WHERE user_id = rec.user_id;
    IF pref_enabled IS NULL THEN pref_enabled := true; END IF;
    IF NOT pref_enabled THEN CONTINUE; END IF;

    BEGIN
      INSERT INTO public.deadline_notifications_log (item_id, kind, sent_on)
      VALUES (rec.item_id, kind_text, CURRENT_DATE);
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;

    msg := CASE kind_text
      WHEN 'today'    THEN '⏰ Vence hoje: "' || rec.title || '"'
      WHEN 'tomorrow' THEN '📅 Vence amanhã: "' || rec.title || '"'
      WHEN 'overdue'  THEN '🚨 Atrasado: "' || rec.title || '"'
    END;

    INSERT INTO public.notifications (user_id, type, item_id, message)
    VALUES (rec.user_id, 'deadline_' || kind_text, rec.item_id, msg);

    sent := sent + 1;
  END LOOP;
  RETURN sent;
END;
$function$;

-- send_daily_digest(): mesma lógica pro contador "X demandas p/ hoje" do
-- resumo diário — um item FINALIZADO não deve mais contar como pendente.
CREATE OR REPLACE FUNCTION public.send_daily_digest()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  today_date date := CURRENT_DATE;
  today_weekday int := ((EXTRACT(DOW FROM CURRENT_DATE)::int) - 1);
  due_today int;
  has_stories boolean;
  has_cleaning boolean;
  parts text[];
  msg text;
  sent int := 0;
BEGIN
  FOR p IN
    SELECT pr.id AS user_id
    FROM public.profiles pr
    WHERE pr.active = true
      AND COALESCE(
        (SELECT daily_digest FROM public.notification_preferences WHERE user_id = pr.id),
        true
      ) = true
  LOOP
    SELECT COUNT(*) INTO due_today
    FROM public.content_items ci
    JOIN public.item_assignees ia ON ia.item_id = ci.id
    WHERE ia.user_id = p.user_id
      AND ci.due_date = today_date
      AND ci.status NOT IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO');

    SELECT EXISTS(
      SELECT 1 FROM public.stories_schedule
      WHERE user_id = p.user_id AND day = today_date AND status = 'pending'
    ) INTO has_stories;

    has_cleaning := false;
    IF today_weekday BETWEEN 0 AND 5 THEN
      SELECT EXISTS(
        SELECT 1 FROM public.cleaning_schedule cs
        WHERE cs.user_id = p.user_id AND cs.weekday = today_weekday
          AND NOT EXISTS (
            SELECT 1 FROM public.cleaning_log cl
            WHERE cl.task_idx = cs.task_idx AND cl.weekday = cs.weekday
              AND cl.occurrence_date = today_date
          )
      ) INTO has_cleaning;
    END IF;

    IF due_today = 0 AND NOT has_stories AND NOT has_cleaning THEN
      CONTINUE;
    END IF;

    parts := ARRAY[]::text[];
    IF due_today > 0 THEN
      parts := array_append(parts, due_today || ' demanda' || (CASE WHEN due_today > 1 THEN 's' ELSE '' END) || ' p/ hoje');
    END IF;
    IF has_stories THEN parts := array_append(parts, 'Stories do dia'); END IF;
    IF has_cleaning THEN parts := array_append(parts, 'Limpeza do dia'); END IF;

    msg := '📅 Sua agenda de hoje: ' || array_to_string(parts, ' · ');

    IF EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = p.user_id
        AND type = 'daily_digest'
        AND created_at::date = today_date
    ) THEN CONTINUE; END IF;

    INSERT INTO public.notifications (user_id, type, message)
    VALUES (p.user_id, 'daily_digest', msg);

    sent := sent + 1;
  END LOOP;
  RETURN sent;
END;
$function$;
