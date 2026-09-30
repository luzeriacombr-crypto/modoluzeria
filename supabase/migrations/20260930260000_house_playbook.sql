-- House (Fase 3): Playbook da função.
--
-- Seções > páginas (texto formatado em Markdown, imagens, exemplos e um
-- mini checklist no fim). org_id NULL = o PLAYBOOK MODELO global, editável
-- só pela Luzeria; toda House nova recebe uma cópia (copy_playbook_template)
-- que o gestor dela edita livremente sem mexer no modelo.
-- playbook_reads guarda quem leu cada página (e os itens do mini checklist
-- marcados); step_keys liga a página às etapas do fluxo de produção pro
-- link "Como fazer" dentro do item.

CREATE TABLE IF NOT EXISTS public.playbook_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  icon text NOT NULL DEFAULT 'BookOpen',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_playbook_sections_org ON public.playbook_sections(org_id, sort_order);

CREATE TABLE IF NOT EXISTS public.playbook_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.playbook_sections(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  summary text CHECK (summary IS NULL OR length(summary) <= 300),
  content text NOT NULL DEFAULT '' CHECK (length(content) <= 60000),
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  step_keys text[] NOT NULL DEFAULT '{}',
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_playbook_pages_section ON public.playbook_pages(section_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_playbook_pages_org ON public.playbook_pages(org_id);

CREATE TABLE IF NOT EXISTS public.playbook_reads (
  page_id uuid NOT NULL REFERENCES public.playbook_pages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  read_at timestamptz,
  checked int[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (page_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_playbook_reads_org ON public.playbook_reads(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.playbook_sections, public.playbook_pages, public.playbook_reads TO authenticated;
GRANT ALL ON public.playbook_sections, public.playbook_pages, public.playbook_reads TO service_role;
ALTER TABLE public.playbook_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_reads ENABLE ROW LEVEL SECURITY;

-- Playbook da org: todo mundo ativo lê; o master edita.
DROP POLICY IF EXISTS "playbook sections org read" ON public.playbook_sections;
CREATE POLICY "playbook sections org read" ON public.playbook_sections FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()));
DROP POLICY IF EXISTS "playbook sections master write" ON public.playbook_sections;
CREATE POLICY "playbook sections master write" ON public.playbook_sections FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_master(auth.uid()))
  WITH CHECK (org_id = public.current_org_id() AND public.is_master(auth.uid()));

DROP POLICY IF EXISTS "playbook pages org read" ON public.playbook_pages;
CREATE POLICY "playbook pages org read" ON public.playbook_pages FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()));
DROP POLICY IF EXISTS "playbook pages master write" ON public.playbook_pages;
CREATE POLICY "playbook pages master write" ON public.playbook_pages FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_master(auth.uid()))
  WITH CHECK (org_id = public.current_org_id() AND public.is_master(auth.uid()));

