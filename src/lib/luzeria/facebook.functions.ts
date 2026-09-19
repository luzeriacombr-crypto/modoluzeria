import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

// Login do Facebook clássico (graph.facebook.com) — diferente do Instagram
// Business Login (graph.instagram.com), não dá pra reaproveitar o mesmo
// fluxo de troca de código. Mesmo App da Meta (INSTAGRAM_APP_ID/SECRET),
// produto "Facebook Login for Business" ativado à parte, redirect_uri própria.
const FB_GRAPH_API = "https://graph.facebook.com/v21.0";
const FB_REDIRECT_URI = "https://www.modocriador.com.br/oauth/facebook-callback";
const FB_SCOPES = ["pages_show_list", "pages_manage_posts", "pages_read_engagement"].join(",");

async function assertCanPublish(supabase: any, userId: string) {
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (isMaster) return;
  // Reaproveita a mesma permissão de setor do Instagram — v1 trata
  // "publicar em rede social" como um único balde de permissão, sem criar
  // uma chave nova só pro Facebook.
  const { data: allowed } = await supabase.rpc("has_setor_permission", { _user_id: userId, _perm: "instagram_publish" });
  if (!allowed) throw new Error("Você não tem permissão pra gerenciar o Facebook desse cliente.");
}

async function assertClientInOrg(supabase: any, clientId: string, orgId: string) {
  const { data } = await supabase.from("clients").select("id").eq("id", clientId).eq("org_id", orgId).maybeSingle();
  if (!data) throw new Error("Cliente não encontrado.");
}

export const getFacebookConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const { data: row } = await (context.supabase as any)
      .from("client_facebook_credentials")
      .select("page_name, connected_at")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!row) return { connected: false, pageName: null, connectedAt: null };
    return { connected: true, pageName: row.page_name, connectedAt: row.connected_at };
  });

export const disconnectFacebook = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const { error } = await (context.supabase as any).from("client_facebook_credentials").delete().eq("client_id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getFacebookConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const appId = process.env.INSTAGRAM_APP_ID;
    if (!appId) throw new Error("Credenciais do Facebook ausentes no servidor.");
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: FB_REDIRECT_URI,
      response_type: "code",
      scope: FB_SCOPES,
      state: data.clientId,
      auth_type: "rerequest",
    });
    return { url: `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}` };
  });

export type FacebookPageOption = { id: string; name: string; accessToken: string };

/** Troca o código OAuth por um token de usuário, upgrada pra 60 dias, e
 * lista as Páginas que esse usuário administra — cada uma já vem com seu
 * próprio token de Página (de vida longa, herdado do token de usuário de
 * 60 dias). Se vier só 1 Página, o callback conecta direto; se vier mais
 * de 1, a pessoa escolhe qual. */
