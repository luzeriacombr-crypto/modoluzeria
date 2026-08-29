import { useState } from "react";
import { Star, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (rating: number, note?: string) => void;
  itemTitle?: string;
}

export function QualityModal({ open, onClose, onConfirm, itemTitle }: Props) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [note, setNote] = useState("");
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="w-full max-w-sm bg-card border border-foreground/10 rounded-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-[var(--lz-accent-ink)] mb-1">Finalizar</div>
            <h3 className="text-base font-semibold text-foreground">Avalie a entrega</h3>
          </div>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground"><X size={16} /></button>
        </div>
        {itemTitle && <div className="text-[11px] text-foreground/40 mb-4 truncate">{itemTitle}</div>}
        <div className="flex items-center justify-center gap-1 my-4">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = (hover || rating) >= n;
            return (
              <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)} className="p-1">
                <Star size={28} fill={active ? "var(--lz-accent-ink)" : "none"}
                  className={active ? "text-[var(--lz-accent-ink)]" : "text-foreground/20"} />
              </button>
            );
          })}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500}
          placeholder="Observações (opcional)..."
          className="lz-input-dark w-full bg-background border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 resize-none" />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded-lg text-sm text-foreground/70 hover:bg-foreground/5">
            Cancelar
          </button>
          <button onClick={() => rating > 0 && onConfirm(rating, note.trim() || undefined)}
            disabled={rating === 0}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-[rgb(var(--lz-brand-rgb))] text-black disabled:opacity-40">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}