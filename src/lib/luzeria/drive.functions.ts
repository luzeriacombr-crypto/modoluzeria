import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

/**
 * Google Drive integration via Lovable connector gateway.
 * The connector proxies Drive v3 REST endpoints using a project-level API key.
 */

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const DRIVE_FIELDS =
  "id,name,mimeType,iconLink,thumbnailLink,webViewLink,size,modifiedTime";

function gatewayHeaders(): Record<string, string> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY ausente no servidor.");
  if (!driveKey) throw new Error("Conector do Google Drive não está conectado.");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": driveKey,
  };
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      ...gatewayHeaders(),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Drive API ${res.status}: ${txt.slice(0, 240)}`);
  }
  return res.json();
}

/** Extract a Drive file ID from a URL or return the raw ID. */
function parseDriveId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  // Plain id (chars allowed in Drive ids)
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  const m1 = s.match(/\/(?:file\/d|folders)\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

async function assertCanWrite(supabase: any, userId: string, itemId: string) {
  const { data: admin } = await supabase.rpc("is_admin", { _user_id: userId });
  if (admin) return;
  const { data: row } = await supabase
    .from("item_assignees")
    .select("user_id")
    .eq("item_id", itemId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) throw new Error("Sem permissão para editar arquivos deste item.");
}

/** Keep legacy content_items.drive_link in sync with the first attached file. */
async function syncLegacyDriveLink(supabase: any, itemId: string) {
  const { data: first } = await supabase
    .from("item_files")
    .select("web_view_url")
    .eq("item_id", itemId)
    .order("sort_order")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  await supabase
    .from("content_items")
    .update({ drive_link: first?.web_view_url ?? "" })
    .eq("id", itemId);
}

/* ============== READ ============== */

export const listItemFiles = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string }) =>
    z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("item_files")
      .select("id, drive_file_id, name, mime_type, icon_url, thumbnail_url, web_view_url, size_bytes, added_by, sort_order, created_at")
      .eq("item_id", data.itemId)
      .order("sort_order")
      .order("created_at");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      driveFileId: r.drive_file_id,
      name: r.name,
      mimeType: r.mime_type,
      iconUrl: r.icon_url,
      thumbnailUrl: r.thumbnail_url,
      webViewUrl: r.web_view_url,
      sizeBytes: r.size_bytes ? Number(r.size_bytes) : null,
      addedBy: r.added_by,
      sortOrder: r.sort_order,
      createdAt: r.created_at,
    }));
  });

/* ============== SEARCH ============== */

export const searchDriveFiles = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { query?: string }) =>
    z.object({ query: z.string().max(120).optional() }).parse(d))
  .handler(async ({ data }) => {
    const q = (data.query ?? "").trim();
    const qParam = q
      ? `name contains '${q.replace(/'/g, "\\'")}' and trashed = false`
      : `trashed = false`;
    const params = new URLSearchParams({
      q: qParam,
      pageSize: "25",
      fields: `files(${DRIVE_FIELDS})`,
      orderBy: "modifiedTime desc",
    });
    const json = await driveFetch(`/drive/v3/files?${params.toString()}`);
    return (json.files ?? []).map((f: any) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      iconUrl: f.iconLink ?? null,
      thumbnailUrl: f.thumbnailLink ?? null,
      webViewUrl: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
      sizeBytes: f.size ? Number(f.size) : null,
      modifiedTime: f.modifiedTime ?? null,
    }));
  });

/* ============== ATTACH BY ID/URL ============== */

