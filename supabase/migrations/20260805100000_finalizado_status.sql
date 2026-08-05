-- Pedido da Orim: um status "Finalizado" pra depois de "Pronto para
-- publicar" — some da grade de Posts/Reels (mantém o board limpo) mas
-- continua aparecendo no Preview de Feed. Precisa ser sua própria migration:
-- Postgres não deixa usar um valor de enum recém-adicionado na mesma
-- transação que o cria (a próxima migration, que referencia FINALIZADO em
-- funções/triggers, precisa rodar depois desta, separada).
ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'FINALIZADO';
