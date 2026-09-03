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

/** Master, or setor with the org's "instagram_publish" permission granted —
 * used both by the publish/schedule actions and by connect/disconnect,
 * since managing a client's Instagram connection needs the same trust
 * level as being allowed to publish through it. */
async function assertCanPublish(supabase: any, userId: string) {
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (isMaster) return;
  const { data: allowed } = await supabase.rpc("has_setor_permission", { _user_id: userId, _perm: "instagram_publish" });
  if (!allowed) throw new Error("Você não tem permissão pra gerenciar o Instagram desse cliente.");
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
    await assertCanPublish(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const { error } = await context.supabase.from("client_instagram_credentials").delete().eq("client_id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Builds the Instagram consent URL for an admin (master, or setor with the
 * "instagram_publish" permission) to connect the client's Instagram account
 * directly. `state` carries the clientId through the redirect —
 * re-validated (belongs to caller's org) in completeInstagramConnect. */
export const getInstagramConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
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
    await assertCanPublish(context.supabase, context.userId);
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

  // Reel é sempre vídeo, Post pode ser 1 imagem OU um carrossel de várias
  // (até 10, limite da própria Meta), Story pode ser imagem OU vídeo — por
  // isso o tipo de mídia real é o que decide o media_type/endpoint da
  // chamada, não o item.type sozinho.
  const { data: files } = await supabaseAdmin
    .from("item_files")
    .select("drive_file_id, mime_type")
    .eq("item_id", itemId)
    .order("sort_order").order("created_at");
  const wantVideo = item.type === "reel";
  const wantImage = item.type === "post";
  const relevantFiles = (files ?? []).filter((f: any) => {
    const mime = f.mime_type ?? "";
    if (wantVideo) return mime.startsWith("video/");
    if (wantImage) return mime.startsWith("image/");
    return mime.startsWith("image/") || mime.startsWith("video/"); // story
  });
  if (relevantFiles.length === 0) {
    throw new Error(
      item.type === "reel" ? "Anexe um vídeo ao reel antes de publicar."
        : item.type === "story" ? "Anexe uma imagem ou vídeo à story antes de publicar."
        : "Anexe uma imagem ao post antes de publicar.",
    );
  }

  const { getAccessToken, withDriveOrg } = await import("./drive.functions");
  const tempPaths: string[] = [];

  /** Baixa um arquivo do Drive e sobe pro storage temporário público, que a
   * Meta consegue buscar pra criar o container. Registra o caminho pra
   * limpeza no finally, não importa quantos arquivos isso rodar. */
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
    const tempPath = `${itemId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("instagram-publish-temp")
      .upload(tempPath, buffer, { contentType: mimeType, upsert: true });
    if (upErr) throw new Error(`Falha ao preparar ${isVideoFile ? "o vídeo" : "a imagem"}: ${upErr.message}`);
    tempPaths.push(tempPath);
    const { data: pub } = supabaseAdmin.storage.from("instagram-publish-temp").getPublicUrl(tempPath);
    return { url: pub.publicUrl, isVideoFile };
  }

  /** Instagram processa o container de forma assíncrona — publicar (ou usar
   * como filho de carrossel) logo após criar pode falhar com "Media ID is
   * not available". Espera status_code virar FINISHED, ou desiste. Vídeo
   * demora bem mais que imagem, por isso o limite de espera é maior. */
  async function waitForContainer(containerId: string, isVideoFile: boolean, label: string) {
    const maxAttempts = isVideoFile ? 40 : 15;
    const intervalMs = isVideoFile ? 3000 : 2000;
    let lastStatus = "UNKNOWN";
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const statusRes = await fetch(
        `${IG_GRAPH_API}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(creds!.access_token)}`,
      );
      const statusJson: any = await statusRes.json();
      lastStatus = statusJson.status_code ?? "UNKNOWN";
      if (lastStatus === "FINISHED") return;
      if (lastStatus === "ERROR" || lastStatus === "EXPIRED") {
        console.error("[Instagram] container processing failed:", statusJson);
        throw new Error(`O Instagram falhou ao processar ${label} (${statusJson.status ?? lastStatus}).`);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    console.error("[Instagram] container timed out, last status:", lastStatus);
    throw new Error(`O Instagram está demorando pra processar ${label}. Tente publicar de novo em instantes.`);
  }

  try {
    let creationId: string;

    if (item.type === "post" && relevantFiles.length > 1) {
      // Carrossel — um container "filho" por imagem/vídeo (is_carousel_item),
      // depois um container "pai" (media_type=CAROUSEL) referenciando todos.
      // A legenda vai só no pai. Limite de 10 itens é da própria Meta.
      const childIds: string[] = [];
      for (const file of relevantFiles.slice(0, 10)) {
        const { url, isVideoFile } = await uploadFileToTemp(file);
        const childRes = await fetch(`${IG_GRAPH_API}/${creds.instagram_business_account_id}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            ...(isVideoFile ? { video_url: url, media_type: "VIDEO" } : { image_url: url }),
            is_carousel_item: "true",
            access_token: creds.access_token,
          }),
        });
        const childJson: any = await childRes.json();
        if (!childRes.ok || !childJson.id) {
          throw new Error(childJson?.error?.message ?? "O Instagram recusou um item do carrossel.");
        }
        await waitForContainer(childJson.id, isVideoFile, "um item do carrossel");
        childIds.push(childJson.id);
      }
      const parentRes = await fetch(`${IG_GRAPH_API}/${creds.instagram_business_account_id}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          media_type: "CAROUSEL",
          children: childIds.join(","),
          caption: item.caption ?? "",
          access_token: creds.access_token,
        }),
      });
      const parentJson: any = await parentRes.json();
      if (!parentRes.ok || !parentJson.id) {
        throw new Error(parentJson?.error?.message ?? "O Instagram recusou o carrossel.");
      }
      await waitForContainer(parentJson.id, false, "o carrossel");
      creationId = parentJson.id;
    } else {
      // Post com 1 imagem só, Reel ou Story — mídia única.
      const { url, isVideoFile } = await uploadFileToTemp(relevantFiles[0]);
      const igMediaType = item.type === "reel" ? "REELS" : item.type === "story" ? "STORIES" : null;
      // Stories não aceitam legenda pela API — o texto precisa já estar na
      // própria imagem/vídeo.
      const sendsCaption = item.type !== "story";
      const containerRes = await fetch(`${IG_GRAPH_API}/${creds.instagram_business_account_id}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          ...(isVideoFile ? { video_url: url } : { image_url: url }),
          ...(igMediaType ? { media_type: igMediaType } : {}),
          ...(sendsCaption ? { caption: item.caption ?? "" } : {}),
          access_token: creds.access_token,
        }),
      });
      const containerJson: any = await containerRes.json();
      if (!containerRes.ok || !containerJson.id) {
        throw new Error(containerJson?.error?.message ?? `O Instagram recusou ${isVideoFile ? "o vídeo" : "a imagem"}.`);
      }
      await waitForContainer(containerJson.id, isVideoFile, isVideoFile ? "o vídeo" : "a imagem");
      creationId = containerJson.id;
    }

    const publishRes = await fetch(`${IG_GRAPH_API}/${creds.instagram_business_account_id}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ creation_id: creationId, access_token: creds.access_token }),
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
    // Histórico de toda publicação (manual, programada uma vez, ou
    // repetida) — content_items só guarda a mais recente nas duas colunas
    // acima, então uma Story repetida precisa desse log pra "Publicado Nx".
    await supabaseAdmin.from("content_item_publishes").insert({ content_item_id: itemId, ig_media_id: publishJson.id });

    return { ok: true as const, instagramMediaId: publishJson.id as string };
  } finally {
    if (tempPaths.length > 0) {
      await supabaseAdmin.storage.from("instagram-publish-temp").remove(tempPaths).catch(() => {});
    }
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

const REPEAT_SLOT_SCHEMA = z.object({
  weekday: z.number().int().min(1).max(7),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

export type StoryRepeatStatus = {
  mode: "daily" | "weekly" | "custom" | null;
  slots: { weekday: number; time: string }[] | null;
  publishes: { publishedAt: string; igMediaId: string | null }[];
};

/** Estado da repetição de uma Story + histórico de publicações (manuais,
 * programadas ou repetidas) — pra tela mostrar "Publicado Nx" com datas. */
export const getStoryRepeatStatus = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string }) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<StoryRepeatStatus> => {
    const { data: item } = await context.supabase
      .from("content_items")
      .select("id, org_id, ig_repeat_mode, ig_repeat_slots")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item || (item as any).org_id !== context.orgId) throw new Error("Item não encontrado.");
    const { data: publishes } = await context.supabase
      .from("content_item_publishes")
      .select("published_at, ig_media_id")
      .eq("content_item_id", data.itemId)
      .order("published_at", { ascending: false })
      .limit(20);
    return {
      mode: (item as any).ig_repeat_mode ?? null,
      slots: (item as any).ig_repeat_slots ?? null,
      publishes: (publishes ?? []).map((p: any) => ({ publishedAt: p.published_at, igMediaId: p.ig_media_id })),
    };
  });

/** Liga/desliga (ou muda) a repetição de publicação de uma Story — "pra
 * sempre", sem data de término: diária e semanal reaproveitam o horário
 * (e, na semanal, o dia da semana) já definidos em "Data de publicação";
 * personalizada usa os dias/horários escolhidos em `slots`. */
export const setStoryRepeatRule = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; mode: "daily" | "weekly" | "custom" | null; slots?: { weekday: number; time: string }[] }) =>
    z.object({
      itemId: z.string().uuid(),
      mode: z.enum(["daily", "weekly", "custom"]).nullable(),
      slots: z.array(REPEAT_SLOT_SCHEMA).max(7).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
    const { data: item } = await context.supabase
      .from("content_items")
      .select("id, type, org_id, scheduled_at")
      .eq("id", data.itemId)
      .maybeSingle();
    if (!item || (item as any).org_id !== context.orgId) throw new Error("Item não encontrado.");
    if (item.type !== "story") throw new Error("Repetição só está disponível pra Stories.");
    if (data.mode && !item.scheduled_at) {
      throw new Error("Defina uma data e horário em Publicação antes de ativar a repetição.");
    }
    if (data.mode === "custom" && (!data.slots || data.slots.length === 0)) {
      throw new Error("Escolha pelo menos um dia da semana pro modo personalizado.");
    }
    const { error } = await context.supabase
      .from("content_items")
      .update({
        ig_repeat_mode: data.mode,
        ig_repeat_slots: data.mode === "custom" ? data.slots : null,
        ig_repeat_last_fired_date: null,
      })
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Brasil inteiro usa UTC-3 desde o fim do horário de verão em 2019 — sem
// DST pra se preocupar. Convertida pra "hora de parede" em São Paulo,
// weekday é ISO (1=Segunda..7=Domingo), pra bater com ig_repeat_slots.
const SP_OFFSET_MS = 3 * 60 * 60 * 1000;
function saoPauloParts(date: Date) {
  const sp = new Date(date.getTime() - SP_OFFSET_MS);
  const jsWeekday = sp.getUTCDay(); // 0=Dom..6=Sáb
  return {
    weekday: jsWeekday === 0 ? 7 : jsWeekday,
    hm: sp.toISOString().slice(11, 16),
    dateStr: sp.toISOString().slice(0, 10),
  };
}

/** Decide se uma Story com repetição ativa deve disparar agora — compara
 * contra a hora de parede em São Paulo, não UTC direto. */
function isRepeatDue(item: { scheduled_at: string | null; ig_repeat_mode: string | null; ig_repeat_slots: any; ig_repeat_last_fired_date: string | null }, now: Date) {
  const nowSp = saoPauloParts(now);
  if (item.ig_repeat_last_fired_date === nowSp.dateStr) return false; // já disparou hoje

  if (item.ig_repeat_mode === "daily") {
    if (!item.scheduled_at) return false;
    return nowSp.hm >= saoPauloParts(new Date(item.scheduled_at)).hm;
  }
  if (item.ig_repeat_mode === "weekly") {
    if (!item.scheduled_at) return false;
    const schedSp = saoPauloParts(new Date(item.scheduled_at));
    return nowSp.weekday === schedSp.weekday && nowSp.hm >= schedSp.hm;
  }
  if (item.ig_repeat_mode === "custom") {
    const slots: { weekday: number; time: string }[] = item.ig_repeat_slots ?? [];
    return slots.some((s) => s.weekday === nowSp.weekday && nowSp.hm >= s.time);
  }
  return false;
}

/** Called by the external cron (GitHub Actions, every few minutes — Vercel
 * Hobby's native cron only runs daily) via /api/cron/publish-instagram.
 * Scans for posts scheduled to go out (uma vez) e Stories com repetição
 * ativa (diária/semanal/personalizada, pra sempre), publicando cada um e
 * tolerando falha individual pra não travar o resto. */
export async function runScheduledInstagramPublishes() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date();

  const { data: due } = await supabaseAdmin
    .from("content_items")
    .select("id")
    .eq("ig_auto_publish", true)
    .eq("status", "PRONTO_PARA_PUBLICAR")
    .lte("scheduled_at", now.toISOString());

  const { data: repeatCandidates } = await supabaseAdmin
    .from("content_items")
    .select("id, scheduled_at, ig_repeat_mode, ig_repeat_slots, ig_repeat_last_fired_date")
    .eq("type", "story")
    .eq("status", "PRONTO_PARA_PUBLICAR")
    .not("ig_repeat_mode", "is", null);
  const dueRepeatIds = (repeatCandidates ?? []).filter((it) => isRepeatDue(it, now)).map((it) => it.id);

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
  for (const itemId of dueRepeatIds) {
    try {
      await runInstagramPublish(itemId);
      await supabaseAdmin.from("content_items").update({ ig_repeat_last_fired_date: saoPauloParts(now).dateStr }).eq("id", itemId);
      results.push({ itemId, ok: true });
    } catch (e: any) {
      console.error("[Instagram cron] falha ao repetir story", itemId, e);
      results.push({ itemId, ok: false, error: e?.message ?? String(e) });
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
  views: number | null;
  totalInteractions: number | null;
  /** Preenchido quando o conjunto completo de métricas falhou e caímos pro
   * fallback (só "reach") — mostra o motivo original pra facilitar debug. */
  degradedReason: string | null;
};

const FEED_METRICS = "reach,likes,comments,saved,shares,total_interactions";
const REELS_METRICS = "reach,likes,comments,saved,shares,total_interactions,views";
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
    views: byName.views ?? null,
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

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function changePct(series: number[]): number | null {
  const mid = Math.floor(series.length / 2);
  const firstHalf = series.slice(0, mid).reduce((a, b) => a + b, 0);
  const secondHalf = series.slice(mid).reduce((a, b) => a + b, 0);
  if (firstHalf === 0) return null;
  return Math.round(((secondHalf - firstHalf) / firstHalf) * 1000) / 10;
}

export type InstagramAccountOverview = {
  username: string | null;
  followersCount: number;
  followingCount: number;
  mediaCount: number;
  kpis: {
    reach: number; reachChangePct: number | null;
    profileViews: number; profileViewsChangePct: number | null;
    accountsEngaged: number; accountsEngagedChangePct: number | null;
    totalInteractions: number; totalInteractionsChangePct: number | null;
  };
  reachSeries: { date: string; value: number }[];
  postingFrequency: { day: string; count: number }[];
  demographics: {
    gender: { label: string; value: number; pct: number }[];
    age: { label: string; value: number; pct: number }[];
    countries: { label: string; value: number; pct: number }[];
  } | null;
};

/** Visão geral da conta do cliente, no estilo "dashboard de insights" —
 * seguidores, alcance/visitas/interações dos últimos 30 dias (com variação
 * vs. os 15 dias anteriores), frequência de postagem por dia da semana, e
 * dados demográficos dos seguidores (idade, gênero, país). `demographics`
 * vem `null` quando a conta não tem audiência suficiente pra Meta liberar
 * esse dado — a tela deve esconder essa seção nesse caso, não tratar como
 * erro. */
export const getInstagramAccountOverview = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<InstagramAccountOverview> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const creds = await getClientInstagramCreds(context.supabase, data.clientId);
    const tok = encodeURIComponent(creds.access_token);
    const acct = creds.instagram_business_account_id;

    const profileRes = await fetch(`${IG_GRAPH_API}/${acct}?fields=username,followers_count,follows_count,media_count&access_token=${tok}`);
    const profile: any = await profileRes.json();
    if (!profileRes.ok) throw new Error(profile?.error?.message ?? "Falha ao buscar dados do perfil.");

    // "reach" é o único desses 4 que a Meta devolve como série diária de
    // verdade (period=day + since/until, sem metric_type) — os outros 3
    // só respondem com metric_type=total_value, que soma um intervalo
    // inteiro num valor só. Por isso buscamos reach separado (dá a série
    // pro gráfico) e os outros 3 em duas metades (15 dias cada) pra
    // conseguir montar total + variação igual fazemos com reach.
    const now = Math.floor(Date.now() / 1000);
    const since30 = now - 30 * 86400;
    const since15 = now - 15 * 86400;

    const reachRes = await fetch(
      `${IG_GRAPH_API}/${acct}/insights?metric=reach&period=day&since=${since30}&until=${now}&access_token=${tok}`,
    );
    const reachJson: any = await reachRes.json();
    if (!reachRes.ok) throw new Error(reachJson?.error?.message ?? "Falha ao buscar alcance da conta.");
    const reachValues = reachJson.data?.[0]?.values ?? [];
    const sumOf = (values: any[]) => values.reduce((a, v) => a + (v.value ?? 0), 0);

    const otherMetrics = "profile_views,accounts_engaged,total_interactions";
    async function totalsFor(sinceTs: number, untilTs: number) {
      const res = await fetch(
        `${IG_GRAPH_API}/${acct}/insights?metric=${otherMetrics}&period=day&metric_type=total_value&since=${sinceTs}&until=${untilTs}&access_token=${tok}`,
      );
      const json: any = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Falha ao buscar métricas da conta.");
      const byName: Record<string, number> = {};
      for (const m of json.data ?? []) byName[m.name] = m.total_value?.value ?? 0;
      return byName;
    }
    const [firstHalf, secondHalf] = await Promise.all([totalsFor(since30, since15), totalsFor(since15, now)]);
    function totalAndChange(name: string) {
      const a = firstHalf[name] ?? 0;
      const b = secondHalf[name] ?? 0;
      return { total: a + b, changePct: a === 0 ? null : Math.round(((b - a) / a) * 1000) / 10 };
    }

    const mediaRes = await fetch(`${IG_GRAPH_API}/${acct}/media?fields=timestamp&limit=50&access_token=${tok}`);
    const mediaJson: any = await mediaRes.json();
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    for (const m of mediaJson.data ?? []) {
      const jsDay = new Date(m.timestamp).getDay(); // 0=Dom..6=Sáb
      dayCounts[(jsDay + 6) % 7]++; // reindexa pra 0=Seg..6=Dom
    }

    let demographics: InstagramAccountOverview["demographics"] = null;
    try {
      const [ageGenderRes, countryRes] = await Promise.all([
        fetch(`${IG_GRAPH_API}/${acct}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=age,gender&access_token=${tok}`),
        fetch(`${IG_GRAPH_API}/${acct}/insights?metric=follower_demographics&period=lifetime&metric_type=total_value&breakdown=country&access_token=${tok}`),
      ]);
      const ageGenderJson: any = await ageGenderRes.json();
      const countryJson: any = await countryRes.json();
      if (!ageGenderRes.ok) throw new Error(ageGenderJson?.error?.message ?? "sem dados demográficos");
      const results: { dimension_values: string[]; value: number }[] =
        ageGenderJson.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
      const genderTotals = new Map<string, number>();
      const ageTotals = new Map<string, number>();
      let grandTotal = 0;
      for (const r of results) {
        const [age, gender] = r.dimension_values;
        genderTotals.set(gender, (genderTotals.get(gender) ?? 0) + r.value);
        ageTotals.set(age, (ageTotals.get(age) ?? 0) + r.value);
        grandTotal += r.value;
      }
      const genderLabel: Record<string, string> = { F: "Mulheres", M: "Homens", U: "Não informado" };
      const countryResults: { dimension_values: string[]; value: number }[] =
        countryJson.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
      const topCountries = [...countryResults].sort((a, b) => b.value - a.value).slice(0, 5);

      demographics = {
        gender: [...genderTotals.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => ({ label: genderLabel[k] ?? k, value: v, pct: grandTotal ? Math.round((v / grandTotal) * 100) : 0 })),
        age: [...ageTotals.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([k, v]) => ({ label: k, value: v, pct: grandTotal ? Math.round((v / grandTotal) * 100) : 0 })),
        countries: topCountries.map((r) => ({
          label: r.dimension_values[0], value: r.value,
          pct: grandTotal ? Math.round((r.value / grandTotal) * 100) : 0,
        })),
      };
    } catch {
      // Conta sem audiência suficiente pra esse dado, ou indisponível — a
      // tela simplesmente esconde a seção de demografia nesse caso.
      demographics = null;
    }

    return {
      username: profile.username ?? null,
      followersCount: profile.followers_count ?? 0,
      followingCount: profile.follows_count ?? 0,
      mediaCount: profile.media_count ?? 0,
      kpis: {
        reach: sumOf(reachValues), reachChangePct: changePct(reachValues.map((v: any) => v.value ?? 0)),
        profileViews: totalAndChange("profile_views").total, profileViewsChangePct: totalAndChange("profile_views").changePct,
        accountsEngaged: totalAndChange("accounts_engaged").total, accountsEngagedChangePct: totalAndChange("accounts_engaged").changePct,
        totalInteractions: totalAndChange("total_interactions").total, totalInteractionsChangePct: totalAndChange("total_interactions").changePct,
      },
      reachSeries: reachValues.map((v: any) => ({ date: v.end_time, value: v.value ?? 0 })),
      postingFrequency: WEEKDAY_LABELS.map((day, i) => ({ day, count: dayCounts[i] })),
      demographics,
    };
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
