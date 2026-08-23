import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, MoreVertical, Trash2, Loader2 } from "lucide-react";

/** Small "⋮" button, shown on hover over a file thumbnail, that opens a
 * compact menu: download, remove from the app only, or remove from the app
 * and trash the file in Drive too. Shared by BriefingUploads and the post
 * carousel media grid. */
export function FileActionsMenu({
  canEdit, downloading, onDownload, onRemoveAppOnly, onRemoveEverywhere,
}: {
  canEdit: boolean;
  downloading?: boolean;
  onDownload: () => void;
  onRemoveAppOnly: () => void;
  onRemoveEverywhere: () => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    function place() {
      const rect = btnRef.current?.getBoundingClientRect();
      if (rect) setPos({ top: rect.bottom + 4, left: Math.max(4, rect.right - 200) });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", h);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        title="Mais ações"
        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-black/80 text-foreground rounded p-0.5"
      >
        {downloading ? <Loader2 size={10} className="animate-spin" /> : <MoreVertical size={10} />}
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 200 }}
          className="z-[200] rounded-md border border-foreground/10 bg-card shadow-lg py-1 text-[12px]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => { setOpen(false); onDownload(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-foreground/80 hover:bg-foreground/5 hover:text-foreground transition"
          >
            <Download size={12} /> Baixar
          </button>
          {canEdit && (
            <>
              <div className="my-1 border-t border-foreground/6" />
              <button
                type="button"
                onClick={() => { setOpen(false); onRemoveAppOnly(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-foreground/70 hover:bg-foreground/5 hover:text-foreground transition"
              >
                <Trash2 size={12} /> Remover do Modo Criador
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); onRemoveEverywhere(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-red-400/90 hover:bg-red-500/10 hover:text-red-400 transition"
              >
                <Trash2 size={12} /> Remover do Modo Criador e do Google Drive
              </button>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
