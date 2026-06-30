import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { X, Film, Upload, Scissors, Loader2, Trash2, Check } from "lucide-react";
import { itemFilesQO, useApi } from "@/lib/luzeria/queries";
import { getDriveFileBytes } from "@/lib/luzeria/drive.functions";

/**
 * Modal editor para escolher a capa de um Reel.
 * - Frame: carrega o vídeo do Drive (via proxy server), permite scrub no <video>
 *   e captura o frame atual em um <canvas> -> JPEG base64 -> upload.
 * - Upload: usuário envia uma imagem (jpg/png/webp).
 * - Remover: limpa a capa atual.
 */
export function ReelCoverEditor({
  itemId,
  currentCoverUrl,
  onClose,
}: {
  itemId: string;
  currentCoverUrl: string | null;
  onClose: () => void;
}) {
  const { uploadItemCover, setItemCover } = useApi();
  const { data: files = [] } = useQuery(itemFilesQO(itemId));
  const videoFile = files.find((f) => (f.mimeType ?? "").startsWith("video/")) ?? files[0];
  const fetchBytes = useServerFn(getDriveFileBytes);

  const [mode, setMode] = useState<"frame" | "upload">("frame");
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "save" | "remove">(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Lock body scroll & Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  // Load video bytes when frame mode is selected
  useEffect(() => {
    if (mode !== "frame" || videoSrc || !videoFile?.driveFileId) return;
    let revoke: string | null = null;
    setVideoLoading(true); setVideoError(null);
    fetchBytes({ data: { fileId: videoFile.driveFileId } })
      .then((r: any) => {
        if (!r?.dataUrl) throw new Error("Sem dados do vídeo.");
        // Convert data URL -> blob URL (lower memory than reusing huge data URL in <video>)
        const [meta, b64] = r.dataUrl.split(",");
        const mime = /:(.*?);/.exec(meta)?.[1] ?? "video/mp4";
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        const blob = new Blob([arr], { type: mime });
        const url = URL.createObjectURL(blob);
        revoke = url;
        setVideoSrc(url);
      })
      .catch((e) => setVideoError(e?.message ?? "Falha ao carregar vídeo."))
      .finally(() => setVideoLoading(false));
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [mode, videoFile?.driveFileId, fetchBytes, videoSrc]);

  function captureFrame() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !v.videoWidth || !v.videoHeight) return;
    // Cap to 1080px on the longer side for storage sanity
    const maxSide = 1080;
    const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, c.width, c.height);
    setPreviewDataUrl(c.toDataURL("image/jpeg", 0.86));
  }

  async function handleFileChosen(file: File) {
    if (!file.type.startsWith("image/")) {
      setVideoError("Selecione uma imagem (JPG, PNG ou WEBP).");
      return;
    }
    if (file.size > 8_000_000) {
      setVideoError("Imagem muito grande (máx. 8 MB).");
      return;
    }
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = () => setPreviewDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  async function saveCover() {
    if (!previewDataUrl) return;
    setBusy("save");
    try {
      const [meta, base64] = previewDataUrl.split(",");
      const contentType = /:(.*?);/.exec(meta)?.[1] ?? "image/jpeg";
      await uploadItemCover.mutateAsync({
        data: {
          itemId,
          base64,
          contentType,
          source: mode === "frame" ? "frame" : "upload",
        },
      });
      onClose();
    } catch (e: any) {
      setVideoError(e?.message ?? "Falha ao salvar capa.");
    } finally {
      setBusy(null);
    }
  }

  async function removeCover() {
    setBusy("remove");
    try {
      await setItemCover.mutateAsync({ data: { itemId, coverPath: null, coverSource: null } });
      onClose();
    } catch (e: any) {
      setVideoError(e?.message ?? "Falha ao remover capa.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center md:p-6 bg-black/80 backdrop-blur-[6px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full md:w-[680px] md:max-w-full bg-[#1A1A1A] border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden max-h-[92vh] rounded-t-2xl md:rounded-2xl"
      >
        {/* Header */}
        <div className="px-5 md:px-6 pt-4 md:pt-5 pb-3 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] uppercase font-bold tracking-wider text-[#C8D44E]">Reel</div>
            <div className="text-base md:text-lg font-bold text-white">Capa do Reel</div>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white p-1.5 rounded-md hover:bg-white/5">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 md:px-6 pt-3 shrink-0">
          <div className="flex gap-1 p-1 rounded-md bg-white/[0.04] w-fit">
            {(["frame", "upload"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setPreviewDataUrl(null); setVideoError(null); }}
                className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded transition-colors"
                style={{
                  backgroundColor: mode === m ? "#C8D44E" : "transparent",
                  color: mode === m ? "#0D0D0D" : "rgba(255,255,255,0.6)",
                }}
              >
                {m === "frame" ? "Frame do vídeo" : "Enviar imagem"}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 md:px-6 py-4 space-y-4">
          {videoError && (
            <div className="text-xs px-3 py-2 rounded-md bg-[#FF6B6B]/10 text-[#FF6B6B] border border-[#FF6B6B]/30">
              {videoError}
            </div>
          )}

          {mode === "frame" && (
            <>
              {!videoFile?.driveFileId && (
                <p className="text-xs text-white/50">
                  Anexe um vídeo nos arquivos do Reel para escolher um frame como capa.
                </p>
              )}
              {videoLoading && (
                <div className="flex items-center gap-2 text-xs text-white/60">
                  <Loader2 size={14} className="animate-spin text-[#C8D44E]" />
                  Carregando vídeo do Drive…
                </div>
              )}
              {videoSrc && (
                <div className="space-y-3">
                  <div className="rounded-lg overflow-hidden bg-black border border-white/[0.06]">
                    <video
                      ref={videoRef}
                      src={videoSrc}
                      controls
                      playsInline
                      crossOrigin="anonymous"
                      className="w-full max-h-[55vh] bg-black"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={captureFrame}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-bold uppercase tracking-wider bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/10"
                  >
                    <Scissors size={14} />
                    Usar frame atual como capa
                  </button>
                </div>
              )}
            </>
          )}

          {mode === "upload" && (
            <label className="block w-full cursor-pointer">
              <div className="w-full aspect-[4/5] max-h-[55vh] rounded-lg border border-dashed border-white/15 bg-[#141414] hover:border-[#C8D44E] hover:bg-[#171717] transition-colors flex flex-col items-center justify-center gap-2">
                <Upload size={22} className="text-white/40" />
                <span className="text-xs text-white/60">
                  {uploadFile ? uploadFile.name : "Clique para enviar uma imagem (JPG, PNG, WEBP)"}
                </span>
                <span className="text-[10px] text-white/30">Recomendado: 1080×1350 (4:5)</span>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChosen(f); }}
              />
            </label>
          )}

          {/* Preview */}
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-white/40 mb-2">Pré-visualização</div>
            <div className="w-full max-w-[260px] aspect-[4/5] rounded-lg overflow-hidden bg-[#141414] border border-white/[0.08] flex items-center justify-center">
              {previewDataUrl ? (
                <img src={previewDataUrl} alt="Pré-visualização da capa" className="w-full h-full object-cover" />
              ) : currentCoverUrl ? (
                <img src={currentCoverUrl} alt="Capa atual" className="w-full h-full object-cover opacity-60" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-white/30">
                  <Film size={28} />
                  <span className="text-[10px] uppercase tracking-wider">Sem capa</span>
                </div>
              )}
            </div>
            {!previewDataUrl && currentCoverUrl && (
              <p className="text-[10px] text-white/40 mt-2">Capa atual mostrada esmaecida. Selecione um frame ou envie uma nova imagem para substituir.</p>
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Footer */}
        <div className="px-5 md:px-6 py-3 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={removeCover}
            disabled={!currentCoverUrl || busy !== null}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-bold uppercase tracking-wider text-[#FF6B6B] hover:bg-[#FF6B6B]/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {busy === "remove" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Remover capa
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-md text-xs font-bold uppercase tracking-wider text-white/70 hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveCover}
              disabled={!previewDataUrl || busy !== null}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}
            >
              {busy === "save" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Salvar capa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}