-- Afiliados (Fase 1, item "ligar o que já existe"): o admin da Luzeria
-- (dono da plataforma Modo Criador) precisa enxergar e marcar como paga a
-- comissão de afiliados de QUALQUER agência, não só da própria — hoje as
-- políticas de affiliate_programs/affiliate_referrals só liberam leitura
-- para o admin da MESMA org do afiliado (org_admin_affiliate_read /
-- org_admin_referral_read), então um afiliado de outra agência (ex: Orim)
-- ficava invisível pro admin da plataforma. Mesmo padrão já usado em
-- "luzeria manages orgs" (multi_tenant_rls_lote_a).
CREATE POLICY "platform_admin_affiliate_programs_read" ON public.affiliate_programs
  FOR SELECT USING (
    public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001'
  );

CREATE POLICY "platform_admin_affiliate_referrals_read" ON public.affiliate_referrals
  FOR SELECT USING (
    public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001'
  );

CREATE POLICY "platform_admin_affiliate_referrals_update" ON public.affiliate_referrals
  FOR UPDATE USING (
    public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001'
  ) WITH CHECK (
    public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001'
  );
