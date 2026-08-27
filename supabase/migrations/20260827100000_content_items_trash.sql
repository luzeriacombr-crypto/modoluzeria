-- Lixeira de posts: soft delete em vez de apagar de verdade. "Excluir"
-- passa a só marcar deleted_at/deleted_by; a linha continua existindo
-- (comentários, arquivos, histórico — tudo intacto) até ser restaurada
-- ou expirar (purga real, feita sob demanda ao abrir a Lixeira).

alter table public.content_items
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

-- As duas políticas existentes cobrem todas as ~50 leituras/escritas de
-- content_items espalhadas pelo app — adicionando "deleted_at is null"
-- aqui, todo mundo que já usa essas políticas passa a não ver itens
-- excluídos automaticamente, sem precisar tocar em cada tela.
drop policy if exists "active read items" on public.content_items;
create policy "active read items" on public.content_items
  for select
  using (
    is_active_profile(auth.uid())
    and org_id = current_org_id()
    and deleted_at is null
    and exists (
      select 1 from public.months m
      where m.id = content_items.month_id and has_client_access(auth.uid(), m.client_id)
    )
  );

-- USING (o que dá pra mirar) exige deleted_at is null — então as ações
-- normais de admin (editar, mover, o próprio "excluir" que agora só
-- marca deleted_at) só alcançam itens vivos. WITH CHECK fica sem essa
-- exigência de propósito: é o que permite a própria UPDATE de soft
-- delete gravar deleted_at = now(). Restaurar/purgar de vez usa o
-- service role (trash.functions.ts), não essa política.
drop policy if exists "admin manage items" on public.content_items;
create policy "admin manage items" on public.content_items
  for all
  using (
    is_admin(auth.uid())
    and org_id = current_org_id()
    and deleted_at is null
    and exists (
      select 1 from public.months m
      where m.id = content_items.month_id and has_client_access(auth.uid(), m.client_id)
    )
  )
  with check (
    is_admin(auth.uid())
    and org_id = current_org_id()
    and exists (
      select 1 from public.months m
      where m.id = content_items.month_id and has_client_access(auth.uid(), m.client_id)
    )
  );

-- O preview público (link do cliente) e os lembretes automáticos de
-- prazo bypassam RLS (SECURITY DEFINER) — precisam do filtro manual
-- pra não continuar mostrando/avisando sobre algo que já foi excluído.
create or replace function public.get_public_feed(_token text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
DECLARE
  tok record;
  v_month_id uuid;
  v_feed_mode text;
  v_feed_dir text;
  result jsonb;
BEGIN
  SELECT client_id, revoked_at
    INTO tok
  FROM public.feed_share_tokens
  WHERE token = _token;
  IF NOT FOUND OR tok.revoked_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  SELECT active_month_id INTO v_month_id FROM public.clients WHERE id = tok.client_id;
  IF v_month_id IS NULL THEN
    SELECT id INTO v_month_id FROM public.months WHERE client_id = tok.client_id ORDER BY key DESC LIMIT 1;
  END IF;
  IF v_month_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT feed_order_mode, feed_order_direction INTO v_feed_mode, v_feed_dir
  FROM public.months WHERE id = v_month_id;

  SELECT jsonb_build_object(
    'client', (
      SELECT jsonb_build_object('name', c.name, 'color', c.color, 'description', c.description, 'photo_path', c.photo_url)
      FROM public.clients c WHERE c.id = tok.client_id
    ),
    'month', (
      SELECT jsonb_build_object('key', m.key) FROM public.months m WHERE m.id = v_month_id
    ),
    'items', COALESCE((
      SELECT jsonb_agg(item_obj ORDER BY
        CASE WHEN v_feed_mode = 'cronologica' AND v_feed_dir = 'desc' THEN -1 ELSE 1 END
          * (CASE WHEN v_feed_mode = 'cronologica' THEN extract(epoch FROM sort_scheduled) END),
        CASE WHEN v_feed_mode = 'cronologica' THEN NULL ELSE sort_feed_order END,
        sort_type_rank, sort_idx)
      FROM (
        SELECT
          ci.feed_order AS sort_feed_order,
          ci.scheduled_at AS sort_scheduled,
          CASE ci.type WHEN 'reel' THEN 1 ELSE 0 END AS sort_type_rank,
          ci.idx AS sort_idx,
          jsonb_build_object(
            'id', ci.id, 'type', ci.type, 'idx', ci.idx, 'title', ci.title,
            'caption', COALESCE(ci.caption, ''),
            'scheduled_at', ci.scheduled_at,
            'feed_order', ci.feed_order,
            'cover_path', ci.cover_path,
            'status', ci.status,
            'blocked_reason', ci.blocked_reason,
            'files', COALESCE((
              SELECT jsonb_agg(jsonb_build_object('id', f.id, 'drive_file_id', f.drive_file_id, 'mime_type', f.mime_type, 'web_view_url', f.web_view_url, 'sort_order', f.sort_order) ORDER BY f.sort_order, f.created_at)
              FROM public.item_files f WHERE f.item_id = ci.id AND f.kind = 'media'
            ), '[]'::jsonb),
            'feedback', COALESCE((
              SELECT jsonb_agg(jsonb_build_object('id', fb.id, 'author_name', fb.author_name, 'text', fb.text, 'created_at', fb.created_at) ORDER BY fb.created_at DESC)
              FROM public.client_feedback fb WHERE fb.item_id = ci.id
            ), '[]'::jsonb)
          ) AS item_obj
        FROM public.content_items ci
        WHERE ci.month_id = v_month_id AND ci.type IN ('post', 'reel') AND ci.deleted_at IS NULL
      ) sub
    ), '[]'::jsonb),
    'stories', COALESCE((
      SELECT jsonb_agg(item_obj ORDER BY sort_scheduled NULLS LAST, sort_idx)
      FROM (
        SELECT
          ci.scheduled_at AS sort_scheduled,
          ci.idx AS sort_idx,
          jsonb_build_object(
            'id', ci.id, 'type', ci.type, 'idx', ci.idx, 'title', ci.title,
            'caption', COALESCE(ci.caption, ''),
            'scheduled_at', ci.scheduled_at,
            'feed_order', ci.feed_order,
            'cover_path', ci.cover_path,
            'status', ci.status,
            'blocked_reason', ci.blocked_reason,
            'files', COALESCE((
              SELECT jsonb_agg(jsonb_build_object('id', f.id, 'drive_file_id', f.drive_file_id, 'mime_type', f.mime_type, 'web_view_url', f.web_view_url, 'sort_order', f.sort_order) ORDER BY f.sort_order, f.created_at)
              FROM public.item_files f WHERE f.item_id = ci.id AND f.kind = 'media'
            ), '[]'::jsonb),
            'feedback', COALESCE((
              SELECT jsonb_agg(jsonb_build_object('id', fb.id, 'author_name', fb.author_name, 'text', fb.text, 'created_at', fb.created_at) ORDER BY fb.created_at DESC)
              FROM public.client_feedback fb WHERE fb.item_id = ci.id
            ), '[]'::jsonb)
          ) AS item_obj
        FROM public.content_items ci
        WHERE ci.month_id = v_month_id AND ci.type = 'story' AND ci.deleted_at IS NULL
      ) sub
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$function$;

create or replace function public.send_daily_digest()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
      AND ci.status NOT IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO')
      AND ci.deleted_at IS NULL;

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

create or replace function public.send_deadline_reminders()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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
      AND ci.deleted_at IS NULL
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
