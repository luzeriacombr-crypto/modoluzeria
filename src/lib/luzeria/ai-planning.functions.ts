// Prévia de planejamento do próximo mês gerada por IA. Validada primeiro
// só com os clientes da própria Luzeria (clients.ai_planning_enabled) —
// agora liberada pra qualquer agência que já tenha chegado no nível Prata
// (Programa de Níveis), como uma novidade a desbloquear evoluindo no app.
// Lê histórico real de conteúdo, o roteiro/planejamento mais recente já
// escrito, os arquivos de marca do Drive e a lista de concorrentes
// informada, e pede pra IA pesquisar os concorrentes na web (tool nativo
// da Anthropic) antes de sugerir a prévia. Nunca escreve nada sozinha —
// o resultado só vira um client_docs de verdade se a pessoa clicar em
// "Salvar como Planejamento" depois de revisar.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { computeAgencyPoints, getAgencyLevel, computeAiPlanningQuota } from "./agency-level";

// Índice de "Prata I" em AGENCY_TIER_NAMES/THRESHOLDS (agency-level.ts):
// Bronze ocupa os índices 0-2, Prata começa no 3. Combinado com o Junior:
// essa função é a primeira "novidade" travada por nível do app.
const MIN_LEVEL_INDEX_FOR_AI_PLANNING = 3;

