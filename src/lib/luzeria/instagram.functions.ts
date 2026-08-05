// Publicação automática no Instagram — Fase 1 (só Posts, botão manual
// "Publicar agora"). A conexão é por CLIENTE (cada cliente tem a própria
// conta), diferente do Drive (uma conexão por agência). Usa Facebook Login
// for Business: o app da Meta (META_APP_ID/META_APP_SECRET, compartilhado
// por toda a plataforma) pede permissão pra postar na conta do Instagram
// Business/Criador de Conteúdo vinculada à Página do Facebook do cliente.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

const GRAPH_API = "https://graph.facebook.com/v21.0";
const IG_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

async function assertMaster(supabase: any, userId: string) {
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (!isMaster) throw new Error("Apenas o Adm Master pode executar esta ação.");
}

async function assertClientInOrg(supabase: any, clientId: string, orgId: string) {
  const { data } = await supabase.from("clients").select("id").eq("id", clientId).eq("org_id", orgId).maybeSingle();
  if (!data) throw new Error("Cliente não encontrado.");
}

export const getInstagramConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const { data: row } = await context.supabase
      .from("client_instagram_credentials")
      .select("ig_username, connected_at")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!row) return { connected: false, igUsername: null, connectedAt: null };
    return { connected: true, igUsername: row.ig_username, connectedAt: row.connected_at };
  });

export const disconnectInstagram = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const { error } = await context.supabase.from("client_instagram_credentials").delete().eq("client_id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Builds the Facebook consent URL for this client's master to connect
 * the client's Instagram. `state` carries the clientId through the
 * redirect — re-validated (belongs to caller's org) in completeInstagramConnect. */
export const getInstagramConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; redirectOrigin: string }) =>
    z.object({ clientId: z.string().uuid(), redirectOrigin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const appId = process.env.META_APP_ID;
    if (!appId) throw new Error("META_APP_ID ausente no servidor.");
    const redirectUri = `${data.redirectOrigin}/oauth/instagram-callback`;
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: IG_SCOPES,
      state: data.clientId,
    });
    return { url: `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}` };
  });

export type InstagramPageCandidate = {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  igId: string;
  igUsername: string | null;
};

/** Exchanges the OAuth code for a long-lived user token, then lists every
 * Facebook Page the user manages that has a connected Instagram Business
 * account. Returns the single match already connected (ok: true), or the
 * full candidate list for the frontend to ask the user to pick one from
 * (ok: false — see finalizeInstagramConnect). Nothing is persisted yet
 * when there's more than one candidate. */
export const completeInstagramConnect = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { code: string; clientId: string; redirectOrigin: string }) =>
    z.object({
      code: z.string().min(1),
      clientId: z.string().uuid(),
      redirectOrigin: z.string().url(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    if (!appId || !appSecret) throw new Error("Credenciais da Meta ausentes no servidor.");
    const redirectUri = `${data.redirectOrigin}/oauth/instagram-callback`;

    const shortRes = await fetch(
      `${GRAPH_API}/oauth/access_token?` + new URLSearchParams({
        client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code: data.code,
      }),
    );
    const shortJson: any = await shortRes.json();
    if (!shortRes.ok || !shortJson.access_token) {
      throw new Error(shortJson?.error?.message ?? "Não foi possível conectar ao Facebook. Tente novamente.");
    }

    const longRes = await fetch(
      `${GRAPH_API}/oauth/access_token?` + new URLSearchParams({
        grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret,
        fb_exchange_token: shortJson.access_token,
      }),
    );
    const longJson: any = await longRes.json();
    if (!longRes.ok || !longJson.access_token) {
      throw new Error(longJson?.error?.message ?? "Não foi possível validar o acesso ao Facebook.");
    }

    const pagesRes = await fetch(`${GRAPH_API}/me/accounts?access_token=${encodeURIComponent(longJson.access_token)}`);
    const pagesJson: any = await pagesRes.json();
    if (!pagesRes.ok) throw new Error(pagesJson?.error?.message ?? "Não foi possível listar as Páginas do Facebook.");

    const candidates: InstagramPageCandidate[] = [];
    for (const page of pagesJson.data ?? []) {
      const igRes = await fetch(
        `${GRAPH_API}/${page.id}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(page.access_token)}`,
      );
      const igJson: any = await igRes.json();
      const ig = igJson?.instagram_business_account;
      if (ig?.id) {
        candidates.push({
          pageId: page.id, pageName: page.name, pageAccessToken: page.access_token,
          igId: ig.id, igUsername: ig.username ?? null,
        });
      }
    }

    if (candidates.length === 0) {
      throw new Error("Nenhuma conta do Instagram Business/Criador de Conteúdo encontrada nas Páginas do Facebook que você administra.");
    }

    if (candidates.length === 1) {
      await saveInstagramCredentials(context, data.clientId, candidates[0]);
      return { ok: true as const, igUsername: candidates[0].igUsername };
    }

    return { ok: false as const, candidates };
  });

export const finalizeInstagramConnect = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; candidate: InstagramPageCandidate }) =>
    z.object({
      clientId: z.string().uuid(),
      candidate: z.object({
        pageId: z.string().min(1),
        pageName: z.string().min(1),
        pageAccessToken: z.string().min(1),
        igId: z.string().min(1),
        igUsername: z.string().nullable(),
      }),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    await saveInstagramCredentials(context, data.clientId, data.candidate);
    return { ok: true, igUsername: data.candidate.igUsername };
  });

