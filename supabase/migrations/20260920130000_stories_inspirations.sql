-- Inspirações de Stories por agência.
--
-- Quando chega o dia da pessoa na escala, ela vê um botão "Ver inspirações"
-- com a rotina de stories da própria agência: o tema de cada dia, as ideias
-- que costumam funcionar, o padrão de publicação e o que evitar.
--
-- Fica por agência (e não no código) porque o app é white-label: a rotina
-- da Luzeria é estratégia da Luzeria, não pode aparecer pra outra agência.
-- Sem conteúdo cadastrado, o botão simplesmente não aparece.
--
-- Pra reverter: ALTER TABLE public.orgs DROP COLUMN stories_inspirations;

ALTER TABLE public.orgs ADD COLUMN stories_inspirations jsonb;

COMMENT ON COLUMN public.orgs.stories_inspirations IS
  'Rotina de stories da agência: { dias: [{titulo, subtitulo, objetivo, ideias[], nota}], essencia: {titulo, itens:[{dia,texto}]}, padrao: {titulo, itens[], rodape[]}, evitar: [] }. NULL = agência sem rotina cadastrada.';
