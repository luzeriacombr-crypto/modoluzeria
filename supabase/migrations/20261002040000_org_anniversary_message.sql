-- Mensagem de aniversário de casa (editável pelo Adm Master) mostrada em
-- Minhas Demandas no dia em que a pessoa completa 1, 2, 3... anos de
-- agência (profiles.joined_at). NULL = texto padrão. Pedido do Junior (02/10).
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS anniversary_message text;
