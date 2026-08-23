import { buildZip, dedupeZipName } from "./zip";

type FetchDriveToken = (opts: { data: { fileId: string } }) => Promise<{
  token: string; url: string; mimeType: string; name: string;
}>;

const EXT_BY_MIME: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-msvideo": "avi",
  "video/x-matroska": "mkv",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

/** Several older uploads have their Drive filename stored without an
 * extension in our DB, even though Drive's own mimeType is correct — the
 * browser's own download manager quietly patches that up when saving a
 * single file (from the response's Content-Type), but a name written
 * straight into a .zip entry has no such safety net, so Finder/Explorer
 * can't tell it's a video and won't open it. Derive the extension from the
 * mimeType whenever the stored name doesn't already end in one. */
function ensureExtension(name: string, mimeType?: string): string {
  if (/\.[a-z0-9]{2,5}$/i.test(name)) return name;
  const ext = mimeType ? EXT_BY_MIME[mimeType] : undefined;
  return ext ? `${name}.${ext}` : name;
}

/** Fetches a Drive file's bytes (via a short-lived OAuth token, same
 * mechanism used for video streaming) and triggers a native browser
 * download — works for any file type/size, no server-side buffering. */
export async function downloadDriveFile(
  fetchToken: FetchDriveToken,
  fileId: string,
  fallbackName?: string,
): Promise<void> {
  const { token, url, name, mimeType } = await fetchToken({ data: { fileId } });
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Falha ao baixar arquivo do Drive.");
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = ensureExtension(fallbackName || name || "arquivo", mimeType);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
}

/** Downloads several files one after another (small stagger between each so
 * the browser's download manager doesn't get every request at once). */
export async function downloadDriveFiles(
  fetchToken: FetchDriveToken,
  files: { driveFileId: string; name: string }[],
): Promise<void> {
  for (const f of files) {
    await downloadDriveFile(fetchToken, f.driveFileId, f.name);
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** Downloads several files and bundles them into a single .zip — one file,
 * one browser download prompt, instead of the "save as" dialog re-firing
 * per file when the browser is set to ask where to save every download. */
export async function downloadDriveFilesAsZip(
  fetchToken: FetchDriveToken,
  files: { driveFileId: string; name: string }[],
  zipName: string,
): Promise<void> {
  const usedNames = new Set<string>();
  const entries: { name: string; data: Uint8Array }[] = [];
  for (const f of files) {
    const { token, url, name, mimeType } = await fetchToken({ data: { fileId: f.driveFileId } });
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("Falha ao baixar arquivo do Drive.");
    const data = new Uint8Array(await res.arrayBuffer());
    const finalName = dedupeZipName(ensureExtension(f.name || name || "arquivo", mimeType), usedNames);
    usedNames.add(finalName);
    entries.push({ name: finalName, data });
  }
  const blob = buildZip(entries);
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
}
