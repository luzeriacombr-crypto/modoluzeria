-- House: metas por dia de conversas e agendamentos, histórico de metas por
-- mês, novas origens de lead, quem agendou, scripts de conversa, lembretes
-- de story, aviso do prazo do planejamento, teto mensal de IA grátis e três
-- páginas novas no Playbook. Tudo aditivo (o código antigo continua rodando).

/* ===== 1. Metas por dia útil + horários de lembrete ===== */
ALTER TABLE public.house_settings ADD COLUMN IF NOT EXISTS leads_per_workday int NOT NULL DEFAULT 0 CHECK (leads_per_workday BETWEEN 0 AND 500);
ALTER TABLE public.house_settings ADD COLUMN IF NOT EXISTS scheduled_per_workday int NOT NULL DEFAULT 0 CHECK (scheduled_per_workday BETWEEN 0 AND 200);
ALTER TABLE public.house_settings ADD COLUMN IF NOT EXISTS story_reminder_hours int[] NOT NULL DEFAULT '{}';
ALTER TABLE public.house_brand_settings ADD COLUMN IF NOT EXISTS leads_per_workday int NOT NULL DEFAULT 0 CHECK (leads_per_workday BETWEEN 0 AND 500);
ALTER TABLE public.house_brand_settings ADD COLUMN IF NOT EXISTS scheduled_per_workday int NOT NULL DEFAULT 0 CHECK (scheduled_per_workday BETWEEN 0 AND 200);

/* ===== 2. Histórico de metas por mês ===== */
CREATE TABLE IF NOT EXISTS public.house_goal_history (
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  month_key text NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
  stories_per_workday int NOT NULL,
  feed_posts_per_week int NOT NULL,
  leads_goal_month int NOT NULL,
  scheduled_goal_month int NOT NULL,
  leads_per_workday int NOT NULL DEFAULT 0,
  scheduled_per_workday int NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, month_key)
);
GRANT SELECT ON public.house_goal_history TO authenticated;
GRANT ALL ON public.house_goal_history TO service_role;
ALTER TABLE public.house_goal_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "goal history read" ON public.house_goal_history;
CREATE POLICY "goal history read" ON public.house_goal_history FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()) AND public.has_client_access(auth.uid(), client_id));

/* ===== 3. Origens novas de lead + quem agendou ===== */
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.instagram_leads'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ILIKE '%origin%'
  LOOP
    EXECUTE format('ALTER TABLE public.instagram_leads DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
ALTER TABLE public.instagram_leads ADD CONSTRAINT instagram_leads_origin_check
  CHECK (origin IN ('story', 'caixinha', 'comentario', 'direct', 'anuncio', 'prospeccao', 'indicacao', 'offline', 'outro'));
ALTER TABLE public.instagram_leads ADD COLUMN IF NOT EXISTS scheduled_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

/* ===== 4. Scripts de conversa (gerados pela IA, um conjunto por marca) ===== */
CREATE TABLE IF NOT EXISTS public.house_lead_scripts (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  scripts jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.house_lead_scripts TO authenticated;
GRANT ALL ON public.house_lead_scripts TO service_role;
ALTER TABLE public.house_lead_scripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lead scripts read" ON public.house_lead_scripts;
CREATE POLICY "lead scripts read" ON public.house_lead_scripts FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()) AND public.has_client_access(auth.uid(), client_id));

/* ===== 5. Uso de IA grátis por mês (teto do teste) ===== */
CREATE TABLE IF NOT EXISTS public.org_ai_usage (
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  month_key text NOT NULL,
  generations int NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, month_key)
);
ALTER TABLE public.org_ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_ai_usage FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.org_ai_usage TO service_role;

/* ===== 6. Lembretes: stories do dia e prazo do planejamento ===== */
CREATE OR REPLACE FUNCTION public.notify_house_story_reminders()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamp := now() AT TIME ZONE 'America/Sao_Paulo';
  v_hour int := EXTRACT(HOUR FROM v_now)::int;
  v_isodow int := EXTRACT(ISODOW FROM v_now)::int;
  v_count int := 0;
  rec record;
  v_goal int;
