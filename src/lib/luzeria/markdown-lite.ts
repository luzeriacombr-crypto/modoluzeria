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
  | { kind: "ul"; items: string[] };

export function parseMarkdownLite(md: string): MdBlock[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let i = 0;
  const isHeading = (l: string) => /^#{1,3}\s/.test(l);
  const isBullet = (l: string) => /^[-*]\s/.test(l);

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

    const paraLines: string[] = [];
    while (i < lines.length && lines[i].trim() && !isHeading(lines[i].trim()) && !isBullet(lines[i].trim())) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) blocks.push({ kind: "p", text: paraLines.join(" ") });
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
