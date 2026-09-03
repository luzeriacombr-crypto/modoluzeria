// Publicação automática no Instagram — Posts/Carrosséis, Reels e Stories. Duas formas de
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
  "instagram_business_manage_insights",
].join(",");
// Fixo — precisa bater byte a byte com o redirect_uri cadastrado em Meta
// for Developers > Modo Criador > Casos de uso > Instagram Business >
// "Configurar o login da empresa no Instagram" (os dois — com e sem www —
// estão cadastrados lá). O domínio canônico é COM www: confirmado via
// Depurador de Compartilhamento da Meta (2026-08-12), que mostra
// modocriador.com.br redirecionando com HTTP 308 pra
// www.modocriador.com.br — a barra de endereço do Chrome esconde o "www."
// por padrão, o que enganou uma tentativa anterior de trocar isso pra sem
// www. Trocado com e sem www já foram testados e ambos falharam com o
// mesmo erro "[1/3 troca de código]" — ou seja, o domínio nunca foi a
// causa raiz do problema; mantido em www por ser o canônico de verdade.
const INSTAGRAM_REDIRECT_URI = "https://www.modocriador.com.br/oauth/instagram-callback";

async function assertMaster(supabase: any, userId: string) {
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (!isMaster) throw new Error("Apenas o Adm Master pode executar esta ação.");
}

/** Master, or setor with the org's "instagram_publish" permission granted —
 * used only by the actual publish/schedule actions. Connecting/disconnecting
 * a client's Instagram account stays master-only (assertMaster above). */
