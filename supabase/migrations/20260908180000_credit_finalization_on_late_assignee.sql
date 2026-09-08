-- Se alguém é adicionado como responsável (item_assignees) num item que JÁ
-- está "Pronto para publicar", essa pessoa nunca ganhava um registro em
-- `finalizations` — o crédito só acontecia no instante da transição de
-- status (record_finalizations, 20260709190000), não quando um responsável
-- é atribuído depois. Isso deixava a hora dela de fora do Margem mesmo
-- aparecendo como responsável na tela. Espelha a mesma regra pro caminho
-- inverso: atribuição tardia num item já finalizado credita na hora.
CREATE OR REPLACE FUNCTION public.credit_finalization_on_late_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item_status public.content_status;
BEGIN
  SELECT status INTO item_status FROM public.content_items WHERE id = NEW.item_id;
  IF item_status = 'PRONTO_PARA_PUBLICAR' AND NOT EXISTS (
    SELECT 1 FROM public.finalizations WHERE item_id = NEW.item_id AND user_id = NEW.user_id
  ) THEN
    INSERT INTO public.finalizations (user_id, item_id, finalized_at)
    VALUES (NEW.user_id, NEW.item_id, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_finalization_on_late_assignee ON public.item_assignees;
CREATE TRIGGER trg_credit_finalization_on_late_assignee
  AFTER INSERT ON public.item_assignees
  FOR EACH ROW EXECUTE FUNCTION public.credit_finalization_on_late_assignee();