export const exchangeFacebookCode = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; clientId: string }) =>
    z.object({ code: z.string().min(1), clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<{ pages: FacebookPageOption[] }> => {
    const appId = process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    if (!appId || !appSecret) throw new Error("Credenciais do Facebook ausentes no servidor.");

    const shortRes = await fetch(`${FB_GRAPH_API}/oauth/access_token?` + new URLSearchParams({
      client_id: appId, client_secret: appSecret, redirect_uri: FB_REDIRECT_URI, code: data.code,
    }));
    const shortJson: any = await shortRes.json();
    if (!shortRes.ok || !shortJson.access_token) {
      console.error("[Facebook connect] falha na troca do código:", shortRes.status, JSON.stringify(shortJson));
      throw new Error(`[1/3 troca de código] ${shortJson?.error?.message ?? "Não foi possível conectar ao Facebook. Tente novamente."}`);
    }

    const longRes = await fetch(`${FB_GRAPH_API}/oauth/access_token?` + new URLSearchParams({
      grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: shortJson.access_token,
    }));
    const longJson: any = await longRes.json();
    if (!longRes.ok || !longJson.access_token) {
      console.error("[Facebook connect] falha ao trocar por token longo:", longRes.status, JSON.stringify(longJson));
      throw new Error(`[2/3 token de longa duração] ${longJson?.error?.message ?? "Não foi possível validar o acesso ao Facebook."}`);
    }

    const pagesRes = await fetch(`${FB_GRAPH_API}/me/accounts?fields=id,name,access_token&access_token=${encodeURIComponent(longJson.access_token)}`);
    const pagesJson: any = await pagesRes.json();
    if (!pagesRes.ok) {
      console.error("[Facebook connect] falha ao listar Páginas:", pagesRes.status, JSON.stringify(pagesJson));
      throw new Error(`[3/3 listar Páginas] ${pagesJson?.error?.message ?? "Não foi possível listar suas Páginas do Facebook."}`);
    }
    const pages: FacebookPageOption[] = ((pagesJson.data ?? []) as any[]).map((p) => ({ id: p.id, name: p.name, accessToken: p.access_token }));
    if (pages.length === 0) {
      throw new Error("Essa conta do Facebook não administra nenhuma Página. Conecte com a conta que gerencia a Página do cliente.");
    }
    return { pages };
  });

/** Segundo passo — depois da pessoa escolher qual Página conectar (ou
 * automático, se só veio 1 opção). O token de Página já veio pronto de
 * /me/accounts, não precisa de outra troca com a Meta. */
export const connectFacebookPage = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; pageId: string; pageName: string; pageAccessToken: string }) =>
    z.object({
      clientId: z.string().uuid(),
      pageId: z.string().min(1),
      pageName: z.string().min(1).max(200),
      pageAccessToken: z.string().min(1),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const { error } = await (context.supabase as any).from("client_facebook_credentials").upsert({
      client_id: data.clientId,
      facebook_page_id: data.pageId,
      page_name: data.pageName,
      access_token: data.pageAccessToken,
      connected_by: context.userId,
      connected_at: new Date().toISOString(),
    }, { onConflict: "client_id" });
    if (error) throw new Error(error.message);
    return { ok: true as const, pageName: data.pageName };
  });

/** Faz o trabalho de publicar um "post" no Facebook — usado pelo botão
 * manual e pelo cron de programação. Sempre via supabaseAdmin (o cron não
 * tem sessão de usuário); `expectedOrgId`, quando informado, é uma
 * checagem extra de que o item é mesmo da org de quem chamou (só o
 * caminho manual passa isso — o cron já filtrou o item ao buscar). */
