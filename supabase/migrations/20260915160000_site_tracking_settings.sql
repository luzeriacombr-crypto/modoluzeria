-- Configurações de rastreamento do site de vendas (Meta Pixel hoje, espaço
-- pra outros no futuro — Google Ads, GA4 etc.) — editável pelo Junior em
-- Configurações > Site, sem precisar de deploy a cada troca de pixel.
-- Mesmo padrão de RLS de sales_page_blocks (20260809090000): só o master
-- da própria Luzeria escreve; qualquer um lê (visitante anônimo do site de
-- vendas precisa do pixel ID pra carregar o script de rastreamento).
CREATE TABLE public.site_tracking_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.site_tracking_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_tracking_settings TO authenticated;
GRANT ALL ON public.site_tracking_settings TO service_role;
ALTER TABLE public.site_tracking_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon read tracking settings" ON public.site_tracking_settings FOR SELECT TO anon
  USING (true);

CREATE POLICY "auth read tracking settings" ON public.site_tracking_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "luzeria master manages tracking settings" ON public.site_tracking_settings FOR ALL TO authenticated
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');

-- Seed com o pixel já em uso (colocado direto no código antes desse painel existir).
INSERT INTO public.site_tracking_settings (key, value) VALUES
  ('meta_pixel_id', '"3556074894637223"'::jsonb)
ON CONFLICT (key) DO NOTHING;
