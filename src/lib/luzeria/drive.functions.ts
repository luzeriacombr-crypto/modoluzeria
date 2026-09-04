import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { refreshGoogleAccessToken } from "./google-oauth";
import { LUZERIA_ORG_ID } from "./api.functions";
import { z } from "zod";

const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const DRIVE_BASE  = "https://www.googleapis.com/drive/v3";

const DRIVE_FIELDS =
  "id,name,mimeType,iconLink,thumbnailLink,webViewLink,size,modifiedTime";

/** Carries the calling org's id through every Drive helper call for the
 * duration of one request, without threading it through every function
 * signature — every exported handler below wraps its body in withDriveOrg().
 * The AsyncLocalStorage itself lives in a .server.ts module and is always
 * dynamically imported — top-level `node:async_hooks` would otherwise leak
 * into the client bundle (this file ships partially to the browser). */
export async function withDriveOrg<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
  const { withDriveOrg: run } = await import("./drive-org-context.server");
  return run(orgId, fn);
}

// In-memory token cache, keyed by org — reused until 5 min before expiry.
const _tokenCacheByOrg = new Map<string, { token: string; expiresAt: number }>();

export async function getAccessToken(): Promise<string> {
  const { currentDriveOrgId } = await import("./drive-org-context.server");
  const orgId = currentDriveOrgId();
  if (!orgId) throw new Error("Drive: organização não identificada nesta requisição.");

  const cached = _tokenCacheByOrg.get(orgId);
  if (cached && cached.expiresAt > Date.now() + 300_000) return cached.token;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do Google Drive ausentes no servidor (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET).");
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("org_google_credentials").select("refresh_token").eq("org_id", orgId).maybeSingle();
  let refreshToken = (data as any)?.refresh_token as string | undefined;
  if (!refreshToken && orgId === LUZERIA_ORG_ID) {
    refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  }
  if (!refreshToken) {
    throw new Error("Esta agência ainda não conectou o Google Drive. Vá em Configurações → Drive e conecte sua conta.");
  }

  const { accessToken, expiresIn } = await refreshGoogleAccessToken({ clientId, clientSecret, refreshToken });
  _tokenCacheByOrg.set(orgId, { token: accessToken, expiresAt: Date.now() + expiresIn * 1000 });
  return accessToken;
}

async function driveHeaders(extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return { Authorization: `Bearer ${token}`, ...extra };
}

const DEFAULT_ROOT_FOLDER_ID = "1LuefYT7TJiUhweGlOoHE31NGkXA2uTww";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const PT_MONTHS = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

function monthLabelFromKey(key: string | null | undefined): string | null {
  if (!key) return null;
  const m = /^(\d{4})-(\d{2})/.exec(key);
  if (!m) return null;
  const idx = Math.max(1, Math.min(12, parseInt(m[2], 10))) - 1;
  return PT_MONTHS[idx];
}

function monthLabelWithYear(key: string | null | undefined): string | null {
  if (!key) return null;
  const m = /^(\d{4})-(\d{2})/.exec(key);
  if (!m) return null;
  const idx = Math.max(1, Math.min(12, parseInt(m[2], 10))) - 1;
  return `${PT_MONTHS[idx]} ${m[1]}`;
}

/**
 * Structured error encoded in the message so the UI can parse it.
 * The client checks for the `[DELIVERIES_FOLDER_MISSING:<clientId>]` prefix.
 */
function deliveriesFolderMissingError(clientId: string): Error {
  return new Error(
    `[DELIVERIES_FOLDER_MISSING:${clientId}] Configure a pasta de entregas no Perfil do Cliente antes de fazer upload.`,
  );
}

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function driveFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://www.googleapis.com${path}`, {
    ...init,
    headers: {
      ...await driveHeaders(),
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Drive API ${res.status}: ${txt.slice(0, 240)}`);
  }
  return res.json();
}

async function driveJson(path: string, init: RequestInit = {}) {
  return driveFetch(path, init);
}

/** Create a folder under a parent and return the new folder id. */
async function driveCreateFolder(name: string, parentId: string): Promise<string> {
  const body = JSON.stringify({
    name,
    mimeType: FOLDER_MIME,
    parents: [parentId],
  });
  const res = await fetch(`${DRIVE_BASE}/files?fields=id,name&supportsAllDrives=true`, {
    method: "POST",
    headers: { ...await driveHeaders(), "Content-Type": "application/json" },
    body,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Drive criar pasta falhou (${res.status}): ${t.slice(0, 200)}`);
  }
  const j: any = await res.json();
  return j.id;
}