async function runFacebookPublish(itemId: string, expectedOrgId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: item } = await (supabaseAdmin as any)
    .from("content_items")
    .select("id, type, status, caption, month_id, months(client_id, clients!months_client_id_fkey(id, org_id))")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) throw new Error("Item não encontrado.");
  if (item.type !== "post") throw new Error("A publicação no Facebook só está disponível pra Posts.");
  if (item.status !== "PRONTO_PARA_PUBLICAR" && item.status !== "FINALIZADO") {
    throw new Error('Marque o status como "Pronto para publicar" antes de publicar no Facebook.');
  }
  const clientId: string | undefined = item.months?.client_id;
  const clientOrgId: string | undefined = item.months?.clients?.org_id;
  if (!clientId || !clientOrgId) throw new Error("Cliente não encontrado.");
  if (expectedOrgId && clientOrgId !== expectedOrgId) throw new Error("Cliente não encontrado.");

  const { data: creds } = await (supabaseAdmin as any)
    .from("client_facebook_credentials")
    .select("facebook_page_id, access_token")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!creds) throw new Error("Esse cliente ainda não conectou o Facebook. Vá na Ficha do Cliente e conecte.");

  const { data: files } = await (supabaseAdmin as any)
    .from("item_files")
    .select("drive_file_id, mime_type")
    .eq("item_id", itemId)
    .eq("kind", "media")
    .order("sort_order").order("created_at");
  const relevantFiles = (files ?? []).filter((f: any) => {
    const mime = f.mime_type ?? "";
    return mime.startsWith("image/") || mime.startsWith("video/");
  });
  if (relevantFiles.length === 0) throw new Error("Anexe uma imagem ou vídeo ao post antes de publicar.");

  const { getAccessToken, withDriveOrg } = await import("./drive.functions");
  const tempPaths: string[] = [];

  async function uploadFileToTemp(file: { drive_file_id: string; mime_type: string | null }) {
    const isVideoFile = (file.mime_type ?? "").startsWith("video/");
    const buffer = await withDriveOrg(clientOrgId!, async () => {
      const token = await getAccessToken();
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`Falha ao baixar ${isVideoFile ? "o vídeo" : "a imagem"} do Drive (${res.status}).`);
      return Buffer.from(await res.arrayBuffer());
    });
    const mimeType = file.mime_type ?? (isVideoFile ? "video/mp4" : "image/jpeg");
    const ext = isVideoFile ? "mp4" : mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
    const tempPath = `fb-${itemId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("instagram-publish-temp")
      .upload(tempPath, buffer, { contentType: mimeType, upsert: true });
    if (upErr) throw new Error(`Falha ao preparar ${isVideoFile ? "o vídeo" : "a imagem"}: ${upErr.message}`);
    tempPaths.push(tempPath);
    const { data: pub } = supabaseAdmin.storage.from("instagram-publish-temp").getPublicUrl(tempPath);
    return { url: pub.publicUrl, isVideoFile };
  }

  try {
    let postId: string;
    // Álbum multi-foto só quando são todas imagens — o Graph API do
    // Facebook não mistura foto+vídeo num post de "attached_media" (e um
    // carrossel de vários vídeos não é um formato nativo do feed). Se tiver
    // vídeo misturado, publica só o primeiro arquivo relevante como post único.
    const allImages = relevantFiles.every((f: any) => (f.mime_type ?? "").startsWith("image/"));
    if (allImages && relevantFiles.length > 1) {
      const mediaFbids: string[] = [];
      for (const file of relevantFiles.slice(0, 10)) {
        const { url } = await uploadFileToTemp(file);
        const photoRes = await fetch(`${FB_GRAPH_API}/${creds.facebook_page_id}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ url, published: "false", access_token: creds.access_token }),
        });
        const photoJson: any = await photoRes.json();
        if (!photoRes.ok || !photoJson.id) throw new Error(photoJson?.error?.message ?? "O Facebook recusou uma das fotos do álbum.");
        mediaFbids.push(photoJson.id);
      }
      const feedRes = await fetch(`${FB_GRAPH_API}/${creds.facebook_page_id}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          message: item.caption ?? "",
          attached_media: JSON.stringify(mediaFbids.map((id) => ({ media_fbid: id }))),
          access_token: creds.access_token,
        }),
      });
      const feedJson: any = await feedRes.json();
      if (!feedRes.ok || !feedJson.id) throw new Error(feedJson?.error?.message ?? "O Facebook recusou o álbum de fotos.");
      postId = feedJson.id;
    } else {
      const { url, isVideoFile } = await uploadFileToTemp(relevantFiles[0]);
      const endpoint = isVideoFile ? "videos" : "photos";
      const body = isVideoFile
        ? new URLSearchParams({ file_url: url, description: item.caption ?? "", access_token: creds.access_token })
        : new URLSearchParams({ url, caption: item.caption ?? "", access_token: creds.access_token });
      const mediaRes = await fetch(`${FB_GRAPH_API}/${creds.facebook_page_id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const mediaJson: any = await mediaRes.json();
      if (!mediaRes.ok || !mediaJson.id) throw new Error(mediaJson?.error?.message ?? `O Facebook recusou ${isVideoFile ? "o vídeo" : "a imagem"}.`);
      // Post de foto devolve post_id (o post de feed de verdade); post de
      // vídeo não tem post_id separado, o próprio id do vídeo já é o post.
      postId = mediaJson.post_id ?? mediaJson.id;
    }

    const statusPatch = item.status !== "FINALIZADO" ? { status: "FINALIZADO" } : {};
    await (supabaseAdmin as any).from("content_items").update({
      ...statusPatch,
      fb_auto_publish: false,
      fb_media_id: postId,
      fb_last_error: null,
      fb_last_error_at: null,
    }).eq("id", itemId);

    return { ok: true as const, facebookPostId: postId };
  } finally {
    if (tempPaths.length > 0) {
      await supabaseAdmin.storage.from("instagram-publish-temp").remove(tempPaths).catch(() => {});
    }
  }
}