async function assertCanPublish(supabase: any, userId: string) {
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (isMaster) return;
  const { data: allowed } = await supabase.rpc("has_setor_permission", { _user_id: userId, _perm: "instagram_publish" });
  if (!allowed) throw new Error("Você não tem permissão pra publicar no Instagram.");
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
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const appId = process.env.INSTAGRAM_APP_ID;
    if (!appId) throw new Error("INSTAGRAM_APP_ID ausente no servidor.");
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: INSTAGRAM_REDIRECT_URI,
      response_type: "code",
      scope: IG_SCOPES,
      state: data.clientId,
      // Without this, Instagram skips straight to "you already connected
      // this app" once authorized once — App Review needs to see the actual
      // permissions screen, so force it to show every time.
      auth_type: "rerequest",
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
  .inputValidator((d: { code: string; clientId: string }) =>
    z.object({
      code: z.string().min(1),
      clientId: z.string().uuid(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const appId = process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;
    if (!appId || !appSecret) throw new Error("Credenciais do Instagram ausentes no servidor.");

    const shortBody = new URLSearchParams({
      client_id: appId, client_secret: appSecret, grant_type: "authorization_code",
      redirect_uri: INSTAGRAM_REDIRECT_URI, code: data.code,
    });
    console.error("[Instagram connect] enviando troca de código:", JSON.stringify({
      at: new Date().toISOString(),
      client_id: appId,
      client_id_length: appId.length,
      client_secret_length: appSecret.length,
      client_secret_last4: appSecret.slice(-4),
      redirect_uri: INSTAGRAM_REDIRECT_URI,
      code_prefix: data.code.slice(0, 12),
      code_length: data.code.length,
    }));
    const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: shortBody,
    });
    const shortJson: any = await shortRes.json();
    if (!shortRes.ok || !shortJson.access_token || !shortJson.user_id) {
      console.error("[Instagram connect] falha na troca do código curto:", shortRes.status, JSON.stringify(shortJson));
      throw new Error(`[1/3 troca de código] ${shortJson?.error_message ?? shortJson?.error?.message ?? "Não foi possível conectar ao Instagram. Tente novamente."}`);
    }

    const longRes = await fetch(
      `${IG_GRAPH_API.replace("/v21.0", "")}/access_token?` + new URLSearchParams({
        grant_type: "ig_exchange_token", client_secret: appSecret, access_token: shortJson.access_token,
      }),
    );
    const longJson: any = await longRes.json();
    if (!longRes.ok || !longJson.access_token) {
      console.error("[Instagram connect] falha ao trocar por token longo:", longRes.status, JSON.stringify(longJson));
      throw new Error(`[2/3 token de 60 dias] ${longJson?.error?.message ?? "Não foi possível validar o acesso ao Instagram."}`);
    }

    // The user_id from the token exchange isn't reliably the same ID the
    // /media publishing endpoints expect — fetch the authoritative id via
    // /me with the long-lived token instead of trusting it.
    const meRes = await fetch(`${IG_GRAPH_API}/me?fields=id,username&access_token=${encodeURIComponent(longJson.access_token)}`);
    const meJson: any = await meRes.json();
    if (!meRes.ok || !meJson.id) {
      console.error("[Instagram connect] falha ao buscar conta:", meRes.status, JSON.stringify(meJson));
      throw new Error(`[3/3 identificar conta] ${meJson?.error?.message ?? "Não foi possível identificar a conta do Instagram."}`);
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
    .select("id, type, status, caption, month_id, months(client_id, clients!months_client_id_fkey(id, org_id))")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) throw new Error("Item não encontrado.");
  if (item.type !== "post" && item.type !== "reel" && item.type !== "story") {
    throw new Error("A publicação automática só está disponível pra Posts, Reels e Stories.");
  }
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

  // Reel é sempre vídeo, Post hoje só aceita imagem, mas Story pode ser
  // imagem OU vídeo — por isso o tipo de mídia real é o que decide o
  // media_type/endpoint da chamada, não o item.type sozinho.
  const { data: files } = await supabaseAdmin
    .from("item_files")
    .select("drive_file_id, mime_type")
    .eq("item_id", itemId)
    .order("sort_order").order("created_at");
  const wantVideo = item.type === "reel";
  const wantImage = item.type === "post";
  const mediaFile = (files ?? []).find((f: any) => {
    const mime = f.mime_type ?? "";
    if (wantVideo) return mime.startsWith("video/");
    if (wantImage) return mime.startsWith("image/");
    return mime.startsWith("image/") || mime.startsWith("video/"); // story
  });
  if (!mediaFile) {
    throw new Error(
      item.type === "reel" ? "Anexe um vídeo ao reel antes de publicar."
        : item.type === "story" ? "Anexe uma imagem ou vídeo à story antes de publicar."
        : "Anexe uma imagem ao post antes de publicar.",
    );
  }
  const isVideo = (mediaFile.mime_type ?? "").startsWith("video/");
  const igMediaType = item.type === "reel" ? "REELS" : item.type === "story" ? "STORIES" : null;
  // Stories não aceitam legenda pela API — o texto precisa já estar na
  // própria imagem/vídeo.
  const sendsCaption = item.type !== "story";

  const { getAccessToken, withDriveOrg } = await import("./drive.functions");
  const mediaBuffer = await withDriveOrg(clientOrgId, async () => {
    const token = await getAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(mediaFile.drive_file_id)}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) throw new Error(`Falha ao baixar ${isVideo ? "o vídeo" : "a imagem"} do Drive (${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  });

  const mimeType = mediaFile.mime_type ?? (isVideo ? "video/mp4" : "image/jpeg");
  const ext = isVideo ? "mp4" : mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const tempPath = `${itemId}/${Date.now()}.${ext}`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("instagram-publish-temp")
    .upload(tempPath, mediaBuffer, { contentType: mimeType, upsert: true });
  if (upErr) throw new Error(`Falha ao preparar ${isVideo ? "o vídeo" : "a imagem"}: ${upErr.message}`);
  const { data: pub } = supabaseAdmin.storage.from("instagram-publish-temp").getPublicUrl(tempPath);
  const publicMediaUrl = pub.publicUrl;

  try {
    const containerRes = await fetch(`${IG_GRAPH_API}/${creds.instagram_business_account_id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...(isVideo ? { video_url: publicMediaUrl } : { image_url: publicMediaUrl }),
        ...(igMediaType ? { media_type: igMediaType } : {}),
        ...(sendsCaption ? { caption: item.caption ?? "" } : {}),
        access_token: creds.access_token,
      }),
    });
    const containerJson: any = await containerRes.json();
    if (!containerRes.ok || !containerJson.id) {
      throw new Error(containerJson?.error?.message ?? `O Instagram recusou ${isVideo ? "o vídeo" : "a imagem"}.`);
    }

    // Instagram processes the container asynchronously — publishing
    // immediately after creation can fail with "Media ID is not
    // available". Poll status_code until it's FINISHED (or give up). Vídeo
    // demora bem mais que imagem pra processar, por isso a espera máxima é
    // maior nesse caso (vale tanto pra Reels quanto pra Story em vídeo).
    const maxAttempts = isVideo ? 40 : 15;
    const intervalMs = isVideo ? 3000 : 2000;
    let finished = false;
    let lastStatus = "UNKNOWN";
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const statusRes = await fetch(
        `${IG_GRAPH_API}/${containerJson.id}?fields=status_code,status&access_token=${encodeURIComponent(creds.access_token)}`,
      );
      const statusJson: any = await statusRes.json();
      lastStatus = statusJson.status_code ?? "UNKNOWN";
      if (lastStatus === "FINISHED") { finished = true; break; }
      if (lastStatus === "ERROR" || lastStatus === "EXPIRED") {
        console.error("[Instagram] container processing failed:", statusJson);
        throw new Error(`O Instagram falhou ao processar ${isVideo ? "o vídeo" : "a imagem"} (${statusJson.status ?? lastStatus}).`);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    if (!finished) {
      console.error("[Instagram] container timed out, last status:", lastStatus);
      throw new Error(`O Instagram está demorando pra processar ${isVideo ? "o vídeo" : "a imagem"}. Tente publicar de novo em instantes.`);
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

    // Story não tem status "Finalizado" no funil do app (isso é coisa de
    // Post/Reel, ligada ao Preview de Feed) — pra Story, publicar não muda
    // o status, só registra ig_published_at/ig_media_id abaixo.
    if (item.type !== "story" && item.status !== "FINALIZADO") {
      // Same RPC the normal status dropdown uses — keeps triggers,
      // permissions and side effects (finalizations credit, activity
      // log, notifications) identical to a manual status change.
      await supabaseAdmin.rpc("set_item_status", { p_item_id: itemId, p_status: "FINALIZADO" });
    }
    await supabaseAdmin.from("content_items").update({
      ig_auto_publish: false,
      ig_published_at: new Date().toISOString(),
      ig_media_id: publishJson.id,
    }).eq("id", itemId);

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
    await assertCanPublish(context.supabase, context.userId);
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
    await assertCanPublish(context.supabase, context.userId);
    const { data: item } = await context.supabase
      .from("content_items")
      .select("id, type, status, scheduled_at, month_id, months(client_id, clients!months_client_id_fkey(org_id))")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item) throw new Error("Item não encontrado.");
    if ((item as any).months?.clients?.org_id !== context.orgId) throw new Error("Item não encontrado.");
    if (item.type !== "post" && item.type !== "reel" && item.type !== "story") throw new Error("Só é possível programar Posts, Reels e Stories.");
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

export type InstagramActivityItem = {
  id: string;
  title: string;
  type: string;
  postFormat: string | null;
  scheduledAt: string | null;
  igPublishedAt: string | null;
  igAutoPublish: boolean;
  igMediaId: string | null;
  clientId: string;
  clientName: string;
  clientColor: string;
  monthKey: string;
};

/** Tudo que já foi publicado no Instagram pelo app, ou que está programado
 * pra sair sozinho — de todos os clientes da agência, pra tela "Instagram"
 * do menu lateral. Publicação manual direto no Instagram (fora do app) não
 * entra aqui, porque não passa por runInstagramPublish. */
export const getInstagramActivity = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: rows, error } = await context.supabase
      .from("content_items")
      .select(
        "id, title, type, post_format, scheduled_at, ig_published_at, ig_auto_publish, ig_media_id, months!inner(key, clients!months_client_id_fkey!inner(id, name, color, archived, category))",
      )
      .or("ig_auto_publish.eq.true,ig_published_at.not.is.null")
      .order("ig_published_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (rows ?? [])
      .filter((r: any) => r.months?.clients && !r.months.clients.archived && r.months.clients.category !== "Ex-clientes")
      .map((r: any) => ({
        id: r.id, title: r.title, type: r.type, postFormat: r.post_format,
        scheduledAt: r.scheduled_at, igPublishedAt: r.ig_published_at, igAutoPublish: r.ig_auto_publish,
        igMediaId: r.ig_media_id,
        clientId: r.months.clients.id, clientName: r.months.clients.name, clientColor: r.months.clients.color,
        monthKey: r.months.key,
      })) as InstagramActivityItem[];
  });

