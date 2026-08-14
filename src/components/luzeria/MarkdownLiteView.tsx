import { FileText, Layers } from "lucide-react";
import { type MdBlock, groupByH2, leadingTitle } from "@/lib/luzeria/markdown-lite";

function MdInline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i} className="font-bold" style={{ color: "rgb(var(--lz-brand-rgb))" }}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>,
      )}
    </>
  );
}

function BlockRenderer({ block }: { block: MdBlock }) {
  switch (block.kind) {
    case "h1": return null; // rendered separately as the doc title
    case "h2":
      return <h3 className="text-white font-bold text-[15px] mt-6 mb-2 first:mt-0">{block.text}</h3>;
    case "h3":
      return <h4 className="text-white/80 font-semibold text-[13px] mt-4 mb-1.5">{block.text}</h4>;
    case "p":
      return <p className="text-white/70 text-[13.5px] leading-relaxed mb-3"><MdInline text={block.text} /></p>;
    case "ul":
      return (
        <ul className="mb-3 space-y-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-white/70 text-[13.5px] leading-relaxed">
              <span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }} />
              <span><MdInline text={item} /></span>
            </li>
          ))}
        </ul>
      );
  }
}

/** Flowing document view — planejamento/relatório. H1 becomes the title,
 * every H2 a section, rendered top to bottom. */
export function PlanejamentoView({ blocks }: { blocks: MdBlock[] }) {
  const title = leadingTitle(blocks);
  const rest = title ? blocks.slice(1) : blocks;
  return (
    <div className="rounded-xl p-5 md:p-6" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.06)" }}>
      {title && (
        <div className="flex items-center gap-2 mb-5">
          <FileText size={16} style={{ color: "rgb(var(--lz-brand-rgb))" }} />
          <h2 className="text-white font-bold text-lg">{title}</h2>
        </div>
      )}
      {rest.map((b, i) => <BlockRenderer key={i} block={b} />)}
    </div>
  );
}

/** Card-per-roteiro view — each "## Roteiro N: Título" section becomes a
 * numbered card, with a count header so the client sees at a glance how
 * many roteiros there are. */
export function RoteirosView({ blocks }: { blocks: MdBlock[] }) {
  const groups = groupByH2(blocks);
  if (groups.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Layers size={15} style={{ color: "rgb(var(--lz-brand-rgb))" }} />
        <span className="text-white/60 text-[12px] font-semibold uppercase tracking-wide">
          {groups.length} {groups.length === 1 ? "roteiro" : "roteiros"}
        </span>
      </div>
      <div className="space-y-3">
        {groups.map((g, i) => (
          <div key={i} className="rounded-xl p-5" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-start gap-3">
              <span
                className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "rgb(var(--lz-brand-rgb))" }}
              >{String(i + 1).padStart(2, "0")}</span>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-white font-bold text-[14.5px] mb-2">{g.title}</h3>
                {g.blocks.map((b, j) => <BlockRenderer key={j} block={b} />)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
