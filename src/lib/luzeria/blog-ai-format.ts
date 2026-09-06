import type { BlogBlock } from "./blog-posts";

/** Marcação combinada com a IA — simples o bastante pra qualquer modelo
 * seguir de primeira, mapeada 1:1 pros tipos de BlogBlock. Nada de IA
 * paga aqui: o Junior cola esse prompt em qualquer ferramenta de IA que já
 * usa (Claude, ChatGPT, Gemini...) e cola a resposta de volta. */
export function buildAiFormattingPrompt(rawText: string, extraInstructions?: string): string {
  return `Formate o texto abaixo pro blog do Modo Criador, seguindo EXATAMENTE essa marcação (não use markdown chique, HTML nem nenhuma outra sintaxe):

- A primeira frase/parágrafo de abertura: escreva normal, sem prefixo — é o "gancho" do texto, um pouco mais forte que o resto.
- Parágrafo normal: escreva normal, sem prefixo, uma linha em branco separando de outros blocos.
- Título de seção: comece a linha com "## " (ex: "## O ponto de virada").
- Subtítulo menor: comece a linha com "### ".
- Uma "fala" pessoal, tipo citação: comece a linha com "> ".
- Caixa de destaque: coloque ":::" numa linha (pode escrever um título logo depois, tipo ":::Um ponto importante"), o texto da caixa na linha de baixo, e feche com ":::" sozinho numa linha.
- Lista simples: cada item numa linha começando com "- ".
- Lista numerada com título por item (tipo ranking): cada item assim: "1. **Título**: descrição" (aumentando o número a cada item).
- Pra destacar uma palavra ou frase no meio do texto, use **negrito** (dois asteriscos).

Escreva em português, no tom direto e pessoal que já uso nos outros textos do blog — primeira pessoa do plural ("a gente"), sem enrolação, contando de um jeito natural.
${extraInstructions ? `\nInstrução extra: ${extraInstructions}\n` : ""}
Devolva SÓ o texto formatado, nada de comentário antes ou depois.

TEXTO PRA FORMATAR:
"""
${rawText.trim()}
"""`;
}

/** Desfaz buildAiFormattingPrompt: lê a marcação que a IA devolveu e monta
 * o array de blocos. Feito pra ser tolerante — se a IA errar um detalhe da
 * marcação, o pior caso é uma linha virar parágrafo comum, nunca quebra. */
export function parseAiFormattedText(text: string): BlogBlock[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: BlogBlock[] = [];
  let sawFirstParagraph = false;
  let i = 0;

  function flushParagraphBuffer(buf: string[]) {
    if (buf.length === 0) return;
    const joined = buf.join(" ").trim();
    if (!joined) return;
    if (!sawFirstParagraph) {
      blocks.push({ type: "lead", text: joined });
      sawFirstParagraph = true;
    } else {
      blocks.push({ type: "p", text: joined });
    }
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push({ type: "h3", text: trimmed.slice(4).trim() });
      sawFirstParagraph = true;
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push({ type: "h2", text: trimmed.slice(3).trim() });
      sawFirstParagraph = true;
      i++;
      continue;
    }
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", text: quoteLines.join(" ").trim() });
      sawFirstParagraph = true;
      continue;
    }
    if (trimmed.startsWith(":::")) {
      const title = trimmed.slice(3).trim() || undefined;
      i++;
      const calloutLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== ":::") {
        if (lines[i].trim() !== "") calloutLines.push(lines[i].trim());
        i++;
      }
      i++; // pula o ":::" de fechamento
      blocks.push({ type: "callout", title, text: calloutLines.join(" ").trim() });
      sawFirstParagraph = true;
      continue;
    }
    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("- ")) {
        items.push(lines[i].trim().slice(2).trim());
        i++;
      }
      blocks.push({ type: "list", items });
      sawFirstParagraph = true;
      continue;
    }
    const rankedMatch = trimmed.match(/^\d+\.\s+\*\*(.+?)\*\*:?\s*(.*)$/);
    if (rankedMatch) {
      const items: { title: string; text: string }[] = [];
      while (i < lines.length) {
        const m = lines[i].trim().match(/^\d+\.\s+\*\*(.+?)\*\*:?\s*(.*)$/);
        if (!m) break;
        items.push({ title: m[1].trim(), text: m[2].trim() });
        i++;
      }
      blocks.push({ type: "rankedList", items });
      sawFirstParagraph = true;
      continue;
    }

    // Parágrafo comum — acumula linhas até achar uma em branco ou outro
    // tipo de bloco começando.
    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const t = lines[i].trim();
      if (
        t === "" ||
        t.startsWith("## ") || t.startsWith("### ") || t.startsWith(">") ||
        t.startsWith(":::") || t.startsWith("- ") || /^\d+\.\s+\*\*/.test(t)
      ) break;
      paragraphLines.push(lines[i]);
      i++;
    }
    flushParagraphBuffer(paragraphLines);
  }

  return blocks;
}
