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
      .select("id, type, status, scheduled_at, month_id, months(client_id, clients!months_client_id_fkey(org_id))")
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

export type InstagramActivityItem = {
  id: string;
  title: string;
  type: string;
  postFormat: string | null;
  scheduledAt: string | null;
  igPublishedAt: string | null;
  igAutoPublish: boolean;
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
        "id, title, type, post_format, scheduled_at, ig_published_at, ig_auto_publish, months!inner(key, clients!months_client_id_fkey!inner(id, name, color, archived, category))",
      )
      .or("ig_auto_publish.eq.true,ig_published_at.not.is.null")
      .order("ig_published_at", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (rows ?? [])
      .filter((r: any) => r.months?.clients && !r.months.clients.archived && r.months.clients.category !== "Ex-clientes")
      .map((r: any) => ({
        id: r.id, title: r.title, type: r.type, postFormat: r.post_format,
        scheduledAt: r.scheduled_at, igPublishedAt: r.ig_published_at, igAutoPublish: r.ig_auto_publish,
        clientId: r.months.clients.id, clientName: r.months.clients.name, clientColor: r.months.clients.color,
        monthKey: r.months.key,
      })) as InstagramActivityItem[];
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
 * manualmente enquanto a Meta não libera publicação automática pra todo
 * mundo (hoje só funciona pra Luzeria, ver INSTAGRAM_CONNECT_ENABLED em
 * ClientFichaPanel.tsx). Some da lista sozinho assim que ig_published_at é
 * setado (publicado pelo app) — publicação manual direto no Instagram não
 * teria como o sistema saber, então continua aparecendo até o item ser
 * movido de status/data por quem publicou. */
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
      .in("type", ["post", "reel"])
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
