import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";
import { getAccessToken, withDriveOrg } from "./drive.functions";
import type { Status } from "./types";
import {
  type ClientStage,
  CLIENT_STAGE_ORDER,
  CLIENT_STAGE_META,
  CLIENT_STAGE_BLOCKED_FALLBACK,
  mapStatusToClientStage,
} from "./client-stage";

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

/** Um único link por CLIENTE (não por mês) — resolve sempre pro mês mais
 * recente daquele cliente (ver get_public_feed). `monthId` é guardado só
 * como referência de "gerado a partir de qual mês", não faz parte da
 * identidade do link. */
export const getOrCreateShareToken = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; monthId: string }) =>
    z.object({ clientId: z.string().uuid(), monthId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Apenas admins podem compartilhar o preview.");
    const { data: existing } = await context.supabase
      .from("feed_share_tokens").select("token, revoked_at")
      .eq("client_id", data.clientId).maybeSingle();
    if (existing && !existing.revoked_at) return { token: existing.token as string };
    const token = randomToken(22);
    if (existing) {
      const { error } = await context.supabase
        .from("feed_share_tokens")
        .update({ token, month_id: data.monthId, revoked_at: null, created_by: context.userId })
        .eq("client_id", data.clientId);
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
      }, { onConflict: "client_id" });
    if (error) throw new Error(error.message);
    return { token };
  });

/* ============ TEAM: which month the client's fixed link shows ============ */

/** O link público é fixo por cliente e sempre mostra o mês "ativo" —
 * escolhido manualmente pela agência (clients.active_month_id), não o
 * mês mais recente automaticamente: um mês novo pode já existir (ex:
 * container vazio) sem ainda ser o que deve aparecer pro cliente. */
export const getActiveFeedMonth = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) =>
    z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("clients").select("active_month_id").eq("id", data.clientId).maybeSingle();
    if (error) throw new Error(error.message);
    return { monthId: (row?.active_month_id as string | null) ?? null };
  });

