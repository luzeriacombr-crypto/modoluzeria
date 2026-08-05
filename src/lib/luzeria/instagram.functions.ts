// Publicação automática no Instagram — Fase 1 (só Posts, botão manual
// "Publicar agora"). A conexão é por CLIENTE (cada cliente tem a própria
// conta), diferente do Drive (uma conexão por agência). Usa o produto
// "Instagram API com Login do Instagram" da Meta (INSTAGRAM_APP_ID/
// INSTAGRAM_APP_SECRET — credenciais separadas do app principal): o master
// loga direto na conta Instagram Business/Criador de Conteúdo do cliente,
// sem precisar de Página do Facebook.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

const IG_GRAPH_API = "https://graph.instagram.com/v21.0";
const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
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

/** Builds the Instagram consent URL for this client's master to connect
 * the client's Instagram account directly. `state` carries the clientId
 * through the redirect — re-validated (belongs to caller's org) in
 * completeInstagramConnect. */
export const getInstagramConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; redirectOrigin: string }) =>
    z.object({ clientId: z.string().uuid(), redirectOrigin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const appId = process.env.INSTAGRAM_APP_ID;
    if (!appId) throw new Error("INSTAGRAM_APP_ID ausente no servidor.");
    const redirectUri = `${data.redirectOrigin}/oauth/instagram-callback`;
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: IG_SCOPES,
      state: data.clientId,
    });
    return { url: `https://www.instagram.com/oauth/authorize?${params.toString()}` };
  });

/** Exchanges the OAuth code for a short-lived token, upgrades it to a
 * long-lived (60-day) token, fetches the connected account's username, and
 * persists the credentials for this client. Instagram Business Login
 * authenticates directly to one Instagram professional account — no
 * Facebook Page picker needed. */
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
    const appId = process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    if (!appId || !appSecret) throw new Error("Credenciais do Instagram ausentes no servidor.");
    const redirectUri = `${data.redirectOrigin}/oauth/instagram-callback`;

    const shortBody = new URLSearchParams({
      client_id: appId, client_secret: appSecret, grant_type: "authorization_code",
      redirect_uri: redirectUri, code: data.code,
    });
    const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: shortBody,
    });
    const shortJson: any = await shortRes.json();
    if (!shortRes.ok || !shortJson.access_token || !shortJson.user_id) {
      throw new Error(shortJson?.error_message ?? "Não foi possível conectar ao Instagram. Tente novamente.");
    }

    const longRes = await fetch(
      `${IG_GRAPH_API.replace("/v21.0", "")}/access_token?` + new URLSearchParams({
        grant_type: "ig_exchange_token", client_secret: appSecret, access_token: shortJson.access_token,
      }),
    );
    const longJson: any = await longRes.json();
    if (!longRes.ok || !longJson.access_token) {
      throw new Error(longJson?.error?.message ?? "Não foi possível validar o acesso ao Instagram.");
    }

    // The user_id from the token exchange isn't reliably the same ID the
    // /media publishing endpoints expect — fetch the authoritative id via
    // /me with the long-lived token instead of trusting it.
    const meRes = await fetch(`${IG_GRAPH_API}/me?fields=id,username&access_token=${encodeURIComponent(longJson.access_token)}`);
    const meJson: any = await meRes.json();
    if (!meRes.ok || !meJson.id) {
      throw new Error(meJson?.error?.message ?? "Não foi possível identificar a conta do Instagram.");
    }
    const igId = String(meJson.id);
    const igUsername: string | null = meJson.username ?? null;

    const { error } = await context.supabase.from("client_instagram_credentials").upsert({
      client_id: data.clientId,
      instagram_business_account_id: igId,
      ig_username: igUsername,
      access_token: longJson.access_token,
      connected_by: context.userId,
      connected_at: new Date().toISOString(),
    }, { onConflict: "client_id" });
    if (error) throw new Error(error.message);

    return { ok: true as const, igUsername };
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
      .select("instagram_business_account_id, access_token")
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
      const containerRes = await fetch(`${IG_GRAPH_API}/${creds.instagram_business_account_id}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          image_url: publicImageUrl,
          caption: item.caption ?? "",
          access_token: creds.access_token,
        }),
      });
      const containerJson: any = await containerRes.json();
      if (!containerRes.ok || !containerJson.id) {
        throw new Error(containerJson?.error?.message ?? "O Instagram recusou a imagem.");
      }

      const publishRes = await fetch(`${IG_GRAPH_API}/${creds.instagram_business_account_id}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ creation_id: containerJson.id, access_token: creds.access_token }),
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
