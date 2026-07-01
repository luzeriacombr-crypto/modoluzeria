import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";
import { getAccessToken } from "./drive.functions";

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";

function randomToken(len = 22): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function driveFetch(path: string) {
  const token = await getAccessToken();
  const r = await fetch(`${DRIVE_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Drive ${r.status}`);
  return r.json() as Promise<any>;
}

async function fetchThumbDataUrl(fileId: string, size = 480): Promise<string | null> {
  try {
    const meta: any = await driveFetch(
      `/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink,mimeType&supportsAllDrives=true`,
    );
    const link: string | undefined = meta?.thumbnailLink;
    if (!link) return null;
    const url = link.replace(/=s\d+(-[a-z]+)?$/i, `=s${size}`);
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 2_500_000) return null;
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/* ============ ADMIN: get/create + rotate ============ */

export const getOrCreateShareToken = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; monthId: string }) =>
    z.object({ clientId: z.string().uuid(), monthId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Apenas admins podem compartilhar o preview.");
    const { data: existing } = await context.supabase
      .from("feed_share_tokens").select("token, revoked_at")
      .eq("client_id", data.clientId).eq("month_id", data.monthId).maybeSingle();
    if (existing && !existing.revoked_at) return { token: existing.token as string };
    const token = randomToken(22);
    if (existing) {
      const { error } = await context.supabase
        .from("feed_share_tokens")
        .update({ token, revoked_at: null, created_by: context.userId })
        .eq("client_id", data.clientId).eq("month_id", data.monthId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("feed_share_tokens")
        .insert({ client_id: data.clientId, month_id: data.monthId, token, created_by: context.userId });
      if (error) throw new Error(error.message);
    }
    return { token };
  });

export const rotateShareToken = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; monthId: string }) =>
    z.object({ clientId: z.string().uuid(), monthId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Apenas admins podem rotacionar o link.");
    const token = randomToken(22);
    const { error } = await context.supabase
      .from("feed_share_tokens")
      .upsert({
        client_id: data.clientId, month_id: data.monthId, token,
        revoked_at: null, created_by: context.userId,
      }, { onConflict: "client_id,month_id" });
    if (error) throw new Error(error.message);
    return { token };
  });

/* ============ TEAM: list feedback for an item ============ */

export const listClientFeedback = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string }) =>
    z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_feedback").select("id, author_name, text, created_at")
      .eq("item_id", data.itemId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      authorName: r.author_name as string,
      text: r.text as string,
      createdAt: r.created_at as string,
    }));
  });

/* ============ PUBLIC: get feed by token ============ */

export type PublicFeedFile = {
  id: string;
  driveFileId: string;
  mimeType: string | null;
  webViewUrl: string | null;
};
export type PublicFeedItem = {
  id: string;
  type: "post" | "reel" | "outros";
  idx: number;
  title: string;
  caption: string;
  dueDate: string | null;
  coverUrl: string | null;
  gridThumb: string | null;
  files: PublicFeedFile[];
  feedback: Array<{ id: string; authorName: string; text: string; createdAt: string }>;
};
export type PublicFeedPayload = {
  client: { name: string; color: string; description: string | null };
  month: { key: string };
  items: PublicFeedItem[];
};