export const setActiveFeedMonth = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; monthId: string }) =>
    z.object({ clientId: z.string().uuid(), monthId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Apenas admins podem escolher o mês do link.");
    const { error } = await context.supabase
      .from("clients").update({ active_month_id: data.monthId }).eq("id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
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

/* ============ TEAM: approval summary for the "Preview de Feed" tab ============ */

export type FeedApprovalItem = { itemId: string; approved: boolean; comment: string | null };

export const getFeedApprovalSummary = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; monthId: string; itemIds: string[] }) =>
    z.object({
      clientId: z.string().uuid(),
      monthId: z.string().uuid(),
      itemIds: z.array(z.string().uuid()),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: monthRow } = await context.supabase
      .from("months")
      .select("client_approved_at")
      .eq("id", data.monthId)
      .maybeSingle();

    let items: FeedApprovalItem[] = data.itemIds.map((id) => ({ itemId: id, approved: false, comment: null }));

    if (data.itemIds.length > 0) {
      const { data: fbRows, error: fbErr } = await context.supabase
        .from("client_feedback")
        .select("item_id, text, created_at")
        .in("item_id", data.itemIds)
        .order("created_at", { ascending: false });
      if (fbErr) throw new Error(fbErr.message);

      // Rows arrive newest-first, so the first non-approval text seen per
      // item is its most recent actual suggestion/comment.
      const byItem = new Map<string, { approved: boolean; comment: string | null }>();
      for (const row of fbRows ?? []) {
        const id = row.item_id as string;
        const entry = byItem.get(id) ?? { approved: false, comment: null };
        if (row.text === "✅ APROVADO") entry.approved = true;
        else if (entry.comment === null) entry.comment = row.text as string;
        byItem.set(id, entry);
      }
      items = data.itemIds.map((id) => ({
        itemId: id,
        approved: byItem.get(id)?.approved ?? false,
        comment: byItem.get(id)?.comment ?? null,
      }));
    }

    return {
      feedApprovedAt: (monthRow?.client_approved_at as string | null) ?? null,
      items,
    };
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
  type: "post" | "reel";
  idx: number;
  title: string;
  caption: string;
  scheduledAt: string | null;
  coverUrl: string | null;
  gridThumb: string | null;
  files: PublicFeedFile[];
  feedback: Array<{ id: string; authorName: string; text: string; createdAt: string }>;
  status: Status;
  stage: ClientStage;
  stageLabel: string;
  blockedReason: string | null;
};
export type PublicFeedPayload = {
  client: { name: string; color: string; description: string | null; photoUrl: string | null };
  month: { key: string };
  items: PublicFeedItem[];
  stageCounts: { stage: ClientStage; label: string; count: number }[];
  orgName: string | null;
  feedPreviewImageUrl: string | null;
  orgLogoUrl: string | null;
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

    const { data: orgId } = await supabase.rpc("get_org_id_for_token", { _token: data.token });
    let orgName: string | null = null;
    let feedPreviewImagePath: string | null = null;
    let orgLogoPath: string | null = null;
    if (orgId) {
      const { data: org } = await supabase.from("orgs").select("name, feed_preview_image_path, logo_path").eq("id", orgId as string).maybeSingle();
      orgName = org?.name ?? null;
      feedPreviewImagePath = (org as any)?.feed_preview_image_path ?? null;
      orgLogoPath = (org as any)?.logo_path ?? null;
    }

    const r = result as any;
    const { client, month, items: rawItems, files: rawFiles, feedback: rawFeedback } = r;
    if (!client || !month) return null;

    // The "avatars" bucket only allows reads from authenticated users (client
    // photos aren't meant to be publicly listable) — this public page needs
    // to show exactly one already-known photo for the client this token
    // belongs to, so sign it with the service-role client instead. Same deal
    // for the agency's custom feed-preview og:image, if they set one.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let clientPhotoUrl: string | null = null;
    if (client.photo_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from("avatars")
        .createSignedUrl(client.photo_path, 60 * 60 * 24 * 365);
      clientPhotoUrl = signed?.signedUrl ?? null;
    }
    let feedPreviewImageUrl: string | null = null;
    if (feedPreviewImagePath) {
      const { data: signed } = await supabaseAdmin.storage
        .from("avatars")
        .createSignedUrl(feedPreviewImagePath, 60 * 60 * 24 * 365);
      feedPreviewImageUrl = signed?.signedUrl ?? null;
    }
    let orgLogoUrl: string | null = null;
    if (orgLogoPath) {
      const { data: signed } = await supabaseAdmin.storage
        .from("avatars")
        .createSignedUrl(orgLogoPath, 60 * 60 * 24 * 365);
      orgLogoUrl = signed?.signedUrl ?? null;
    }

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
    // A single transient failure here (token refresh hiccup, network blip)
    // would otherwise leave every item without a thumbnail for this render
    // with no way to recover — retry once before giving up entirely.
    let token: string | null = null;
    let tokenErr: unknown = null;
    if (orgId) {
      await withDriveOrg(orgId as string, async () => {
        for (let attempt = 0; attempt < 2 && !token; attempt++) {
          try {
            token = await getAccessToken();
          } catch (e) {
            tokenErr = e;
            if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
          }
        }
      });
    } else {
      tokenErr = new Error("Could not resolve org for this share token");
    }
    if (!token) {
      console.error("[getPublicFeed] getAccessToken failed after retry:", tokenErr);
    }
    if (token) {
      await Promise.all(
        [...allDriveIds].map(async (fileId) => {
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const res = await fetch(
                `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=thumbnailLink&supportsAllDrives=true`,
                { headers: { Authorization: `Bearer ${token}` } },
              );
              if (!res.ok) {
                if (attempt === 0) { await new Promise((r) => setTimeout(r, 300)); continue; }
                const body = await res.text().catch(() => "");
                console.error(`[getPublicFeed] thumbnailLink fetch failed for ${fileId}: ${res.status} ${body.slice(0, 200)}`);
                return;
              }
              const meta = await res.json();
              const link: string | undefined = meta?.thumbnailLink;
              if (!link) console.error(`[getPublicFeed] no thumbnailLink in response for ${fileId}:`, JSON.stringify(meta).slice(0, 200));
              if (link) thumbUrls.set(fileId, link.replace(/=s\d+(-[a-z]+)?$/i, "=s720"));
              return;
            } catch (e) {
              if (attempt === 0) { await new Promise((r) => setTimeout(r, 300)); continue; }
              console.error(`[getPublicFeed] thumbnailLink fetch threw for ${fileId}:`, e);
            }
          }
        }),
      );
    }

    const mappedItems: PublicFeedItem[] = sorted.map((it: any) => {
      const files = (filesByItem.get(it.id) ?? []).map((f: any) => ({
        id: f.id,
        driveFileId: f.drive_file_id ?? f.driveFileId,
        mimeType: f.mime_type ?? f.mimeType,
        webViewUrl: f.web_view_url ?? f.webViewUrl,
        thumbUrl: thumbUrls.get(f.drive_file_id ?? f.driveFileId) ?? null,
      }));
      const gridThumb = files[0]?.thumbUrl ?? null;
      const status = it.status as Status;
      const stage = mapStatusToClientStage(status);
      const blockedReason: string | null = it.blocked_reason ?? null;
      const stageLabel = stage === "blocked"
        ? (blockedReason || CLIENT_STAGE_BLOCKED_FALLBACK)
        : CLIENT_STAGE_META[stage].label;
      return {
        id: it.id,
        type: it.type,
        idx: it.idx,
        title: it.title,
        caption: it.caption ?? "",
        scheduledAt: it.scheduled_at ?? null,
        coverUrl: null,
        gridThumb,
        files,
        feedback: (fbByItem.get(it.id) ?? []).map((f: any) => ({
          id: f.id,
          authorName: f.author_name ?? f.authorName,
          text: f.text,
          createdAt: f.created_at ?? f.createdAt,
        })),
        status,
        stage,
        stageLabel,
        blockedReason,
      };
    });

    const stageCounts = CLIENT_STAGE_ORDER.map((stage) => ({
      stage,
      label: CLIENT_STAGE_META[stage].label,
      count: mappedItems.filter((it) => it.stage === stage).length,
    }));

    return {
      client: {
        name: client.name as string,
        color: (client.color as string) ?? "rgb(var(--lz-brand-rgb))",
        description: client.description ?? null,
        photoUrl: clientPhotoUrl,
      },
      month: { key: month.key as string },
      items: mappedItems,
      stageCounts,
      orgName,
      feedPreviewImageUrl,
      orgLogoUrl,
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
    const { data: orgId } = await supabase.rpc("get_org_id_for_token", { _token: data.token });
    if (!orgId) return { dataUrl: null as string | null };
    const dataUrl = await withDriveOrg(orgId as string, () => fetchThumbDataUrl(data.fileId, data.size ?? 720));
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
    const { data: approvedAt, error } = await supabase.rpc("approve_public_feed", { _token: data.token });
    if (error) throw new Error(error.message);
    if (!approvedAt) throw new Error("Link inválido ou revogado.");
    return { ok: true, approvedAt: approvedAt as string };
  });
