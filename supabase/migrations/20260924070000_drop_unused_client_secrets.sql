-- "Senhas e acessos" (client_secrets) — checado com todas as agências:
-- zero linhas na tabela inteira, ninguém nunca usou desde que foi criada
-- (20260629015353...sql). Removido antes de virar dívida técnica, mesmo
-- padrão já usado antes pro sales_stages original (20260821140000...sql).
DROP TABLE IF EXISTS public.client_secrets;
