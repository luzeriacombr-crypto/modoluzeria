import { useState } from "react";
import { useApi } from "./queries";

// 4MB — comfortably under any serverless request-body limit even after
// base64 inflation (~33%, so ~5.3MB on the wire), while still keeping the
// number of round trips reasonable for a big video (a 300MB reel is ~75
// chunks). Google's resumable upload protocol wants chunk sizes that are a
// multiple of 256KB; 4MB already is.
const CHUNK_SIZE = 4 * 1024 * 1024;
const MAX_CHUNK_ATTEMPTS = 3;

export function parseDriveError(msg: string | undefined): { kind: "missing"; clientId: string } | { kind: "other"; msg: string } {
  const m = /^\[DELIVERIES_FOLDER_MISSING:([0-9a-f-]{36})\]\s*(.*)$/i.exec(msg ?? "");
  if (m) return { kind: "missing", clientId: m[1] };
  return { kind: "other", msg: msg ?? "Falha na operação." };
}

/** ArrayBuffer -> base64, in sub-chunks — spreading a large typed array
 * straight into String.fromCharCode blows the call stack well before 4MB. */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const STEP = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += STEP) {
    binary += String.fromCharCode(...bytes.subarray(i, i + STEP));
  }
  return btoa(binary);
}

export type UploadProgress = { done: number; total: number; pct: number; phase: "uploading" | "syncing" };

/** Sends a file to the org's Google Drive without the browser ever talking
 * to Drive directly (confirmed: Drive's upload endpoint rejects the
 * cross-origin PUT with a CORS error) and without staging it in Supabase
 * Storage first (capped at 50MB on the current plan). Instead: open a
 * resumable session on Drive (startDriveUploadSession), then relay the
 * file through our own server a small chunk at a time (uploadDriveChunk) —
 * each request is tiny regardless of the file's total size, so there's no
 * practical upload size ceiling beyond Drive's own (a few TB). */
async function uploadOneFile(
  itemId: string,
  file: File,
  kind: "media" | "briefing",
  api: ReturnType<typeof useApi>,
  onProgress: (pct: number) => void,
): Promise<{ id: string; name: string }> {
  const { uploadUrl } = await api.startDriveUploadSession.mutateAsync({
    data: { itemId, name: file.name, mimeType: file.type || "application/octet-stream", kind },
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
    if (!result) throw lastErr instanceof Error ? lastErr : new Error("Falha ao enviar um pedaço do arquivo.");

    onProgress(Math.round((end / total) * 100));
    if (result.done) { finalMeta = result.meta; break; }
    offset = end;
  }
  if (!finalMeta) throw new Error("O envio terminou sem confirmação do Drive.");

  const result = await api.finalizeDriveUpload.mutateAsync({
    data: { itemId, kind, driveFile: finalMeta },
  }) as { file: { id: string; name: string } };
  return result.file;
}

/** Shared upload orchestration used by "Arquivos" (kind: "media", the
 * default), the Mídia preview's direct-upload (kind: "media"), and the
 * Briefing section's reference-image uploader (kind: "briefing") — same
 * relay (chunked straight into Google Drive), just tagged differently so
 * each lands in its own folder/list. */
export function useItemFileUpload(itemId: string, kind: "media" | "briefing" = "media") {
  const api = useApi();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingClientId, setMissingClientId] = useState<string | null>(null);

  async function upload(selected: File[]) {
    setError(null);
    setMissingClientId(null);
    if (selected.length === 0) return;

    setUploadProgress({ done: 0, total: selected.length, pct: 0, phase: "uploading" });
    const failed: { name: string; msg: string }[] = [];
    for (const file of selected) {
      try {
        await uploadOneFile(itemId, file, kind, api, (pct) =>
          setUploadProgress((p) => (p ? { ...p, pct, phase: "uploading" } : p)));
        setUploadProgress((p) => (p ? { done: p.done + 1, total: p.total, pct: 0, phase: "uploading" } : p));
      } catch (err: any) {
        const p = parseDriveError(err?.message);
        if (p.kind === "missing") {
          setMissingClientId(p.clientId);
          break;
        }
        failed.push({ name: file.name, msg: p.msg });
      }
    }
    setUploadProgress(null);
    if (failed.length > 0) {
      setError(failed.map((f) => `${f.name}: ${f.msg}`).join(" | "));
    }
  }

  return {
    upload,
    uploadProgress,
    error,
    setError,
    missingClientId,
    setMissingClientId,
    busy: uploadProgress !== null || api.startDriveUploadSession.isPending || api.uploadDriveChunk.isPending || api.finalizeDriveUpload.isPending,
  };
}