/** Métricas de uma publicação já feita pelo app (Post/Carrossel, Reel ou
 * Story) — usa a permissão `instagram_business_manage_insights`, que ainda
 * precisa ser adicionada e aprovada pela Meta (separada da permissão de
 * publicar). Enquanto isso, toda chamada aqui retorna 403 da própria API —
 * o erro sobe pro chamador com a mensagem original da Meta. */
export type InstagramMediaInsights = {
  itemId: string;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  plays: number | null;
  totalInteractions: number | null;
  /** Preenchido quando o conjunto completo de métricas falhou e caímos pro
   * fallback (só "reach") — mostra o motivo original pra facilitar debug. */
  degradedReason: string | null;
};

const FEED_METRICS = "reach,likes,comments,saved,shares,total_interactions";
const REELS_METRICS = "reach,likes,comments,saved,shares,total_interactions,plays";
const STORY_METRICS = "reach,replies,navigation";

/** media_product_type é o campo que a própria Meta devolve pra cada mídia
 * (FEED, REELS, STORY) — usar isso em vez do nosso content_items.type
 * deixa a busca de métricas válida tanto pro que foi publicado pelo app
 * quanto pro que a agência postou direto no Instagram. */
function metricsForProductType(productType: string) {
  if (productType === "REELS") return REELS_METRICS;
  if (productType === "STORY") return STORY_METRICS;
  return FEED_METRICS;
}
function productTypeForItemType(type: string) {
  if (type === "reel") return "REELS";
  if (type === "story") return "STORY";
  return "FEED";
}

