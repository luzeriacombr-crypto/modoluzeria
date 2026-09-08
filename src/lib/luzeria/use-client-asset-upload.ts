import { useState } from "react";
import { useApi } from "./queries";
import { CHUNK_SIZE, MAX_CHUNK_ATTEMPTS, arrayBufferToBase64 } from "./use-item-file-upload";

export type UploadProgress = { done: number; total: number; pct: number };

/** Mesmo relay em pedaços pro Drive que `useItemFileUpload` usa pros
 * arquivos de post/reel (ver o comentário lá pra entender por que não é
 * upload direto do navegador) — aqui o destino é a pasta "Arquivo da
 * Marca - <Cliente>" em vez da pasta de um item específico. */
async function uploadOneFile(
  clientId: string,
  file: File,
  api: ReturnType<typeof useApi>,
  onProgress: (pct: number) => void,
): Promise<void> {
  const { uploadUrl } = await api.startClientAssetUploadSession.mutateAsync({
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

    onProgress(Math.round((end / total) * 100));
    if (result.done) { finalMeta = result.meta; break; }
    offset = end;
  }
  if (!finalMeta) throw new Error("O envio terminou sem confirmação do Drive.");

  await api.finalizeClientAssetUpload.mutateAsync({ data: { clientId, driveFile: finalMeta } });
}

export function useClientAssetUpload(clientId: string) {
  const api = useApi();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  async function upload(selected: File[]): Promise<{ failed: { name: string; msg: string }[] }> {
    if (selected.length === 0) return { failed: [] };
    setUploadProgress({ done: 0, total: selected.length, pct: 0 });
    const failed: { name: string; msg: string }[] = [];
    for (const file of selected) {
      try {
        await uploadOneFile(clientId, file, api, (pct) =>
          setUploadProgress((p) => (p ? { ...p, pct } : p)));
        setUploadProgress((p) => (p ? { done: p.done + 1, total: p.total, pct: 0 } : p));
      } catch (err: any) {
        failed.push({ name: file.name, msg: err?.message ?? "Falha ao enviar." });
      }
    }
    setUploadProgress(null);
    return { failed };
  }

  return { upload, uploadProgress, busy: uploadProgress !== null };
}
