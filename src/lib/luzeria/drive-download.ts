import { buildZip, dedupeZipName } from "./zip";

type FetchDriveToken = (opts: { data: { fileId: string } }) => Promise<{
  token: string; url: string; mimeType: string; name: string;
}>;

/** Fetches a Drive file's bytes (via a short-lived OAuth token, same
 * mechanism used for video streaming) and triggers a native browser
 * download — works for any file type/size, no server-side buffering. */
export async function downloadDriveFile(
  fetchToken: FetchDriveToken,
  fileId: string,
  fallbackName?: string,
): Promise<void> {
  const { token, url, name } = await fetchToken({ data: { fileId } });
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error("Falha ao baixar arquivo do Drive.");
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fallbackName || name || "arquivo";
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
    const { token, url, name } = await fetchToken({ data: { fileId: f.driveFileId } });
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error("Falha ao baixar arquivo do Drive.");
    const data = new Uint8Array(await res.arrayBuffer());
    const finalName = dedupeZipName(f.name || name || "arquivo", usedNames);
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
