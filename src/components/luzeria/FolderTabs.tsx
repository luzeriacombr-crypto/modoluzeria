import { Folder, FolderOpen } from "lucide-react";

export type FolderTabItem = { id: string; label: string; badge?: number | string | null };

/** Abas em formato de divisória de pasta (estilos em styles.css, `.lz-ftab*`). A aba atual se abre pra página;
 * com muitas abas elas quebram em 2 linhas e a linha da aba atual desce pra ficar colada no conteúdo.
 * `size="sm"` é a versão menor, pra sub-abas dentro de uma tela. `trailing` entra no fim da última linha. */
export function FolderTabs({
  items, activeId, onChange, maxPerRow = 6, size = "md", icons = true, trailing, className = "", ...rest
}: {
  items: FolderTabItem[];
  activeId: string;
  onChange: (id: string) => void;
  /** Passando disso, as abas se dividem em 2 linhas. */
  maxPerRow?: number;
  size?: "md" | "sm";
  icons?: boolean;
  trailing?: React.ReactNode;
  className?: string;
  "data-tour"?: string;
}) {
  const perRow = items.length > maxPerRow ? Math.ceil(items.length / 2) : items.length;
  const rows: FolderTabItem[][] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
  rows.sort((a, b) => Number(a.some((t) => t.id === activeId)) - Number(b.some((t) => t.id === activeId)));
  const lastRow = rows.length - 1;

  return (
    <div className={`lz-ftabs ${size === "sm" ? "lz-ftabs--sm" : ""} lz-no-print ${className}`} role="tablist" data-tour={rest["data-tour"]}>
      {rows.map((row, ri) => (
        <div key={ri} className="lz-ftab-row">
          {row.map((t) => {
            const active = t.id === activeId;
            const Icon = active ? FolderOpen : Folder;
            return (
              <button key={t.id} type="button" role="tab" aria-selected={active} onClick={() => onChange(t.id)} className="lz-ftab">
                {icons && <Icon size={size === "sm" ? 12 : 14} className="lz-ftab-icon" />}
                {t.label}
                {t.badge != null && t.badge !== "" && <span className="lz-ftab-badge">{t.badge}</span>}
              </button>
            );
          })}
          {ri === lastRow && trailing ? <div className="lz-ftab-trailing">{trailing}</div> : null}
        </div>
      ))}
    </div>
  );
}