// Formato de casa da Luzeria, exatamente como o Junior manda — a IA deve
// escrever `captionDraft` já pronto nesse formato, não um resumo genérico.
// IMPORTANTE: captionDraft é o TEXTO DE PRODUÇÃO (roteiro/slides/imagem) —
// vira o Briefing do content_item. publishCaption é a legenda de verdade
// que vai publicada junto com o post/reel — são coisas diferentes, nunca
// repita o mesmo texto nos dois.
export const HOUSE_STYLE_GUIDE = `FORMATO DE CASA: captionDraft precisa sair PRONTO PRA USAR, no formato exato abaixo (nunca um resumo genérico).

PROIBIDO usar o caractere travessão (—) em QUALQUER texto gerado (captionDraft, publishCaption, títulos), em nenhuma hipótese, nem uma vez. Troque sempre por vírgula, ponto, dois-pontos ou reestruture a frase. Isso vale pra tudo abaixo, inclusive pra estrutura de contraste tipo "não é sobre X, é sobre Y" — pode escrever esse tipo de contraste, só nunca com travessão no meio.

ANTES DE TUDO: isso vale tanto pro captionDraft (o roteiro/texto de produção) quanto pro publishCaption (a legenda, ver mais abaixo). Nunca escreva com "cara de texto gerado por IA". Evite especificamente:
- "É importante ressaltar/destacar", pergunta retórica genérica pra abrir todo texto (tipo "Você sabia que...?").
- "Primeiro... Segundo... Terceiro..." em toda peça (varie a estrutura de um roteiro pro outro).
- Frase de marketing vaga tipo "cuidado de qualidade" ou "atendimento diferenciado" sem nenhum fato concreto por trás.
- Trio de frases curtas telegráficas separadas por ponto, tipo "Fachada nova. Recepção nova. Laboratório novo." Isso é tique clássico de IA, prefira uma frase corrida de verdade.
- Construção de contraste usada como muleta em quase toda peça (tipo "Não é sobre X, é sobre Y"). Pode aparecer uma vez ou outra, nunca como fórmula fixa.
- Encerramento sempre igual (mesma frase de CTA repetida peça após peça).
Prefira sempre um fato, número ou detalhe específico (da base de conhecimento da agência ou do histórico do cliente, quando disponível) a uma frase genérica: é isso que faz o texto soar escrito por alguém que conhece o negócio de verdade, não gerado por IA. NUNCA inclua, em nenhum texto ou título, qualquer menção a "IA", "inteligência artificial" ou "gerado por": o cliente final nunca deve saber que esse conteúdo passou por IA.

Se for POST estático (format: "estático"):
TEXTO:
<texto do post, direto, sem enrolação>

Exemplo real:
TEXTO:
Cuidar de você também é a nossa forma de agradecer.
Feliz dia do Cliente.

Se for POST carrossel (format: "carrossel"):
SLIDE 1: <texto do slide 1>
SLIDE 2: <texto do slide 2>
(continue "SLIDE N:" pra cada slide. VARIE a quantidade entre os carrosséis do lote, de 3 a 8 slides conforme o que a mensagem realmente precisa, não estique um carrossel só pra bater um número redondo. O último costuma ser a chamada pra ação, mas nem sempre precisa. E nem todo carrossel precisa de um slide 1 "de contexto/introdução" genérico antes de ir ao ponto: se o assunto já é direto, comece o SLIDE 1 falando a coisa em si, sem enrolar.)

Exemplo real:
SLIDE 1: Aos 30, seu rosto já começa a perder o que sustenta ele.
SLIDE 2: A pele não faz isso sozinha. O osso também vai reabsorvendo aos poucos essa sustentação.
SLIDE 3: E o preenchimento sozinho sem entender essa base, quase nunca resolve.
SLIDE 4: Por isso meu trabalho começa entendendo o que o rosto perdeu, não o que ele "precisa ganhar".
SLIDE 5: Meu trabalho é repor estrutura, não só volume.
SLIDE 6: Quer saber o que o seu rosto precisa? Me manda uma mensagem.

Se for REEL: roteiro completo, pronto pra gravar. Gancho forte na primeira linha, corpo desenvolvendo o argumento (pode ter lista numerada por extenso tipo "Primeiro:... Segundo:..." e notas de direção entre parênteses quando ajudar, tipo "(aparece a imagem de X)"), terminando SEMPRE com uma chamada pra comentário/compartilhamento.

Exemplos reais (observe o tom: direto, frase curta, sem enrolação, nada de emoji forçado, sem travessão):
"Três sinais do joelho que, se fossem meus, eu não deixaria passar. Primeiro: estalo com dor, diferente de estalo sem dor, que é comum. Segundo: inchaço que aparece depois do esforço e demora a sumir. Terceiro: sensação de falseio, quando o joelho parece que vai ceder. Nenhum desses é motivo pra pânico. Mas todos são motivo pra avaliação."

"Doutor, fiz PRP e ainda sinto dor. Isso é normal? É, pode ser. PRP não é resultado imediato, o corpo precisa de tempo pra responder ao estímulo, geralmente algumas semanas. E outra coisa importante: raramente o PRP é usado sozinho, ele costuma vir junto de fisioterapia e acompanhamento clínico de perto. Sentir dor residual nas primeiras semanas não significa que o tratamento falhou. Se você já fez PRP e tem dúvida sobre o resultado, comenta aqui que eu respondo."

FORMATOS DE REEL, varie de verdade o formato entre um reel e outro, não só o tema:
- Direto pra câmera (R1): uma pessoa falando direto, gancho forte na primeira frase.
- Vlog de bastidor (R2): narração por cima de imagens do dia a dia da produção/loja/fábrica. Quando o vídeo abrir com uma imagem forte antes de falar, comece com um "Gancho visual:" entre parênteses ou em linha separada (ex: "Gancho visual: abre em close de X, sem falar nada nos primeiros segundos, corta pra Y.") antes da narração.
- Tela dividida (R3): quando o cliente tiver mais de um produto/opção real pra comparar, prefira fazer em RODADAS (uma comparação por produto/situação, no formato "Rodada N | tema: lado esquerdo X, lado direito Y com o produto real") em vez de uma única comparação isolada e abstrata, pra aproveitar e citar vários produtos de verdade de uma vez.
- Depoimento/entrevista: quando fizer sentido dar voz a mais de uma pessoa da equipe em vez de um narrador único, estruture como voz em off perguntando + "Fala 1:", "Fala 2:", "Fala 3:" com respostas curtas e diferentes entre si, terminando com a nota "(as respostas podem ser trocadas pelo que a pessoa falar de verdade na hora de gravar, quanto mais espontâneo melhor)".
- Personagem/fundador como voz: se o histórico/briefing do cliente citar um fundador ou personagem de marca conhecido, considere ele como quem fala direto pra câmera em conteúdo mais emocional/institucional, em vez de sempre um narrador genérico. Pra conteúdo de nicho bem específico (linha fitness, linha infantil), considere atribuir a alguém nomeado daquela frente, se o briefing/histórico mencionar essa pessoa, em vez de sempre a mesma voz pra tudo.

SEMPRE QUE FOR CONTEÚDO PRÁTICO (receita, dica de uso, "como fazer"): dê o passo a passo REAL e específico (o quê, em que ordem, quanto tempo), nunca só a promessa emocional em volta sem nunca explicar como fazer de verdade. Um "troque X por Y" sem o passo a passo de como fazer Y não serve pra nada.

NUNCA INVENTE nome de produto, linha ou fato específico do cliente que não esteja no briefing, histórico ou base de conhecimento disponível no contexto. Se o roteiro pedir um produto/detalhe específico e você não tiver certeza que ele existe de verdade na linha do cliente, escreva mesmo assim usando o nome mais plausível baseado no que você tem, mas adicione uma nota separada pro time revisar antes de gravar, tipo: "Confirma se [produto] faz parte da linha antes de gravar. Se não for, dá pra usar a mesma estrutura com [alternativa]." Nunca finja certeza sobre um fato que você não verificou. Prefira SEMPRE um fato/produto real e específico do cliente a um genérico inventado ("tempero completo", "produto de qualidade").

NOTAS DE PRODUÇÃO, quando ajudarem a equipe a gravar: liste "Imagens de apoio:" com os b-rolls/imagens de reforço que a edição vai precisar, separado da narração principal, sempre que o reel misturar fala com imagens de apoio. Se o roteiro tiver múltiplas cenas fixas em sequência (ex: um tour por um lugar), pode abrir com uma linha "Cena | local 1 | local 2 | local 3" listando os ambientes na ordem que aparecem. Se um roteiro provavelmente ficar longo demais pra um Reel só, avise numa nota separada que dá pra quebrar em série.

MODERE O TOM DE ENSAIO REFLEXIVO: contraste tipo "não é sobre X, é sobre Y" e reflexão filosófica em volta do produto podem aparecer, mas no máximo 1 vez por leva de sugestões, nunca em quase toda peça. Conteúdo institucional/B2B/lista prática (ex: "como revender", "5 temperos que não podem faltar") deve ir direto ao ponto, sem embrulhar em narrativa emocional que ele não precisa.

REGRA FIXA: nunca escreva a palavra "GRAVADO" em nenhum título ou texto, isso é só uma marcação de controle interna da agência, não faz parte do conteúdo.

publishCaption é OUTRO texto, sempre: a legenda de verdade que vai publicada junto com o post/reel no Instagram (o que aparece embaixo da mídia). Por padrão, prefira legendas MÉDIAS ou LONGAS, mais desenvolvidas. Só use uma curtíssima quando o conteúdo realmente já fala por si (promoção pontual, aviso rápido, humor). Nunca deixe todas as legendas do lote com uma frase só, isso fica repetitivo e genérico:
- Curtíssima (1 frase, gancho + CTA): exceção, não a regra.
- Média (2-4 linhas curtas, com quebra de linha entre elas): padrão pra maioria dos posts educativos/institucionais.
- Longa (parágrafos curtos com quebra de linha entre eles, pode ter 1-3 linhas com "- " no meio): quando o post pede contexto, storytelling ou prova social (depoimento, case, explicação mais completa). Use com mais frequência do que a curtíssima.
Numa leva de sugestões, misture os tamanhos, mas puxando mais pra média/longa. Nunca repita captionDraft ali (não cole o roteiro/slides inteiro como legenda): é um texto PRÓPRIO, pensado pra funcionar sozinho embaixo do post.

APROFUNDE, não fique na superfície: sempre que houver base de conhecimento da agência ou histórico do cliente disponível no contexto, puxe fatos e detalhes CONCRETOS de lá (um número, um processo específico, um diferencial real) em vez de frase genérica de marketing tipo "cuidado de qualidade" ou "atendimento especial". Isso é o que faz a legenda parecer escrita por alguém que conhece o negócio, não gerada por IA.

EMOJI: use ocasionalmente como padrão (não em toda frase, um ou dois por legenda no máximo, só onde soa natural, nunca fileira de emoji nem emoji decorativo sem função).

EVITE SOAR COMO TEXTO GERADO POR IA: nunca use essas muletas: "É importante ressaltar/destacar", "não deixe de", "confira", pergunta retórica genérica pra abrir toda legenda (tipo "Você sabia que...?"), "Primeiro... Segundo... Terceiro..." em toda legenda (varie a estrutura), encerramento sempre igual tipo "Fica de olho!"/"Vem com a gente!". Escreva como uma pessoa de verdade que conhece o negócio escreveria: específico, com voz própria, cada legenda estruturada de um jeito diferente da anterior.

Exemplos reais de legenda (repare a variação de tamanho, o emoji ocasional e a ausência total de travessão):
Curta: "Joelho estalando com dor? Não é normal. Comenta aqui que eu te explico 👇"
Média: "Fez PRP e ainda sente dor?
Isso pode ser normal nas primeiras semanas, o corpo precisa de tempo pra responder ao estímulo.
Se tiver dúvida sobre o seu caso, comenta aqui que eu te oriento."
Longa: "Três sinais do joelho que eu não deixaria passar 🦵

- Estalo COM dor (diferente do estalo sem dor, que é comum)
- Inchaço que demora a sumir depois do esforço
- Sensação de falseio, como se o joelho fosse ceder

Nenhum desses é motivo pra pânico. Mas todos são motivo pra avaliação.
Se identificou algum, comenta aqui que eu te oriento."`;

