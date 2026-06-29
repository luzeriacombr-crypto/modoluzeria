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
      <div className="w-full max-w-sm bg-[#1C1C1C] border border-white/10 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#C8D44E] mb-1">Finalizar</div>
            <h3 className="text-base font-semibold text-white">Avalie a entrega</h3>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>
        {itemTitle && <div className="text-[11px] text-white/40 mb-4 truncate">{itemTitle}</div>}
        <div className="flex items-center justify-center gap-1 my-4">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = (hover || rating) >= n;
            return (
              <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
                onClick={() => setRating(n)} className="p-1">
                <Star size={28} fill={active ? "#C8D44E" : "none"}
                  className={active ? "text-[#C8D44E]" : "text-white/20"} />
              </button>
            );
          })}
        </div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500}
          placeholder="Observações (opcional)..."
          className="w-full bg-[#0D0D0D] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#C8D44E]/50 resize-none" />
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/5">
            Cancelar
          </button>
          <button onClick={() => rating > 0 && onConfirm(rating, note.trim() || undefined)}
            disabled={rating === 0}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-[#C8D44E] text-black disabled:opacity-40">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}