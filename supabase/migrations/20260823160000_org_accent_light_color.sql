-- Cor de destaque dos gráficos (donut do dashboard, linha de tendência) no
-- modo claro hoje é sempre derivada automaticamente (escurecendo a cor
-- principal da agência pra manter contraste em fundo claro) — nunca
-- escolhida diretamente. Esse campo deixa a agência sobrescrever isso.
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS color_accent_light text;