function parseInsights(json: any): Partial<Omit<InstagramMediaInsights, "itemId" | "degradedReason">> {
  const byName: Record<string, number> = {};
  for (const m of json?.data ?? []) {
    const value = m.values?.[0]?.value ?? m.total_value?.value;
    if (typeof value === "number") byName[m.name] = value;
  }
  return {
    reach: byName.reach ?? null,
    likes: byName.likes ?? null,
    comments: byName.comments ?? null,
    saved: byName.saved ?? null,
    shares: byName.shares ?? null,
    plays: byName.plays ?? null,
    totalInteractions: byName.total_interactions ?? null,
  };
}

/** Busca as métricas de uma mídia do Instagram (identificada pelo id que a
 * própria Meta usa), com fallback pro básico ("reach", garantido pra
 * qualquer tipo) se o conjunto completo falhar pra esse media_product_type
 * — a Meta muda essa lista de vez em quando. Compartilhado entre a busca
 * por item do app e por mídia direto da conta. */
async function fetchMediaInsights(accessToken: string, mediaId: string, productType: string) {
  async function fetchMetrics(metrics: string) {
    const res = await fetch(
      `${IG_GRAPH_API}/${mediaId}/insights?metric=${metrics}&access_token=${encodeURIComponent(accessToken)}`,
    );
    const json: any = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? "Falha ao buscar métricas no Instagram.");
    return json;
  }

  try {
    const json = await fetchMetrics(metricsForProductType(productType));
    return { degradedReason: null, ...parseInsights(json) };
  } catch (e: any) {
    try {
      const json = await fetchMetrics("reach");
      return { degradedReason: e?.message ?? "Métricas completas indisponíveis", ...parseInsights(json) };
    } catch (e2: any) {
      throw new Error(e2?.message ?? e?.message ?? "Falha ao buscar métricas no Instagram.");
    }
  }
}

async function getClientInstagramCreds(supabase: any, clientId: string) {
  const { data: creds } = await supabase
    .from("client_instagram_credentials")
    .select("instagram_business_account_id, access_token")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!creds) throw new Error("Esse cliente não está mais com o Instagram conectado.");
  return creds as { instagram_business_account_id: string; access_token: string };
}

export const getInstagramItemInsights = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string }) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<InstagramMediaInsights> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: item } = await context.supabase
      .from("content_items")
      .select("id, type, ig_media_id, months!inner(client_id, clients!months_client_id_fkey!inner(id, org_id))")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item || (item as any).months?.clients?.org_id !== context.orgId) throw new Error("Item não encontrado.");
    if (!item.ig_media_id) throw new Error("Esse item ainda não foi publicado pelo Modo Criador.");

    const clientId = (item as any).months.client_id;
    const creds = await getClientInstagramCreds(context.supabase, clientId);
    const result = await fetchMediaInsights(creds.access_token, item.ig_media_id, productTypeForItemType(item.type));
    return { itemId: data.itemId, ...result } as InstagramMediaInsights;
  });

export type InstagramAccountMedia = {
  id: string;
  caption: string | null;
  mediaType: string;
  mediaProductType: string;
  timestamp: string;
  permalink: string | null;
  thumbnailUrl: string | null;
  /** Preenchido quando essa mídia também existe como item do Modo Criador
   * (bate o ig_media_id) — deixa dar crédito ao que foi publicado por aqui,
   * mas a lista em si é de TUDO que está na conta do cliente. */
  publishedByApp: boolean;
};

