-- House: base de conhecimento inicial, desenvolvida pela Luzeria.
--
-- A base de conhecimento (org_content_knowledge) é o que ensina a IA de
-- planejamento/ideias como a empresa cria conteúdo. Em vez de toda House
-- começar do zero, ela nasce com uma cópia deste modelo — versão geral do
-- método da Luzeria, sem nomes de clientes e sem nada específico de um
-- perfil. A base da própria Luzeria não é tocada.

CREATE TABLE IF NOT EXISTS public.knowledge_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  text_content text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.knowledge_templates TO authenticated;
GRANT ALL ON public.knowledge_templates TO service_role;
ALTER TABLE public.knowledge_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "luzeria manages knowledge templates" ON public.knowledge_templates;
CREATE POLICY "luzeria manages knowledge templates" ON public.knowledge_templates FOR ALL TO authenticated
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');

-- Copia o modelo pra uma org — só os itens que ela ainda não tem (pelo título).
CREATE OR REPLACE FUNCTION public.copy_knowledge_template(_org_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count int;
BEGIN
  INSERT INTO public.org_content_knowledge (org_id, kind, title, text_content)
  SELECT _org_id, 'text', t.title, t.text_content
    FROM public.knowledge_templates t
   WHERE NOT EXISTS (SELECT 1 FROM public.org_content_knowledge k WHERE k.org_id = _org_id AND k.title = t.title)
   ORDER BY t.sort_order DESC;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.copy_knowledge_template(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.copy_knowledge_template(uuid) TO service_role;

DELETE FROM public.knowledge_templates;

INSERT INTO public.knowledge_templates (title, sort_order, text_content) VALUES
('Sistema de Conteúdo · desenvolvido por Luzeria', 0, $kb$Sistema de Conteúdo, desenvolvido por Luzeria

Um jeito de transformar a criação de conteúdo num processo repetível, validado em dezenas de perfis. Serve de base pra qualquer marca: o que muda de uma empresa pra outra são as respostas do diagnóstico, não o método.

## 1. Diagnóstico (antes de criar qualquer conteúdo)

1. Mapeamento da marca: identidade, o que vende, ticket, posicionamento, voz, personalidade e referências.
2. O que já funcionou: olhar os conteúdos que mais performaram no perfil e extrair o formato predominante, o tom, o tipo de gancho, o tipo de chamada pra ação e o padrão de legenda.
3. Métricas reais do Instagram: audiência, alcance, crescimento e conteúdos top, pra descobrir qual formato tem mais potencial naquele perfil.
4. Datas do nicho: mapear as datas comemorativas da área e classificar por relevância: vermelho (criar conteúdo), amarelo (monitorar), branco (apenas saber). Nunca forçar uma conexão fraca com a data.

## 2. Os formatos

Reels
- R1: direto pra câmera.
- R2: vlog ou bastidor.
- R3: tela dividida ou polarização (dois lados de um assunto).

Posts
- P1: estático.
- P2: carrossel, com narrativa puxada por um dado ou por uma provocação.

Adicionais (usar conforme o perfil, no lugar de um formato principal, no máximo 2 por mês)
- A1 Lo-fi, A2 React, A3 narração em off, A4 game ou quiz, A5 diálogo solo, A6 trend ou áudio viral.

## 3. Ritmo de referência

Uma boa base é 12 conteúdos por mês (6 reels, 3 estáticos e 3 carrosséis), postados em dias fixos (por exemplo segunda, quarta e sexta), nos horários de pico reais da audiência. Ajuste às metas da sua empresa.

O planejamento de cada mês reúne: o sistema da marca, o mapa de datas, o calendário, os roteiros, um banco de reserva (conteúdos prontos pra emergência) e um banco bônus (ideias extras).

## 4. Regras fixas

- Tom simples, direto e prático. Nunca coach barato, nunca sermão.
- Roteiro de Reels entre 600 e 1.039 caracteres, sempre contados.
- Sem abertura contextualizadora: o vídeo já começa no gancho.
- Sempre chamada pra ação direta no fim.
- Legenda curta, que complementa o gancho (não repete), emoji leve, sem hashtag.
- Nunca inventar dado. Nunca forçar data comemorativa.
- O mix de formatos de um perfil não se copia pra outro: cada marca tem o seu, tirado do diagnóstico.$kb$),

('Roteirista Viral · desenvolvido por Luzeria', 1, $kb$Roteirista Viral, desenvolvido por Luzeria

Como escrever roteiros de Reels e vídeos curtos que prendem e geram alcance.

## Regra de linguagem

Linguagem natural, simples e próxima, pensada pra alcance real. Nunca usar clichês de texto de IA (por exemplo "jornada", "no mundo de hoje", "é importante ressaltar").

## Estrutura fixa de todo roteiro

1. GANCHO: uma frase que choca ou provoca curiosidade imediata, nos 3 primeiros segundos.
2. DESENVOLVIMENTO: o contexto do problema com um dado ou uma explicação simples.
3. VIRADA: o ponto de virada, uma nova perspectiva que reforça a autoridade de quem fala.
4. CTA: chamada direta pra ação (comentar, seguir, chamar no direct).
5. DICA EXTRA (fora do roteiro): sugestão de tom, cenário ou imagem ideal pra gravar.

## Banco de ganchos (padrões, não frases pra decorar)

Reconheça o padrão e adapte pro assunto. Só use quando fizer sentido; nunca force.

Garantia ou risco reverso
Ex.: "Resultado em 24h ou seu dinheiro de volta."
Padrão: promessa + prazo curto + garantia que tira o risco de quem lê. (Atenção: em saúde, direito e finanças, não prometa resultado.)

Erro específico com custo
Ex.: "Um pequeno erro que está custando caro no seu dia a dia."
Padrão: número + consequência concreta. Gera urgência sem parecer isca vazia.

Segredo ou revelação
Ex.: "O que ninguém te conta sobre [tema]."
Padrão: promessa de acesso a uma informação pouco conhecida.

Transformação com prova
Ex.: "Mãe de 52 anos, rotina corrida: veja o que ela mudou."
Padrão: pessoa comum + resultado específico + convite a ver como foi feito.

Pergunta de autoidentificação
Ex.: "Você também faz isso sem perceber?"
Padrão: a pessoa se reconhece no problema antes de saber a solução.

Contraste ou virada de expectativa
Ex.: "Pare de fazer isso todo dia."
Padrão: contraria o senso comum de propósito; faz parar o dedo porque soa errado à primeira vista.

Bastidor ou processo
Ex.: "Vou te mostrar como é o nosso dia antes de abrir as portas."
Padrão: convite pra acompanhar algo real, não uma teoria.

Convite direto
Ex.: "Quer que eu avalie o seu caso pessoalmente?"
Padrão: fecha em atendimento um a um. Bom pra chamada de fim de funil.

## Como usar junto com o Sistema de Conteúdo

A estrutura GANCHO, DESENVOLVIMENTO, VIRADA e CTA é o recheio do Reels de 600 a 1.039 caracteres. O banco de ganchos alimenta os 3 primeiros segundos do R1 (direto pra câmera) e a capa dos carrosséis P2.$kb$),

('Formatos de Conteúdo Viral · desenvolvido por Luzeria', 2, $kb$Formatos de Conteúdo Viral, desenvolvido por Luzeria

Sete formatos testados, com o que é, por que funciona e como executar.

## 1. Pauta quente
O que é: pegar algo que já está circulando (notícia, assunto viral, data comemorativa, uma dúvida que o público vive repetindo) e conectar com o seu negócio, do seu ponto de vista.
Por que funciona: o algoritmo empurra assunto que já está em alta; você aproveita a atenção em vez de competir do zero.
Como fazer: diga por que o assunto está em alta, dê sua leitura em 1 ou 2 frases e feche puxando pro seu nicho ("isso tem tudo a ver com o que a gente faz aqui, porque..."). Cuidado pra não forçar a conexão.

## 2. Estilo fofoca
O que é: uma informação real e útil, embalada como se fosse um segredo ("deixa eu te contar uma coisa que pouca gente sabe"). Tom leve, de conversa entre amigos.
Por que funciona: a embalagem de revelação ativa a curiosidade e faz a pessoa assistir até o fim.
Como fazer: abra com "vou te contar uma coisa que pouca gente fala sobre [tema]" e entregue como bastidor exclusivo. Precisa soar espontâneo, não decorado.

## 3. Historinha (novelinha)
O que é: uma história real contada em 3 episódios. O primeiro apresenta o personagem e o problema, o segundo avança, o terceiro resolve. Cada vídeo termina com gancho pro próximo.
Por que funciona: a pessoa volta ao perfil pra ver a continuação, o que sinaliza forte pro algoritmo.
Como fazer: escolha uma história real com começo, meio e fim claros e publique em dias seguidos.

## 4. Esse ou aquele
O que é: duas opções aparecem na tela e quem está no vídeo decide na hora. No fim, pergunta se quem assiste concorda.
Por que funciona: ver alguém decidir ao vivo engaja mais do que listar opções; o "concorda?" gera comentário fácil.
Como fazer: mostre as opções, decida com uma justificativa curta (ou nenhuma, se for óbvio) e feche perguntando a opinião. Funciona muito bem em sequência rápida, com várias situações seguidas.

## 5. Troque isso por isso
O que é: 4 ou 5 trocas simples no mesmo vídeo, "em vez de X, faça Y", mostrando o erro comum e a correção.
Por que funciona: cada troca dá sensação de progresso imediato, o que aumenta muito os salvamentos.
Como fazer: liste os erros mais comuns do nicho e a correção de cada um, direto ao ponto.

## 6. Tela dividida (narrativa de caso)
O que é: um roteiro narrado como se alguém analisasse um caso de fora, real ou hipotético, que revela algo verdadeiro sobre como o nicho funciona.
Por que funciona: dá a sensação de "insight que poucos percebem": uma história com tensão, contexto e conclusão, fechando com uma pergunta que puxa comentário.
Estrutura: abertura com tensão, contexto, virada (o acontecimento que revela a verdade), aprofundamento no vocabulário do próprio nicho, conclusão forte e pergunta final.
Regras: no máximo 700 caracteres, parágrafos curtos, sem listas. Se não for um fato real, avise que é um caso ilustrativo e nunca use nome real. Em saúde, finanças e direito, nunca prometa resultado nem compare antes e depois.

## 7. POV (ponto de vista)
O que é: colocar a pessoa dentro de uma cena bem específica do dia a dia dela, abrindo com "POV:".
Por que funciona: identificação imediata; a pessoa se reconhece antes de você entregar a solução.
Como fazer: descreva uma cena concreta do seu cliente ideal, faça uma pausa e entre com o comentário ou a solução. Quanto mais específica a cena, mais forte a identificação.$kb$),

('Táticas de Infotenimento · desenvolvido por Luzeria', 3, $kb$Táticas de Infotenimento, desenvolvido por Luzeria

Informação que também entretém. Quem só educa e esquece o entretenimento perde atenção (e vendas). O ideal é entregar valor real de um jeito prazeroso de consumir.

## A anatomia de todo conteúdo

- Conteúdo: a mistura de informação e entretenimento.
- Elo: a ponte do "e daí?", a moral da história que liga o conteúdo ao próximo passo. Sem elo, a pessoa entende mas não age.
- CTA: a ação pedida no fim (comentar, seguir, agendar, comprar).

## As 12 táticas

1. Analogias fora do comum: pegar algo banal do dia a dia e tirar dali uma lição sobre o nicho. Difícil de copiar, porque depende da vivência de quem fala.
2. Previsões: apontar tendências da área. Prende atenção mesmo quando a previsão não se confirma.
3. Personalidade: pessoas compram de pessoas. Mostrar o que irrita, alegra ou preocupa quem está por trás da marca cria identificação.
4. Linguagem própria: bordões, apelidos e um jeito de falar reconhecível fazem o conteúdo se destacar do genérico.
5. Storytelling: histórias são o jeito mais eficiente de passar uma ideia complexa.
6. Humor: um pouco de exagero ou comparação inusitada deixa o público de bom humor, e gente de bom humor compra mais.
7. Brincadeira com respeito: brincar com figuras conhecidas ou com o "topo" do mercado entretém e raramente ofende.
8. Fatos interessantes: abrir com um dado curioso prende logo de cara. Vale manter um banco de fatos por tema.
9. Fatos históricos: contar um episódio real e tirar dele a lição constrói autoridade mesmo sem casos próprios.
10. Cultura pop: filme, série, música ou evento em alta, desde que a conexão com o nicho seja natural.
11. Intimidade: um pedaço real da rotina ou da vida (com limite e intenção) aprofunda o vínculo, e equilibra períodos de venda mais forte.
12. Controvérsia: discordar publicamente de uma crença aceita no nicho gera emoção, e emoção converte. Exige estar preparado pro debate.

## Como combinar com o Sistema de Conteúdo

O Sistema define a estrutura (formatos, regras, calendário). Estas táticas são o repertório de gancho e retenção dentro dele. Ex.: uma data comemorativa pode virar gancho por um fato histórico ou por cultura pop; o tom provocador sem arrogância combina com a tática de controvérsia.$kb$),

('Humanize · desenvolvido por Luzeria', 4, $kb$Humanize, desenvolvido por Luzeria

Como deixar qualquer texto (roteiro, legenda, carrossel) com cara de gente, e não de texto gerado por IA.

## O processo em 6 passos

1. Encontre os padrões de IA no texto.
2. Reescreva os trechos problemáticos.
3. Preserve o sentido.
4. Mantenha a voz da marca.
5. Coloque personalidade (não é só limpar, é dar alma).
6. Auditoria final: pergunte "o que ainda faz isso parecer escrito por IA?", corrija e revise de novo.

## Padrões pra caçar e corrigir

- Importância exagerada: "marca um momento crucial", "reflete uma tendência mais ampla".
- Frases terminadas em "-ando/-endo" que não dizem nada: "destacando", "refletindo", "contribuindo para".
- Linguagem de propaganda: vibrante, rico, deslumbrante, "no coração de".
- Atribuições vagas: "especialistas dizem", "estudos mostram" (sem dizer quais).
- Travessão em excesso, regra do três em tudo, emoji decorativo, negrito exagerado.
- "Não é só X, é Y" repetido.
- Trocar o verbo "ser" por "funciona como", "atua como", "serve como".
- Fechamentos genéricos e otimistas demais: "o futuro é promissor".
- Enchimento: "a fim de", "devido ao fato de que", "neste momento".
- Excesso de cautela: "poderia potencialmente talvez".
- Tom bajulador: "Ótima pergunta!", "Você está certíssimo".

## Como dar alma ao texto

- Tenha opinião: reaja ao assunto, não só informe.
- Varie o ritmo. Frase curta. Depois uma mais longa, que se desenvolve com calma.
- Reconheça que as coisas têm nuance.
- Use primeira pessoa quando couber.
- Deixe um pouco de naturalidade (um parêntese, um comentário no meio).
- Seja específico sobre sentimentos em vez de vago.$kb$),

('Modelos de Roteiro que Funcionaram · desenvolvido por Luzeria', 5, $kb$Modelos de Roteiro que Funcionaram, desenvolvido por Luzeria

Estruturas tiradas de roteiros reais que performaram bem em perfis de profissionais e clínicas. Troque o assunto pelo da sua marca e mantenha a estrutura.

## 1. Esse ou aquele em sequência rápida
Uma pergunta com duas respostas possíveis e 10 a 15 situações do dia a dia em sequência, cada uma com a resposta certa. Fecha com uma regra simples que resume tudo e uma chamada leve.
Estrutura: título-pergunta ("X ou Y?") → situação 1: resposta → situação 2: resposta → ... → "Regra simples: ..." → "Comenta se você já errou isso."
Dica: rende parte 1 e parte 2.

## 2. "Vai agora ou pode esperar?"
Mesma lógica do anterior, pra decisões práticas do público (procurar ajuda urgente ou agendar, trocar agora ou depois). Sempre termina com a regra de bolso e "salva pra próxima dúvida".

## 3. Top 5 em contagem regressiva
"As 5 maiores causas de...", "Top 5 melhores...", "As profissões que mais...". Começa do quinto e termina no primeiro, com uma frase de impacto no número um e uma conclusão ("reparou? a maioria avisa antes").
Fecha pedindo comentário ou marcação ("marca alguém que...").

## 4. Sinais de alerta
"5 sinais de que...". Cada sinal numa frase curta e concreta. Fecha com "bateu um desses? É sinal de que..." e um convite pra avaliação ou atendimento.

## 5. Respondendo uma dúvida real
Lê (ou repete) uma pergunta de cliente olhando pra câmera, responde direto na primeira frase ("Não. E o problema é..."), explica em 2 ou 3 frases e fecha convidando pra agendar ou comentar.

## 6. Mito ou verdade
"Você já deve ter ouvido que X. Será?" Responde com honestidade, separando o que é verdade do que é promessa exagerada. Fecha com uma frase firme ("prometer X é vender expectativa, não resultado") e um convite a tirar dúvidas nos comentários.

## 7. A x B
"X ou Y, qual é melhor?" Explica o que cada um faz, em linguagem simples, e vira a pergunta: "a pergunta certa não é qual é melhor, é qual faz sentido pro seu caso". Fecha pedindo experiências nos comentários.

## 8. Quando eu NÃO indicaria
Autoridade por honestidade: explica em que casos o serviço mais procurado não é a melhor escolha. Gera confiança e filtra o público certo.

## 9. O caminho que ninguém vê
Mostra tudo que acontece antes do serviço (atendimento, avaliação, preparo). "O resultado começa muito antes do procedimento." Fecha com convite pra agendar.

## 10. Reação a um caso em alta
Pega um acontecimento que está repercutindo (um lance esportivo, uma notícia) e explica o que provavelmente aconteceu, com cuidado pra não dar diagnóstico ou opinião irresponsável.

## 11. Lições de quem lidera
Conteúdo do dono sobre gestão, equipe e crescimento, ligando a profissão à liderança ("ser bom tecnicamente não é ser bom gestor"). Humaniza e atrai outros empreendedores. Fecha com uma frase de efeito curta e uma pergunta.

## 12. Quadro fixo (série)
Um formato que se repete com identidade própria: por exemplo placas físicas com respostas ("SIM / NÃO / DEPENDE") e uma lista de situações pra decidir, uma por vídeo. Cria hábito de acompanhar.

## 13. Rotina narrada
Vlog com narração em primeira pessoa e hora marcada ("Sete e meia da manhã, café ainda quente e a agenda cheia..."). Mistura rotina real com uma mensagem (o cuidado que ninguém vê, a equipe por trás do resultado) e fecha com convite.

## 14. Dois lados
"De um lado, X. Do outro, Y." Compara dois resultados ou dois jeitos de trabalhar e deixa claro qual caminho a marca escolhe e por quê. Fecha com pergunta ("qual dos dois você reconheceria?").

## 15. "Um cliente me perguntou..."
Abre com uma pergunta real de um cliente (sem identificar ninguém) e responde com honestidade, inclusive quando a resposta é desconfortável. Fecha com "guarda essa informação" ou "manda pra quem precisa ouvir".

## 16. Gratidão e relacionamento
Em datas como Dia do Cliente: história próxima e verdadeira sobre a relação com os clientes, sem tom de propaganda. Fecha com um agradecimento e um convite pra interação ("manda um oi se você é um desses").

Regras que valem pra todos: frases curtas, uma ideia por frase, nada de promessa de resultado em áreas reguladas (saúde, estética, direito, finanças), sempre uma chamada pra ação clara no fim.$kb$);

-- Houses que já existem recebem a base inicial.
SELECT public.copy_knowledge_template(id) FROM public.orgs WHERE account_type = 'house';