const WEB_SEARCH_TOOL = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 5,
};

const REPORT_PLAN_TOOL = {
  name: "report_monthly_plan",
  description: "Reporta a prévia de planejamento de conteúdo do próximo mês pro cliente.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string" as const,
        description: "Resumo curto (2-4 frases) da estratégia geral sugerida pro mês, em português.",
      },
      items: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            title: { type: "string" as const, description: "Título curto da publicação sugerida. NUNCA inclua a palavra 'GRAVADO'" },
            type: { type: "string" as const, enum: ["post", "reel"] },
            pillar: { type: "string" as const, description: "Pilar/tema de conteúdo, ex: bastidores, prova social, educativo" },
            captionDraft: { type: "string" as const, description: "TEXTO DE PRODUÇÃO pronto pra usar, no formato de casa exato (TEXTO:/SLIDE N:/roteiro de reel, ver instrução). Isso vira o Briefing, não a legenda publicada. Nunca use o caractere travessão (—)." },
            publishCaption: { type: "string" as const, description: "A LEGENDA DE VERDADE que vai publicada junto com o post/reel, no tom da marca. VARIE o tamanho entre as sugestões (curta/média/longa, ver instrução), nunca uma frase só toda vez. NUNCA igual a captionDraft. Nunca use o caractere travessão (—)." },
            postFormat: { type: "string" as const, enum: ["estatico", "carrossel"], description: "OBRIGATÓRIO quando type=post. Decide o botão de formato real do post no sistema. Precisa bater com o formato usado em captionDraft (TEXTO: → estatico, SLIDE N: → carrossel). Não usar quando type=reel." },
            format: { type: "string" as const, description: "Descrição livre do formato/estilo, pra contexto humano (ex: 'vlog', 'lista', 'POV', 'carrossel educativo'). Não substitui postFormat." },
            rationale: { type: "string" as const, description: "Por que essa publicação faz sentido agora, em 1 frase" },
          },
          required: ["title", "type", "captionDraft", "publishCaption"],
        },
      },
      competitorNotes: {
        type: "string" as const,
        description: "O que a pesquisa dos concorrentes trouxe de relevante, em português. Deixe vazio se nenhum concorrente foi informado.",
      },
    },
    required: ["summary", "items"],
  },
};

