-- Perfis convidados como colaboradores (co-autores) num post/reel do
-- Instagram — string separada por vírgula com os @ (sem o @) que a Meta
-- convida junto na hora de publicar. O perfil convidado ainda precisa
-- aceitar o convite no próprio Instagram pra aparecer como colab de
-- verdade; a API só manda o convite.
ALTER TABLE public.content_items
  ADD COLUMN ig_collaborators text;