export const publishToFacebook = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string }) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
    return runFacebookPublish(data.itemId, context.orgId);
  });

export const setFacebookAutoPublish = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; enabled: boolean }) =>
    z.object({ itemId: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
    const { data: item } = await context.supabase
      .from("content_items")
      .select("id, type, status, scheduled_at, month_id, months(client_id, clients!months_client_id_fkey(org_id))")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item) throw new Error("Item não encontrado.");
    if ((item as any).months?.clients?.org_id !== context.orgId) throw new Error("Item não encontrado.");
    if (item.type !== "post") throw new Error("Só é possível programar Posts no Facebook.");
    if (data.enabled) {
      if (item.status !== "PRONTO_PARA_PUBLICAR") {
        throw new Error('Marque o status como "Pronto para publicar" antes de programar.');
      }
      if (!item.scheduled_at || new Date(item.scheduled_at).getTime() <= Date.now()) {
        throw new Error("Defina uma data e horário futuros em Publicação antes de programar.");
      }
    }
    const { error } = await (context.supabase as any)
      .from("content_items")
      .update({ fb_auto_publish: data.enabled })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function markScheduledFacebookFailure(
  supabaseAdmin: any,
  item: { id: string; title: string; orgId: string | undefined; hadPreviousError: boolean },
  errorMessage: string,
) {
  await supabaseAdmin.from("content_items")
    .update({ fb_last_error: errorMessage, fb_last_error_at: new Date().toISOString() })
    .eq("id", item.id);
  if (item.hadPreviousError || !item.orgId) return;
  const { data: masterRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "master");
  const masterIds = new Set((masterRoles ?? []).map((r: any) => r.user_id));
  const { data: orgProfiles } = await supabaseAdmin.from("profiles").select("id").eq("org_id", item.orgId);
  const masterProfileIds = (orgProfiles ?? []).map((p: any) => p.id).filter((id: string) => masterIds.has(id));
  if (masterProfileIds.length === 0) return;
  await supabaseAdmin.from("notifications").insert(
    masterProfileIds.map((userId: string) => ({
      user_id: userId,
      type: "facebook_publish_failed",
      item_id: item.id,
      message: `Falha ao publicar "${item.title}" no Facebook: ${errorMessage}`,
    })),
  );
}

/** Chamado pelo cron externo (GitHub Actions) via /api/cron/publish-facebook,
 * mesmo padrão de runScheduledInstagramPublishes — cron separado, não mexe
 * em nada do pipeline de Instagram que já está em produção. */
export async function runScheduledFacebookPublishes() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();

  const { data: due } = await (supabaseAdmin as any)
    .from("content_items")
    .select("id, title, fb_last_error, months(clients!months_client_id_fkey(org_id))")
    .eq("fb_auto_publish", true)
    .eq("status", "PRONTO_PARA_PUBLICAR")
    .lte("scheduled_at", now.toISOString());

  const results: { itemId: string; ok: boolean; error?: string }[] = [];
  for (const row of due ?? []) {
    try {
      await runFacebookPublish(row.id);
      results.push({ itemId: row.id, ok: true });
    } catch (e: any) {
      const errorMessage = e?.message ?? String(e);
      console.error("[Facebook cron] falha ao publicar", row.id, e);
      await markScheduledFacebookFailure(supabaseAdmin, {
        id: row.id, title: row.title, orgId: row.months?.clients?.org_id, hadPreviousError: !!row.fb_last_error,
      }, errorMessage);
      results.push({ itemId: row.id, ok: false, error: errorMessage });
    }
  }
  return results;
}
