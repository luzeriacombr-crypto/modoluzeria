-- Revenda white label — Fase 1 (estrutura, sem UI ainda). Plano combinado
-- com o Junior: atacado fixo, 60% de desconto sobre a tabela, revendedor
-- aprovado manualmente pela Luzeria, convivendo com o Programa de Afiliados
-- já existente (nada é removido).

ALTER TABLE public.orgs ADD COLUMN is_reseller boolean NOT NULL DEFAULT false;
ALTER TABLE public.orgs ADD COLUMN reseller_org_id uuid REFERENCES public.orgs(id);
ALTER TABLE public.orgs ADD CONSTRAINT orgs_reseller_not_self CHECK (reseller_org_id IS NULL OR reseller_org_id <> id);
CREATE INDEX idx_orgs_reseller_org ON public.orgs(reseller_org_id) WHERE reseller_org_id IS NOT NULL;

-- Preço de atacado por revendedor + plano. Nasce vazia — a Luzeria semeia
-- uma linha por plano (60% off a tabela: Solo R$20, Pro R$36, Agência R$60)
-- na hora de aprovar cada revendedor nomeado, o que também deixa margem pra
-- negociar um desconto diferente caso a caso sem mexer em código.
CREATE TABLE public.reseller_wholesale_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.plans(id),
  wholesale_price_cents integer NOT NULL CHECK (wholesale_price_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reseller_org_id, plan_id)
);
GRANT SELECT ON public.reseller_wholesale_prices TO authenticated;
GRANT ALL ON public.reseller_wholesale_prices TO service_role;
ALTER TABLE public.reseller_wholesale_prices ENABLE ROW LEVEL SECURITY;

-- Só a Luzeria define/edita preço de atacado — mesmo padrão já usado pra
-- tabela de planos ("luzeria manages plans").
CREATE POLICY "luzeria manages wholesale prices" ON public.reseller_wholesale_prices FOR ALL TO authenticated
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');

-- Cada revendedor lê só o próprio preço de atacado (pra UI calcular a
-- própria fatura) — nunca o de outro revendedor.
CREATE POLICY "reseller reads own wholesale prices" ON public.reseller_wholesale_prices FOR SELECT TO authenticated
  USING (public.is_master(auth.uid()) AND reseller_org_id = public.current_org_id());

-- RLS de orgs: um revendedor aprovado (is_reseller = true na própria linha)
-- pode criar/ler/atualizar SÓ as orgs que ele mesmo revendeu
-- (reseller_org_id = a própria org dele) — nunca outro revendedor, nunca
-- cliente direto, nunca a Luzeria. Fica deliberadamente separada de
-- "luzeria manages orgs"/"org master updates own org" (nenhuma das duas
-- cobre "gerenciar orgs de terceiros que não sejam a Luzeria"), seguindo o
-- padrão do incidente de RLS cross-org já corrigido nesta agência: sempre
-- checar o org-alvo explicitamente, nunca só o papel da pessoa.
CREATE POLICY "reseller manages resold orgs" ON public.orgs FOR ALL TO authenticated
  USING (
    public.is_master(auth.uid())
    AND reseller_org_id IS NOT NULL
    AND reseller_org_id = public.current_org_id()
    AND EXISTS (SELECT 1 FROM public.orgs me WHERE me.id = public.current_org_id() AND me.is_reseller = true)
  )
  WITH CHECK (
    public.is_master(auth.uid())
    AND reseller_org_id IS NOT NULL
    AND reseller_org_id = public.current_org_id()
    AND EXISTS (SELECT 1 FROM public.orgs me WHERE me.id = public.current_org_id() AND me.is_reseller = true)
  );
