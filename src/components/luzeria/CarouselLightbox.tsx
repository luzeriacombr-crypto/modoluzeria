import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, X, Loader2, Image as ImageIcon } from "lucide-react";
import { driveThumbnailQO } from "@/lib/luzeria/queries";

type LightboxFile = { id: string; driveFileId: string; name: string };

function LightboxImage({ file }: { file: LightboxFile }) {
  const { data, isLoading } = useQuery(driveThumbnailQO(file.driveFileId, true, 1024));
  const url = data?.dataUrl ?? null;
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {url ? (
        <img src={url} alt={file.name} className="max-w-full max-h-full object-contain" />
      ) : isLoading ? (
        <Loader2 size={28} className="animate-spin text-white/40" />
      ) : (
        <ImageIcon size={40} className="text-white/20" />
      )}
    </div>
  );
}

/** Same click-through carousel UX as the Instagram-style feed preview
 * (InstagramPostModal) — just the media viewer, without the comments/approve
 * panel, since this opens from inside a DetailPanel that already has those. */
export function CarouselLightbox({
  files, initialIndex, onClose,
}: {
  files: LightboxFile[]; initialIndex: number; onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const total = files.length;
  const current = files[index];

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(total - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, total]);

  if (!current) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 p-4" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute right-3 top-3 z-20 size-9 grid place-items-center rounded-full bg-white/10 hover:bg-white/20 text-white transition"
        aria-label="Fechar"
      >
        <X size={18} />
      </button>
      <div className="relative w-full h-full max-w-3xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <LightboxImage file={current} />
        {total > 1 && (
          <>
            {index > 0 && (
              <button
                onClick={() => setIndex((i) => i - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/90 hover:bg-white grid place-items-center text-neutral-900 shadow transition"
                aria-label="Anterior"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            {index < total - 1 && (
              <button
                onClick={() => setIndex((i) => i + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-9 rounded-full bg-white/90 hover:bg-white grid place-items-center text-neutral-900 shadow transition"
                aria-label="Próximo"
              >
                <ChevronRight size={18} />
              </button>
            )}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 text-[11px] font-semibold text-white bg-black/55 rounded-full px-2.5 py-1">
              {index + 1}/{total}
            </div>
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {files.map((_, i) => (
                <div key={i} className={`size-1.5 rounded-full transition ${i === index ? "bg-white" : "bg-white/40"}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