// Corta uma string sem quebrar um par substituto UTF-16 (emoji etc) ao
// meio — .slice(0,N) puro pode cortar exatamente entre as duas metades de
// um emoji e gerar uma string inválida que a API da Anthropic recusa com
// "no low surrogate in string".
export function safeTruncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  let end = maxLen;
  const code = text.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return text.slice(0, end);
}

const PlanItemSchema = z.object({
  title: z.string(),
  type: z.enum(["post", "reel"]),
  pillar: z.string().optional(),
  captionDraft: z.string(),
  publishCaption: z.string(),
  postFormat: z.enum(["estatico", "carrossel"]).optional(),
  format: z.string().optional(),
  rationale: z.string().optional(),
});
const PlanResultSchema = z.object({
  summary: z.string(),
  items: z.array(PlanItemSchema).max(60),
  competitorNotes: z.string().optional(),
});
export type MonthlyPlanItem = z.infer<typeof PlanItemSchema>;
export type MonthlyPlanResult = z.infer<typeof PlanResultSchema> & {
  /** Quantas entradas a base de conhecimento da agência tinha na hora
   * dessa geração — usado pra sugerir preencher a base quando estiver
   * vazia (feature em beta, quanto mais contexto melhor o resultado). */
  knowledgeItemsCount: number;
};

