-- Throttla o Chat do Modo Criador na página pública de vendas (/assinar) por
-- IP — é um endpoint sem login, então precisa de limite de verdade, mesmo
-- padrão de signup_attempts. Escrito/lido só pelo client de service-role
-- dentro de sendPublicSalesMessage(), então default-deny pra anon/authenticated
-- é o certo aqui (sem GRANT nenhum pra eles).
CREATE TABLE public.public_sales_chat_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_public_sales_chat_attempts_ip_time ON public.public_sales_chat_attempts(ip, created_at);
GRANT ALL ON public.public_sales_chat_attempts TO service_role;
ALTER TABLE public.public_sales_chat_attempts ENABLE ROW LEVEL SECURITY;