/** List immediate folder children under a parent (folders only). */
async function driveListChildFolders(parentId: string) {
  const q = `'${parentId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const params = new URLSearchParams({
    q,
    pageSize: "500",
    fields: "files(id,name)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const j: any = await driveFetch(`/drive/v3/files?${params.toString()}`);
  return (j.files ?? []) as Array<{ id: string; name: string }>;
}

/** Find a child folder by exact name; return id or null. */
async function findChildFolderByName(parentId: string, name: string): Promise<string | null> {
  const target = normalizeName(name);
  const list = await driveListChildFolders(parentId);
  const hit = list.find((f) => normalizeName(f.name) === target);
  return hit?.id ?? null;
}

/** Move a file: add target parent, remove any others. */
async function driveMoveTo(fileId: string, targetParentId: string) {
  const meta: any = await driveFetch(
    `/drive/v3/files/${fileId}?fields=parents&supportsAllDrives=true`,
  );
  const parents: string[] = meta?.parents ?? [];
  if (parents.includes(targetParentId) && parents.length === 1) return;
  const params = new URLSearchParams({
    addParents: targetParentId,
    fields: "id,parents",
    supportsAllDrives: "true",
  });
  const toRemove = parents.filter((p) => p !== targetParentId);
  if (toRemove.length) params.set("removeParents", toRemove.join(","));
  const res = await fetch(`${DRIVE_BASE}/files/${fileId}?${params.toString()}`, {
    method: "PATCH",
    headers: { ...await driveHeaders(), "Content-Type": "application/json" },
    body: "{}",
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Drive mover falhou (${res.status}): ${t.slice(0, 200)}`);
  }
}

/* ============== ROOT FOLDER (app settings) ============== */

function rootFolderSettingKey(orgId: string): string {
  return `drive_root_folder_id:${orgId}`;
}

async function readRootFolderId(supabase: any): Promise<string> {
  const { currentDriveOrgId } = await import("./drive-org-context.server");
  const orgId = currentDriveOrgId()!;
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", rootFolderSettingKey(orgId))
    .maybeSingle();
  let stored = (data?.value as any)?.id;
  // Legacy fallback: Luzeria's root folder was originally stored under the
  // bare key (pre-multi-tenant). Only relevant until it's re-saved once.
  if (!stored && orgId === LUZERIA_ORG_ID) {
    const legacy = await supabase
      .from("app_settings").select("value").eq("key", "drive_root_folder_id").maybeSingle();
    stored = (legacy.data?.value as any)?.id;
  }
  if (typeof stored === "string" && stored) return stored;
  // New orgs with no configured root: use their own Drive's top level.
  return orgId === LUZERIA_ORG_ID ? DEFAULT_ROOT_FOLDER_ID : "root";
}

/* ============== CLIENT / MONTH FOLDER RESOLUTION ============== */

async function loadClientFolderMap(supabase: any, clientId: string) {
  const { data } = await supabase
    .from("client_drive_map")
    .select("drive_folder_id, deliveries_folder_id")
    .eq("client_id", clientId)
    .maybeSingle();
  return data as { drive_folder_id: string; deliveries_folder_id: string | null } | null;
}

async function ensureDeliveriesFolder(
  supabase: any,
  clientId: string,
  clientName: string,
  rootId: string,
  userId: string,
  options: { autoCreate?: boolean; forceClientFolderId?: string } = {},
): Promise<{ clientFolderId: string; deliveriesFolderId: string } | null> {
  const map = await loadClientFolderMap(supabase, clientId);

  let clientFolderId = options.forceClientFolderId ?? map?.drive_folder_id ?? null;
  if (!clientFolderId) {
    clientFolderId = await findChildFolderByName(rootId, clientName);
    if (!clientFolderId) {
      if (!options.autoCreate) return null;
      clientFolderId = await driveCreateFolder(clientName, rootId);
    }
  }

  let deliveriesFolderId = map?.deliveries_folder_id ?? null;
  if (!deliveriesFolderId || options.forceClientFolderId) {
    const expected = `Entregas - ${clientName}`;
    deliveriesFolderId = await findChildFolderByName(clientFolderId, expected);
    if (!deliveriesFolderId) {
      deliveriesFolderId = await driveCreateFolder(expected, clientFolderId);
    }
  }

  await supabase.from("client_drive_map").upsert({
    client_id: clientId,
    drive_folder_id: clientFolderId,
    deliveries_folder_id: deliveriesFolderId,
    confirmed_by: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "client_id" });

  return { clientFolderId, deliveriesFolderId };
}

async function ensureMonthFolder(parentId: string, monthLabel: string): Promise<string> {
  const hit = await findChildFolderByName(parentId, monthLabel);
  if (hit) return hit;
  return driveCreateFolder(monthLabel, parentId);
}

/** Posts, Reels and Stories each get their own subfolder inside the month
 * folder — activity items (gravação/roteiro/sistema/outros) stay directly
 * in the month folder, unchanged. */
const TYPE_FOLDER_LABEL: Record<string, string> = { post: "Posts", reel: "Reels", story: "Stories" };

/** Resolve the target month (or month/type) folder for an item; null if cannot organize.
 * `kind: "briefing"` bypasses the month/type tree entirely — briefing/reference
 * images all land in one shared "Imagens de Briefing" folder per client. */