export const attachDriveFile = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; fileIdOrUrl: string }) =>
    z.object({
      itemId: z.string().uuid(),
      fileIdOrUrl: z.string().min(3).max(1024),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanWrite(context.supabase, context.userId, data.itemId);
    const fileId = parseDriveId(data.fileIdOrUrl);
    if (!fileId) throw new Error("Link/ID do Drive inválido.");

    // Fetch metadata; fall back to a minimal record if API rejects (e.g. folder w/o access).
    let meta: any = null;
    try {
      meta = await driveFetch(`/drive/v3/files/${fileId}?fields=${DRIVE_FIELDS}`);
    } catch {
      meta = null;
    }

    const row = {
      item_id: data.itemId,
      drive_file_id: fileId,
      name: meta?.name ?? "Arquivo do Drive",
      mime_type: meta?.mimeType ?? null,
      icon_url: meta?.iconLink ?? null,
      thumbnail_url: meta?.thumbnailLink ?? null,
      web_view_url:
        meta?.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
      size_bytes: meta?.size ? Number(meta.size) : null,
      added_by: context.userId,
      sort_order: 0,
    };

    const { error } = await context.supabase
      .from("item_files")
      .upsert(row, { onConflict: "item_id,drive_file_id" });
    if (error) throw new Error(error.message);

    await syncLegacyDriveLink(context.supabase, data.itemId);
    return { ok: true };
  });

/* ============== UPLOAD ============== */

export const uploadDriveFile = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    itemId: string;
    name: string;
    mimeType: string;
    base64: string;
  }) =>
    z.object({
      itemId: z.string().uuid(),
      name: z.string().min(1).max(255),
      mimeType: z.string().min(1).max(200),
      // ~25 MB ceiling for inline base64 uploads.
      base64: z.string().min(1).max(35_000_000),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanWrite(context.supabase, context.userId, data.itemId);

    const boundary = `lz_${Math.random().toString(36).slice(2)}`;
    const metadata = { name: data.name, mimeType: data.mimeType };
    const bin = Buffer.from(data.base64, "base64");

    const parts = [
      `--${boundary}\r\n`,
      `Content-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata) + "\r\n",
      `--${boundary}\r\n`,
      `Content-Type: ${data.mimeType}\r\n`,
      `\r\n`,
    ];
    const head = Buffer.from(parts.join(""), "utf8");
    const tail = Buffer.from(`\r\n--${boundary}--`, "utf8");
    const body = Buffer.concat([head, bin, tail]);

    const res = await fetch(
      `${GATEWAY}/upload/drive/v3/files?uploadType=multipart&fields=${encodeURIComponent(DRIVE_FIELDS)}`,
      {
        method: "POST",
        headers: {
          ...gatewayHeaders(),
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": String(body.length),
        },
        body,
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Upload falhou (${res.status}): ${txt.slice(0, 240)}`);
    }
    const meta: any = await res.json();

    const row = {
      item_id: data.itemId,
      drive_file_id: meta.id,
      name: meta.name ?? data.name,
      mime_type: meta.mimeType ?? data.mimeType,
      icon_url: meta.iconLink ?? null,
      thumbnail_url: meta.thumbnailLink ?? null,
      web_view_url:
        meta.webViewLink ?? `https://drive.google.com/file/d/${meta.id}/view`,
      size_bytes: meta.size ? Number(meta.size) : bin.byteLength,
      added_by: context.userId,
      sort_order: 0,
    };
    const { error } = await context.supabase
      .from("item_files")
      .upsert(row, { onConflict: "item_id,drive_file_id" });
    if (error) throw new Error(error.message);

    await syncLegacyDriveLink(context.supabase, data.itemId);
    return { ok: true, file: { id: meta.id, name: row.name } };
  });

/* ============== DETACH ============== */

export const detachItemFile = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("item_files")
      .select("item_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: true };
    await assertCanWrite(context.supabase, context.userId, row.item_id);
    const { error } = await context.supabase
      .from("item_files")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await syncLegacyDriveLink(context.supabase, row.item_id);
    return { ok: true };
  });

export type ItemFile = Awaited<ReturnType<typeof listItemFiles>>[number];
export type DriveSearchResult = Awaited<ReturnType<typeof searchDriveFiles>>[number];