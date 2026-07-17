import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, X, ZoomIn } from "lucide-react";
import { toast } from "sonner";

const MAX_OUTPUT_SIZE = 500;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    img.src = src;
  });
}

async function cropAndResize(
  imageSrc: string,
  area: Area,
  originalType: string,
): Promise<{ blob: Blob; contentType: string; ext: string }> {
  const image = await loadImage(imageSrc);
  const outSize = Math.min(MAX_OUTPUT_SIZE, Math.round(area.width));
  const canvas = document.createElement("canvas");
  canvas.width = outSize;
  canvas.height = outSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado neste navegador.");
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, outSize, outSize);
  const contentType = originalType === "image/png" ? "image/png" : "image/jpeg";
  const ext = contentType === "image/png" ? "png" : "jpg";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao processar imagem."))),
      contentType,
      0.9,
    );
  });
  return { blob, contentType, ext };
}

/** Modal to reposition/zoom a picked image into a 1:1 crop, then downscale it
 * to at most MAX_OUTPUT_SIZE×MAX_OUTPUT_SIZE before handing back a Blob. */
export function ImageCropModal({
  file, onCancel, onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (result: { blob: Blob; contentType: string; ext: string }) => void;
}) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => setArea(areaPixels), []);

  async function handleConfirm() {
    if (!imageSrc || !area) return;
    setProcessing(true);
    try {
      const result = await cropAndResize(imageSrc, area, file.type);
      onConfirm(result);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao processar imagem.");
    }
    setProcessing(false);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div className="w-full max-w-sm bg-[#1C1C1C] border border-white/10 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Ajustar foto</h3>
          <button onClick={onCancel} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>

        <div className="relative w-full h-72 rounded-lg overflow-hidden bg-black">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <ZoomIn size={14} className="text-white/40 shrink-0" />
          <input
            type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[#C8D44E]"
          />
        </div>
        <p className="text-[10px] text-white/40 mt-2">
          Arraste pra reposicionar, use o controle pra dar zoom. A foto final sai em até {MAX_OUTPUT_SIZE}×{MAX_OUTPUT_SIZE}px.
        </p>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            disabled={processing}
            className="flex-1 px-3 py-2 rounded-lg text-sm text-white/70 hover:bg-white/5 disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={processing || !area}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-[#C8D44E] text-black disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
          >
            {processing ? <Loader2 size={14} className="animate-spin" /> : null}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
