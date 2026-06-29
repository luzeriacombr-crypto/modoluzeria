
-- Fase 1: Ficha do Cliente + Prazos + Lead Time + Status Bloqueado

-- 1) clients: description
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

-- 2) content_items: due_date, started_at, finished_at, blocked_reason
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_reason text;

-- 3) Novo status BLOQUEADO
ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'BLOQUEADO';

-- 4) client_links
CREATE TABLE IF NOT EXISTS public.client_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  link_type text NOT NULL DEFAULT 'other',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_links TO authenticated;
GRANT ALL ON public.client_links TO service_role;
ALTER TABLE public.client_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read client_links" ON public.client_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage client_links" ON public.client_links FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS client_links_client_idx ON public.client_links(client_id);

-- 5) client_contacts
CREATE TABLE IF NOT EXISTS public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contacts TO authenticated;
GRANT ALL ON public.client_contacts TO service_role;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read client_contacts" ON public.client_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage client_contacts" ON public.client_contacts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS client_contacts_client_idx ON public.client_contacts(client_id);

-- 6) client_secrets (apenas Master/Setor)
CREATE TABLE IF NOT EXISTS public.client_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label text NOT NULL,
  value text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_secrets TO authenticated;
GRANT ALL ON public.client_secrets TO service_role;
ALTER TABLE public.client_secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read client_secrets" ON public.client_secrets FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
CREATE POLICY "admin manage client_secrets" ON public.client_secrets FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS client_secrets_client_idx ON public.client_secrets(client_id);

-- 7) Trigger para registrar started_at e finished_at automaticamente
CREATE OR REPLACE FUNCTION public.track_lead_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- started_at: ao sair de PLANEJAMENTO pela primeira vez
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'PLANEJAMENTO' AND NEW.status <> 'PLANEJAMENTO' AND NEW.started_at IS NULL THEN
      NEW.started_at := now();
    END IF;
    -- finished_at: ao virar FINALIZADO
    IF NEW.status = 'FINALIZADO' AND OLD.status <> 'FINALIZADO' THEN
      NEW.finished_at := now();
    END IF;
    -- reset finished_at se sair de FINALIZADO
    IF OLD.status = 'FINALIZADO' AND NEW.status <> 'FINALIZADO' THEN
      NEW.finished_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_track_lead_time ON public.content_items;
CREATE TRIGGER trg_track_lead_time
  BEFORE UPDATE ON public.content_items
  FOR EACH ROW EXECUTE FUNCTION public.track_lead_time();