async function resolveTargetFolderForItem(
  supabase: any,
  userId: string,
  itemId: string,
  opts: { autoCreate?: boolean; forceClientFolderId?: string; kind?: "media" | "briefing" } = {},
): Promise<string | null> {
  const { data: item } = await supabase
    .from("content_items")
    .select("month_id, type, months!inner(key, client_id, clients!months_client_id_fkey!inner(id, name))")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return null;
  const months: any = item.months;
  const client: any = months?.clients;
  if (!client?.id || !client?.name) return null;
  const typeLabel = TYPE_FOLDER_LABEL[item.type as string];

  // New flow: require an admin-configured deliveries folder per client.
  const map = await loadClientFolderMap(supabase, client.id);
  if (map?.deliveries_folder_id) {
    if (opts.kind === "briefing") {
      return ensureMonthFolder(map.deliveries_folder_id, "Imagens de Briefing");
    }
    const label = monthLabelWithYear(months?.key);
    if (!label) return null;
    const monthFolderId = await ensureMonthFolder(map.deliveries_folder_id, label);
    return typeLabel ? ensureMonthFolder(monthFolderId, typeLabel) : monthFolderId;
  }

  // Legacy fallback: only used by `reorganizeAllDriveFiles` / `ensureClientDeliveriesFolder`,
  // which still pass `autoCreate`. Day-to-day uploads from posts/reels reach here
  // without `forceClientFolderId` and with no map → throw the friendly error.
  if (!opts.autoCreate && !opts.forceClientFolderId) {
    throw deliveriesFolderMissingError(client.id);
  }
  const monthLabel = monthLabelFromKey(months?.key);
  if (!monthLabel) return null;
  const rootId = await readRootFolderId(supabase);
  const tree = await ensureDeliveriesFolder(
    supabase, client.id, client.name, rootId, userId, opts,
  );
  if (!tree) return null;
  const monthFolderId = await ensureMonthFolder(tree.deliveriesFolderId, monthLabel);
  return typeLabel ? ensureMonthFolder(monthFolderId, typeLabel) : monthFolderId;
}

/** Extract a Drive file ID from a URL or return the raw ID. */
export function parseDriveId(input: string): string | null {
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
    .eq("kind", "media")
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
  .inputValidator((d: { itemId: string; kind?: "media" | "briefing" }) =>
    z.object({ itemId: z.string().uuid(), kind: z.enum(["media", "briefing"]).default("media") }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("item_files")
      .select("id, drive_file_id, name, mime_type, icon_url, thumbnail_url, web_view_url, size_bytes, added_by, sort_order, created_at, kind")
      .eq("item_id", data.itemId)
      .eq("kind", data.kind)
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
      kind: r.kind,
    }));
  });

/**
 * Batched grid-thumbnail lookup for many items at once (e.g. the feed
 * preview grid). Fetches item_files for all itemIds in one query, then
 * resolves fresh Drive thumbnailLinks for every unique file in parallel —
 * avoiding the N-items × 2-round-trips pattern that hits Drive's per-user
 * rate limit when a grid has 15+ cells.
 */
export const getGridThumbnails = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemIds: string[] }) =>
    z.object({ itemIds: z.array(z.string().uuid()).max(200) }).parse(d))
  .handler(async ({ data, context }) => withDriveOrg(context.orgId, async () => {
    if (data.itemIds.length === 0) return {};

    const { data: rows, error } = await context.supabase
      .from("item_files")
      .select("item_id, drive_file_id")
      .in("item_id", data.itemIds)
      .eq("kind", "media")
      .order("sort_order")
      .order("created_at");
    if (error) throw new Error(error.message);

    const filesByItem = new Map<string, string[]>();
    const allDriveIds = new Set<string>();
    for (const r of rows ?? []) {
      const arr = filesByItem.get(r.item_id) ?? [];
      arr.push(r.drive_file_id);
      filesByItem.set(r.item_id, arr);
      if (r.drive_file_id) allDriveIds.add(r.drive_file_id);
    }

    const thumbUrls = new Map<string, string>();
    try {
      const token = await getAccessToken();
      await Promise.all(
        [...allDriveIds].map(async (fileId) => {
          try {
            const res = await fetch(
              `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&supportsAllDrives=true`,
              { headers: { Authorization: `Bearer ${token}` } },
            );
            if (!res.ok) return;
            const meta: any = await res.json();
            const link: string | undefined = meta?.thumbnailLink;
            if (link) thumbUrls.set(fileId, link.replace(/=s\d+(-[a-z]+)?$/i, "=s480"));
          } catch { /* skip this file, others still resolve */ }
        }),
      );
    } catch { /* skip all — Drive auth unavailable, cells fall back to placeholder */ }

    const result: Record<string, { thumbUrl: string | null; fileCount: number }> = {};
    for (const itemId of data.itemIds) {
      const fileIds = filesByItem.get(itemId) ?? [];
      const firstThumb = fileIds.length ? thumbUrls.get(fileIds[0]) ?? null : null;
      result[itemId] = { thumbUrl: firstThumb, fileCount: fileIds.length };
    }
    return result;
  }));

/* ============== SEARCH ============== */

export const searchDriveFiles = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { query?: string }) =>
    z.object({ query: z.string().max(120).optional() }).parse(d))
  .handler(async ({ data, context }) => withDriveOrg(context.orgId, async () => {
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
  }));

/** Drive's `imageMediaMetadata.time` (EXIF) comes as "YYYY:MM:DD HH:MM:SS",
 * not ISO — swap the first two ':' (date separators) for '-' and the
 * space for 'T' so Date.parse can read it. Missing/unparseable time sorts
 * last (Infinity), falling back to name order among those. */
