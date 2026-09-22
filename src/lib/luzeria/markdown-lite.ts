// Constrained Markdown parser for client-facing docs (roteiros/planejamento).
// Deliberately supports only what the AI-generated docs actually use — H1–H3,
// paragraphs, bullet lists, **bold** — no links/images/tables/numbered lists.
// No external dependency: the subset is small and stable enough that a
// hand-rolled parser is simpler than pulling in a full Markdown library.
export type MdBlock =
  | { kind: "h1"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "slides"; items: { n: number; text: string }[] };

export function parseMarkdownLite(md: string): MdBlock[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let i = 0;
  const isHeading = (l: string) => /^#{1,3}\s/.test(l);
  const isBullet = (l: string) => /^[-*]\s/.test(l);
  const isSlide = (l: string) => /^slide\s*\d+\s*:/i.test(l);

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) { i++; continue; }

    if (trimmed.startsWith("### ")) { blocks.push({ kind: "h3", text: trimmed.slice(4).trim() }); i++; continue; }
    if (trimmed.startsWith("## ")) { blocks.push({ kind: "h2", text: trimmed.slice(3).trim() }); i++; continue; }
    if (trimmed.startsWith("# ")) { blocks.push({ kind: "h1", text: trimmed.slice(2).trim() }); i++; continue; }

    if (isBullet(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && isBullet(lines[i].trim())) {
        items.push(lines[i].trim().slice(2).trim());
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // "SLIDE N: texto" em linhas seguidas (formato de casa pra carrossel) —
    // cada uma vira um item separado, renderizado como caixinha 4:5 em vez
    // de virar um parágrafo emendado com o resto. Uma linha de continuação
    // (sem "SLIDE N:" na frente) gruda no texto do último slide.
    if (isSlide(trimmed)) {
      const items: { n: number; text: string }[] = [];
      while (i < lines.length && lines[i].trim() && !isHeading(lines[i].trim()) && !isBullet(lines[i].trim())) {
        const t = lines[i].trim();
        const m = t.match(/^slide\s*(\d+)\s*:\s*(.*)$/i);
        if (m) {
          items.push({ n: Number(m[1]), text: m[2].trim() });
        } else if (items.length > 0) {
          items[items.length - 1].text = [items[items.length - 1].text, t].filter(Boolean).join(" ");
        } else {
          break;
        }
        i++;
      }
      blocks.push({ kind: "slides", items });
      continue;
    }

    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !isHeading(lines[i].trim()) && !isBullet(lines[i].trim()) && !isSlide(lines[i].trim())) {
      paraLines.push(lines[i].trim());
      i++;
    }
    // Preserva a quebra de linha original (em vez de emendar tudo com
    // espaço) — o texto só vira um parágrafo novo de verdade quando tem
    // linha em branco entre um trecho e outro; dentro do mesmo bloco, a
    // quebra do usuário é visual (renderizado com white-space: pre-line).
    if (paraLines.length > 0) blocks.push({ kind: "p", text: paraLines.join("\n") });
  }
  return blocks;
}

/** Groups blocks under each H2 — one group per "## Título" section, with
 * everything until the next H2 (or end) as its body. Blocks before the
 * first H2 (e.g. a leading H1) aren't included in any group. Used to
 * render roteiros as separate numbered cards. */
export function groupByH2(blocks: MdBlock[]): { title: string; blocks: MdBlock[] }[] {
  const groups: { title: string; blocks: MdBlock[] }[] = [];
  let current: { title: string; blocks: MdBlock[] } | null = null;
  for (const b of blocks) {
    if (b.kind === "h2") {
      current = { title: b.text, blocks: [] };
      groups.push(current);
    } else if (current) {
      current.blocks.push(b);
    }
  }
  return groups;
}

/** The leading H1, if the doc starts with one — used as an overall title. */
export function leadingTitle(blocks: MdBlock[]): string | null {
  return blocks[0]?.kind === "h1" ? blocks[0].text : null;
}

/** "Roteiro 3: Tour pela loja (Reel)" → "Tour pela loja". The raw heading
 * keeps "Roteiro N:" and o sufixo de formato porque isso é o que casa com
 * client_doc_roteiro_status.roteiro_title (não pode mudar sem migrar o
 * status junto) — mas exibir isso pro usuário repete o número (já tem um
 * "01" ao lado) e o formato (já tem uma cor/etiqueta ao lado, quando tem).
 * Usado tanto na tela (RoteirosView) quanto no PDF exportado. */
export function displayRoteiroTitle(rawTitle: string): string {
  return rawTitle
    .replace(/^roteiro\s+\d+\s*[:\-]\s*/i, "")
    .replace(/\s*\((reel|post|carrossel|est[aá]tico)\)\s*$/i, "")
    .trim();
}
