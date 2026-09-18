-- Chat de suporte in-app ("Chat do Modo Criador") — responde dúvidas comuns
-- sozinho (base: FAQ/tutoriais da Central de Ajuda) e escala pro Junior
-- (in-app + e-mail) quando não sabe responder ou o usuário pede uma pessoa.
-- Mesmo padrão de RLS/notificação já usado em bug_reports: leitura/escrita
-- própria via RLS normal; leitura/escrita cross-org do dono da plataforma
-- vai por supabaseAdmin (service role) no server, nunca por RLS aberta.

CREATE TABLE public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'escalated', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_threads TO authenticated;
GRANT ALL ON public.support_threads TO service_role;
ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;
CREATE INDEX support_threads_user_idx ON public.support_threads(user_id, created_at DESC);

CREATE POLICY "user reads own support thread" ON public.support_threads FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "user creates own support thread" ON public.support_threads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND org_id = public.current_org_id());
-- A própria pessoa pode marcar a thread dela como escalada/reaberta (o
-- server faz isso em nome dela, com o client dela) — nunca dá acesso a
-- thread de outra pessoa, então é seguro liberar por RLS normal.
CREATE POLICY "user updates own support thread" ON public.support_threads FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'admin')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX support_messages_thread_idx ON public.support_messages(thread_id, created_at);

CREATE POLICY "user reads own support messages" ON public.support_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_threads st WHERE st.id = thread_id AND st.user_id = auth.uid()));
-- Só a própria pessoa pode inserir, e só como role='user' — a resposta da IA
-- e a resposta do admin sempre passam por supabaseAdmin no server (bypassa
-- RLS de propósito, depois de validar do lado do servidor), nunca por essa
-- policy — impede alguém forjar uma mensagem 'assistant'/'admin' via API direta.
CREATE POLICY "user inserts own support messages" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (
    role = 'user'
    AND EXISTS (SELECT 1 FROM public.support_threads st WHERE st.id = thread_id AND st.user_id = auth.uid())
  );

-- Lista pro Junior (Central de Ajuda → Chats): toda thread aberta/escalada
-- de qualquer agência, com nome/agência de quem perguntou e a última mensagem.
-- Mesmo padrão de platform_list_bug_reports.
CREATE OR REPLACE FUNCTION public.platform_list_support_threads()
RETURNS TABLE(
  id uuid, status text, created_at timestamptz, updated_at timestamptz,
  org_name text, user_name text, last_message text, last_message_role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT st.id, st.status, st.created_at, st.updated_at,
         o.name AS org_name, p.name AS user_name,
         lm.content AS last_message, lm.role AS last_message_role
  FROM public.support_threads st
  JOIN public.orgs o ON o.id = st.org_id
  JOIN public.profiles p ON p.id = st.user_id
  LEFT JOIN LATERAL (
    SELECT content, role FROM public.support_messages
    WHERE thread_id = st.id ORDER BY created_at DESC LIMIT 1
  ) lm ON true
  WHERE public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001'
    AND st.status <> 'closed'
  ORDER BY st.updated_at DESC;
$$;
REVOKE ALL ON FUNCTION public.platform_list_support_threads() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_list_support_threads() TO authenticated;

-- Todas as mensagens de UMA thread, pro Junior ler antes de responder.
CREATE OR REPLACE FUNCTION public.platform_get_support_messages(_thread_id uuid)
RETURNS TABLE(id uuid, role text, content text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT sm.id, sm.role, sm.content, sm.created_at
  FROM public.support_messages sm
  WHERE sm.thread_id = _thread_id
    AND public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001'
  ORDER BY sm.created_at;
$$;
REVOKE ALL ON FUNCTION public.platform_get_support_messages(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_get_support_messages(uuid) TO authenticated;

-- Avisa todo master da Luzeria quando uma thread vira 'escalated' (a IA não
-- soube responder ou a pessoa pediu um humano). Mesmo padrão de
-- notify_new_bug_report.
CREATE OR REPLACE FUNCTION public.notify_support_chat_escalated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec record;
  v_user_name text;
  v_org_name text;
BEGIN
  IF NEW.status = 'escalated' AND (OLD.status IS DISTINCT FROM 'escalated') THEN
    SELECT name INTO v_user_name FROM public.profiles WHERE id = NEW.user_id;
    SELECT name INTO v_org_name FROM public.orgs WHERE id = NEW.org_id;
    FOR rec IN
      SELECT ur.user_id FROM public.user_roles ur
      JOIN public.profiles p ON p.id = ur.user_id
      WHERE ur.role = 'master' AND p.org_id = '00000000-0000-0000-0000-000000000001'
    LOOP
      INSERT INTO public.notifications (user_id, type, message)
      VALUES (
        rec.user_id, 'support_chat_escalated',
        COALESCE(v_user_name, 'Alguém') || ' (' || COALESCE(v_org_name, 'agência') || ') precisa de ajuda no Chat do Modo Criador'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_support_chat_escalated ON public.support_threads;
CREATE TRIGGER trg_notify_support_chat_escalated
  AFTER UPDATE ON public.support_threads
  FOR EACH ROW EXECUTE FUNCTION public.notify_support_chat_escalated();

-- Avisa a própria pessoa quando o Junior responde pelo painel admin (o
-- insert da mensagem 'admin' já usa supabaseAdmin no server, então essa
-- notificação também é inserida por lá, direto no handler — não precisa de
-- trigger aqui).
