-- Guarda o assunto/mensagem editados no painel "Mensagens" (Planos e
-- Cobrança > platform-admin) como novo padrão de cada preset (ou do filtro
-- personalizado) — sem isso, toda edição se perdia ao trocar de aba/preset.
-- Só a Luzeria (dono da plataforma) usa essa tela, nunca uma agência comum.
CREATE TABLE public.message_templates (
  key text PRIMARY KEY CHECK (key IN ('noClients', 'fewClients', 'noTeam', 'custom')),
  subject text,
  body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de platform_admin_affiliate_programs_read: is_master +
-- org fixa da Luzeria, não is_master genérico (que também seria true pro
-- master de qualquer agência comum).
CREATE POLICY "platform_admin_message_templates_read" ON public.message_templates FOR SELECT
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "platform_admin_message_templates_write" ON public.message_templates FOR ALL
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');
