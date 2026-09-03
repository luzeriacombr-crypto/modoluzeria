-- Repetir publicação de Story: reaproveitar a mesma arte/legenda pra
-- publicar de novo no Instagram várias vezes (diário, semanal, ou dias e
-- horários personalizados), pra sempre — diferente de ig_auto_publish, que
-- "desliga" sozinho depois de publicar uma vez. ig_repeat_slots só é usado
-- no modo "custom": array de {"weekday": 1-7 (1=Segunda), "time": "HH:MM"}.
-- Nos modos "daily"/"weekly" o horário (e o dia da semana, no semanal) vem
-- do próprio scheduled_at do item. ig_repeat_last_fired_date evita publicar
-- duas vezes no mesmo dia se o cron rodar mais de uma vez dentro da janela.
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS ig_repeat_mode text CHECK (ig_repeat_mode IN ('daily', 'weekly', 'custom')),
  ADD COLUMN IF NOT EXISTS ig_repeat_slots jsonb,
  ADD COLUMN IF NOT EXISTS ig_repeat_last_fired_date date;

CREATE INDEX IF NOT EXISTS idx_content_items_ig_repeat
  ON public.content_items (ig_repeat_mode)
  WHERE ig_repeat_mode IS NOT NULL AND status = 'PRONTO_PARA_PUBLICAR';

-- content_items só guarda a mais recente publicação (ig_published_at /
-- ig_media_id) — com repetição isso deixa de bastar, então cada disparo
-- (manual, programado uma vez, ou repetido) grava sua própria linha aqui
-- pra dar pra mostrar "publicado Nx" com data de cada uma.
CREATE TABLE public.content_item_publishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  ig_media_id text,
  published_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.content_item_publishes TO authenticated;
GRANT ALL ON public.content_item_publishes TO service_role;
ALTER TABLE public.content_item_publishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read content_item_publishes" ON public.content_item_publishes FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = content_item_publishes.content_item_id AND ci.org_id = public.current_org_id())
  );

CREATE INDEX idx_content_item_publishes_item ON public.content_item_publishes(content_item_id, published_at DESC);