function parseDriveExifTime(t: string | undefined): number {
  if (!t) return Infinity;
  const iso = t.replace(":", "-").replace(":", "-").replace(" ", "T");
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? Infinity : ms;
}

/** Lists every image directly inside a Drive folder, paginating through
 * `nextPageToken` until exhausted — a seleção de fotos pode ter centenas de
 * imagens, e nem searchDriveFiles nem driveListChildFolders paginam hoje.
 * Plain async function (not a createServerFn) so it can be called both from
 * an authenticated admin context and from the public/anon photo-selection
 * flow in photo-selection.functions.ts, which has no logged-in profile to
 * satisfy requireActiveProfile. Callers are responsible for already being
 * inside withDriveOrg(orgId, ...).
 *
 * `sortBy: "horario"` orders by the photo's real capture time (EXIF) —
 * the Drive API itself has no `orderBy` option for that, so this fetches
 * `imageMediaMetadata.time` in the same list call (no extra requests) and
 * sorts client-side after all pages are collected. */
export async function listDriveFolderImages(folderId: string, sortBy: "nome" | "horario" = "nome") {
  const q = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
  const files: Array<{ id: string; name: string; thumbnailUrl: string | null; takenAt?: string }> = [];
  const fields = sortBy === "horario"
    ? "nextPageToken,files(id,name,thumbnailLink,imageMediaMetadata(time))"
    : "nextPageToken,files(id,name,thumbnailLink)";
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q,
      pageSize: "1000",
      fields,
      orderBy: "name",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const json: any = await driveFetch(`/drive/v3/files?${params.toString()}`);
    for (const f of json.files ?? []) {
      files.push({ id: f.id, name: f.name, thumbnailUrl: f.thumbnailLink ?? null, takenAt: f.imageMediaMetadata?.time });
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  if (sortBy === "horario") {
    files.sort((a, b) => {
      const diff = parseDriveExifTime(a.takenAt) - parseDriveExifTime(b.takenAt);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
  }
  return files.map(({ id, name, thumbnailUrl }) => ({ id, name, thumbnailUrl }));
}

/* ============== ATTACH BY ID/URL ============== */

export const attachDriveFile = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; fileIdOrUrl: string }) =>
    z.object({
      itemId: z.string().uuid(),
      fileIdOrUrl: z.string().min(3).max(1024),
    }).parse(d))
  .handler(async ({ data, context }) => withDriveOrg(context.orgId, async () => {
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

    // Move into the configured deliveries folder. If the client has no
    // deliveries folder yet, fail loudly so the UI prompts the admin.
    const target = await resolveTargetFolderForItem(
      context.supabase, context.userId, data.itemId, {},
    );
    if (target) {
      try { await driveMoveTo(fileId, target); }
      catch (e) { console.warn("[drive] attach move skipped:", (e as any)?.message); }
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
  }));

/* ============== UPLOAD ============== */

/** Google Drive's upload API doesn't support direct browser uploads (no
 * CORS on googleapis.com's upload endpoints — confirmed live, not assumed),
 * so large files can't go straight from the browser to Drive the way they
 * can to Supabase Storage. Two-step flow instead: the browser PUTs the file
 * to the `reel-covers` Supabase bucket directly (see FilesSection.tsx, path
 * `<itemId>/tmp-*`), then calls this to relay it into Drive. Reusing
 * reel-covers rather than a dedicated bucket: a fresh `item-uploads-temp`
 * bucket's storage.objects RLS policies never took effect no matter how
 * they were created (CLI, dashboard SQL editor, even a raw `WITH CHECK
 * (true)` SQL insert still got rejected) — some platform-level anomaly on
 * this project, not a policy-logic bug. reel-covers' existing, long-lived
 * policy is proven to work, so temp uploads land there instead and get
 * swept up by this function same as before.
 * To fit Vercel Hobby's 10s function duration limit for anything but small
 * files, the download (from Supabase) and upload (to Drive) are piped
 * together as one stream instead of done sequentially — Drive receives
 * bytes as Supabase serves them, roughly halving the time versus buffering
 * the whole file twice. Still not a guarantee for very large files on a
 * slow connection between the two services; if it times out the file
 * simply stays in the temp bucket (nothing is lost) and the user can retry. */
/** Fase 1 do upload direto (sem passar pelo Supabase Storage, que tem teto
 * de 50MB no plano atual): abre uma sessão resumível no Drive e devolve a
 * URL da sessão pro navegador. O navegador NÃO consegue mandar os bytes
 * direto pra essa URL (confirmado: o Drive bloqueia por CORS o PUT com
 * Content-Range vindo de um domínio de terceiro) — por isso o upload em si
 * (uploadDriveChunk) também passa pelo servidor, em pedaços pequenos. */
export const startDriveUploadSession = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; name: string; mimeType: string; kind?: "media" | "briefing" }) =>
    z.object({
      itemId: z.string().uuid(),
      name: z.string().min(1).max(255),
      mimeType: z.string().min(1).max(200),
      kind: z.enum(["media", "briefing"]).default("media"),
    }).parse(d))
  .handler(async ({ data, context }) => withDriveOrg(context.orgId, async () => {
    await assertCanWrite(context.supabase, context.userId, data.itemId);

    // Uploads require the client's deliveries folder to be configured;
    // this throws DELIVERIES_FOLDER_MISSING when it isn't.
    const targetParentId = await resolveTargetFolderForItem(
      context.supabase, context.userId, data.itemId, { kind: data.kind },
    );

    const metadata: any = { name: data.name, mimeType: data.mimeType };
    if (targetParentId) metadata.parents = [targetParentId];

    const sessionRes = await fetch(
      `${UPLOAD_BASE}/files?uploadType=resumable&supportsAllDrives=true&fields=${encodeURIComponent(DRIVE_FIELDS)}`,
      {
        method: "POST",
        headers: {
          ...await driveHeaders(),
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": data.mimeType,
        },
        body: JSON.stringify(metadata),
      },
    );
    if (!sessionRes.ok) {
      const txt = await sessionRes.text().catch(() => "");
      throw new Error(`Não foi possível iniciar o envio pro Drive (${sessionRes.status}): ${txt.slice(0, 240)}`);
    }
    const uploadUrl = sessionRes.headers.get("Location");
    if (!uploadUrl) throw new Error("O Drive não retornou uma URL de upload.");
    return { uploadUrl };
  }));

