-- Quanto a própria plataforma (Vercel, Supabase, Backblaze, Resend, Claude
-- Code etc.) custa pra rodar por mês — lançado à mão por Junior, pra
-- comparar contra a receita das agências em "Plano e Cobrança". Não tem
-- org_id porque não é dado de nenhuma agência, é custo interno da
-- Luzeria/Modo Criador. RLS ligado sem nenhuma policy — só service role
-- acessa (mesmo padrão de demo_requests), o gate real é LUZERIA_ORG_ID +
-- is_master dentro das funções de servidor.
CREATE TABLE public.platform_operating_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'BRL')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_operating_costs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_platform_operating_costs_created_at ON public.platform_operating_costs (created_at DESC);

-- Valores de partida — os mesmos que Junior conferiu nos dashboards de cada
-- serviço em 23/09/2026. Ficam aqui só como ponto de partida; o valor real
-- é o que estiver na tabela, não o que o comentário diz.
INSERT INTO public.platform_operating_costs (name, amount_cents, currency, notes) VALUES
  ('Vercel', 2969, 'USD', 'Pro plan + on-demand — ciclo 04/09 a 04/10'),
  ('Supabase', 3000, 'USD', 'Custo do ciclo até 23/09 — projeção do ciclo inteiro: US$ 39,33'),
  ('Backblaze B2', 0, 'USD', 'Estimativa do ciclo atual — ainda dentro do free tier'),
  ('Resend', 0, 'USD', 'Plano free — bem abaixo do limite'),
  ('Claude Code', 79990, 'BRL', 'Assinatura mensal');
