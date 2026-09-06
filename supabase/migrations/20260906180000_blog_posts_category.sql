-- Categoria de cada artigo do blog, pra permitir filtrar por assunto no
-- cabeçalho público (Tecnologia / Meta e Instagram / Clientes / Dono de
-- Agência). Vira uma coluna própria (não um enum) pra facilitar ajuste
-- futuro sem precisar de outra migração.
ALTER TABLE public.blog_posts
  ADD COLUMN category text NOT NULL DEFAULT 'dono-de-agencia'
  CHECK (category IN ('tecnologia', 'meta-instagram', 'clientes', 'dono-de-agencia'));

UPDATE public.blog_posts SET category = 'tecnologia' WHERE slug IN (
  'melhores-apps-de-edicao-para-agencia',
  'por-que-agencias-estao-deixando-o-trello',
  'trocamos-5-ferramentas-por-1-sistema',
  'modo-criador-vs-planilha-whatsapp',
  'trello-ou-notion-pra-agencia-de-conteudo'
);

UPDATE public.blog_posts SET category = 'meta-instagram' WHERE slug IN (
  'publicar-no-instagram-na-mao-quase-nos-esgotou',
  'conta-banida-bot-postagem-nao-autorizado-meta',
  'o-que-e-app-review-aprovado-pela-meta'
);

UPDATE public.blog_posts SET category = 'clientes' WHERE slug IN (
  'como-paramos-de-perder-arquivo-de-cliente',
  'fim-da-aprovacao-perdida-no-whatsapp',
  'por-que-a-selecao-de-fotos-parou-de-ser-um-problema',
  'checklist-antes-de-aprovar-post-com-cliente'
);

UPDATE public.blog_posts SET category = 'dono-de-agencia' WHERE slug IN (
  'maiores-erros-gerenciando-conteudo-de-varios-clientes',
  'onde-investir-quando-a-agencia-comeca-a-crescer',
  'de-onde-veio-o-modo-criador',
  'quanto-custa-gerenciar-conteudo-sem-virar-prejuizo',
  'quanto-cobrar-gestao-redes-sociais-2026',
  'quantos-clientes-uma-pessoa-consegue-gerenciar-sozinha',
  'como-organizar-rotina-semanal-agencia-social-media',
  'como-conseguir-primeiros-clientes-gestao-redes-sociais'
);
