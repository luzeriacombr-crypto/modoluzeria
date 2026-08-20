-- Personalização do Dashboard: posição/tamanho dos cards (arrastar/
-- redimensionar, guardado por org) e cores próprias do degradê do
-- cabeçalho (em vez de sempre derivar da cor principal/barra lateral).
ALTER TABLE public.orgs ADD COLUMN dashboard_layout jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.orgs ADD COLUMN hero_gradient_from text;
ALTER TABLE public.orgs ADD COLUMN hero_gradient_to text;