BEGIN
  IF v_isodow > 5 THEN RETURN 0; END IF;
  FOR rec IN
    SELECT s.org_id, s.stories_per_workday, o.house_client_id
      FROM public.house_settings s
      JOIN public.orgs o ON o.id = s.org_id AND o.account_type = 'house'
     WHERE v_hour = ANY (s.story_reminder_hours)
  LOOP
    -- Meta total do dia: soma das marcas (cada uma com a meta própria, a principal com a da House).
    SELECT COALESCE(SUM(COALESCE(b.stories_per_workday, CASE WHEN c.id = rec.house_client_id THEN rec.stories_per_workday ELSE 3 END)), rec.stories_per_workday)
      INTO v_goal
      FROM public.clients c
      LEFT JOIN public.house_brand_settings b ON b.client_id = c.id
     WHERE c.org_id = rec.org_id AND NOT c.archived AND c.category <> 'Ex-clientes';
    INSERT INTO public.notifications (user_id, type, message)
    SELECT p.id, 'house_story_reminder',
           'Hora de postar: a meta de hoje é de ' || v_goal || ' stories. Abra o Meu dia pra registrar e pegar ideias.'
      FROM public.profiles p WHERE p.org_id = rec.org_id AND p.active;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_house_story_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_house_story_reminders() TO service_role;

CREATE OR REPLACE FUNCTION public.notify_house_planning_deadline()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_month_start date := date_trunc('month', v_today)::date;
  v_next_key text := to_char(v_month_start + interval '1 month', 'YYYY-MM');
  v_last_day int := EXTRACT(DAY FROM (v_month_start + interval '1 month - 1 day'))::int;
  v_months text[] := ARRAY['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  v_count int := 0;
  v_deadline date;
  v_days int;
  rec record;
BEGIN
  FOR rec IN
    SELECT s.org_id, s.planning_deadline_day, o.created_at
      FROM public.house_settings s
      JOIN public.orgs o ON o.id = s.org_id AND o.account_type = 'house'
  LOOP
    v_deadline := make_date(EXTRACT(YEAR FROM v_today)::int, EXTRACT(MONTH FROM v_today)::int, LEAST(rec.planning_deadline_day, v_last_day));
    v_days := v_deadline - v_today;
    CONTINUE WHEN v_days NOT IN (15, 7, 2, 0);
    CONTINUE WHEN (rec.created_at AT TIME ZONE 'America/Sao_Paulo')::date > v_deadline;
    -- Já entregue? (planejamento/roteiro pro mês seguinte, ou um planejamento escrito neste mês)
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.client_docs d
       WHERE d.org_id = rec.org_id
         AND (d.target_month_key = v_next_key OR (d.type = 'planejamento' AND d.created_at >= v_month_start))
    );
    INSERT INTO public.notifications (user_id, type, message)
    SELECT p.id, 'house_planning_deadline',
           CASE v_days
             WHEN 0 THEN 'Hoje é o prazo do planejamento de ' || v_months[EXTRACT(MONTH FROM v_month_start + interval '1 month')::int] || '.'
             ELSE 'Faltam ' || v_days || ' dias pro prazo do planejamento de ' || v_months[EXTRACT(MONTH FROM v_month_start + interval '1 month')::int] || '. Já dá pra pensar em eventos, datas e campanhas.'
           END
      FROM public.profiles p WHERE p.org_id = rec.org_id AND p.active;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_house_planning_deadline() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_house_planning_deadline() TO service_role;

DO $$
DECLARE jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN ('house-story-reminders', 'house-planning-deadline') LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;
-- Toda hora cheia (o horário certo da House é conferido dentro da função); 11:00 UTC = 8h de Brasília.
SELECT cron.schedule('house-story-reminders', '0 * * * *', $$SELECT public.notify_house_story_reminders();$$);
SELECT cron.schedule('house-planning-deadline', '0 11 * * *', $$SELECT public.notify_house_planning_deadline();$$);