/** Só aceita relayar bytes pra uploads que a própria startDriveUploadSession
 * emitiu — a URL sempre é do domínio de upload do Drive, nunca escolhida
 * pelo chamador, então validar o host aqui é defesa extra contra SSRF, não
 * a proteção principal (essa é o middleware de sessão ativa + o próprio
 * upload_id opaco e não adivinhável que o Drive gera). */
function assertDriveUploadUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.hostname !== "www.googleapis.com" || !parsed.pathname.startsWith("/upload/drive/")) {
    throw new Error("URL de upload inválida.");
  }
}

/** Fase 2: um pedaço (~4MB) do arquivo, em base64 dentro do JSON — grande o
 * bastante pra não precisar de centenas de idas e vindas, pequeno o
 * bastante pra nunca chegar perto de qualquer limite de tamanho de corpo de
 * requisição. Pedaços do meio devolvem 308 (Drive ainda esperando mais);
 * o último devolve 200 com os metadados do arquivo já pronto. */
export const uploadDriveChunk = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { uploadUrl: string; chunkBase64: string; rangeStart: number; rangeEnd: number; totalSize: number; mimeType: string }) =>
    z.object({
      uploadUrl: z.string().url(),
      chunkBase64: z.string().min(1),
      rangeStart: z.number().int().min(0),
      rangeEnd: z.number().int().min(0),
      totalSize: z.number().int().min(1),
      mimeType: z.string().min(1).max(200),
    }).parse(d))
  .handler(async ({ data, context }) => withDriveOrg(context.orgId, async () => {
    assertDriveUploadUrl(data.uploadUrl);
    const chunk = Buffer.from(data.chunkBase64, "base64");
    const res = await fetch(data.uploadUrl, {
      method: "PUT",
      headers: {
        ...await driveHeaders(),
        "Content-Type": data.mimeType,
        "Content-Range": `bytes ${data.rangeStart}-${data.rangeEnd}/${data.totalSize}`,
      },
      body: chunk,
    });
    if (res.status === 308) return { done: false as const };
    if (res.ok) {
      const meta: any = await res.json();
      return { done: true as const, meta };
    }
    const txt = await res.text().catch(() => "");
    throw new Error(`O Drive recusou o pedaço do arquivo (${res.status}): ${txt.slice(0, 240)}`);
  }));

/** Fase 3: registra o arquivo já enviado (o navegador já tem os metadados
 * devolvidos pelo Drive no último pedaço — evita uma chamada extra só pra
 * reconsultar o que o Drive já mandou de volta). */
