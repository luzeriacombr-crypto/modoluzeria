-- Campanhas ganham cara de "projeto" — pedido de um cliente que fecha
-- trabalhos avulsos (ex.: cobertura de evento) e queria registrar o
-- briefing completo, o que vai ser produzido, o que vai ser prestado de
-- serviço, e quanto foi cobrado, tudo dentro da mesma campanha que já
-- agrupa os itens de conteúdo daquele trabalho.
ALTER TABLE public.campaigns
  ADD COLUMN briefing text,
  ADD COLUMN materials text,
  ADD COLUMN services text,
  ADD COLUMN value_cents integer;
