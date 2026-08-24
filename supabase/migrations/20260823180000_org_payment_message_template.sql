-- Mensagem de cobrança pelo WhatsApp (Plano e Cobrança > Pagamentos) era
-- fixa no código — a agência quer poder escrever a sua própria, com
-- placeholders pros dados do cliente/mês. Null continua caindo no texto
-- padrão de sempre.
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS payment_message_template text;
