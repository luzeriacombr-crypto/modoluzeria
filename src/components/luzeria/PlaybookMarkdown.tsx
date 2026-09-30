// Renderiza o texto das páginas do Playbook. Markdown enxuto, escrito à mão
// (sem dependência externa), no mesmo espírito do markdown-lite.ts — mas com
// o que um manual precisa: listas numeradas, tabelas, imagens, links e
// blocos de destaque ("> **Dica:** …" e "> **Exemplo:** …").
import { Fragment, type ReactNode } from "react";
import { Lightbulb, Quote, Sparkles } from "lucide-react";

type Block =
  | { kind: "h1" | "h2" | "h3" | "p"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] }
  | { kind: "img"; alt: string; src: string }
  | { kind: "hr" };

function parse(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: Block[] = [];
  let i = 0;
  const isUl = (l: string) => /^[-*]\s+/.test(l);
  const isOl = (l: string) => /^\d+[.)]\s+/.test(l);
  const isTable = (l: string) => /^\|.*\|$/.test(l);
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) { i++; continue; }
    if (/^---+$/.test(t)) { out.push({ kind: "hr" }); i++; continue; }
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(t);
    if (img) { out.push({ kind: "img", alt: img[1], src: img[2] }); i++; continue; }
    if (t.startsWith("### ")) { out.push({ kind: "h3", text: t.slice(4) }); i++; continue; }
    if (t.startsWith("## ")) { out.push({ kind: "h2", text: t.slice(3) }); i++; continue; }
    if (t.startsWith("# ")) { out.push({ kind: "h1", text: t.slice(2) }); i++; continue; }
    if (t.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) { buf.push(lines[i].trim().replace(/^>\s?/, "")); i++; }
      out.push({ kind: "quote", text: buf.join("\n") });
      continue;
    }
    if (isUl(t) || isOl(t)) {
      const ordered = isOl(t);
      const items: string[] = [];
      while (i < lines.length && (ordered ? isOl(lines[i].trim()) : isUl(lines[i].trim()))) {
        items.push(lines[i].trim().replace(ordered ? /^\d+[.)]\s+/ : /^[-*]\s+/, ""));
        i++;
      }
      out.push({ kind: ordered ? "ol" : "ul", items });
      continue;
    }
    if (isTable(t)) {
      const rows: string[][] = [];
      while (i < lines.length && isTable(lines[i].trim())) {
        const cells = lines[i].trim().slice(1, -1).split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      out.push({ kind: "table", head: rows[0] ?? [], rows: rows.slice(1) });
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length) {
      const l = lines[i].trim();
      if (!l || /^(#{1,3}\s|>|[-*]\s|\d+[.)]\s|\||!\[|---+$)/.test(l)) break;
      buf.push(l); i++;
    }
    out.push({ kind: "p", text: buf.join("\n") });
  }
  return out;
}

/** **negrito**, *itálico* e [texto](https://link). */
function Inline({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(<Fragment key={k++}>{text.slice(last, m.index)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith("**")) nodes.push(<strong key={k++} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("[")) {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)!;
      const safe = /^(https?:|\/)/.test(lm[2]) ? lm[2] : "#";
      nodes.push(<a key={k++} href={safe} target={safe.startsWith("/") ? undefined : "_blank"} rel="noreferrer" className="underline underline-offset-2" style={{ color: "var(--lz-accent-ink)" }}>{lm[1]}</a>);
    } else nodes.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(<Fragment key={k++}>{text.slice(last)}</Fragment>);
  return <>{nodes}</>;
}

function Callout({ text }: { text: string }) {
  const kind = /^\*\*dica/i.test(text) ? "dica" : /^\*\*exemplo/i.test(text) ? "exemplo" : "citacao";
  const style = kind === "dica"
    ? { bg: "rgba(var(--lz-brand-rgb),0.08)", border: "rgba(var(--lz-brand-rgb),0.3)", color: "var(--lz-accent-ink)", Icon: Lightbulb }
    : kind === "exemplo"
      ? { bg: "rgba(74,158,255,0.08)", border: "rgba(74,158,255,0.3)", color: "#4A9EFF", Icon: Sparkles }
      : { bg: "color-mix(in srgb, var(--foreground) 4%, transparent)", border: "color-mix(in srgb, var(--foreground) 12%, transparent)", color: "color-mix(in srgb, var(--foreground) 50%, transparent)", Icon: Quote };
  return (
    <div className="my-4 flex gap-3 rounded-xl px-4 py-3.5" style={{ background: style.bg, border: `1px solid ${style.border}` }}>
      <style.Icon size={17} className="shrink-0 mt-0.5" style={{ color: style.color }} />
      <div className="text-[14.5px] leading-relaxed text-foreground/85" style={{ whiteSpace: "pre-line" }}><Inline text={text} /></div>
    </div>
  );
}

export function PlaybookMarkdown({ content }: { content: string }) {
  const blocks = parse(content);
  return (
    <div className="text-foreground/80">
      {blocks.map((b, idx) => {
        switch (b.kind) {
          case "h1": return <h2 key={idx} className="text-xl font-bold text-foreground mt-8 mb-3 first:mt-0"><Inline text={b.text} /></h2>;
          case "h2": return <h3 key={idx} className="text-[17px] font-bold text-foreground mt-8 mb-3 first:mt-0"><Inline text={b.text} /></h3>;
          case "h3": return <h4 key={idx} className="text-[15px] font-semibold text-foreground mt-6 mb-2"><Inline text={b.text} /></h4>;
          case "p": return <p key={idx} className="text-[15px] leading-relaxed mb-4" style={{ whiteSpace: "pre-line" }}><Inline text={b.text} /></p>;
          case "ul":
            return (
              <ul key={idx} className="mb-4 space-y-2">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2.5 text-[15px] leading-relaxed">
                    <span className="mt-[9px] h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }} />
                    <span><Inline text={it} /></span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={idx} className="mb-4 space-y-2.5">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-3 text-[15px] leading-relaxed">
                    <span className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
                      style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.14)", color: "var(--lz-accent-ink)" }}>{j + 1}</span>
                    <span className="pt-0.5"><Inline text={it} /></span>
                  </li>
                ))}
              </ol>
            );
          case "quote": return <Callout key={idx} text={b.text} />;
          case "table":
            return (
              <div key={idx} className="my-4 overflow-x-auto rounded-xl border border-foreground/10">
                <table className="w-full text-sm">
                  <thead><tr className="bg-foreground/[0.04]">{b.head.map((h, j) => <th key={j} className="text-left font-semibold text-foreground px-4 py-2.5"><Inline text={h} /></th>)}</tr></thead>
                  <tbody>{b.rows.map((r, j) => <tr key={j} className="border-t border-foreground/[0.06]">{r.map((c, k) => <td key={k} className="px-4 py-2.5"><Inline text={c} /></td>)}</tr>)}</tbody>
                </table>
              </div>
            );
          case "img":
            if (!/^https:\/\//.test(b.src)) return null;
            return (
              <figure key={idx} className="my-5">
                <img src={b.src} alt={b.alt} loading="lazy" className="w-full rounded-xl border border-foreground/10" />
                {b.alt && <figcaption className="text-xs text-foreground/45 mt-2 text-center">{b.alt}</figcaption>}
              </figure>
            );
          case "hr": return <hr key={idx} className="my-6 border-foreground/10" />;
        }
      })}
    </div>
  );
}
