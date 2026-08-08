import { useState } from "react";
import { useApi } from "./queries";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
// Reusing reel-covers here (not a dedicated bucket) — its RLS policy is
// proven working right now, unlike freshly created/modified storage.objects
// policies on this project, which silently fail to take effect regardless
// of creation method (CLI, dashboard SQL editor) or policy logic (confirmed
// down to a raw `WITH CHECK (true)` SQL insert still getting rejected).
// Filenames get a "tmp-" prefix to stay visually distinct from real covers.
const UPLOAD_BUCKET = "reel-covers";

// 50 MB — Supabase Storage's own hard cap on the free plan (confirmed via a
// real 413 EntityTooLarge; not configurable past this without upgrading
// Supabase to Pro). Well past the old ~3 MB working reality either way.
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Supabase Storage keys only allow word chars, whitespace, and a specific
 * punctuation set — accented characters (e.g. macOS screenshot names like
 * "Captura de Tela ... às ...") get rejected with a 400 InvalidKey. Only
 * used for the temp storage key; the real filename (kept accented) still
 * goes to Drive via syncUploadToDrive's `name` field. */
export function sanitizeStorageFileName(name: string): string {
  const ascii = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return ascii.replace(/[^\w\s!\-.*'()&$@=;:+,?]/g, "_");
}

/** PUTs the file straight to Supabase Storage's REST endpoint — unlike
 * Google Drive's upload API (confirmed: no CORS support for third-party
 * origins), Supabase Storage is built for exactly this direct-from-browser
 * use case, so it isn't subject to Vercel's 4.5 MB request-body limit
 * either. Uses XHR (not fetch) for real upload-progress events. The file
 * lands in a temp bucket; a server call then relays it into the org's
 * Drive (see syncUploadToDrive). */
export function putToSupabaseStorage(path: string, file: File, accessToken: string, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `${SUPABASE_URL}/storage/v1/object/${UPLOAD_BUCKET}/${encodeURIComponent(path).replace(/%2F/g, "/")}`, true);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload falhou (${xhr.status} ${xhr.statusText}): ${xhr.responseText?.slice(0, 240) || "sem detalhes"}`));
      }
    };
    xhr.onerror = () => reject(new Error("Falha de rede durante o upload."));
    xhr.send(file);
  });
}

export function parseDriveError(msg: string | undefined): { kind: "missing"; clientId: string } | { kind: "other"; msg: string } {
  const m = /^\[DELIVERIES_FOLDER_MISSING:([0-9a-f-]{36})\]\s*(.*)$/i.exec(msg ?? "");
  if (m) return { kind: "missing", clientId: m[1] };
  return { kind: "other", msg: msg ?? "Falha na operação." };
}

export type UploadProgress = { done: number; total: number; pct: number; phase: "uploading" | "syncing" };

/** Shared upload orchestration used by "Arquivos" (kind: "media", the
 * default), the Mídia preview's direct-upload (kind: "media"), and the
 * Briefing section's reference-image uploader (kind: "briefing") — same
 * relay (Supabase Storage temp → syncUploadToDrive → Google Drive), just
 * tagged differently so each lands in its own folder/list. */
export function useItemFileUpload(itemId: string, kind: "media" | "briefing" = "media") {
  const { syncUploadToDrive } = useApi();
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingClientId, setMissingClientId] = useState<string | null>(null);

  async function upload(selected: File[]) {
    setError(null);
    setMissingClientId(null);
    if (selected.length === 0) return;

    const tooBig = selected.filter((f) => f.size > MAX_UPLOAD_BYTES);
    const toUpload = selected.filter((f) => f.size <= MAX_UPLOAD_BYTES);
    if (tooBig.length > 0) {
      setError(
        tooBig.length === selected.length
          ? `Arquivo${tooBig.length > 1 ? "s" : ""} grande${tooBig.length > 1 ? "s" : ""} demais (máx. 50 MB).`
          : `${tooBig.length} arquivo(s) ignorado(s) por serem grandes demais (máx. 50 MB): ${tooBig.map((f) => f.name).join(", ")}`,
      );
    }
    if (toUpload.length === 0) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError("Sessão expirada — recarregue a página e tente de novo.");
      return;
    }

    setUploadProgress({ done: 0, total: toUpload.length, pct: 0, phase: "uploading" });
    const failed: { name: string; msg: string }[] = [];
    for (const file of toUpload) {
      const storagePath = `${itemId}/tmp-${Date.now()}-${sanitizeStorageFileName(file.name)}`;
      try {
        await putToSupabaseStorage(storagePath, file, accessToken, (pct) =>
          setUploadProgress((p) => (p ? { ...p, pct, phase: "uploading" } : p)));
        setUploadProgress((p) => (p ? { ...p, pct: 100, phase: "syncing" } : p));
        await syncUploadToDrive.mutateAsync({
          data: {
            itemId,
            storagePath,
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            kind,
          },
        });
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
    busy: uploadProgress !== null || syncUploadToDrive.isPending,
  };
}
