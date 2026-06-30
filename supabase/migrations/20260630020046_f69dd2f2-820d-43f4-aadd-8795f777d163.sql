BEGIN;

-- 1. Dropar triggers dependentes da coluna status em content_items
DROP TRIGGER IF EXISTS trg_log_item_activity ON public.content_items;
DROP TRIGGER IF EXISTS trg_on_status_change ON public.content_items;
DROP TRIGGER IF EXISTS trg_record_finalizations ON public.content_items;
DROP TRIGGER IF EXISTS trg_track_lead_time ON public.content_items;
DROP TRIGGER IF EXISTS trg_track_status_transition ON public.content_items;

-- 2. Remover default value que depende do enum antigo
ALTER TABLE public.content_items ALTER COLUMN status DROP DEFAULT;

-- 3. Converter a coluna status para texto
ALTER TABLE public.content_items
  ALTER COLUMN status TYPE text
  USING status::text;

-- 4. Dropar o enum antigo
DROP TYPE IF EXISTS public.content_status;

-- 5. Criar o enum novo
CREATE TYPE public.content_status AS ENUM (
  'PLANEJAMENTO',
  'COPY',
  'CRIACAO',
  'REVISAO_ARTE',
  'EM_GRAVACAO',
  'EM_EDICAO',
  'REVISAO_INTERNA',
  'REVISAO_CLIENTE',
  'AGENDAMENTO',
  'REVISAO_AGENDAMENTO',
  'TRAVADO',
  'PRONTO_PARA_PUBLICAR'
);

-- 6. Migrar valores antigos nos registros
UPDATE public.content_items
SET status = CASE status
  WHEN 'FINALIZADO' THEN 'PRONTO_PARA_PUBLICAR'
  WHEN 'BLOQUEADO' THEN 'TRAVADO'
  WHEN 'START' THEN 'PLANEJAMENTO'
  ELSE status
END
WHERE status IN ('FINALIZADO', 'BLOQUEADO', 'START');

-- 7. Converter a coluna de volta para o enum novo
ALTER TABLE public.content_items
  ALTER COLUMN status TYPE public.content_status
  USING status::public.content_status;

-- 8. Restaurar o default value com o novo enum
ALTER TABLE public.content_items
  ALTER COLUMN status SET DEFAULT 'PLANEJAMENTO'::public.content_status;

-- 9. Atualizar funções para os novos nomes
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
    IF NEW.status = 'PRONTO_PARA_PUBLICAR' AND OLD.status <> 'PRONTO_PARA_PUBLICAR' THEN
      NEW.finished_at := now();
    END IF;
    IF OLD.status = 'PRONTO_PARA_PUBLICAR' AND NEW.status <> 'PRONTO_PARA_PUBLICAR' THEN
      NEW.finished_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

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

    IF (OLD.status = 'PRONTO_PARA_PUBLICAR' AND NEW.status <> 'PRONTO_PARA_PUBLICAR')
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

CREATE OR REPLACE FUNCTION public.record_finalizations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
BEGIN
  IF NEW.status = 'PRONTO_PARA_PUBLICAR' AND (OLD.status IS DISTINCT FROM 'PRONTO_PARA_PUBLICAR') THEN
    FOR rec IN SELECT user_id FROM public.item_assignees WHERE item_id = NEW.id LOOP
      INSERT INTO public.finalizations (user_id, item_id, finalized_at)
      VALUES (rec.user_id, NEW.id, now());
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  rec record;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.comments (item_id, author_id, text, is_system)
    VALUES (NEW.id, actor_id, 'Status alterado para ' || NEW.status::text, true);

    FOR rec IN SELECT user_id FROM public.item_assignees WHERE item_id = NEW.id LOOP
      IF rec.user_id <> COALESCE(actor_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications (user_id, type, item_id, message)
        VALUES (rec.user_id, 'status', NEW.id, 'Status de "' || NEW.title || '" virou ' || NEW.status::text);
      END IF;
    END LOOP;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_item_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log (actor_id, entity_type, entity_id, action, meta)
    VALUES (auth.uid(), 'content_item', NEW.id, 'created',
            jsonb_build_object('title', NEW.title, 'type', NEW.type));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
      INSERT INTO public.activity_log (actor_id, entity_type, entity_id, action, meta)
      VALUES (auth.uid(), 'content_item', NEW.id, 'due_date_changed',
              jsonb_build_object('from', OLD.due_date, 'to', NEW.due_date));
    END IF;
    IF NEW.quality_rating IS DISTINCT FROM OLD.quality_rating AND NEW.quality_rating IS NOT NULL THEN
      INSERT INTO public.activity_log (actor_id, entity_type, entity_id, action, meta)
      VALUES (auth.uid(), 'content_item', NEW.id, 'rated',
              jsonb_build_object('rating', NEW.quality_rating));
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

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
      AND ci.status <> 'PRONTO_PARA_PUBLICAR';

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
      AND ci.status <> 'PRONTO_PARA_PUBLICAR'
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

-- 10. Recriar triggers
CREATE TRIGGER trg_track_lead_time
  BEFORE UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.track_lead_time();

CREATE TRIGGER trg_track_status_transition
  BEFORE UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.track_status_transition();

CREATE TRIGGER trg_on_status_change
  BEFORE UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.on_status_change();

CREATE TRIGGER trg_record_finalizations
  AFTER UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.record_finalizations();

CREATE TRIGGER trg_log_item_activity
  AFTER INSERT OR UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.log_item_activity();

COMMIT;