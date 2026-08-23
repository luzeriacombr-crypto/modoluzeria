import type { ReactNode } from "react";
import { Layers, Target, Compass, Lightbulb, TrendingUp, ListChecks, Users, Calendar, Sparkles, Check } from "lucide-react";
import { type MdBlock, groupByH2, leadingTitle } from "@/lib/luzeria/markdown-lite";

function MdInline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i} className="font-bold" style={{ color: "var(--lz-accent-ink)" }}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>,
      )}
    </>
  );
}

function BlockRenderer({ block }: { block: MdBlock }) {
  switch (block.kind) {
    case "h1": return null; // rendered separately as the doc title
    case "h2":
      return <h3 className="text-foreground font-bold text-[15px] mt-6 mb-2 first:mt-0">{block.text}</h3>;
    case "h3":
      return <h4 className="text-foreground/80 font-semibold text-[13px] mt-4 mb-1.5">{block.text}</h4>;
    case "p":
      return <p className="text-foreground/70 text-[13.5px] leading-relaxed mb-3"><MdInline text={block.text} /></p>;
    case "ul":
      return (
        <ul className="mb-3 space-y-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-foreground/70 text-[13.5px] leading-relaxed">
              <span className="mt-1.5 h-1 w-1 rounded-full shrink-0" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }} />
              <span><MdInline text={item} /></span>
            </li>
          ))}
        </ul>
      );
  }
}

/** Picks a section icon from its title's keywords — purely cosmetic, falls
 * back to a generic sparkle when nothing matches. */
function sectionIcon(title: string) {
  const t = title.toLowerCase();
  if (/objetivo|meta|direç|direc/.test(t)) return Target;
  if (/estratég|estrateg|abordagem/.test(t)) return Compass;
  if (/tema|assunto|pauta|ideia/.test(t)) return Lightbulb;
  if (/resultado|métrica|metrica|desempenho|indicador|número|numero/.test(t)) return TrendingUp;
  if (/próximo|proximo|passo|ação|acao/.test(t)) return ListChecks;
  if (/público|publico|audiênc|audienc/.test(t)) return Users;
  if (/produç|produc|formato|cronograma|calendári|calendar|conteúdo|conteudo/.test(t)) return Calendar;
  return Sparkles;
}

type StatItem = { label: string; value: string; suffix: string };

/** Matches bullets shaped like "Alcance total: **38.420 contas**" or
 * "Conteúdo educativo: **40%**" — a label, a colon, and a bold span that
 * starts with a number (the rest of the bold span, if any, becomes the
 * unit/suffix). Used to promote number-heavy lists into a stat grid
 * instead of a plain bullet list. */
function parseStatItem(raw: string): StatItem | null {
  const m = raw.match(/^(.+?):\s*\*\*(.+?)\*\*\s*(.*)$/);
  if (!m) return null;
  const numMatch = m[2].trim().match(/^([\d.,]+%?)\s*(.*)$/);
  if (!numMatch) return null;
  const suffix = [numMatch[2], m[3].trim()].filter(Boolean).join(" ").trim();
  return { label: m[1].trim(), value: numMatch[1], suffix };
}

function StatGrid({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
      {items.map((s, i) => (
        <div key={i} className="rounded-lg p-3" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
          <div className="font-extrabold text-xl leading-none tabular-nums" style={{ color: "var(--lz-accent-ink)" }}>{s.value}</div>
          {s.suffix && <div className="text-foreground/45 text-[10.5px] font-semibold mt-1 leading-snug">{s.suffix}</div>}
          <div className="text-foreground/50 text-[11px] mt-1.5 leading-snug">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

function ChecklistItems({ items }: { items: string[] }) {
  return (
    <div className="space-y-1.5 mb-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2.5 rounded-lg px-3 py-2.5" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)", border: "1px solid color-mix(in srgb, var(--foreground) 5%, transparent)" }}>
          <span className="shrink-0 mt-[3px] h-4 w-4 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.18)" }}>
            <Check size={10} strokeWidth={3} style={{ color: "var(--lz-accent-ink)" }} />
          </span>
          <span className="text-foreground/75 text-[13.5px] leading-relaxed"><MdInline text={item} /></span>
        </div>
      ))}
    </div>
  );
}

/** Renders a section's blocks with extra visual promotion: the first short
 * paragraph reads as a bigger lead line, bullet lists that are all
 * "label: **number**" become a stat grid, other lists become boxed
 * checklist rows, and a divider separates prose from the first list. */
