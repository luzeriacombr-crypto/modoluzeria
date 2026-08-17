-- Fórum entre agências: espaço de discussão cross-tenant, uma exceção
-- deliberada ao isolamento por org_id que o resto do app segue à risca.
-- Só masters leem e escrevem; moderar (fixar/apagar) é exclusivo do
-- platform admin (org Luzeria). Categorias são curadas só pelo platform
-- admin, não por agência.

CREATE TABLE public.forum_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'MessageCircle',
  color text NOT NULL DEFAULT '#5BA88A',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forum_categories TO authenticated;
GRANT ALL ON public.forum_categories TO service_role;
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forum_categories_read_masters" ON public.forum_categories FOR SELECT TO authenticated
  USING (public.is_master(auth.uid()));

CREATE POLICY "forum_categories_platform_admin_write" ON public.forum_categories FOR ALL TO authenticated
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');

INSERT INTO public.forum_categories (name, description, icon, color, sort_order) VALUES
  ('Operação e processos', 'Fluxo de trabalho, prazos, aprovação e organização do dia a dia.', 'Cog', '#4A9EFF', 1),
  ('Clientes e cases', 'Briefing, relacionamento e cases de clientes.', 'Users', '#C8D44E', 2),
  ('Ferramentas e IA', 'Apps, automações e inteligência artificial no dia a dia da agência.', 'Sparkles', '#B392F0', 3),
  ('Financeiro', 'Precificação, cobrança e contratos.', 'Wallet', '#FF8C42', 4),
  ('Vitrine', 'Mostre o que sua agência entregou.', 'LayoutGrid', '#E76F51', 5),
  ('Geral', 'Tudo o que não se encaixa nas outras categorias.', 'MessageCircle', '#5BA88A', 6);

CREATE TABLE public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  category_id uuid NOT NULL REFERENCES public.forum_categories(id),
  title text NOT NULL,
  body text NOT NULL,
  link_url text,
  pinned boolean NOT NULL DEFAULT false,
  reply_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.forum_posts TO authenticated;
GRANT ALL ON public.forum_posts TO service_role;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_forum_posts_category ON public.forum_posts(category_id);
CREATE INDEX idx_forum_posts_org ON public.forum_posts(org_id);

CREATE POLICY "forum_posts_insert_own" ON public.forum_posts FOR INSERT TO authenticated
  WITH CHECK (public.is_master(auth.uid()) AND org_id = public.current_org_id() AND author_id = auth.uid());

CREATE POLICY "forum_posts_read_masters" ON public.forum_posts FOR SELECT TO authenticated
  USING (
    public.is_master(auth.uid())
    AND (deleted_at IS NULL OR public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  );

CREATE POLICY "forum_posts_platform_admin_moderate" ON public.forum_posts FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');

CREATE TABLE public.forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.forum_replies TO authenticated;
GRANT ALL ON public.forum_replies TO service_role;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_forum_replies_post ON public.forum_replies(post_id);

CREATE POLICY "forum_replies_insert_own" ON public.forum_replies FOR INSERT TO authenticated
  WITH CHECK (public.is_master(auth.uid()) AND org_id = public.current_org_id() AND author_id = auth.uid());

CREATE POLICY "forum_replies_read_masters" ON public.forum_replies FOR SELECT TO authenticated
  USING (
    public.is_master(auth.uid())
    AND (deleted_at IS NULL OR public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  );

CREATE POLICY "forum_replies_platform_admin_moderate" ON public.forum_replies FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');

-- reply_count denormalizado (evita contar em toda listagem) + notifica o
-- autor do post quando alguém responde (exceto se ele mesmo responder).
CREATE OR REPLACE FUNCTION public.on_forum_reply_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_post_author uuid;
  v_post_title text;
  v_replier_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_posts SET reply_count = reply_count + 1 WHERE id = NEW.post_id
      RETURNING author_id, title INTO v_post_author, v_post_title;
    IF v_post_author IS NOT NULL AND v_post_author <> NEW.author_id THEN
      SELECT name INTO v_replier_name FROM public.profiles WHERE id = NEW.author_id;
      INSERT INTO public.notifications (user_id, type, message)
      VALUES (v_post_author, 'forum_reply', COALESCE(v_replier_name, 'Alguém') || ' respondeu seu post "' || COALESCE(v_post_title, '') || '"');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    UPDATE public.forum_posts SET reply_count = GREATEST(0, reply_count - 1) WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_forum_reply_change ON public.forum_replies;
CREATE TRIGGER trg_forum_reply_change
  AFTER INSERT OR UPDATE ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.on_forum_reply_change();

-- profiles/orgs são RLS-scoped por org — pra listar autor/agência de posts
-- de OUTRAS agências (o ponto inteiro do fórum), essas três funções fazem
-- o join explicitamente como SECURITY DEFINER, gated só por is_master(),
-- mesmo padrão já usado em platform_list_bug_reports.
CREATE OR REPLACE FUNCTION public.list_forum_posts(_category_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid, category_id uuid, title text, body text, link_url text,
  pinned boolean, reply_count integer, created_at timestamptz,
  author_id uuid, author_name text, org_id uuid, org_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.category_id, p.title, p.body, p.link_url, p.pinned, p.reply_count, p.created_at,
         p.author_id, pr.name, p.org_id, o.name
  FROM public.forum_posts p
  JOIN public.profiles pr ON pr.id = p.author_id
  JOIN public.orgs o ON o.id = p.org_id
  WHERE public.is_master(auth.uid())
    AND p.deleted_at IS NULL
    AND (_category_id IS NULL OR p.category_id = _category_id)
  ORDER BY p.pinned DESC, p.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.list_forum_posts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_forum_posts(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_forum_post(_post_id uuid)
RETURNS TABLE(
  id uuid, category_id uuid, title text, body text, link_url text,
  pinned boolean, reply_count integer, created_at timestamptz,
  author_id uuid, author_name text, org_id uuid, org_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT p.id, p.category_id, p.title, p.body, p.link_url, p.pinned, p.reply_count, p.created_at,
         p.author_id, pr.name, p.org_id, o.name
  FROM public.forum_posts p
  JOIN public.profiles pr ON pr.id = p.author_id
  JOIN public.orgs o ON o.id = p.org_id
  WHERE public.is_master(auth.uid()) AND p.id = _post_id AND p.deleted_at IS NULL;
$$;
REVOKE ALL ON FUNCTION public.get_forum_post(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_forum_post(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_forum_replies(_post_id uuid)
RETURNS TABLE(
  id uuid, body text, created_at timestamptz,
  author_id uuid, author_name text, org_id uuid, org_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.id, r.body, r.created_at, r.author_id, pr.name, r.org_id, o.name
  FROM public.forum_replies r
  JOIN public.profiles pr ON pr.id = r.author_id
  JOIN public.orgs o ON o.id = r.org_id
  WHERE public.is_master(auth.uid()) AND r.post_id = _post_id AND r.deleted_at IS NULL
  ORDER BY r.created_at ASC;
$$;
REVOKE ALL ON FUNCTION public.list_forum_replies(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_forum_replies(uuid) TO authenticated;
