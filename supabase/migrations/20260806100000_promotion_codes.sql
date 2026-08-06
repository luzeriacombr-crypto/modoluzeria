-- Promotion codes (cupons)
CREATE TABLE public.promotion_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  slug text NOT NULL, -- URL-friendly identifier (e.g., 'orim', 'friend-special')
  discount_percent numeric NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  description text,
  active boolean NOT NULL DEFAULT true,
  valid_from timestamp with time zone DEFAULT now(),
  valid_until timestamp with time zone,
  max_uses integer, -- NULL = unlimited
  used_count integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(org_id, slug),
  UNIQUE(org_id, code)
);

CREATE INDEX idx_promotion_codes_org_id ON public.promotion_codes(org_id);
CREATE INDEX idx_promotion_codes_slug ON public.promotion_codes(org_id, slug);
CREATE INDEX idx_promotion_codes_active ON public.promotion_codes(org_id, active);

-- Enable RLS
ALTER TABLE public.promotion_codes ENABLE ROW LEVEL SECURITY;

-- Only org admins can see/edit promo codes
CREATE POLICY "org_admin_promo_read" ON public.promotion_codes
  FOR SELECT USING (
    EXISTS(SELECT 1 FROM public.org_members om
      WHERE om.org_id = promotion_codes.org_id AND om.user_id = auth.uid() AND om.is_master)
  );

CREATE POLICY "org_admin_promo_insert" ON public.promotion_codes
  FOR INSERT WITH CHECK (
    org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid() AND is_master)
  );

CREATE POLICY "org_admin_promo_update" ON public.promotion_codes
  FOR UPDATE USING (
    EXISTS(SELECT 1 FROM public.org_members om
      WHERE om.org_id = promotion_codes.org_id AND om.user_id = auth.uid() AND om.is_master)
  );

CREATE POLICY "org_admin_promo_delete" ON public.promotion_codes
  FOR DELETE USING (
    EXISTS(SELECT 1 FROM public.org_members om
      WHERE om.org_id = promotion_codes.org_id AND om.user_id = auth.uid() AND om.is_master)
  );

-- Public table for validating codes (anyone can check if a code is valid)
CREATE TABLE public.promotion_code_validations AS
  SELECT id, org_id, discount_percent, active, valid_from, valid_until, max_uses, used_count
  FROM public.promotion_codes WHERE FALSE;

ALTER TABLE public.promotion_code_validations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_validate_promo" ON public.promotion_code_validations
  FOR SELECT USING (true);

-- Trigger to sync public view
CREATE OR REPLACE FUNCTION sync_promotion_code_validations()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.promotion_code_validations WHERE id = NEW.id OR id = OLD.id;
  INSERT INTO public.promotion_code_validations
    SELECT id, org_id, discount_percent, active, valid_from, valid_until, max_uses, used_count
    FROM public.promotion_codes WHERE id = NEW.id OR id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_promotion_codes
AFTER INSERT OR UPDATE OR DELETE ON public.promotion_codes
FOR EACH ROW EXECUTE FUNCTION sync_promotion_code_validations();
