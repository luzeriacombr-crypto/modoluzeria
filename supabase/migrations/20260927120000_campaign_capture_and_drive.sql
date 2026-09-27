-- Pedido do Junior: 1) data de captação da campanha vira demanda de verdade
-- (item ligado à campanha, com responsáveis) que já aparece em Minhas
-- Demandas; 2) essa data também vira evento na Google Agenda pessoal de
-- cada responsável (reaproveitando a conexão que já existe em Perfil);
-- 3) link da pasta do Drive guardado na própria campanha.

ALTER TABLE public.campaigns
  ADD COLUMN drive_folder_url text,
  ADD COLUMN capture_date date,
  ADD COLUMN capture_item_id uuid REFERENCES public.content_items(id) ON DELETE SET NULL;

-- Guarda o evento do Google Agenda criado por responsável, pra próxima
-- edição da data ATUALIZAR o mesmo evento (PATCH) em vez de duplicar, e pra
-- dar pra apagar o evento de quem for removido da lista de responsáveis.
-- Só o servidor (com o refresh token de cada pessoa) mexe aqui — não existe
-- cenário de leitura direta do cliente, por isso RLS ligada e zero
-- políticas (mesmo padrão já usado em outras ~14 tabelas internas).
CREATE TABLE public.campaign_calendar_events (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, user_id)
);

GRANT ALL ON public.campaign_calendar_events TO service_role;
ALTER TABLE public.campaign_calendar_events ENABLE ROW LEVEL SECURITY;
