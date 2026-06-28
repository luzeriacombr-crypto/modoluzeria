
-- =========== ENUMS ===========
CREATE TYPE public.app_role AS ENUM ('master', 'setor', 'member');
CREATE TYPE public.content_type AS ENUM ('post', 'reel');
CREATE TYPE public.content_status AS ENUM ('START','CRIACAO','REVISAO_ARTE','REVISAO_CLIENTE','FINALIZADO');

-- =========== PROFILES ===========
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#C8D44E',
  icon text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =========== USER_ROLES ===========
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('master','setor'))
$$;

CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'master')
$$;

-- =========== EMAIL ROLE PRE-ASSIGNMENT ===========
CREATE TABLE public.email_role_assignments (
  email text PRIMARY KEY,
  role public.app_role NOT NULL,
  name text NOT NULL
);
GRANT SELECT ON public.email_role_assignments TO authenticated;
GRANT ALL ON public.email_role_assignments TO service_role;
ALTER TABLE public.email_role_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone authenticated can read" ON public.email_role_assignments FOR SELECT TO authenticated USING (true);

INSERT INTO public.email_role_assignments (email, role, name) VALUES
  ('junior.reis@live.com', 'master', 'Júnior Reis'),
  ('jordania.agenda@gmail.com', 'setor', 'Jordania Carneiro Soares'),
  ('ribeiromoises123456789@gmail.com', 'setor', 'Moisés Aquino'),
  ('lucas@luzeria.com.br', 'member', 'Lucas Costa'),
  ('amarof43@gmail.com', 'member', 'Amaro');

-- =========== PROFILES POLICIES ===========
CREATE POLICY "all authenticated can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own basic profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "master can update any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

-- =========== USER_ROLES POLICIES ===========
CREATE POLICY "all authenticated read roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "master manages roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_master(auth.uid())) WITH CHECK (public.is_master(auth.uid()));

-- =========== HANDLE NEW USER ===========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  assigned_role public.app_role;
  assigned_name text;
BEGIN
  SELECT role, name INTO assigned_role, assigned_name
  FROM public.email_role_assignments WHERE lower(email) = lower(NEW.email);

  IF assigned_role IS NULL THEN
    assigned_role := 'member';
  END IF;
  IF assigned_name IS NULL THEN
    assigned_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  END IF;

  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, assigned_name);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========== CLIENTS ===========
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#C8D44E',
  icon text,
  favorite boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  niche text DEFAULT '',
  posts_per_week int DEFAULT 0,
  reels_per_week int DEFAULT 0,
  fixed_responsible_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_day text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage clients" ON public.clients FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========== MONTHS ===========
CREATE TABLE public.months (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.months TO authenticated;
GRANT ALL ON public.months TO service_role;
ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read months" ON public.months FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage months" ON public.months FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========== CONTENT ITEMS ===========
CREATE TABLE public.content_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_id uuid NOT NULL REFERENCES public.months(id) ON DELETE CASCADE,
  type public.content_type NOT NULL,
  idx int NOT NULL,
  title text NOT NULL DEFAULT '',
  status public.content_status NOT NULL DEFAULT 'START',
  copy text NOT NULL DEFAULT '',
  drive_link text NOT NULL DEFAULT '',
  legacy_assignee text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_items TO authenticated;
GRANT ALL ON public.content_items TO service_role;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read items" ON public.content_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage items" ON public.content_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_items_month ON public.content_items (month_id, type, idx);

-- =========== ITEM ASSIGNEES ===========
CREATE TABLE public.item_assignees (
  item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_assignees TO authenticated;
GRANT ALL ON public.item_assignees TO service_role;
ALTER TABLE public.item_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read assignees" ON public.item_assignees FOR SELECT TO authenticated USING (true);
CREATE POLICY "self assign" ON public.item_assignees FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "self unassign" ON public.item_assignees FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "admin assign any" ON public.item_assignees FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin unassign any" ON public.item_assignees FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- =========== COMMENTS ===========
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  text text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read comments" ON public.comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert own comments" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id OR is_system = true);
CREATE POLICY "admin delete comments" ON public.comments FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- =========== NOTIFICATIONS ===========
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  item_id uuid REFERENCES public.content_items(id) ON DELETE CASCADE,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "user updates own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "auth insert notifications" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_notif_user_unread ON public.notifications (user_id, read, created_at DESC);

-- =========== TRIGGERS: notifications + system comments ===========
CREATE OR REPLACE FUNCTION public.notify_on_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item_title text;
  actor_id uuid := auth.uid();
BEGIN
  IF NEW.user_id = actor_id THEN
    RETURN NEW; -- self-assign: no notification
  END IF;
  SELECT title INTO item_title FROM public.content_items WHERE id = NEW.item_id;
  INSERT INTO public.notifications (user_id, type, item_id, message)
  VALUES (NEW.user_id, 'assigned', NEW.item_id, 'Você foi atribuído a "' || COALESCE(item_title,'') || '"');
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_assignment AFTER INSERT ON public.item_assignees
FOR EACH ROW EXECUTE FUNCTION public.notify_on_assignment();

CREATE OR REPLACE FUNCTION public.on_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
$$;
CREATE TRIGGER trg_on_status_change BEFORE UPDATE ON public.content_items
FOR EACH ROW EXECUTE FUNCTION public.on_status_change();

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec record;
  item_title text;
BEGIN
  IF NEW.is_system THEN RETURN NEW; END IF;
  SELECT title INTO item_title FROM public.content_items WHERE id = NEW.item_id;
  FOR rec IN SELECT user_id FROM public.item_assignees WHERE item_id = NEW.item_id LOOP
    IF rec.user_id <> COALESCE(NEW.author_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, type, item_id, message)
      VALUES (rec.user_id, 'comment', NEW.item_id, 'Novo comentário em "' || COALESCE(item_title,'') || '"');
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_comment AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- =========== REALTIME ===========
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.content_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.item_assignees;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
