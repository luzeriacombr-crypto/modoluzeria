-- Marca o último nível (índice em THRESHOLDS, agency-level.ts) que a
-- agência já viu comemorado num pop-up de "subiu de nível". NULL = ainda
-- não inicializado — a primeira checagem depois do deploy só grava o
-- nível atual, sem disparar popup (evita uma falsa comemoração pra
-- agências que já estavam num nível alto antes dessa feature existir).
ALTER TABLE public.orgs ADD COLUMN last_seen_level_index integer;