export const finalizeDriveUpload = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    itemId: string; kind?: "media" | "briefing";
    driveFile: { id: string; name: string; mimeType?: string; iconLink?: string; thumbnailLink?: string; webViewLink?: string; size?: string | number };
  }) =>
    z.object({
      itemId: z.string().uuid(),
      kind: z.enum(["media", "briefing"]).default("media"),
      driveFile: z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        mimeType: z.string().optional(),
        iconLink: z.string().optional(),
        thumbnailLink: z.string().optional(),
        webViewLink: z.string().optional(),
        size: z.union([z.string(), z.number()]).optional(),
      }),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanWrite(context.supabase, context.userId, data.itemId);
    const meta = data.driveFile;
    const row = {
      item_id: data.itemId,
      drive_file_id: meta.id,
      name: meta.name,
      mime_type: meta.mimeType ?? null,
      icon_url: meta.iconLink ?? null,
      thumbnail_url: meta.thumbnailLink ?? null,
      web_view_url: meta.webViewLink ?? `https://drive.google.com/file/d/${meta.id}/view`,
      size_bytes: meta.size != null ? Number(meta.size) : null,
      added_by: context.userId,
      sort_order: 0,
      kind: data.kind,
    };
    const { error } = await context.supabase
      .from("item_files")
      .upsert(row, { onConflict: "item_id,drive_file_id" });
    if (error) throw new Error(error.message);
    await syncLegacyDriveLink(context.supabase, data.itemId);
    return { ok: true, file: { id: meta.id, name: row.name } };
  });

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
  .handler(async ({ data, context }) => withDriveOrg(context.orgId, async () => {
    await assertCanWrite(context.supabase, context.userId, data.itemId);

    // Uploads require the client's deliveries folder to be configured;
    // this throws DELIVERIES_FOLDER_MISSING when it isn't.
    const targetParentId = await resolveTargetFolderForItem(
      context.supabase, context.userId, data.itemId, {},
    );

    const boundary = `lz_${Math.random().toString(36).slice(2)}`;
    const metadata: any = { name: data.name, mimeType: data.mimeType };
    if (targetParentId) metadata.parents = [targetParentId];
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
      `${UPLOAD_BASE}/files?uploadType=multipart&supportsAllDrives=true&fields=${encodeURIComponent(DRIVE_FIELDS)}`,
      {
        method: "POST",
        headers: {
          ...await driveHeaders(),
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
  }));

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

/** Same as detachItemFile, but also moves the underlying Drive file to the
 * trash (recoverable there for the usual ~30 days) instead of leaving it
 * behind in the client's folder. */
export const deleteItemFileAndDrive = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => withDriveOrg(context.orgId, async () => {
    const { data: row } = await context.supabase
      .from("item_files")
      .select("item_id, drive_file_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { ok: true };
    await assertCanWrite(context.supabase, context.userId, row.item_id);
    if (row.drive_file_id) {
      try {
        await driveFetch(`/drive/v3/files/${encodeURIComponent(row.drive_file_id)}?supportsAllDrives=true`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trashed: true }),
        });
      } catch (e) {
        // Don't block removing our own record if Drive trashing fails (file
        // already gone, permission hiccup, etc.) — surface it but proceed.
        console.error("[deleteItemFileAndDrive] Drive trash failed:", e);
      }
    }
    const { error } = await context.supabase
      .from("item_files")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await syncLegacyDriveLink(context.supabase, row.item_id);
    return { ok: true };
  }));

export type ItemFile = Awaited<ReturnType<typeof listItemFiles>>[number];
export type DriveSearchResult = Awaited<ReturnType<typeof searchDriveFiles>>[number];

/* ============== REORDER ============== */

export const reorderItemFiles = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; orderedIds: string[] }) =>
    z.object({
      itemId: z.string().uuid(),
      orderedIds: z.array(z.string().uuid()).min(1).max(200),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanWrite(context.supabase, context.userId, data.itemId);
    // Update each row's sort_order to its index. Scope by item_id to
    // prevent cross-item writes even if a stray id is passed.
    for (let i = 0; i < data.orderedIds.length; i++) {
      const { error } = await context.supabase
        .from("item_files")
        .update({ sort_order: i })
        .eq("id", data.orderedIds[i])
        .eq("item_id", data.itemId);
      if (error) throw new Error(error.message);
    }
    await syncLegacyDriveLink(context.supabase, data.itemId);
    return { ok: true };
  });

/* ============== THUMBNAIL ============== */

/**
 * Returns a base64 data URL with the Drive thumbnail for a file.
 * Fetches a fresh thumbnailLink and proxies the bytes server-side so the
 * browser doesn't need to authenticate against googleusercontent.com.
 */
export const getDriveThumbnail = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { fileId: string; size?: number }) =>
    z.object({
      fileId: z.string().min(5).max(200),
      size: z.number().int().min(64).max(1024).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => withDriveOrg(context.orgId, async () => {
    try {
      const meta: any = await driveFetch(
        `/drive/v3/files/${encodeURIComponent(data.fileId)}?fields=thumbnailLink,mimeType&supportsAllDrives=true`,
      );
      const link: string | undefined = meta?.thumbnailLink;
      if (!link) return { dataUrl: null as string | null };
      const sz = data.size ?? 320;
      const url = link.replace(/=s\d+(-[a-z]+)?$/i, `=s${sz}`);
      const res = await fetch(url);
      if (!res.ok) return { dataUrl: null as string | null };
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.byteLength > 2_500_000) return { dataUrl: null as string | null };
      const ct = res.headers.get("content-type") ?? "image/jpeg";
      return { dataUrl: `data:${ct};base64,${buf.toString("base64")}` };
    } catch (e) {
      // Drive API hiccups (rate limits, transient errors) shouldn't crash the
      // request — fall back to no thumbnail so the client can retry.
      console.error("[getDriveThumbnail] failed:", e);
      return { dataUrl: null as string | null };
    }
  }));

/**
 * Returns a short-lived Drive OAuth token so the browser can fetch the video
 * directly from googleapis.com (supports CORS). No size limit — the video
 * streams straight from Drive to the browser without buffering on the server.
 */
export const getDriveVideoToken = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { fileId: string }) =>
    z.object({ fileId: z.string().min(5).max(200) }).parse(d))
  .handler(async ({ data, context }) => withDriveOrg(context.orgId, async () => {
    const token = await getAccessToken();
    const meta: any = await driveFetch(
      `/drive/v3/files/${encodeURIComponent(data.fileId)}?fields=mimeType,name&supportsAllDrives=true`,
    );
    return {
      token,
      url: `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(data.fileId)}?alt=media&supportsAllDrives=true`,
      mimeType: (meta?.mimeType as string) ?? "video/mp4",
      name: (meta?.name as string) ?? "video",
    };
  }));

