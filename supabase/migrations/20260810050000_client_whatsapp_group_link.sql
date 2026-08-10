-- Muitas agências já falam com o cliente por um GRUPO de WhatsApp, não com
-- um contato individual. Quando esse link existir, a mensagem da etapa deve
-- ir pra lá em vez do número pessoal de algum contato.
ALTER TABLE public.clients
  ADD COLUMN whatsapp_group_link text;