-- Modelo global (org_id NULL): só a Luzeria lê e edita.
DROP POLICY IF EXISTS "playbook template luzeria sections" ON public.playbook_sections;
CREATE POLICY "playbook template luzeria sections" ON public.playbook_sections FOR ALL TO authenticated
  USING (org_id IS NULL AND public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (org_id IS NULL AND public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');
DROP POLICY IF EXISTS "playbook template luzeria pages" ON public.playbook_pages;
CREATE POLICY "playbook template luzeria pages" ON public.playbook_pages FOR ALL TO authenticated
  USING (org_id IS NULL AND public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (org_id IS NULL AND public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');

-- Leitura: cada um grava a própria; a org inteira vê (o dono acompanha o progresso).
DROP POLICY IF EXISTS "playbook reads org read" ON public.playbook_reads;
CREATE POLICY "playbook reads org read" ON public.playbook_reads FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()));
DROP POLICY IF EXISTS "playbook reads own write" ON public.playbook_reads;
CREATE POLICY "playbook reads own write" ON public.playbook_reads FOR ALL TO authenticated
  USING (user_id = auth.uid() AND org_id = public.current_org_id())
  WITH CHECK (
    user_id = auth.uid() AND org_id = public.current_org_id()
    AND EXISTS (SELECT 1 FROM public.playbook_pages p WHERE p.id = page_id AND p.org_id = public.current_org_id())
  );

-- Imagens do playbook: bucket público (a URL vai direto no texto da página).
-- Cada org escreve só na própria pasta; a pasta "modelo" é da Luzeria.
INSERT INTO storage.buckets (id, name, public) VALUES ('playbook-assets', 'playbook-assets', true)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "playbook assets public read" ON storage.objects;
CREATE POLICY "playbook assets public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'playbook-assets');
DROP POLICY IF EXISTS "playbook assets master write" ON storage.objects;
CREATE POLICY "playbook assets master write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'playbook-assets' AND public.is_master(auth.uid())
    AND (
      (storage.foldername(name))[1] = public.current_org_id()::text
      OR ((storage.foldername(name))[1] = 'modelo' AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
    )
  );

-- Copia o modelo global pra uma org (só se ela ainda não tem playbook).
CREATE OR REPLACE FUNCTION public.copy_playbook_template(_org_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  v_new_section uuid;
  v_pages int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM public.playbook_sections WHERE org_id = _org_id) THEN
    RETURN 0;
  END IF;
  FOR s IN SELECT * FROM public.playbook_sections WHERE org_id IS NULL ORDER BY sort_order LOOP
    INSERT INTO public.playbook_sections (org_id, title, icon, sort_order)
    VALUES (_org_id, s.title, s.icon, s.sort_order)
    RETURNING id INTO v_new_section;
    INSERT INTO public.playbook_pages (org_id, section_id, title, summary, content, checklist, step_keys, sort_order)
    SELECT _org_id, v_new_section, p.title, p.summary, p.content, p.checklist, p.step_keys, p.sort_order
      FROM public.playbook_pages p WHERE p.section_id = s.id;
    v_pages := v_pages + (SELECT count(*) FROM public.playbook_pages WHERE section_id = v_new_section);
  END LOOP;
  RETURN v_pages;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.copy_playbook_template(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copy_playbook_template(uuid) TO service_role;

-- ===== Playbook modelo (conteúdo inicial) =====
DO $seed$
DECLARE
  v_sec uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.playbook_sections WHERE org_id IS NULL) THEN
    RETURN;
  END IF;

  -- 1. Sistema de Conteúdo
  INSERT INTO public.playbook_sections (org_id, title, icon, sort_order) VALUES (NULL, 'Sistema de Conteúdo', 'Layers', 0) RETURNING id INTO v_sec;
  INSERT INTO public.playbook_pages (org_id, section_id, title, summary, content, checklist, step_keys, sort_order) VALUES
  (NULL, v_sec, 'Como funciona o fluxo de produção', 'O caminho de toda peça, da ideia até o post no ar.', $md$
Todo conteúdo da marca passa pelo mesmo caminho. Seguir o fluxo é o que faz o trabalho aparecer no painel do gestor e nas metas.

## As etapas

1. **Planejamento**: a ideia entra no mês, com tema e formato definidos.
2. **Copy**: roteiro, texto dos slides ou legenda escritos.
3. **Criação / Gravação / Edição**: a peça é produzida.
4. **Revisão interna**: você mesmo revisa com o checklist de qualidade antes de mandar.
5. **Aprovação do gestor**: o gestor aprova dentro do app. Aprovado com data marcada, o post já fica programado.
6. **Agendamento**: data, horário e legenda final conferidos.
7. **Publicado**: a peça está no ar.

> **Dica:** mude o status do item assim que a etapa andar. Card parado em "Copy" por uma semana é sinal de gargalo, não de trabalho.

## Regras de ouro

- Toda peça tem **prazo** e **responsável**.
- Nada vai pro ar sem passar pela **aprovação do gestor**.
- Arquivo final sempre anexado no item (ou na pasta do Drive da marca).
$md$, '["Conferi o prazo e o responsável dos itens da semana", "Movi os status do que avançou hoje", "Anexei os arquivos finais nos itens prontos"]'::jsonb, ARRAY['REVISAO_INTERNA', 'AGENDAMENTO'], 0),
  (NULL, v_sec, 'Pilares de conteúdo da marca', 'Os 4 tipos de conteúdo que sustentam o perfil.', $md$
Um perfil que vende não posta só oferta. Distribua o mês entre quatro pilares.

## Os pilares

- **Autoridade**: ensina algo útil e mostra que a marca sabe do assunto. Ex.: "3 sinais de que você precisa de…".
- **Bastidores**: mostra pessoas, rotina e cuidado. É o que cria confiança.
- **Prova social**: depoimentos, antes e depois (quando permitido), números, clientes reais.
- **Oferta**: convite claro pra agendar, comprar ou participar, sempre com o próximo passo.

## Proporção sugerida

| Pilar | Peso no mês |
| --- | --- |
| Autoridade | 35% |
| Bastidores | 25% |
| Prova social | 20% |
| Oferta | 20% |

> **Exemplo:** num mês com 12 posts no feed, fica algo como 4 de autoridade, 3 de bastidores, 3 de prova social e 2 de oferta.
$md$, '["Classifiquei os posts do mês por pilar", "Tem pelo menos 1 prova social por semana", "Toda oferta tem chamada pra ação clara"]'::jsonb, '{}', 1);

  -- 2. Planejamento do Mês
  INSERT INTO public.playbook_sections (org_id, title, icon, sort_order) VALUES (NULL, 'Planejamento do Mês', 'CalendarDays', 1) RETURNING id INTO v_sec;
  INSERT INTO public.playbook_pages (org_id, section_id, title, summary, content, checklist, step_keys, sort_order) VALUES
  (NULL, v_sec, 'Passo a passo do planejamento', 'Como montar o mês seguinte até o dia combinado.', $md$
O planejamento do mês seguinte tem prazo (ele aparece no seu **Meu dia**). Entregue antes, nunca depois.

## Passo a passo

1. **Olhe os números do mês atual**: o que teve mais alcance, mais salvamentos e mais conversas no direct.
2. **Liste as datas e campanhas** do próximo mês (feriados, datas da área, eventos, promoções).
3. Na marca, abra **Mais → Roteiros & Planejamento** e use **Gerar prévia com IA** (ou escreva direto).
4. Ajuste a prévia: troque o que não combina com a marca e garanta o equilíbrio dos pilares.
5. Salve como **Planejamento** e depois **Aprovar e enviar pros Roteiros**.
6. Avise o gestor que o planejamento está pronto pra aprovação.

> **Dica:** quanto mais contexto a IA recebe (briefing da marca, concorrentes, o que funcionou), melhor a prévia.
$md$, '["Revisei os números do mês atual", "Listei datas e campanhas do próximo mês", "Planejamento salvo e roteiros gerados", "Avisei o gestor"]'::jsonb, ARRAY['PLANEJAMENTO'], 0),
  (NULL, v_sec, 'Datas e campanhas', 'Onde procurar pauta pro mês.', $md$
## Fontes de pauta

- **Datas comemorativas da área** (dia do profissional, campanhas de saúde, sazonalidade).
- **Datas gerais** que fazem sentido pra marca (Dia das Mães, Black Friday, fim de ano).
- **Agenda interna**: eventos, novidades, lançamentos, projetos (ex.: programa de rádio).
- **Perguntas frequentes** que chegam no direct: cada pergunta boa vira um conteúdo.

> **Exemplo:** se chegaram 5 perguntas sobre preço no mês, planeje um conteúdo explicando o que está incluído e como agendar.
$md$, '["Conferi o calendário de datas do mês", "Incluí pelo menos 1 conteúdo vindo de perguntas do direct"]'::jsonb, '{}', 1);

  -- 3. Stories
  INSERT INTO public.playbook_sections (org_id, title, icon, sort_order) VALUES (NULL, 'Stories', 'Smartphone', 2) RETURNING id INTO v_sec;
  INSERT INTO public.playbook_pages (org_id, section_id, title, summary, content, checklist, step_keys, sort_order) VALUES
  (NULL, v_sec, 'Rotina diária de stories', 'A meta mínima e como distribuir ao longo do dia.', $md$
Stories são a vitrine do dia a dia. A meta mínima aparece no seu **Meu dia** e conta direto do Instagram.

## Distribuição sugerida

- **Manhã**: bastidor ou "bom dia" com algo real acontecendo (equipe chegando, preparação).
- **Tarde**: conteúdo que gera resposta (enquete, caixinha, pergunta).
- **Fim do dia**: prova social ou convite pra agendar.

## O que funciona

- Rosto e voz de pessoas da equipe.
- Texto curto, grande e legível.
- Uma ideia por story.

> **Dica:** não deixe pra postar tudo de uma vez no fim do dia. Stories espalhados alcançam mais gente.
$md$, '["Postei os stories de manhã", "Postei um story que pede resposta", "Encerrei o dia com prova social ou convite"]'::jsonb, '{}', 0),
  (NULL, v_sec, 'Stories que geram conversa', 'Caixinhas, enquetes e chamadas pro direct.', $md$
Story bom não é só visto, é **respondido**. Cada resposta é uma porta pra um lead.

## Formatos

- **Caixinha de perguntas**: "Qual sua maior dúvida sobre…?"
- **Enquete**: duas opções simples, sobre algo que a pessoa vive.
- **Chamada pro direct**: "Me manda QUERO que eu te explico como funciona."

## Quando alguém responder

1. Responda rápido (idealmente em até 1 hora).
2. Registre no botão **+ Lead** com a origem "Resposta de story" ou "Caixinha".
3. Siga o roteiro da seção **Abordagem de Leads**.
$md$, '["Fiz pelo menos 1 story interativo hoje", "Registrei no + Lead quem respondeu"]'::jsonb, '{}', 1);

  -- 4. Feed e Reels
  INSERT INTO public.playbook_sections (org_id, title, icon, sort_order) VALUES (NULL, 'Feed e Reels', 'Clapperboard', 3) RETURNING id INTO v_sec;
  INSERT INTO public.playbook_pages (org_id, section_id, title, summary, content, checklist, step_keys, sort_order) VALUES
  (NULL, v_sec, 'Estrutura de um Reels que prende', 'Gancho, desenvolvimento e chamada pra ação.', $md$
## A estrutura

1. **Gancho (0 a 3 segundos)**: uma frase ou imagem que faça a pessoa parar. Ex.: "Você está escovando os dentes errado."
2. **Desenvolvimento**: entregue o que prometeu, direto, com cortes rápidos.
3. **Chamada pra ação**: diga o que fazer agora (salvar, comentar, chamar no direct).

## Na gravação

- Luz de frente (janela ou ring light), celular na vertical e limpo.
- Grave cada frase mais de uma vez.
- Áudio claro vale mais que imagem bonita.

## Na edição

- Legenda na tela (muita gente assiste sem som).
- Corte os silêncios.
- Capa com título legível no grid.
$md$, '["O gancho aparece nos 3 primeiros segundos", "Tem legenda na tela", "Tem chamada pra ação no final", "A capa está legível no grid"]'::jsonb, ARRAY['EM_GRAVACAO', 'EM_EDICAO'], 0),
  (NULL, v_sec, 'Posts e carrosséis', 'Capa que chama, uma ideia por slide e legenda que conversa.', $md$
## Carrossel

- **Capa**: promessa clara em poucas palavras.
- **Um slide, uma ideia**.
- **Último slide**: resumo ou chamada pra ação.

## Legenda

- Primeira linha forte (aparece antes do "mais").
- Parágrafos curtos.
- Termine com uma pergunta ou chamada.

> **Exemplo de primeira linha:** "Esse erro deixa seu tratamento 2x mais longo (e quase todo mundo comete)."
$md$, '["Capa com promessa clara", "Texto revisado (sem erro de português)", "Legenda com chamada pra ação"]'::jsonb, ARRAY['COPY', 'CRIACAO', 'REVISAO_ARTE'], 1);

  -- 5. Abordagem de Leads
  INSERT INTO public.playbook_sections (org_id, title, icon, sort_order) VALUES (NULL, 'Abordagem de Leads', 'MessageCircle', 4) RETURNING id INTO v_sec;
  INSERT INTO public.playbook_pages (org_id, section_id, title, summary, content, checklist, step_keys, sort_order) VALUES
  (NULL, v_sec, 'Do direct ao agendamento', 'Como conduzir a conversa e registrar cada lead.', $md$
Todo mundo que chama no Instagram é um lead. O objetivo é levar a conversa até o **agendamento** e acompanhar até o **comparecimento**.

## O caminho

1. **Registre** no botão **+ Lead** assim que a conversa começar (leva segundos).
2. **Responda rápido** e pelo nome.
3. **Entenda a necessidade** com uma ou duas perguntas.
4. **Convide pro próximo passo** com opções de dia e horário.
5. **Mova o lead** no kanban: Agendou, Compareceu ou Não avançou.

> **Dica:** lead que não é registrado não aparece no relatório do mês. Se conversou, registrou.

## Quando não avançar

Marque como **Não avançou** e, se fizer sentido, retome em 15 dias com uma novidade ou conteúdo útil.
$md$, '["Registrei todos os leads de hoje", "Respondi as conversas abertas", "Atualizei o status no kanban"]'::jsonb, '{}', 0),
  (NULL, v_sec, 'Mensagens prontas', 'Modelos pra adaptar ao seu jeito de falar.', $md$
Adapte ao tom da marca. Nunca cole igualzinho pra todo mundo.

## Primeira resposta

> "Oi, [nome]! Que bom que você chamou. Me conta: o que você está buscando hoje?"

## Convite pra agendar

> "Pelo que você me contou, o ideal é uma avaliação. Tenho [dia] às [hora] ou [dia] às [hora]. Qual fica melhor?"

## Confirmação

> "Combinado, [nome]! Fica agendado pra [dia] às [hora]. No dia anterior eu te mando um lembrete."

## Retomada (15 dias depois)

> "Oi, [nome]! Lembrei de você porque [novidade]. Se ainda fizer sentido, consigo um horário essa semana."
$md$, '["Adaptei as mensagens ao tom da marca", "Salvei as respostas rápidas no Instagram"]'::jsonb, '{}', 1);

  -- 6. Tráfego Pago
  INSERT INTO public.playbook_sections (org_id, title, icon, sort_order) VALUES (NULL, 'Tráfego Pago', 'Megaphone', 5) RETURNING id INTO v_sec;
  INSERT INTO public.playbook_pages (org_id, section_id, title, summary, content, checklist, step_keys, sort_order) VALUES
  (NULL, v_sec, 'Impulsionar ou criar campanha?', 'O básico pra investir sem desperdiçar.', $md$
## Impulsionar

Rápido e simples, direto no app do Instagram. Bom pra dar mais alcance a um post que **já está indo bem**.

## Campanha (Gerenciador de Anúncios)

Mais controle de público, orçamento e objetivo. Use pra **mensagens no direct** ou **agendamentos**.

## O que acompanhar

- **Custo por conversa** iniciada no direct.
- **Quantas conversas viraram agendamento** (use o kanban de leads).
- Pare o que não gera conversa em 3 a 5 dias e reforce o que gera.

> **Dica:** marque os leads que vieram de anúncio com a origem "Outro" e escreva "anúncio" na observação, pra separar no relatório.
$md$, '["Defini o objetivo da campanha", "Anotei o orçamento e o período", "Acompanhei o custo por conversa"]'::jsonb, '{}', 0);

  -- 7. Eventos
  INSERT INTO public.playbook_sections (org_id, title, icon, sort_order) VALUES (NULL, 'Eventos', 'PartyPopper', 6) RETURNING id INTO v_sec;
  INSERT INTO public.playbook_pages (org_id, section_id, title, summary, content, checklist, step_keys, sort_order) VALUES
  (NULL, v_sec, 'Antes, durante e depois do evento', 'Como transformar um evento em conteúdo e leads.', $md$
## Antes

- Data, local e objetivo definidos.
- Estrutura e materiais (banner, brindes, som, internet).
- Divulgação: contagem regressiva nos stories e um post de convite.
- Patrocínios e parceiros confirmados.

## Durante

- Uma pessoa responsável só pela **cobertura**.
- Stories ao vivo, fotos das pessoas e da estrutura.
- Capte depoimentos curtos (15 segundos).

## Depois

- Post de agradecimento com as melhores fotos.
- Reels com os melhores momentos.
- Registrar os leads que surgiram no evento.

> **Dica:** crie o evento em **Projetos** com o modelo "Evento" pra ter as etapas e prazos prontos.
$md$, '["Checklist de estrutura e materiais conferido", "Responsável pela cobertura definido", "Pós-evento publicado em até 48h"]'::jsonb, '{}', 0);

  -- 8. Projetos
  INSERT INTO public.playbook_sections (org_id, title, icon, sort_order) VALUES (NULL, 'Projetos', 'Radio', 7) RETURNING id INTO v_sec;
  INSERT INTO public.playbook_pages (org_id, section_id, title, summary, content, checklist, step_keys, sort_order) VALUES
  (NULL, v_sec, 'Programa de rádio: da pauta às redes', 'Um programa rende conteúdo pra semana inteira.', $md$
## Antes do programa

1. **Pauta**: tema, 3 a 5 perguntas e a mensagem principal.
2. **Convidado**: confirmado, com nome, cargo e @.
3. **Divulgação**: story e post avisando dia e horário.

## No dia

- Grave vídeo dos bastidores e trechos da conversa (vertical).
- Foto com o convidado.

## Reaproveitamento pras redes

- 2 a 3 **Reels** com os melhores trechos.
- 1 **carrossel** com as principais dicas.
- Stories com "você perdeu? olha esse trecho".

> **Exemplo:** um programa de 30 minutos vira facilmente 5 conteúdos pra semana seguinte.
$md$, '["Pauta e convidado confirmados", "Divulgação publicada", "Trechos gravados pra reaproveitar"]'::jsonb, '{}', 0);

  -- 9. Relatório do Mês
  INSERT INTO public.playbook_sections (org_id, title, icon, sort_order) VALUES (NULL, 'Relatório do Mês', 'BarChart3', 8) RETURNING id INTO v_sec;
  INSERT INTO public.playbook_pages (org_id, section_id, title, summary, content, checklist, step_keys, sort_order) VALUES
  (NULL, v_sec, 'Como fazer o relatório do mês', 'Números, aprendizados e o que muda.', $md$
O relatório fecha o mês e abre o próximo. Os números saem do app; a análise é sua.

## O que entra

- **Metas**: stories e posts publicados contra a meta.
- **Leads**: quantos chegaram, por origem, quantos agendaram e quantos compareceram.
- **Conteúdos destaque**: os 3 que mais funcionaram (e por quê).

## As três perguntas

1. **O que funcionou?**
2. **O que aprendemos?**
3. **O que muda no próximo mês?**

> **Dica:** seja específico. "Reels com a equipe tiveram o dobro de alcance" ajuda mais que "o mês foi bom".
$md$, '["Conferi os números do mês", "Respondi as três perguntas", "Combinei com o gestor o que muda"]'::jsonb, '{}', 0);
END
$seed$;

-- Houses que já existem ganham a cópia do modelo.
SELECT public.copy_playbook_template(id) FROM public.orgs WHERE account_type = 'house';

-- O conteúdo semeado acima começa/termina com quebra de linha (dollar-quote).
UPDATE public.playbook_pages SET content = btrim(content, E'\n ') WHERE content <> btrim(content, E'\n ');
