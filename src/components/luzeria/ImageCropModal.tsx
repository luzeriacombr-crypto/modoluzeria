import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, X, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";

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
  outputWidth: number,
  outputHeight: number,
): Promise<{ blob: Blob; contentType: string; ext: string }> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado neste navegador.");
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, outputWidth, outputHeight);
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

/** Modal pra reposicionar/dar zoom numa imagem até encaixar na proporção e
 * no tamanho exigidos, antes de mandar um Blob de volta. Usado tanto pra
 * foto de perfil (1:1, redonda, até 500×500 — o comportamento original)
 * quanto pra imagem de orçamento (retangular, tamanho exato, ex: banner de
 * cabeçalho 2000×370 ou capa A4 1240×1754) — ver OrcamentosPanel.tsx. */
export function ImageCropModal({
  file, onCancel, onConfirm,
  outputWidth = MAX_OUTPUT_SIZE, outputHeight = MAX_OUTPUT_SIZE, cropShape = "round",
  title = "Ajustar foto", hint,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (result: { blob: Blob; contentType: string; ext: string }) => void;
  /** Tamanho exato de saída em pixels — default 500×500 (foto de perfil). */
  outputWidth?: number;
  outputHeight?: number;
  cropShape?: "round" | "rect";
  title?: string;
  /** Texto de ajuda abaixo do zoom — default explica o tamanho de saída quadrado. */
  hint?: string;
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
      const result = await cropAndResize(imageSrc, area, file.type, outputWidth, outputHeight);
      onConfirm(result);
    } catch (e: any) {
      toastFriendlyError(e, "Erro ao processar imagem.");
    }
    setProcessing(false);
  }

  const aspect = outputWidth / outputHeight;
  // Caixa de corte quadrada/redonda (foto de perfil) fica como sempre foi.
  // Pra formato retangular (banner, capa A4...) a caixa acompanha a
  // proporção de saída, numa largura maior — senão um banner bem baixo
  // (ex: 2000×370) ficava espremido demais pra arrastar/dar zoom direito.
  const boxWidth = cropShape === "round" ? undefined : 460;
  const boxHeight = cropShape === "round" ? undefined : Math.max(130, Math.min(420, boxWidth! / aspect));

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div className={`w-full bg-card border border-foreground/10 rounded-2xl p-6 ${cropShape === "round" ? "max-w-sm" : "max-w-lg"}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <button onClick={onCancel} className="text-foreground/40 hover:text-foreground"><X size={16} /></button>
        </div>

        <div
          className="relative w-full rounded-lg overflow-hidden bg-black mx-auto"
          style={cropShape === "round" ? { height: 288 } : { height: boxHeight, maxWidth: boxWidth }}
        >
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              showGrid={cropShape === "rect"}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          )}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <ZoomIn size={14} className="text-foreground/40 shrink-0" />
          <input
            type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-[rgb(var(--lz-brand-rgb))]"
          />
        </div>
        <p className="text-[10px] text-foreground/40 mt-2">
          {hint ?? `Arraste pra reposicionar, use o controle pra dar zoom. A imagem final sai em ${outputWidth}×${outputHeight}px.`}
        </p>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onCancel}
            disabled={processing}
            className="flex-1 px-3 py-2 rounded-lg text-sm text-foreground/70 hover:bg-foreground/5 disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={processing || !area}
            className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-[rgb(var(--lz-brand-rgb))] text-black disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
          >
            {processing ? <Loader2 size={14} className="animate-spin" /> : null}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
