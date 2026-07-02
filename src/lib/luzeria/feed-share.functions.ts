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
  thumbUrl: string | null;
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
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );

    const { data: result, error } = await supabase.rpc("get_public_feed", { _token: data.token });
    if (error || !result) return null;

    const r = result as any;
    const { client, month, items: rawItems, files: rawFiles, feedback: rawFeedback } = r;
    if (!client || !month) return null;

    // Support both flat (files/feedback as top-level arrays with item_id)
    // and nested (files/feedback embedded inside each item) structures
    const flatFiles: any[] = Array.isArray(rawFiles) ? rawFiles : [];
    const flatFeedback: any[] = Array.isArray(rawFeedback) ? rawFeedback : [];

    const filesByItem = new Map<string, any[]>();
    flatFiles.forEach((f: any) => {
      const arr = filesByItem.get(f.item_id) ?? [];
      arr.push(f); filesByItem.set(f.item_id, arr);
    });
    const fbByItem = new Map<string, any[]>();
    flatFeedback.forEach((f: any) => {
      const arr = fbByItem.get(f.item_id) ?? [];
      arr.push(f); fbByItem.set(f.item_id, arr);
    });

    // If files were nested inside items, extract them
    (rawItems ?? []).forEach((it: any) => {
      if (Array.isArray(it.files) && it.files.length > 0 && !filesByItem.has(it.id)) {
        filesByItem.set(it.id, it.files);
      }
      if (Array.isArray(it.feedback) && it.feedback.length > 0 && !fbByItem.has(it.id)) {
        fbByItem.set(it.id, it.feedback);
      }
    });

    const sorted = (rawItems ?? []).slice().sort((a: any, b: any) => {
      const ao = a.feed_order ?? Number.POSITIVE_INFINITY;
      const bo = b.feed_order ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      if (a.type !== b.type) return a.type === "reel" ? 1 : -1;
      return a.idx - b.idx;
    });

    // Collect all unique Drive file IDs and fetch thumbnail URLs in parallel
    const allDriveIds = new Set<string>();
    for (const it of sorted) {
      for (const f of (filesByItem.get(it.id) ?? [])) {
        const id = f.drive_file_id ?? f.driveFileId;
        if (id) allDriveIds.add(id);
      }
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
            const meta = await res.json();
            const link: string | undefined = meta?.thumbnailLink;
            if (link) thumbUrls.set(fileId, link.replace(/=s\d+(-[a-z]+)?$/i, "=s720"));
          } catch { /* skip */ }
        }),
      );
    } catch { /* skip if Drive auth unavailable */ }

    return {
      client: {
        name: client.name as string,
        color: (client.color as string) ?? "#C8D44E",
        description: client.description ?? null,
      },
      month: { key: month.key as string },
      items: sorted.map((it: any) => {
        const files = (filesByItem.get(it.id) ?? []).map((f: any) => ({
          id: f.id,
          driveFileId: f.drive_file_id ?? f.driveFileId,
          mimeType: f.mime_type ?? f.mimeType,
          webViewUrl: f.web_view_url ?? f.webViewUrl,
          thumbUrl: thumbUrls.get(f.drive_file_id ?? f.driveFileId) ?? null,
        }));
        const gridThumb = files[0]?.thumbUrl ?? null;
        return {
          id: it.id,
          type: it.type,
          idx: it.idx,
          title: it.title,
          caption: it.caption ?? "",
          dueDate: it.due_date ?? null,
          coverUrl: null,
          gridThumb,
          files,
          feedback: (fbByItem.get(it.id) ?? []).map((f: any) => ({
            id: f.id,
            authorName: f.author_name ?? f.authorName,
            text: f.text,
            createdAt: f.created_at ?? f.createdAt,
          })),
        };
      }),
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
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );
    // verify_public_token_file: SECURITY DEFINER function that checks the token is valid
    // and the fileId belongs to an item in the token's month
    const { data: ok } = await supabase.rpc("verify_public_token_file", {
      _token: data.token,
      _file_id: data.fileId,
    });
    if (!ok) return { dataUrl: null as string | null };
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
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );
    // add_public_feedback: SECURITY DEFINER function that validates token + item ownership
    // and inserts into client_feedback, returning the new row
    const { data: row, error } = await supabase.rpc("add_public_feedback", {
      _token: data.token,
      _item_id: data.itemId,
      _author_name: data.authorName,
      _text: data.text,
    });
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Link inválido ou revogado.");
    const r = row as any;
    return {
      id: r.id as string,
      authorName: r.author_name as string,
      text: r.text as string,
      createdAt: r.created_at as string,
    };
  });

/* ============ PUBLIC: approve single item ============ */

export const approvePublicItem = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; itemId: string; authorName: string }) =>
    z.object({
      token: z.string().min(8).max(60),
      itemId: z.string().uuid(),
      authorName: z.string().trim().min(1).max(60),
    }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );
    const { error } = await supabase.rpc("add_public_feedback", {
      _token: data.token,
      _item_id: data.itemId,
      _author_name: data.authorName,
      _text: "✅ APROVADO",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ PUBLIC: approve feed ============ */

export const approvePublicFeed = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) =>
    z.object({ token: z.string().min(8).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );
    const { error } = await supabase
      .from("feed_share_tokens")
      .update({ client_approved_at: new Date().toISOString() })
      .eq("token", data.token)
      .is("revoked_at", null);
    if (error) throw new Error(error.message);
    return { ok: true, approvedAt: new Date().toISOString() };
  });