export const getPublicFeed = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) =>
    z.object({ token: z.string().min(8).max(60) }).parse(d))
  .handler(async ({ data }): Promise<PublicFeedPayload | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tok } = await supabaseAdmin
      .from("feed_share_tokens")
      .select("client_id, month_id, revoked_at")
      .eq("token", data.token).maybeSingle();
    if (!tok || tok.revoked_at) return null;

    const [{ data: client }, { data: month }] = await Promise.all([
      supabaseAdmin.from("clients").select("name, color, description").eq("id", tok.client_id).maybeSingle(),
      supabaseAdmin.from("months").select("key").eq("id", tok.month_id).maybeSingle(),
    ]);
    if (!client || !month) return null;

    const { data: items } = await supabaseAdmin
      .from("content_items")
      .select("id, type, idx, title, caption, due_date, feed_order, cover_path")
      .eq("month_id", tok.month_id)
      .eq("status", "PRONTO_PARA_PUBLICAR");

    const ids = (items ?? []).map((i: any) => i.id);
    const [{ data: files }, { data: feedback }] = await Promise.all([
      ids.length
        ? supabaseAdmin.from("item_files")
            .select("id, item_id, drive_file_id, mime_type, web_view_url, sort_order, created_at")
            .in("item_id", ids).order("sort_order").order("created_at")
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabaseAdmin.from("client_feedback")
            .select("id, item_id, author_name, text, created_at")
            .in("item_id", ids).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const filesByItem = new Map<string, any[]>();
    (files ?? []).forEach((f: any) => {
      const arr = filesByItem.get(f.item_id) ?? [];
      arr.push(f); filesByItem.set(f.item_id, arr);
    });
    const fbByItem = new Map<string, any[]>();
    (feedback ?? []).forEach((f: any) => {
      const arr = fbByItem.get(f.item_id) ?? [];
      arr.push(f); fbByItem.set(f.item_id, arr);
    });

    // Sign covers
    const coverPaths = Array.from(new Set((items ?? []).map((i: any) => i.cover_path).filter(Boolean) as string[]));
    const signedCovers = new Map<string, string>();
    if (coverPaths.length) {
      const { data: sig } = await supabaseAdmin.storage.from("reel-covers")
        .createSignedUrls(coverPaths, 60 * 60 * 24 * 7);
      (sig ?? []).forEach((r: any) => { if (r?.path && r?.signedUrl) signedCovers.set(r.path, r.signedUrl); });
    }

    const sorted = (items ?? []).slice().sort((a: any, b: any) => {
      const ao = a.feed_order ?? Number.POSITIVE_INFINITY;
      const bo = b.feed_order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      if (a.type !== b.type) return a.type === "reel" ? 1 : -1;
      return a.idx - b.idx;
    });

    // Fetch grid thumbnail for each item (cover for reels, first file for posts)
    const gridThumbs = await Promise.all(sorted.map(async (it: any) => {
      if (it.cover_path && signedCovers.has(it.cover_path)) return signedCovers.get(it.cover_path)!;
      const f0 = (filesByItem.get(it.id) ?? [])[0];
      if (!f0) return null;
      return await fetchThumbDataUrl(f0.drive_file_id, 480);
    }));

    return {
      client: {
        name: client.name as string,
        color: (client.color as string) ?? "#C8D44E",
        description: (client as any).description ?? null,
      },
      month: { key: month.key as string },
      items: sorted.map((it: any, i: number) => ({
        id: it.id,
        type: it.type,
        idx: it.idx,
        title: it.title,
        caption: it.caption ?? "",
        dueDate: it.due_date ?? null,
        coverUrl: it.cover_path ? signedCovers.get(it.cover_path) ?? null : null,
        gridThumb: gridThumbs[i],
        files: (filesByItem.get(it.id) ?? []).map((f: any) => ({
          id: f.id, driveFileId: f.drive_file_id, mimeType: f.mime_type, webViewUrl: f.web_view_url,
        })),
        feedback: (fbByItem.get(it.id) ?? []).map((f: any) => ({
          id: f.id, authorName: f.author_name, text: f.text, createdAt: f.created_at,
        })),
      })),
    };
  });

/* ============ PUBLIC: thumbnail by token + fileId ============ */

export const getPublicDriveThumbnail = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string; fileId: string; size?: number }) =>
    z.object({
      token: z.string().min(8).max(60),
      fileId: z.string().min(5).max(200),
      size: z.number().int().min(64).max(1280).optional(),
    }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tok } = await supabaseAdmin
      .from("feed_share_tokens")
      .select("month_id, revoked_at")
      .eq("token", data.token).maybeSingle();
    if (!tok || tok.revoked_at) return { dataUrl: null as string | null };
    // Make sure the fileId belongs to an item_file whose item is in this token's month.
    const { data: fileRow } = await supabaseAdmin
      .from("item_files").select("item_id").eq("drive_file_id", data.fileId).limit(1).maybeSingle();
    if (!fileRow) return { dataUrl: null as string | null };
    const { data: itemRow } = await supabaseAdmin
      .from("content_items").select("month_id").eq("id", fileRow.item_id).maybeSingle();
    if (!itemRow || itemRow.month_id !== tok.month_id) return { dataUrl: null as string | null };
    const dataUrl = await fetchThumbDataUrl(data.fileId, data.size ?? 720);
    return { dataUrl };
  });

/* ============ PUBLIC: add feedback ============ */

export const addPublicFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; itemId: string; authorName: string; text: string }) =>
    z.object({
      token: z.string().min(8).max(60),
      itemId: z.string().uuid(),
      authorName: z.string().trim().min(1).max(60),
      text: z.string().trim().min(1).max(1000),
    }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tok } = await supabaseAdmin
      .from("feed_share_tokens")
      .select("month_id, revoked_at")
      .eq("token", data.token).maybeSingle();
    if (!tok || tok.revoked_at) throw new Error("Link inválido ou revogado.");
    // Item must belong to the same month_id as the token
    const { data: item } = await supabaseAdmin
      .from("content_items").select("month_id").eq("id", data.itemId).maybeSingle();
    if (!item || item.month_id !== tok.month_id) throw new Error("Publicação inválida.");
    const { data: row, error } = await supabaseAdmin
      .from("client_feedback")
      .insert({
        item_id: data.itemId,
        author_name: data.authorName,
        text: data.text,
        share_token: data.token,
      })
      .select("id, author_name, text, created_at")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: row.id as string,
      authorName: row.author_name as string,
      text: row.text as string,
      createdAt: row.created_at as string,
    };
  });