/* ===== 7. Playbook: três páginas novas (modelo + Houses que já existem) ===== */
CREATE TEMP TABLE _new_playbook_pages (section_title text, title text, summary text, content text);
INSERT INTO _new_playbook_pages VALUES
('Stories', 'Stories que quem é de fora entende', 'Qualidade antes de quantidade: o teste de quem não é da equipe.', $md$
## O teste

Antes de postar, pergunte: **quem não trabalha aqui entenderia esse story?** Se a resposta é não, ele é conversa interna, e o público de fora passa direto.

## O que evitar

- Selfie com a equipe e uma frase solta, sem contexto do que está acontecendo.
- Repost de conteúdo de outras páginas só pra bater a meta.
- Story sem pergunta, sem convite e sem motivo pra alguém responder.

## O que funciona

- Mostrar o que está acontecendo agora e **por que isso importa pro paciente ou cliente**.
- Trazer o público pra conversa: enquete, caixinha de perguntas, "me manda X".
- Uma pessoa falando direto pra câmera sobre uma dúvida que o público realmente tem.
- Uma sequência curta (3 a 5 stories) com começo, meio e chamada pra agendar.

## Meta e qualidade

A meta de stories é um mínimo de **bons** stories por dia, não de qualquer story. Bater a meta com repost cumpre o número, mas não traz conversa nem agendamento.
$md$),
('Abordagem de Leads', 'Meta do dia: conversas e agendamentos', 'Quantas conversas abrir, quantos agendamentos trazer e como se organizar pra chegar lá.', $md$
## Como a meta funciona

Cada pessoa que responde um story, comenta ou chama no direct é uma **conversa**. Registre todas em Leads (botão "+ Lead"), com a origem certa. A meta do dia tem dois números: conversas abertas e agendamentos fechados.

## Quem conversa também agenda

O objetivo é **converter**: quem abre a conversa conduz até o agendamento, sem passar pra recepção no meio do caminho. Passar o bastão no meio dilui o resultado e ninguém sabe de quem foi o mérito.

## Ritmo do dia

- **Manhã:** responder os directs que ficaram pendentes e retomar as conversas de ontem.
- **Meio do dia:** olhar respostas de story e comentários, e puxar conversa.
- **Fim do dia:** cobrar quem esfriou e registrar o resultado de cada conversa.

## Como agendar

Ofereça sempre **dois horários** em vez de perguntar "quando você pode?". Peça o WhatsApp assim que a conversa esquentar e confirme o agendamento no dia anterior.

## Acompanhe no Meu dia

Em Meu dia aparece quantas conversas e quantos agendamentos já saíram hoje. Se no meio da tarde está longe da meta, priorize as conversas que já estão quentes antes de abrir novas.
$md$),
('Abordagem de Leads', 'Prospecção ativa: buscar quem ainda não conhece', 'Como abordar pessoas frias sem parecer spam.', $md$
## Por que fazer

Quem chega pelo anúncio já está procurando. Quem ainda não conhece é o público que **faz a marca crescer**. Vale reservar parte do dia pra ir atrás dele.

## Onde procurar

- Quem comenta e curte páginas locais do mesmo público (sem ser concorrente direto).
- Quem interage com os stories mas nunca chamou no direct.
- Indicações de quem já é cliente.

## Como abordar

1. Comece pela pessoa, não pela venda: um comentário real sobre algo que ela postou ou perguntou.
2. Uma pergunta simples que dê vontade de responder.
3. Só depois de resposta, apresente o que a marca faz e o próximo passo.

## Registre a origem

Cadastre o lead com a origem **Prospecção ativa** (ou Indicação, ou Rua / offline). Assim o relatório mostra quantos agendamentos vieram de gente fria e quantos de gente que já chegou quente.
$md$);

-- Modelo global (org_id NULL)
INSERT INTO public.playbook_pages (org_id, section_id, title, summary, content, checklist, step_keys, sort_order)
SELECT NULL, s.id, n.title, n.summary, btrim(n.content, E'\n '), '[]'::jsonb, '{}',
       COALESCE((SELECT max(p.sort_order) FROM public.playbook_pages p WHERE p.section_id = s.id), -1) + 1
  FROM _new_playbook_pages n
  JOIN public.playbook_sections s ON s.org_id IS NULL AND s.title = n.section_title
 WHERE NOT EXISTS (SELECT 1 FROM public.playbook_pages p WHERE p.section_id = s.id AND p.title = n.title);

-- Houses que já têm playbook próprio
INSERT INTO public.playbook_pages (org_id, section_id, title, summary, content, checklist, step_keys, sort_order)
SELECT s.org_id, s.id, n.title, n.summary, btrim(n.content, E'\n '), '[]'::jsonb, '{}',
       COALESCE((SELECT max(p.sort_order) FROM public.playbook_pages p WHERE p.section_id = s.id), -1) + 1
  FROM _new_playbook_pages n
  JOIN public.playbook_sections s ON s.org_id IS NOT NULL AND s.title = n.section_title
  JOIN public.orgs o ON o.id = s.org_id AND o.account_type = 'house'
 WHERE NOT EXISTS (SELECT 1 FROM public.playbook_pages p WHERE p.section_id = s.id AND p.title = n.title);