/** Publishes a "post" content_item straight to the client's Instagram feed.
 * Fase 1 scope: post (image) only, triggered by an admin clicking "Publicar
 * agora" — no Reels/Stories, no automatic scheduling yet. On success, marks
 * the item FINALIZADO (it really is done now — one less manual step). */
export const publishToInstagram = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string }) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);

    const { data: item } = await context.supabase
      .from("content_items")
      .select("id, type, status, caption, month_id, months(client_id, clients(id, org_id))")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item) throw new Error("Item não encontrado.");
    if (item.type !== "post") throw new Error("A publicação automática só está disponível pra Posts, por enquanto.");
    if (item.status !== "PRONTO_PARA_PUBLICAR" && item.status !== "FINALIZADO") {
      throw new Error('Marque o status como "Pronto para publicar" antes de publicar no Instagram.');
    }
    const clientId: string | undefined = (item as any).months?.client_id;
    const clientOrgId: string | undefined = (item as any).months?.clients?.org_id;
    if (!clientId || clientOrgId !== context.orgId) throw new Error("Cliente não encontrado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: creds } = await supabaseAdmin
      .from("client_instagram_credentials")
      .select("instagram_business_account_id, page_access_token")
      .eq("client_id", clientId)
      .maybeSingle();
    if (!creds) throw new Error("Esse cliente ainda não conectou o Instagram. Vá na Ficha do Cliente e conecte.");

    const { data: files } = await context.supabase
      .from("item_files")
      .select("drive_file_id, mime_type")
      .eq("item_id", data.itemId)
      .order("sort_order").order("created_at");
    const imageFile = (files ?? []).find((f: any) => (f.mime_type ?? "").startsWith("image/"));
    if (!imageFile) throw new Error("Anexe uma imagem ao post antes de publicar.");

    const { getAccessToken, withDriveOrg } = await import("./drive.functions");
    const imageBuffer = await withDriveOrg(context.orgId, async () => {
      const token = await getAccessToken();
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(imageFile.drive_file_id)}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`Falha ao baixar a imagem do Drive (${res.status}).`);
      return Buffer.from(await res.arrayBuffer());
    });

    const mimeType = imageFile.mime_type ?? "image/jpeg";
    const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const tempPath = `${data.itemId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("instagram-publish-temp")
      .upload(tempPath, imageBuffer, { contentType: mimeType, upsert: true });
    if (upErr) throw new Error(`Falha ao preparar a imagem: ${upErr.message}`);
    const { data: pub } = supabaseAdmin.storage.from("instagram-publish-temp").getPublicUrl(tempPath);
    const publicImageUrl = pub.publicUrl;

    try {
      const containerRes = await fetch(`${GRAPH_API}/${creds.instagram_business_account_id}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: publicImageUrl,
          caption: item.caption ?? "",
          access_token: creds.page_access_token,
        }),
      });
      const containerJson: any = await containerRes.json();
      if (!containerRes.ok || !containerJson.id) {
        throw new Error(containerJson?.error?.message ?? "O Instagram recusou a imagem.");
      }

      const publishRes = await fetch(`${GRAPH_API}/${creds.instagram_business_account_id}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: containerJson.id, access_token: creds.page_access_token }),
      });
      const publishJson: any = await publishRes.json();
      if (!publishRes.ok || !publishJson.id) {
        throw new Error(publishJson?.error?.message ?? "Falha ao publicar no Instagram.");
      }

      if (item.status !== "FINALIZADO") {
        // Same RPC the normal status dropdown uses — keeps triggers,
        // permissions and side effects (finalizations credit, activity
        // log, notifications) identical to a manual status change.
        await context.supabase.rpc("set_item_status", { p_item_id: data.itemId, p_status: "FINALIZADO" });
      }

      return { ok: true, instagramMediaId: publishJson.id as string };
    } finally {
      await supabaseAdmin.storage.from("instagram-publish-temp").remove([tempPath]).catch(() => {});
    }
  });

async function saveInstagramCredentials(context: any, clientId: string, c: InstagramPageCandidate) {
  const { error } = await context.supabase.from("client_instagram_credentials").upsert({
    client_id: clientId,
    facebook_page_id: c.pageId,
    instagram_business_account_id: c.igId,
    ig_username: c.igUsername,
    page_access_token: c.pageAccessToken,
    connected_by: context.userId,
    connected_at: new Date().toISOString(),
  }, { onConflict: "client_id" });
  if (error) throw new Error(error.message);
}