export const generateMonthlyPlanPreview = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; extraContext?: string }) =>
    z.object({
      clientId: z.string().uuid(),
      // Colado na hora, só pra essa geração — reunião recente, transcrição,
      // briefing pontual do mês. Não é persistido (diferente do briefing
      // fixo salvo na Ficha do Cliente).
      // Pode ser uma transcrição de reunião inteira — bem mais generoso que
      // os outros campos de texto do app.
      extraContext: z.string().trim().max(60000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<MonthlyPlanResult> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    // competitors/content_briefing/recent_roteiros/ai_planning_enabled são
    // colunas novas — cast até os tipos do Supabase serem regenerados.
    const { data: client, error: clientError } = await (context.supabase as any)
      .from("clients")
      .select("id, name, niche, posts_per_week, reels_per_week, description, notes, competitors, content_briefing, recent_roteiros, ai_planning_enabled")
      .eq("id", data.clientId)
      .maybeSingle();
    if (clientError) throw new Error(clientError.message);
    if (!client) throw new Error("Cliente não encontrado.");
    const c: any = client;

    // Gate em duas camadas — substitui a liberação manual por cliente que
    // valia só durante o teste na Luzeria: (1) a AGÊNCIA precisa ter
    // chegado no nível Prata, (2) dentro da cota que o nível+plano dão,
    // esse CLIENTE específico precisa estar marcado (setClientAiPlanningEnabled,
    // escolhido pela própria agência na Ficha do Cliente). Fail-closed: se
    // não der pra calcular o nível por qualquer motivo, fica bloqueado.
    const { fetchAgencyLevelInputs, LUZERIA_ORG_ID } = await import("./api.functions");
    if (context.orgId !== LUZERIA_ORG_ID) {
      const levelInputs = await fetchAgencyLevelInputs(context.supabase, context.orgId);
      const level = getAgencyLevel(computeAgencyPoints(levelInputs));
      if (level.index < MIN_LEVEL_INDEX_FOR_AI_PLANNING) {
        throw new Error(`Essa novidade é liberada a partir do nível Prata — sua agência está em ${level.label}. Continue usando o Modo Criador pra subir de nível.`);
      }
      if (!c.ai_planning_enabled) {
        throw new Error("Esse cliente ainda não foi ativado pra IA de planejamento — ative na Ficha do Cliente (dentro da cota do seu nível).");
      }
    }

    const { data: historyRows } = await context.supabase
      .from("content_items")
      .select("title, caption, type, status, post_format, reel_type, months!inner(client_id)")
      .eq("months.client_id", data.clientId)
      .in("type", ["post", "reel"])
      .is("deleted_at", null)
      .order("last_status_change_at", { ascending: false })
      .limit(60);
    const history = (historyRows ?? []) as any[];
    const historyText = history.length
      ? history.map((h) => {
          const format = h.type === "post" ? h.post_format : h.reel_type;
          return `- [${h.type}${format ? `/${format}` : ""}] ${h.title || "(sem título)"} (${h.status})${h.caption ? ` — legenda: ${safeTruncate(String(h.caption), 200)}` : ""}`;
        }).join("\n")
      : "Nenhum post/reel no histórico ainda.";

    const { data: docRows } = await context.supabase
      .from("client_docs")
      .select("content")
      .eq("client_id", data.clientId)
      .order("updated_at", { ascending: false })
      .limit(1);
    const lastDocContent = (docRows ?? [])[0]?.content as string | undefined;

    const { data: assetRows } = await (context.supabase as any)
      .from("client_brand_assets")
      .select("drive_file_id, mime_type, name")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false })
      .limit(5);
    const assets = ((assetRows ?? []) as any[]).filter(
      (a) => a.mime_type?.startsWith("image/") || a.mime_type === "application/pdf",
    );

    const assetBlocks: any[] = [];
    if (assets.length) {
      const { withDriveOrg, downloadDriveFileBase64 } = await import("./drive.functions");
      await withDriveOrg(context.orgId, async () => {
        for (const asset of assets) {
          const file = await downloadDriveFileBase64(asset.drive_file_id);
          if (!file) continue;
          assetBlocks.push({ type: "text", text: `Arquivo de marca: ${asset.name}` });
          if (file.mimeType.startsWith("image/")) {
            assetBlocks.push({ type: "image", source: { type: "base64", media_type: file.mimeType, data: file.base64 } });
          } else if (file.mimeType === "application/pdf") {
            assetBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } });
          }
        }
      });
    }

    // Banco de conhecimento da agência (texto livre + arquivos) — ensina a
    // IA como essa agência cria conteúdo, além do histórico específico
    // desse cliente. PDF entra como document block (a Anthropic extrai
    // sozinha); Markdown/texto entra direto como texto; .doc/.docx é
    // guardado mas ainda não é lido (sem lib de extração instalada).
    const { data: knowledgeRows } = await (context.supabase as any)
      .from("org_content_knowledge")
      .select("kind, title, text_content, storage_path, file_name, mime_type")
      .eq("org_id", context.orgId)
      .order("created_at", { ascending: false })
      .limit(20);
    const knowledge = (knowledgeRows ?? []) as any[];
    const knowledgeTextParts: string[] = [];
    const knowledgeBlocks: any[] = [];
    for (const k of knowledge) {
      if (k.kind === "text" && k.text_content) {
        knowledgeTextParts.push(`### ${k.title || "Nota"}\n${safeTruncate(String(k.text_content), 8000)}`);
        continue;
      }
      if (k.kind === "file" && k.storage_path) {
        const isReadableText = k.mime_type === "text/markdown" || k.mime_type === "text/plain"
          || /\.(md|txt)$/i.test(k.file_name ?? "");
        const isPdf = k.mime_type === "application/pdf" || /\.pdf$/i.test(k.file_name ?? "");
        if (!isReadableText && !isPdf) continue; // .doc/.docx etc — guardado, não lido ainda
        const { data: fileBlob } = await context.supabase.storage.from("org-knowledge").download(k.storage_path);
        if (!fileBlob) continue;
        if (isReadableText) {
          const text = await fileBlob.text();
          knowledgeTextParts.push(`### ${k.title || k.file_name}\n${safeTruncate(text, 8000)}`);
        } else {
          const buf = Buffer.from(await fileBlob.arrayBuffer());
          knowledgeBlocks.push({ type: "text", text: `Documento da base de conhecimento: ${k.title || k.file_name}` });
          knowledgeBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } });
        }
      }
    }
    const knowledgeText = knowledgeTextParts.length
      ? `\n\nBase de conhecimento da agência (como ela costuma criar conteúdo, guias de voz/estilo etc — use isso pra escrever no tom certo):\n${knowledgeTextParts.join("\n\n")}`
      : "";

    const briefText = [
      `Cliente: ${c.name}`,
      c.niche ? `Nicho: ${c.niche}` : null,
      `Meta: ${c.posts_per_week ?? 0} posts/mês e ${c.reels_per_week ?? 0} reels/mês`,
      c.description ? `Descrição/briefing: ${c.description}` : null,
      c.notes ? `Observações internas: ${c.notes}` : null,
    ].filter(Boolean).join("\n");

    const competitorsText: string | null = c.competitors?.trim() || null;
    const contentBriefingText: string | null = c.content_briefing?.trim() || null;
    const recentRoteirosText: string | null = c.recent_roteiros?.trim() || null;

    const instruction = [
      "Você é um estrategista de conteúdo de uma agência de social media, ajudando a montar uma PRÉVIA (rascunho pra revisão, não versão final) de planejamento de conteúdo do próximo mês pra um cliente.",
      "",
      briefText,
      "",
      "Histórico recente de posts/reels já produzidos pro cliente (use pra manter o tom de voz e não repetir temas recentes):",
      historyText,
      lastDocContent ? `\n\nDocumento de roteiro/planejamento mais recente já escrito pro cliente (contexto de tom de voz e temas já tratados):\n${safeTruncate(lastDocContent, 6000)}` : "",
      contentBriefingText ? `\n\nBriefing/sistema de conteúdo específico desse cliente (siga isso à risca, é o manual de como criar pra ele):\n${safeTruncate(contentBriefingText, 8000)}` : "",
      recentRoteirosText ? `\n\nRoteiros recentes já escritos pra esse cliente (use pra aprender o padrão e o tom exatos já usados, não repita os mesmos temas):\n${safeTruncate(recentRoteirosText, 8000)}` : "",
      knowledgeText,
      data.extraContext ? `\n\nContexto informado agora, específico pra ESSE planejamento (reunião recente, transcrição, briefing pontual do mês — prioridade alta, é a informação mais atual que existe, siga isso de perto):\n${safeTruncate(data.extraContext, 50000)}` : "",
      competitorsText
        ? `\n\nConcorrentes informados pela agência — pesquise na web (use a tool web_search) o que cada um tem postado recentemente, formatos e temas em alta, ANTES de sugerir o planejamento, e cite o que encontrou em competitorNotes:\n${competitorsText}`
        : "\n\nNenhum concorrente foi informado — não pesquise nada, deixe competitorNotes vazio.",
      "",
      HOUSE_STYLE_GUIDE,
      "",
      `Gere entre 4 e 12 sugestões de posts/reels pro próximo mês, com a mistura de tipos batendo aproximadamente com a meta mensal informada acima. Escreva tudo em português do Brasil, com tom real e específico do nicho do cliente — nunca genérico ou clichê. As legendas (publishCaption) precisam variar de tamanho entre si — misture curtas, médias e longas na mesma leva, não entregue tudo com uma frase só. Termine SEMPRE chamando a tool report_monthly_plan com o resultado final.`,
    ].filter(Boolean).join("\n");

    const { getAnthropicClient, PLANNING_MODEL } = await import("./ai-client.server");
    const anthropic = getAnthropicClient();

    const response = await anthropic.messages.create({
      model: PLANNING_MODEL,
      // Até 12 itens com captionDraft completo no formato de casa (carrossel
      // pode ter 5-8 slides) mais o texto de busca de concorrentes já
      // estourava os 8000 tokens antigos antes de fechar a tool_use final —
      // margem generosa pra não cortar a resposta no meio.
      max_tokens: 16000,
      tools: [WEB_SEARCH_TOOL as any, REPORT_PLAN_TOOL],
      tool_choice: { type: "auto" },
      messages: [{
        role: "user",
        content: [{ type: "text", text: instruction }, ...assetBlocks, ...knowledgeBlocks],
      }],
    } as any);

    const toolUse = [...response.content].reverse().find(
      (b: any) => b.type === "tool_use" && b.name === "report_monthly_plan",
    ) as any;
    if (!toolUse) {
      console.error("generateMonthlyPlanPreview: sem tool_use", { stopReason: (response as any).stop_reason, clientId: data.clientId });
      throw new Error(
        (response as any).stop_reason === "max_tokens"
          ? "A prévia ficou grande demais e foi cortada — tenta gerar de novo."
          : "Não consegui gerar a prévia — tenta de novo.",
      );
    }
    const parsed = PlanResultSchema.parse(toolUse.input);
    return { ...parsed, knowledgeItemsCount: knowledge.length };
  });

