// Publicação automática no Instagram — Fase 1 (Posts). Duas formas de
// disparar: botão manual "Publicar agora", ou "Programar publicação" que
// deixa o item marcado pra sair sozinho quando bater o scheduled_at (um job
// externo — GitHub Actions — chama /api/cron/publish-instagram a cada
// poucos minutos, ver .github/workflows/publish-instagram-cron.yml). A
// conexão é por CLIENTE (cada cliente tem a própria conta), diferente do
// Drive (uma conexão por agência). Usa o produto "Instagram API com Login
// do Instagram" da Meta (INSTAGRAM_APP_ID/INSTAGRAM_APP_SECRET —
// credenciais separadas do app principal): o master loga direto na conta
// Instagram Business/Criador de Conteúdo do cliente, sem precisar de
// Página do Facebook.
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

/** Does the actual work of publishing a "post" content_item to Instagram —
 * shared by the manual "Publicar agora" button and the scheduled-publish
 * cron endpoint. Always runs against supabaseAdmin (no user session in the
 * cron path); `expectedOrgId`, when given, is a defense-in-depth check that
 * the item truly belongs to the caller's org (used by the manual path —
 * the cron path already selected the item by scanning, so it's omitted). */
async function runInstagramPublish(itemId: string, expectedOrgId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: item } = await supabaseAdmin
    .from("content_items")
    .select("id, type, status, caption, month_id, months(client_id, clients(id, org_id))")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) throw new Error("Item não encontrado.");
  if (item.type !== "post") throw new Error("A publicação automática só está disponível pra Posts, por enquanto.");
  if (item.status !== "PRONTO_PARA_PUBLICAR" && item.status !== "FINALIZADO") {
    throw new Error('Marque o status como "Pronto para publicar" antes de publicar no Instagram.');
  }
  const clientId: string | undefined = (item as any).months?.client_id;
  const clientOrgId: string | undefined = (item as any).months?.clients?.org_id;
  if (!clientId || !clientOrgId) throw new Error("Cliente não encontrado.");
  if (expectedOrgId && clientOrgId !== expectedOrgId) throw new Error("Cliente não encontrado.");

  const { data: creds } = await supabaseAdmin
    .from("client_instagram_credentials")
    .select("instagram_business_account_id, access_token")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!creds) throw new Error("Esse cliente ainda não conectou o Instagram. Vá na Ficha do Cliente e conecte.");

  const { data: files } = await supabaseAdmin
    .from("item_files")
    .select("drive_file_id, mime_type")
    .eq("item_id", itemId)
    .order("sort_order").order("created_at");
  const imageFile = (files ?? []).find((f: any) => (f.mime_type ?? "").startsWith("image/"));
  if (!imageFile) throw new Error("Anexe uma imagem ao post antes de publicar.");

  const { getAccessToken, withDriveOrg } = await import("./drive.functions");
  const imageBuffer = await withDriveOrg(clientOrgId, async () => {
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
  const tempPath = `${itemId}/${Date.now()}.${ext}`;
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

    // Instagram processes the container asynchronously — publishing
    // immediately after creation can fail with "Media ID is not
    // available". Poll status_code until it's FINISHED (or give up).
    let finished = false;
    let lastStatus = "UNKNOWN";
    for (let attempt = 0; attempt < 15; attempt++) {
      const statusRes = await fetch(
        `${IG_GRAPH_API}/${containerJson.id}?fields=status_code,status&access_token=${encodeURIComponent(creds.access_token)}`,
      );
      const statusJson: any = await statusRes.json();
      lastStatus = statusJson.status_code ?? "UNKNOWN";
      if (lastStatus === "FINISHED") { finished = true; break; }
      if (lastStatus === "ERROR" || lastStatus === "EXPIRED") {
        console.error("[Instagram] container processing failed:", statusJson);
        throw new Error(`O Instagram falhou ao processar a imagem (${statusJson.status ?? lastStatus}).`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!finished) {
      console.error("[Instagram] container timed out, last status:", lastStatus);
      throw new Error("O Instagram está demorando pra processar a imagem. Tente publicar de novo em instantes.");
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
      await supabaseAdmin.rpc("set_item_status", { p_item_id: itemId, p_status: "FINALIZADO" });
    }
    await supabaseAdmin.from("content_items").update({ ig_auto_publish: false }).eq("id", itemId);

    return { ok: true as const, instagramMediaId: publishJson.id as string };
  } finally {
    await supabaseAdmin.storage.from("instagram-publish-temp").remove([tempPath]).catch(() => {});
  }
}

/** Publishes a "post" content_item straight to the client's Instagram feed,
 * triggered by an admin clicking "Publicar agora". */
export const publishToInstagram = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string }) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    return runInstagramPublish(data.itemId, context.orgId);
  });

/** Marks/unmarks a post to be auto-published by the scheduled-publish cron
 * once its scheduled_at arrives. Requires scheduled_at to already be set
 * to a future moment when enabling. */
export const setInstagramAutoPublish = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; enabled: boolean }) =>
    z.object({ itemId: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    const { data: item } = await context.supabase
      .from("content_items")
      .select("id, type, status, scheduled_at, month_id, months(client_id, clients(org_id))")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item) throw new Error("Item não encontrado.");
    if ((item as any).months?.clients?.org_id !== context.orgId) throw new Error("Item não encontrado.");
    if (item.type !== "post") throw new Error("Só é possível programar Posts, por enquanto.");
    if (data.enabled) {
      if (item.status !== "PRONTO_PARA_PUBLICAR") {
        throw new Error('Marque o status como "Pronto para publicar" antes de programar.');
      }
      if (!item.scheduled_at || new Date(item.scheduled_at).getTime() <= Date.now()) {
        throw new Error("Defina uma data e horário futuros em Publicação antes de programar.");
      }
    }
    const { error } = await context.supabase
      .from("content_items")
      .update({ ig_auto_publish: data.enabled })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Called by the external cron (GitHub Actions, every few minutes — Vercel
 * Hobby's native cron only runs daily) via /api/cron/publish-instagram.
 * Scans for posts scheduled to go out and publishes each, tolerating
 * per-item failures so one bad post doesn't block the rest. */
export async function runScheduledInstagramPublishes() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: due } = await supabaseAdmin
    .from("content_items")
    .select("id")
    .eq("ig_auto_publish", true)
    .eq("status", "PRONTO_PARA_PUBLICAR")
    .lte("scheduled_at", new Date().toISOString());

  const results: { itemId: string; ok: boolean; error?: string }[] = [];
  for (const row of due ?? []) {
    try {
      await runInstagramPublish(row.id);
      results.push({ itemId: row.id, ok: true });
    } catch (e: any) {
      console.error("[Instagram cron] falha ao publicar", row.id, e);
      results.push({ itemId: row.id, ok: false, error: e?.message ?? String(e) });
    }
  }
  return results;
}