function SectionBody({ blocks }: { blocks: MdBlock[] }) {
  const nodes: ReactNode[] = [];
  let dividerAdded = false;
  let sawText = false;
  let firstP = true;
  blocks.forEach((b, i) => {
    if (b.kind === "ul") {
      const stats = b.items.map(parseStatItem);
      const allStats = stats.length >= 2 && stats.every((s): s is StatItem => s !== null);
      if (sawText && !dividerAdded) {
        nodes.push(<div key={`div-${i}`} className="h-px my-3.5" style={{ background: "color-mix(in srgb, var(--foreground) 6%, transparent)" }} />);
        dividerAdded = true;
      }
      nodes.push(allStats ? <StatGrid key={i} items={stats as StatItem[]} /> : <ChecklistItems key={i} items={b.items} />);
      return;
    }
    if (b.kind === "p") {
      sawText = true;
      const isLead = firstP && b.text.length <= 140;
      firstP = false;
      nodes.push(
        <p
          key={i}
          className={isLead ? "text-foreground/85 text-[15px] leading-relaxed mb-3 font-medium" : "text-foreground/70 text-[13.5px] leading-relaxed mb-3"}
        >
          <MdInline text={b.text} />
        </p>,
      );
      return;
    }
    nodes.push(<BlockRenderer key={i} block={b} />);
  });
  return <>{nodes}</>;
}

/** Flowing document view — planejamento/relatório. H1 becomes a highlighted
 * title card, every H2 its own section card with a keyword-matched icon. */
export function PlanejamentoView({ blocks }: { blocks: MdBlock[] }) {
  const title = leadingTitle(blocks);
  const rest = title ? blocks.slice(1) : blocks;
  const firstH2 = rest.findIndex((b) => b.kind === "h2");
  const lead = firstH2 === -1 ? rest : rest.slice(0, firstH2);
  const sections = groupByH2(rest);

  return (
    <div className="space-y-3">
      {(title || lead.length > 0) && (
        <div className="relative overflow-hidden rounded-xl p-5 md:p-6" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
          <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: "linear-gradient(90deg, rgb(var(--lz-brand-rgb)), transparent)" }} />
          {title && (
            <>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }} />
                <span className="text-[10.5px] uppercase font-bold tracking-wider" style={{ color: "var(--lz-accent-ink)" }}>Planejamento</span>
              </div>
              <h2 className="text-foreground font-extrabold text-xl md:text-2xl leading-tight">{title}</h2>
            </>
          )}
          {lead.length > 0 && (
            <div className={title ? "mt-3" : undefined}>
              <SectionBody blocks={lead} />
            </div>
          )}
        </div>
      )}
      {sections.map((s, i) => {
        const Icon = sectionIcon(s.title);
        return (
          <div key={i} className="rounded-xl p-5 md:p-6" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
            <div className="flex items-center gap-2.5 mb-3">
              <span
                className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)" }}
              >
                <Icon size={15} style={{ color: "var(--lz-accent-ink)" }} />
              </span>
              <h3 className="text-foreground font-bold text-[15px]">{s.title}</h3>
            </div>
            <div className="pl-[42px] -mt-1">
              <SectionBody blocks={s.blocks} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Card-per-roteiro view — each "## Roteiro N: Título" section becomes a
 * numbered card, with a count header so the client sees at a glance how
 * many roteiros there are. `renderFooter` is an optional per-card slot
 * (title + its blocks in, a node out) used by the admin editor to inject
 * workflow controls (aprovar/ajustar/gravado/enviar pro Reels) without this
 * shared component — also rendered on the public client page — knowing
 * anything about that behavior. */
export function RoteirosView({
  blocks,
  renderFooter,
}: {
  blocks: MdBlock[];
  renderFooter?: (group: { title: string; blocks: MdBlock[] }, index: number) => ReactNode;
}) {
  const groups = groupByH2(blocks);
  if (groups.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Layers size={15} style={{ color: "var(--lz-accent-ink)" }} />
        <span className="text-foreground/60 text-[12px] font-semibold uppercase tracking-wide">
          {groups.length} {groups.length === 1 ? "roteiro" : "roteiros"}
        </span>
      </div>
      <div className="space-y-3">
        {groups.map((g, i) => (
          <div key={i} className="rounded-xl p-5" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
            <div className="flex items-start gap-3">
              <span
                className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}
              >{String(i + 1).padStart(2, "0")}</span>
              <div className="flex-1 min-w-0 pt-0.5">
                <h3 className="text-foreground font-bold text-[14.5px] mb-2">{g.title}</h3>
                {g.blocks.map((b, j) => <BlockRenderer key={j} block={b} />)}
                {renderFooter?.(g, i)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