/** Liga/desliga a IA de planejamento pra UM cliente específico — a própria
 * agência escolhe quais clientes usam sua cota (computeAiPlanningQuota,
 * agency-level.ts), em vez de um número fixo/automático. Só valida a cota
 * ao LIGAR (desligar sempre é permitido); se o nível cair depois e a
 * agência ficar acima da cota, os clientes já ativados continuam
 * funcionando até alguém desativar manualmente — evita um "desliga sozinho
 * no meio da noite" surpreendente. */
export const setClientAiPlanningEnabled = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; enabled: boolean }) =>
    z.object({ clientId: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    const { fetchAgencyLevelInputs, LUZERIA_ORG_ID } = await import("./api.functions");
    if (data.enabled && context.orgId !== LUZERIA_ORG_ID) {
      const levelInputs = await fetchAgencyLevelInputs(context.supabase, context.orgId);
      const level = getAgencyLevel(computeAgencyPoints(levelInputs));
      const quota = computeAiPlanningQuota(level, levelInputs.planMaxClients);
      if (quota <= 0) {
        throw new Error(`Essa novidade é liberada a partir do nível Prata — sua agência está em ${level.label}.`);
      }
      const { count } = await (context.supabase as any)
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("org_id", context.orgId)
        .eq("ai_planning_enabled", true);
      if ((count ?? 0) >= quota) {
        throw new Error(`Sua agência já usou toda a cota de ${quota} cliente(s) liberado(s) no nível ${level.label}. Desative em outro cliente primeiro, ou suba de nível.`);
      }
    }

    const { error } = await (context.supabase as any)
      .from("clients")
      .update({ ai_planning_enabled: data.enabled })
      .eq("id", data.clientId)
      .eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Avaliação de satisfação da prévia (feature em beta) — 0 a 5 estrelas +
 * motivo opcional. Admin-only, uma linha por avaliação. */
export const submitAiPlanningFeedback = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; rating: number; reason?: string }) =>
    z.object({
      clientId: z.string().uuid(),
      rating: z.number().int().min(0).max(5),
      reason: z.string().trim().max(1000).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await (context.supabase as any).from("ai_planning_feedback").insert({
      org_id: context.orgId, client_id: data.clientId,
      rating: data.rating, reason: data.reason || null, created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type AiPlanningFeedbackRow = {
  id: string;
  rating: number;
  reason: string | null;
  createdAt: string;
  orgName: string;
  clientName: string;
};

/** Platform-admin only: todas as avaliações de satisfação da feature em
 * beta, de todas as agências — pra acompanhar a recepção em Configurações
 * → Plano e Cobrança. */
export const listAiPlanningFeedback = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<AiPlanningFeedbackRow[]> => {
    const { LUZERIA_ORG_ID } = await import("./api.functions");
    if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("ai_planning_feedback")
      .select("id, rating, reason, created_at, orgs(name), clients(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id, rating: r.rating, reason: r.reason, createdAt: r.created_at,
      orgName: r.orgs?.name ?? "—", clientName: r.clients?.name ?? "—",
    }));
  });