/** @deprecated Use getDriveVideoToken instead — no size limit. */
export const getDriveFileBytes = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { fileId: string }) =>
    z.object({ fileId: z.string().min(5).max(200) }).parse(d))
  .handler(async ({ data, context }) => withDriveOrg(context.orgId, async () => {
    const meta: any = await driveFetch(
      `/drive/v3/files/${encodeURIComponent(data.fileId)}?fields=mimeType,size,name&supportsAllDrives=true`,
    );
    const res = await fetch(
      `${DRIVE_BASE}/files/${encodeURIComponent(data.fileId)}?alt=media&supportsAllDrives=true`,
      { headers: await driveHeaders() },
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Drive download falhou (${res.status}): ${t.slice(0, 200)}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = meta?.mimeType ?? res.headers.get("content-type") ?? "application/octet-stream";
    return { dataUrl: `data:${ct};base64,${buf.toString("base64")}`, mimeType: ct, name: meta?.name ?? "video" };
  }));

/* ============== DRIVE CONFIG + ORGANIZE ============== */

async function assertMaster(supabase: any, userId: string) {
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (!isMaster) {
    throw new Error("Apenas o Adm Master pode executar esta ação.");
  }
}

export const getDriveConfig = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => withDriveOrg(context.orgId, async () => {
    const rootFolderId = await readRootFolderId(context.supabase);
    return { rootFolderId, default: DEFAULT_ROOT_FOLDER_ID };
  }));

export const setDriveRootFolder = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { folderIdOrUrl: string }) =>
    z.object({ folderIdOrUrl: z.string().min(5).max(500) }).parse(d))
  .handler(async ({ data, context }) => withDriveOrg(context.orgId, async () => {
    await assertMaster(context.supabase, context.userId);
    const id = parseDriveId(data.folderIdOrUrl) ?? data.folderIdOrUrl.trim();
    // Validate it exists and is a folder.
    const meta: any = await driveFetch(
      `/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType&supportsAllDrives=true`,
    );
    if (meta?.mimeType !== FOLDER_MIME) {
      throw new Error("O ID informado não é uma pasta do Drive.");
    }
    const { error } = await context.supabase
      .from("app_settings")
      .upsert({ key: rootFolderSettingKey(context.orgId), value: { id, name: meta.name } });
    if (error) throw new Error(error.message);
    return { ok: true, id, name: meta.name };
  }));

/* ============== PER-ORG DRIVE CONNECTION (OAuth) ============== */

export const getDriveConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("org_google_credentials")
      .select("drive_email, connected_at")
      .eq("org_id", context.orgId)
      .maybeSingle();
    if (data) return { connected: true, driveEmail: data.drive_email, connectedAt: data.connected_at };
    if (context.orgId === LUZERIA_ORG_ID && process.env.GOOGLE_REFRESH_TOKEN) {
      return { connected: true, driveEmail: null, connectedAt: null };
    }
    return { connected: false, driveEmail: null, connectedAt: null };
  });

/** Builds the Google consent URL for this org's master to connect their own Drive. */
export const getDriveConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { redirectOrigin: string }) =>
    z.object({ redirectOrigin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error("GOOGLE_CLIENT_ID ausente no servidor.");
    const redirectUri = `${data.redirectOrigin}/oauth/drive-callback`;
    const scope = [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/userinfo.email",
    ].join(" ");
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope,
      access_type: "offline",
      prompt: "consent",
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
  });

/** Exchanges the OAuth code from /oauth/drive-callback for a refresh token
 * tied to this org — never touches another org's credentials. */
