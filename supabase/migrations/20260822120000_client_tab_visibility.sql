-- Personalização de quais abas aparecem na página do cliente (Reels,
-- Finalizados, Mais, Preview de Feed — Posts e Ficha continuam sempre
-- visíveis). O padrão da agência já existia via orgs.disabled_features
-- (mesmo mecanismo que hoje esconde Stories/Biblioteca); isso só adiciona
-- a exceção por cliente: null = usa o padrão da agência, um array = essa
-- lista específica de abas ocultas pra esse cliente, sobrepõe o padrão.
ALTER TABLE public.clients ADD COLUMN hidden_tabs text[];
