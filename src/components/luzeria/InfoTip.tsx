import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

const TOOLTIP_WIDTH = 224;

/** "i" que mostra a explicação no hover (desktop) ou no toque/clique (mobile) —
 * pensado pra rótulos/cabeçalhos cujo significado não é óbvio de bater o olho.
 * Usa portal + posição calculada da tela (não do pai) pra nunca cortar em
 * elementos perto da borda nem ficar preso por containers com overflow. */
export function InfoTip({ text }: { text: string }) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function computeAndShow() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, margin),
      window.innerWidth - TOOLTIP_WIDTH - margin,
    );
    setCoords({ top: rect.bottom + 6, left });
  }

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={computeAndShow}
      onMouseLeave={() => setCoords(null)}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); coords ? setCoords(null) : computeAndShow(); }}
        className="inline-flex items-center justify-center text-white/30 hover:text-[rgb(var(--lz-brand-rgb))] transition-colors"
      >
        <Info size={11} />
      </button>
      {coords && createPortal(
        <div
          style={{ position: "fixed", top: coords.top, left: coords.left, width: TOOLTIP_WIDTH }}
          className="z-[999] rounded-md border border-white/10 bg-[#1C1C1C] px-3 py-2 text-[11px] font-normal leading-relaxed text-white/70 shadow-xl normal-case tracking-normal"
          onClick={(e) => e.stopPropagation()}
        >
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}