export const completeDriveConnect = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { code: string; redirectOrigin: string }) =>
    z.object({ code: z.string().min(1), redirectOrigin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Credenciais do Google ausentes no servidor.");
    const redirectUri = `${data.redirectOrigin}/oauth/drive-callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: data.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokens: any = await tokenRes.json();
    if (!tokenRes.ok || !tokens.refresh_token) {
      throw new Error(
        tokens?.error_description || tokens?.error ||
        "Não foi possível conectar ao Google Drive. Tente novamente.",
      );
    }

    let driveEmail: string | null = null;
    try {
      const uiRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (uiRes.ok) driveEmail = (await uiRes.json())?.email ?? null;
    } catch { /* cosmetic only, connection still succeeds without it */ }

    const { error } = await context.supabase
      .from("org_google_credentials")
      .upsert({
        org_id: context.orgId,
        refresh_token: tokens.refresh_token,
        drive_email: driveEmail,
        connected_by: context.userId,
        connected_at: new Date().toISOString(),
      }, { onConflict: "org_id" });
    if (error) throw new Error(error.message);

    return { ok: true, driveEmail };
  });

/** List candidate client folders inside the root (for fuzzy review). */
export const findClientFolderCandidates = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => withDriveOrg(context.orgId, async () => {
    const { data: client } = await context.supabase
      .from("clients").select("id, name").eq("id", data.clientId).maybeSingle();
    if (!client) throw new Error("Cliente não encontrado.");
    const rootId = await readRootFolderId(context.supabase);
    const folders = await driveListChildFolders(rootId);
    const target = normalizeName(client.name);
    const tokens = target.split(" ").filter(Boolean);

    const scored = folders.map((f) => {
      const n = normalizeName(f.name);
      let score = 0;
      if (n === target) score = 100;
      else if (n.includes(target) || target.includes(n)) score = 75;
      else {
        const hits = tokens.filter((t) => t.length > 2 && n.includes(t)).length;
        score = (hits / Math.max(1, tokens.length)) * 60;
      }
      return { id: f.id, name: f.name, score };
    }).filter((x) => x.score > 25)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const exact = scored.find((s) => s.score === 100) ?? null;
    return { clientName: client.name, exact, candidates: scored };
  }));

/** Idempotently ensure the Entregas folder exists for a client. */
export const ensureClientDeliveriesFolder = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; clientFolderId?: string }) =>
    z.object({
      clientId: z.string().uuid(),
      clientFolderId: z.string().min(5).max(200).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => withDriveOrg(context.orgId, async () => {
    const { data: client } = await context.supabase
      .from("clients").select("id, name").eq("id", data.clientId).maybeSingle();
    if (!client) throw new Error("Cliente não encontrado.");
    const rootId = await readRootFolderId(context.supabase);
    const tree = await ensureDeliveriesFolder(
      context.supabase, client.id, client.name, rootId, context.userId,
      { autoCreate: true, forceClientFolderId: data.clientFolderId },
    );
    return { ok: true, ...tree };
  }));

/** Re-organize every existing attached file into the correct client/month folder. */
export const reorganizeAllDriveFiles = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => withDriveOrg(context.orgId, async () => {
    await assertMaster(context.supabase, context.userId);
    const { data: files } = await context.supabase
      .from("item_files")
      .select("id, drive_file_id, item_id, content_items!inner(month_id, months!inner(key, client_id, clients!months_client_id_fkey!inner(id, name)))");
    if (!files?.length) return { ok: true, moved: 0, skipped: 0, errors: [] as string[] };

    const rootId = await readRootFolderId(context.supabase);
    const folderCache = new Map<string, string>(); // key `${clientId}|${monthLabel}` -> folderId
    let moved = 0, skipped = 0;
    const errors: string[] = [];

    for (const f of files as any[]) {
      try {
        const months = f.content_items?.months;
        const client = months?.clients;
        const label = monthLabelFromKey(months?.key);
        if (!client?.id || !label) { skipped++; continue; }
        const cacheKey = `${client.id}|${label}`;
        let target = folderCache.get(cacheKey) ?? null;
        if (!target) {
          const tree = await ensureDeliveriesFolder(
            context.supabase, client.id, client.name, rootId, context.userId,
            { autoCreate: true },
          );
          if (!tree) { skipped++; continue; }
          target = await ensureMonthFolder(tree.deliveriesFolderId, label);
          folderCache.set(cacheKey, target);
        }
        await driveMoveTo(f.drive_file_id, target);
        moved++;
      } catch (e) {
        errors.push(`${f.drive_file_id}: ${(e as any)?.message ?? "erro"}`);
      }
    }
    return { ok: true, moved, skipped, errors: errors.slice(0, 20) };
  }));

/* ============== PER-CLIENT DELIVERIES FOLDER (Perfil do Cliente) ============== */

async function assertAdmin(supabase: any, userId: string) {
  const { data: ok } = await supabase.rpc("is_admin", { _user_id: userId });
  if (!ok) throw new Error("Apenas administradores podem alterar a pasta de entregas.");
}

export const getClientDeliveriesFolder = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const map = await loadClientFolderMap(context.supabase, data.clientId);
    const folderId = map?.deliveries_folder_id ?? null;
    return {
      folderId,
      webViewUrl: folderId
        ? `https://drive.google.com/drive/folders/${folderId}`
        : null,
    };
  });

export const setClientDeliveriesFolder = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; folderIdOrUrl: string }) =>
    z.object({
      clientId: z.string().uuid(),
      folderIdOrUrl: z.string().trim().min(5).max(500),
    }).parse(d))
  .handler(async ({ data, context }) => withDriveOrg(context.orgId, async () => {
    await assertAdmin(context.supabase, context.userId);
    const id = parseDriveId(data.folderIdOrUrl);
    if (!id) throw new Error("Link/ID do Drive inválido.");

    // Validate the id points to an accessible folder.
    let meta: any;
    try {
      meta = await driveFetch(
        `/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType&supportsAllDrives=true`,
      );
    } catch (e: any) {
      throw new Error("Pasta não encontrada no Drive ou sem permissão de acesso.");
    }
    if (meta?.mimeType !== FOLDER_MIME) {
      throw new Error("O link informado não aponta para uma pasta do Drive.");
    }

    const { error } = await context.supabase
      .from("client_drive_map")
      .upsert({
        client_id: data.clientId,
        drive_folder_id: id,
        deliveries_folder_id: id,
        confirmed_by: context.userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "client_id" });
    if (error) throw new Error(error.message);

    return {
      ok: true,
      folderId: id,
      name: meta?.name ?? null,
      webViewUrl: `https://drive.google.com/drive/folders/${id}`,
    };
  }));

export const clearClientDeliveriesFolder = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("client_drive_map")
      .delete()
      .eq("client_id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });