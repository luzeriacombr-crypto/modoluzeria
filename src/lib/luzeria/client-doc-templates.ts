// Prompts prontos pra colar numa IA (ChatGPT, Claude, Gemini etc.) junto
// com o material bruto do cliente. A IA devolve o texto já em Markdown —
// exatamente no formato que markdown-lite.ts sabe interpretar — e esse
// resultado é colado direto no Modo Criador, sem passar por nenhuma IA
// dentro do app.
export type ClientDocType = "roteiro" | "planejamento";

export const CLIENT_DOC_TYPE_LABEL: Record<ClientDocType, { label: string; description: string }> = {
  roteiro: {
    label: "Roteiros",
    description: "Cada roteiro vira um card numerado, fácil do cliente ver quantos tem.",
  },
  planejamento: {
    label: "Planejamento / Relatório",
    description: "Vira uma apresentação organizada por seções, com destaques em negrito.",
  },
};

export const ROTEIRO_PROMPT = `Você vai transformar um material bruto de roteiros de vídeo em um documento formatado. Vou colar abaixo (ou anexar em arquivo) as informações com os roteiros de conteúdo — pode estar em qualquer formato: texto corrido, lista, rascunho, etc.

Sua tarefa: identificar cada roteiro individual dentro do material e reescrever cada um seguindo EXATAMENTE este formato Markdown, sem nada além disso (sem introdução, sem comentários, sem blocos de código com \`\`\`):

## Roteiro 1: [título curto e chamativo do roteiro]
[o conteúdo do roteiro aqui — cenas, falas, indicações de gravação, tudo em texto corrido ou parágrafos. Pode usar listas com "- " se ajudar a organizar cenas ou passos.]

## Roteiro 2: [título do próximo roteiro]
[conteúdo...]

(repita "## Roteiro N: título" pra cada roteiro que você encontrar no material, numerando em sequência)

Regras importantes:
- Use exatamente "## Roteiro N: " no início de cada roteiro (dois #, espaço, "Roteiro", o número, dois pontos, espaço, e o título).
- Não invente conteúdo que não está no material original — só reorganize e formate o que já existe.
- Não use blocos de código (\`\`\`), não use links nem imagens.
- Pode usar **negrito** pra destacar palavras-chave dentro do texto, se ajudar.

Aqui está o material bruto:
[COLE AQUI O TEXTO OU ANEXE O ARQUIVO]`;

export const PLANEJAMENTO_PROMPT = `Você vai transformar um material bruto de planejamento (ou relatório) em uma apresentação organizada e visual pro cliente final ver. Vou colar abaixo (ou anexar em arquivo) as informações — pode estar em qualquer formato: texto corrido, planilha copiada, rascunho, etc.

Sua tarefa: reescrever esse conteúdo seguindo EXATAMENTE este formato Markdown, sem nada além disso (sem introdução, sem comentários, sem blocos de código com \`\`\`):

# [Título geral do documento — ex: "Planejamento de Agosto" ou "Relatório de Resultados"]

## [Nome da primeira seção — ex: "Objetivos do mês", "Resumo executivo", "Principais números"]
[texto explicando essa seção, em parágrafos]

- [Se fizer sentido, liste pontos ou métricas importantes aqui, um por linha, começando com "- "]
- [Destaque números e dados importantes usando **negrito**, tipo: Alcance total: **32.400** contas]

## [Nome da segunda seção]
[texto...]

(continue com quantas seções "## " fizerem sentido pra organizar o conteúdo original — normalmente entre 3 e 6 seções)

Regras importantes:
- Comece sempre com um único "# Título" na primeira linha.
- Cada seção principal usa "## " (dois #).
- Use **negrito** pra destacar números, métricas e palavras-chave importantes — isso ajuda a informação saltar aos olhos.
- Não invente dados que não estão no material original — só reorganize, resuma e formate o que já existe.
- Não use blocos de código (\`\`\`), tabelas, links ou imagens.
- Seja direto: frases curtas, sem enrolação, pensando em alguém lendo rápido pelo celular.

Aqui está o material bruto:
[COLE AQUI O TEXTO OU ANEXE O ARQUIVO]`;

export const CLIENT_DOC_PROMPT: Record<ClientDocType, string> = {
  roteiro: ROTEIRO_PROMPT,
  planejamento: PLANEJAMENTO_PROMPT,
};
