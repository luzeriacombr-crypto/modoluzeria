-- "Finalizados" pode ficar junto (fita "Publicado" no card, padrão desde
-- ontem) ou em aba separada (comportamento antigo) — vira escolha de cada
-- agência em Configurações → Geral, não mais um comportamento único fixo
-- pro app inteiro. Default false (mantém o padrão novo pra quem não mexer).
ALTER TABLE public.orgs ADD COLUMN finalizados_separate_tab boolean NOT NULL DEFAULT false;