/** Lista as publicações reais da conta do Instagram do cliente — direto da
 * Meta, não do nosso banco — pra dar uma visão completa (o que foi
 * publicado pelo Modo Criador E o que foi postado direto pelo Instagram).
 * Usa `instagram_business_basic`, já aprovado; as métricas de cada uma
 * (endpoint separado) que dependem da permissão de insights ainda não
 * aprovada. */
export const getInstagramAccountMedia = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; after?: string }) =>
    z.object({ clientId: z.string().uuid(), after: z.string().optional() }).parse(d))
  .handler(async ({ data, context }): Promise<{ items: InstagramAccountMedia[]; nextAfter: string | null }> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const creds = await getClientInstagramCreds(context.supabase, data.clientId);

    const fields = "id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url";
    const params = new URLSearchParams({ fields, limit: "25", access_token: creds.access_token });
    if (data.after) params.set("after", data.after);
    const res = await fetch(`${IG_GRAPH_API}/${creds.instagram_business_account_id}/media?${params.toString()}`);
    const json: any = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? "Falha ao listar publicações do Instagram.");

    const { data: appItems } = await context.supabase
      .from("content_items")
      .select("ig_media_id, months!inner(client_id)")
      .eq("months.client_id", data.clientId)
      .not("ig_media_id", "is", null);
    const appMediaIds = new Set((appItems ?? []).map((r: any) => r.ig_media_id));

    const items: InstagramAccountMedia[] = (json.data ?? []).map((m: any) => ({
      id: m.id,
      caption: m.caption ?? null,
      mediaType: m.media_type,
      mediaProductType: m.media_product_type,
      timestamp: m.timestamp,
      permalink: m.permalink ?? null,
      thumbnailUrl: m.thumbnail_url ?? null,
      publishedByApp: appMediaIds.has(m.id),
    }));
    return { items, nextAfter: json.paging?.cursors?.after ?? null };
  });

/** Métricas de uma mídia da conta (pode não ter item correspondente no
 * nosso banco — publicada direto no Instagram). */
export const getInstagramAccountMediaInsights = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; mediaId: string; mediaProductType: string }) =>
    z.object({ clientId: z.string().uuid(), mediaId: z.string().min(1), mediaProductType: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }): Promise<InstagramMediaInsights> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const creds = await getClientInstagramCreds(context.supabase, data.clientId);
    const result = await fetchMediaInsights(creds.access_token, data.mediaId, data.mediaProductType);
    return { itemId: data.mediaId, ...result } as InstagramMediaInsights;
  });

export type TodayPublicationItem = {
  id: string;
  title: string;
  type: string;
  postFormat: string | null;
  scheduledAt: string;
  clientId: string;
  clientName: string;
  clientColor: string;
  monthKey: string;
};

/** Posts/Reels com "Data de publicação" caindo no dia de hoje, dos clientes
 * onde o usuário é o "Responsável fixo" — pra ele não esquecer de publicar
 * manualmente (ou conferir a publicação automática) no Instagram. Some da
 * lista sozinho assim que ig_published_at é setado (publicado pelo app) —
 * publicação manual direto no Instagram não teria como o sistema saber,
 * então continua aparecendo até o item ser movido de status/data por quem
 * publicou. */
export const getTodayPublications = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId?: string; from: string; to: string }) => d)
  .handler(async ({ data, context }) => {
    let targetUser = context.userId;
    if (data.userId && data.userId !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
      if (!isAdmin) throw new Error("Forbidden");
      targetUser = data.userId;
    }
    const { data: clients } = await context.supabase
      .from("clients")
      .select("id")
      .eq("fixed_responsible_id", targetUser)
      .eq("archived", false)
      .neq("category", "Ex-clientes");
    const clientIds = (clients ?? []).map((c: any) => c.id);
    if (clientIds.length === 0) return [] as TodayPublicationItem[];

    const { data: rows, error } = await context.supabase
      .from("content_items")
      .select("id, title, type, post_format, scheduled_at, months!inner(client_id, key, clients!months_client_id_fkey!inner(id, name, color))")
      .in("type", ["post", "reel", "story"])
      .gte("scheduled_at", data.from)
      .lt("scheduled_at", data.to)
      .is("ig_published_at", null)
      .in("months.client_id", clientIds)
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id, title: r.title, type: r.type, postFormat: r.post_format,
      scheduledAt: r.scheduled_at,
      clientId: r.months.clients.id, clientName: r.months.clients.name, clientColor: r.months.clients.color,
      monthKey: r.months.key,
    })) as TodayPublicationItem[];
  });
