import { useState } from "react";
import { useApi } from "./queries";
import { CHUNK_SIZE, MAX_CHUNK_ATTEMPTS, arrayBufferToBase64 } from "./use-item-file-upload";

export type UploadProgress = { pct: number };

/** Mesmo relay em pedaços pro Drive que `useClientAssetUpload` usa — aqui
 * pro contrato, que é 1 arquivo só por cliente (troca o anterior). */
export function useClientContractUpload(clientId: string) {
  const api = useApi();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  async function upload(file: File): Promise<{ error: string | null }> {
    setUploadProgress({ pct: 0 });
    try {
      const { uploadUrl } = await api.startClientContractUploadSession.mutateAsync({
        data: { clientId, name: file.name, mimeType: file.type || "application/octet-stream" },
      });

      const total = file.size;
      let offset = 0;
      let finalMeta: any = null;
      while (offset < total) {
        const end = Math.min(offset + CHUNK_SIZE, total);
        const chunkBuffer = await file.slice(offset, end).arrayBuffer();
        const chunkBase64 = arrayBufferToBase64(chunkBuffer);

        let lastErr: unknown;
        let result: { done: boolean; meta?: any } | null = null;
        for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt++) {
          try {
            result = await api.uploadDriveChunk.mutateAsync({
              data: {
                uploadUrl, chunkBase64,
                rangeStart: offset, rangeEnd: end - 1, totalSize: total,
                mimeType: file.type || "application/octet-stream",
              },
            });
            break;
          } catch (err) {
            lastErr = err;
            if (attempt < MAX_CHUNK_ATTEMPTS) await new Promise((r) => setTimeout(r, 800 * attempt));
          }
        }
        if (!result) {
          const detail = lastErr instanceof Error ? lastErr.message : lastErr ? String(lastErr) : "motivo desconhecido";
          throw new Error(`Falha ao enviar um pedaço do arquivo (${detail}).`);
        }

        setUploadProgress({ pct: Math.round((end / total) * 100) });
        if (result.done) { finalMeta = result.meta; break; }
        offset = end;
      }
      if (!finalMeta) throw new Error("O envio terminou sem confirmação do Drive.");

      await api.finalizeClientContractUpload.mutateAsync({ data: { clientId, driveFile: finalMeta } });
      return { error: null };
    } catch (e: any) {
      return { error: e?.message ?? "Falha ao enviar." };
    } finally {
      setUploadProgress(null);
    }
  }

  return { upload, uploadProgress, busy: uploadProgress !== null };
}
