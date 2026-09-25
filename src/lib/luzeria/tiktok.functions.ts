import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

// TikTok Content Posting API (Direct Post) + Login Kit. Credenciais próprias
// do TikTok for Developers (TIKTOK_CLIENT_KEY/SECRET), sem nada em comum com
// as da Meta. O token de acesso dura 24h, então é renovado na hora de usar
// (getFreshTikTokToken) em vez de por cron.
const TT_API = "https://open.tiktokapis.com/v2";
const TT_REDIRECT_URI = "https://www.modocriador.com.br/oauth/tiktok-callback";
const TT_SCOPES = "user.info.basic,video.publish,video.upload";

// Limite defensivo: o vídeo é baixado do Drive pra memória do servidor antes
// de subir pro TikTok.
const MAX_VIDEO_BYTES = 250 * 1024 * 1024;
const SINGLE_CHUNK_MAX = 64 * 1024 * 1024;
const CHUNK_SIZE = 32 * 1024 * 1024;

const PRIVACY_LEVELS = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"] as const;

const settingsSchema = z.object({
  privacyLevel: z.enum(PRIVACY_LEVELS),
  allowComment: z.boolean(),
  allowDuet: z.boolean(),
  allowStitch: z.boolean(),
  brandOrganic: z.boolean(),
  brandContent: z.boolean(),
});
export type TikTokPostSettings = z.infer<typeof settingsSchema>;

// Enquanto o app não passa na auditoria do TikTok, a API só aceita publicar
// como "SELF_ONLY" (e em conta privada), mas o creator_info ainda lista as
// outras opções. Depois da aprovação, defina TIKTOK_APP_APROVADO=true na Vercel.
function filterPrivacyOptions(options: string[]): string[] {
  if (process.env.TIKTOK_APP_APROVADO?.trim() === "true") return options;
  return options.filter((o) => o === "SELF_ONLY");
}

function credentials() {
  // trim: colar o valor na Vercel costuma levar uma quebra de linha junto (%0A na URL).
  const key = process.env.TIKTOK_CLIENT_KEY?.trim();
  const secret = process.env.TIKTOK_CLIENT_SECRET?.trim();
  if (!key || !secret) throw new Error("Credenciais do TikTok ausentes no servidor.");
  return { key, secret };
}

async function assertCanPublish(supabase: any, userId: string) {
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (isMaster) return;
  // Mesmo balde de permissão do Instagram/Facebook: "publicar em rede social".
  const { data: allowed } = await supabase.rpc("has_setor_permission", { _user_id: userId, _perm: "instagram_publish" });
  if (!allowed) throw new Error("Você não tem permissão pra gerenciar o TikTok desse cliente.");
}

async function assertClientInOrg(supabase: any, clientId: string, orgId: string) {
  const { data } = await supabase.from("clients").select("id").eq("id", clientId).eq("org_id", orgId).maybeSingle();
  if (!data) throw new Error("Cliente não encontrado.");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Chamada JSON ao TikTok. A API devolve `error.code === "ok"` no sucesso. */
async function ttJson(path: string, token: string, body?: unknown): Promise<any> {
  const res = await fetch(`${TT_API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || (json?.error?.code && json.error.code !== "ok")) {
    console.error("[TikTok]", path, res.status, JSON.stringify(json?.error ?? json));
    if (json?.error?.code === "unaudited_client_can_only_post_to_private_accounts") {
      throw new Error("O app ainda não foi aprovado pelo TikTok: por enquanto só dá pra publicar como \"Só eu\", e a conta do TikTok precisa estar privada.");
    }
    throw new Error(json?.error?.message || `O TikTok recusou a requisição (${res.status}).`);
  }
  return json;
}

async function ttToken(params: Record<string, string>): Promise<any> {
  const { key, secret } = credentials();
  const res = await fetch(`${TT_API}/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: key, client_secret: secret, ...params }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    console.error("[TikTok token]", res.status, JSON.stringify(json));
    throw new Error(json?.error_description || json?.error?.message || "Não foi possível autorizar no TikTok.");
  }
  return json;
}

/** Devolve um token de acesso válido, renovando com o refresh token se
 * faltar menos de 5 minutos pra expirar. */
async function getFreshTikTokToken(clientId: string): Promise<{ token: string; openId: string }> {
  const db = await admin();
  const { data: creds } = await db.from("client_tiktok_credentials").select("*").eq("client_id", clientId).maybeSingle();
  if (!creds) throw new Error("Esse cliente ainda não conectou o TikTok. Vá na Ficha do Cliente e conecte.");

  if (new Date(creds.access_token_expires_at).getTime() - Date.now() > 5 * 60 * 1000) {
    return { token: creds.access_token, openId: creds.open_id };
  }
  if (new Date(creds.refresh_token_expires_at).getTime() <= Date.now()) {
    throw new Error("A conexão com o TikTok expirou. Reconecte o TikTok na Ficha do Cliente.");
  }
  let json: any;
  try {
    json = await ttToken({ grant_type: "refresh_token", refresh_token: creds.refresh_token });
  } catch {
    throw new Error("Não foi possível renovar o acesso ao TikTok. Reconecte o TikTok na Ficha do Cliente.");
  }
  const now = Date.now();
  await db.from("client_tiktok_credentials").update({
    access_token: json.access_token,
    access_token_expires_at: new Date(now + (json.expires_in ?? 86400) * 1000).toISOString(),
    refresh_token: json.refresh_token ?? creds.refresh_token,
    refresh_token_expires_at: new Date(now + (json.refresh_expires_in ?? 31536000) * 1000).toISOString(),
  }).eq("client_id", clientId);
  return { token: json.access_token, openId: creds.open_id };
}

export const getTikTokConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const db = await admin();
    const { data: row } = await db
      .from("client_tiktok_credentials")
      .select("display_name, avatar_url, connected_at")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!row) return { connected: false, displayName: null, avatarUrl: null, connectedAt: null };
    return { connected: true, displayName: row.display_name as string | null, avatarUrl: row.avatar_url as string | null, connectedAt: row.connected_at as string };
  });

export const getTikTokConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const { key } = credentials();
    const params = new URLSearchParams({
      client_key: key,
      scope: TT_SCOPES,
      response_type: "code",
      redirect_uri: TT_REDIRECT_URI,
      state: data.clientId,
    });
    return { url: `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}` };
  });

/** Troca o código OAuth por tokens e já salva tudo no servidor — o token
 * nunca passa pelo navegador. */
export const connectTikTok = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { code: string; clientId: string }) =>
    z.object({ code: z.string().min(1), clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);

    const json = await ttToken({ grant_type: "authorization_code", code: data.code, redirect_uri: TT_REDIRECT_URI });
    const grantedScopes = String(json.scope ?? "").split(",");
    if (!grantedScopes.includes("video.publish")) {
      throw new Error("A permissão de publicar vídeos não foi concedida. Conecte de novo e aceite todas as permissões.");
    }

    let displayName: string | null = null;
    let avatarUrl: string | null = null;
    try {
      const info = await ttJson("/user/info/?fields=open_id,display_name,avatar_url", json.access_token);
      displayName = info?.data?.user?.display_name ?? null;
      avatarUrl = info?.data?.user?.avatar_url ?? null;
    } catch {
      // Sem o nome a conexão ainda funciona; só a exibição fica genérica.
    }

    const now = Date.now();
    const db = await admin();
    const { error } = await db.from("client_tiktok_credentials").upsert({
      client_id: data.clientId,
      open_id: json.open_id,
      display_name: displayName,
      avatar_url: avatarUrl,
      access_token: json.access_token,
      access_token_expires_at: new Date(now + (json.expires_in ?? 86400) * 1000).toISOString(),
      refresh_token: json.refresh_token,
      refresh_token_expires_at: new Date(now + (json.refresh_expires_in ?? 31536000) * 1000).toISOString(),
      scopes: json.scope ?? null,
      connected_by: context.userId,
      connected_at: new Date().toISOString(),
    }, { onConflict: "client_id" });
    if (error) throw new Error(error.message);
    return { ok: true as const, displayName };
  });

export const disconnectTikTok = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const db = await admin();
    const { data: creds } = await db.from("client_tiktok_credentials").select("access_token").eq("client_id", data.clientId).maybeSingle();
    if (creds) {
      // Revoga no TikTok também; se falhar, apagar do nosso lado já basta.
      try {
        const { key, secret } = credentials();
        await fetch(`${TT_API}/oauth/revoke/`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_key: key, client_secret: secret, token: creds.access_token }),
        });
      } catch { /* segue */ }
    }
    const { error } = await db.from("client_tiktok_credentials").delete().eq("client_id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type TikTokCreatorInfo = {
  nickname: string;
  avatarUrl: string | null;
  privacyOptions: string[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxDurationSec: number | null;
};

/** Pergunta ao TikTok o que essa conta pode fazer agora (privacidades
 * disponíveis, comentário/duet/stitch desligados pela conta, duração máxima).
 * As regras do TikTok exigem consultar isso antes de cada publicação. */
export const getTikTokCreatorInfo = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<TikTokCreatorInfo> => {
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const { token } = await getFreshTikTokToken(data.clientId);
    const json = await ttJson("/post/publish/creator_info/query/", token, {});
    const d = json?.data ?? {};
    return {
      nickname: d.creator_nickname ?? d.creator_username ?? "",
      avatarUrl: d.creator_avatar_url ?? null,
      privacyOptions: filterPrivacyOptions(Array.isArray(d.privacy_level_options) ? d.privacy_level_options : []),
      commentDisabled: !!d.comment_disabled,
      duetDisabled: !!d.duet_disabled,
      stitchDisabled: !!d.stitch_disabled,
      maxDurationSec: typeof d.max_video_post_duration_sec === "number" ? d.max_video_post_duration_sec : null,
    };
  });

export type TikTokItemState = {
  autoPublish: boolean;
  privacyLevel: string | null;
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  brandOrganic: boolean;
  brandContent: boolean;
  publishId: string | null;
  publishedAt: string | null;
  lastError: string | null;
};

export const getTikTokItemState = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string }) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<TikTokItemState | null> => {
    const { data: item } = await context.supabase
      .from("content_items")
      .select("id, months(clients!months_client_id_fkey(org_id))")
      .eq("id", data.itemId).maybeSingle();
    if (!item || (item as any).months?.clients?.org_id !== context.orgId) throw new Error("Item não encontrado.");
    const db = await admin();
    const { data: row } = await db.from("content_item_tiktok").select("*").eq("item_id", data.itemId).maybeSingle();
    if (!row) return null;
    return {
      autoPublish: row.auto_publish, privacyLevel: row.privacy_level,
      allowComment: row.allow_comment, allowDuet: row.allow_duet, allowStitch: row.allow_stitch,
      brandOrganic: row.brand_organic, brandContent: row.brand_content,
      publishId: row.publish_id, publishedAt: row.published_at, lastError: row.last_error,
    };
  });

function assertSettingsValid(s: TikTokPostSettings) {
  // Regra do TikTok: conteúdo de marca de terceiros (branded content) não pode ser privado (SELF_ONLY).
  if (s.brandContent && s.privacyLevel === "SELF_ONLY") {
    throw new Error("Conteúdo de marca de terceiros não pode ser publicado como privado. Escolha outra privacidade.");
  }
}

async function saveSettings(db: any, itemId: string, s: TikTokPostSettings, extra: Record<string, unknown> = {}) {
  const { error } = await db.from("content_item_tiktok").upsert({
    item_id: itemId,
    privacy_level: s.privacyLevel,
    allow_comment: s.allowComment,
    allow_duet: s.allowDuet,
    allow_stitch: s.allowStitch,
    brand_organic: s.brandOrganic,
    brand_content: s.brandContent,
    updated_at: new Date().toISOString(),
    ...extra,
  }, { onConflict: "item_id" });
  if (error) throw new Error(error.message);
}

/** Duração em segundos de um mp4/mov, lida do átomo "mvhd". Devolve null se
 * não conseguir ler (aí a checagem de duração é pulada, e o TikTok valida). */
function mp4DurationSec(buf: Buffer): number | null {
  const at = buf.indexOf("mvhd");
  if (at < 0 || at + 32 > buf.length) return null;
  const version = buf[at + 4];
  const timescale = buf.readUInt32BE(at + (version === 1 ? 24 : 16));
  const duration = version === 1 ? Number(buf.readBigUInt64BE(at + 28)) : buf.readUInt32BE(at + 20);
  return timescale > 0 ? duration / timescale : null;
}

const STATUS_POLL_ATTEMPTS = 12;
const STATUS_POLL_INTERVAL_MS = 4000;

/** Consulta o andamento de uma publicação. Devolve "done", "failed" ou
 * "processing". Quando conclui, marca o item como Finalizado. */
async function reconcileTikTokPublish(db: any, itemId: string, clientId: string, publishId: string) {
  const { token } = await getFreshTikTokToken(clientId);
  const json = await ttJson("/post/publish/status/fetch/", token, { publish_id: publishId });
  const status: string = json?.data?.status ?? "";
  if (status === "PUBLISH_COMPLETE") {
    await db.from("content_items").update({ status: "FINALIZADO" }).eq("id", itemId);
    await db.from("content_item_tiktok").update({
      auto_publish: false, published_at: new Date().toISOString(), last_error: null, last_error_at: null,
    }).eq("item_id", itemId);
    return { state: "done" as const };
  }
  if (status === "FAILED") {
    const reason = json?.data?.fail_reason ?? "desconhecido";
    // Limpa o publish_id: o envio falhou de vez, a próxima tentativa sobe o vídeo de novo.
    await db.from("content_item_tiktok").update({ publish_id: null }).eq("item_id", itemId);
    throw new Error(`O TikTok não conseguiu publicar o vídeo (${reason}).`);
  }
  return { state: "processing" as const };
}

/** Publica um vídeo no TikTok — usado pelo botão manual e pelo cron. Sempre
 * via service_role (o cron não tem sessão); `expectedOrgId`, quando
 * informado, confirma que o item é da org de quem chamou. */
async function runTikTokPublish(itemId: string, expectedOrgId?: string) {
  const db = await admin();

  const { data: item } = await db
    .from("content_items")
    .select("id, type, status, title, caption, months(client_id, clients!months_client_id_fkey(id, org_id))")
    .eq("id", itemId).maybeSingle();
  if (!item) throw new Error("Item não encontrado.");
  if (item.type !== "reel" && item.type !== "post") throw new Error("A publicação no TikTok só está disponível pra Posts e Reels com vídeo.");
  if (item.status !== "PRONTO_PARA_PUBLICAR") {
    throw new Error('Marque o status como "Pronto para publicar" antes de publicar no TikTok.');
  }
  const clientId: string | undefined = item.months?.client_id;
  const clientOrgId: string | undefined = item.months?.clients?.org_id;
  if (!clientId || !clientOrgId) throw new Error("Cliente não encontrado.");
  if (expectedOrgId && clientOrgId !== expectedOrgId) throw new Error("Cliente não encontrado.");

  const { data: settings } = await db.from("content_item_tiktok").select("*").eq("item_id", itemId).maybeSingle();
  if (!settings?.privacy_level) throw new Error("Escolha a privacidade do vídeo no TikTok antes de publicar.");
  // Já enviado e só esperando o TikTok processar: não sobe de novo.
  if (settings.publish_id && !settings.published_at) {
    const r = await reconcileTikTokPublish(db, itemId, clientId, settings.publish_id);
    return { ok: true as const, processing: r.state === "processing", publishId: settings.publish_id as string };
  }
  const s: TikTokPostSettings = {
    privacyLevel: settings.privacy_level, allowComment: settings.allow_comment, allowDuet: settings.allow_duet,
    allowStitch: settings.allow_stitch, brandOrganic: settings.brand_organic, brandContent: settings.brand_content,
  };
  assertSettingsValid(s);

  const { data: files } = await db
    .from("item_files").select("drive_file_id, mime_type")
    .eq("item_id", itemId).eq("kind", "media").order("sort_order").order("created_at");
  const video = (files ?? []).find((f: any) => (f.mime_type ?? "").startsWith("video/"));
  if (!video) throw new Error("Anexe um vídeo ao item antes de publicar no TikTok.");

  const { token } = await getFreshTikTokToken(clientId);

  // Confere se a privacidade escolhida ainda é permitida pra essa conta.
  const creator = await ttJson("/post/publish/creator_info/query/", token, {});
  const allowedPrivacy: string[] = filterPrivacyOptions(creator?.data?.privacy_level_options ?? []);
  if (allowedPrivacy.length > 0 && !allowedPrivacy.includes(s.privacyLevel)) {
    throw new Error("A privacidade escolhida não está disponível pra essa conta do TikTok agora. Escolha outra.");
  }

  const { getAccessToken, withDriveOrg } = await import("./drive.functions");
  const buffer: Buffer = await withDriveOrg(clientOrgId, async () => {
    const driveToken = await getAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(video.drive_file_id)}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${driveToken}` } },
    );
    if (!res.ok) throw new Error(`Falha ao baixar o vídeo do Drive (${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  });
  if (buffer.length > MAX_VIDEO_BYTES) throw new Error("O vídeo passa de 250 MB, que é o limite pra enviar ao TikTok por aqui.");

  // Regra do TikTok: o vídeo não pode passar da duração máxima que a conta aceita.
  const maxSec: number | undefined = creator?.data?.max_video_post_duration_sec;
  const durSec = mp4DurationSec(buffer);
  if (maxSec && durSec && durSec > maxSec) {
    throw new Error(`O vídeo tem ${Math.ceil(durSec)}s e essa conta do TikTok aceita até ${maxSec}s.`);
  }

  const size = buffer.length;
  const chunkSize = size <= SINGLE_CHUNK_MAX ? size : CHUNK_SIZE;
  const totalChunks = Math.max(1, Math.floor(size / chunkSize));
  const title = (item.caption?.trim() || item.title || "").slice(0, 2200);

  const init = await ttJson("/post/publish/video/init/", token, {
    post_info: {
      title,
      privacy_level: s.privacyLevel,
      disable_comment: !s.allowComment,
      disable_duet: !s.allowDuet,
      disable_stitch: !s.allowStitch,
      brand_content_toggle: s.brandContent,
      brand_organic_toggle: s.brandOrganic,
      video_cover_timestamp_ms: 1000,
    },
    source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunkSize, total_chunk_count: totalChunks },
  });
  const publishId: string = init?.data?.publish_id;
  const uploadUrl: string = init?.data?.upload_url;
  if (!publishId || !uploadUrl) throw new Error("O TikTok não devolveu o endereço de envio do vídeo.");

  // Guarda o publish_id já: se o envio quebrar no meio, o cron/consulta de
  // status consegue reconciliar em vez de duplicar o post.
  await saveSettings(db, itemId, s, { publish_id: publishId, last_error: null, last_error_at: null });

  const mime = (video.mime_type as string | null) ?? "video/mp4";
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = i === totalChunks - 1 ? size - 1 : start + chunkSize - 1;
    const part = buffer.subarray(start, end + 1);
    const up = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": mime, "Content-Length": String(part.length), "Content-Range": `bytes ${start}-${end}/${size}` },
      body: new Uint8Array(part),
    });
    if (!up.ok && up.status !== 206) {
      const text = await up.text().catch(() => "");
      console.error("[TikTok upload]", up.status, text);
      throw new Error(`Falha ao enviar o vídeo ao TikTok (${up.status}).`);
    }
  }

  for (let attempt = 0; attempt < STATUS_POLL_ATTEMPTS; attempt++) {
    await new Promise((r) => setTimeout(r, STATUS_POLL_INTERVAL_MS));
    const r = await reconcileTikTokPublish(db, itemId, clientId, publishId);
    if (r.state === "done") return { ok: true as const, processing: false, publishId };
  }
  // Ainda processando: o cron reconcilia depois.
  return { ok: true as const, processing: true, publishId };
}

export const publishToTikTok = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; settings: TikTokPostSettings }) =>
    z.object({ itemId: z.string().uuid(), settings: settingsSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
    assertSettingsValid(data.settings);
    const { data: item } = await context.supabase
      .from("content_items")
      .select("id, months(clients!months_client_id_fkey(org_id))")
      .eq("id", data.itemId).maybeSingle();
    if (!item || (item as any).months?.clients?.org_id !== context.orgId) throw new Error("Item não encontrado.");
    const db = await admin();
    // Salvar antes de publicar: se falhar, a escolha do usuário não se perde.
    // publish_id zerado só quando é uma tentativa nova (não há envio pendente).
    const { data: prev } = await db.from("content_item_tiktok").select("publish_id, published_at").eq("item_id", data.itemId).maybeSingle();
    const pending = !!prev?.publish_id && !prev?.published_at;
    await saveSettings(db, data.itemId, data.settings, pending ? {} : { publish_id: null, published_at: null });
    return runTikTokPublish(data.itemId, context.orgId);
  });

export const setTikTokAutoPublish = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; enabled: boolean; settings?: TikTokPostSettings }) =>
    z.object({ itemId: z.string().uuid(), enabled: z.boolean(), settings: settingsSchema.optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
    const { data: item } = await context.supabase
      .from("content_items")
      .select("id, type, status, scheduled_at, months(clients!months_client_id_fkey(org_id))")
      .eq("id", data.itemId).maybeSingle();
    if (!item || (item as any).months?.clients?.org_id !== context.orgId) throw new Error("Item não encontrado.");
    if (item.type !== "reel" && item.type !== "post") throw new Error("Só é possível programar Posts e Reels com vídeo no TikTok.");
    const db = await admin();
    if (data.enabled) {
      if (!data.settings) throw new Error("Escolha as opções de publicação do TikTok antes de programar.");
      assertSettingsValid(data.settings);
      if (item.status !== "PRONTO_PARA_PUBLICAR") {
        throw new Error('Marque o status como "Pronto para publicar" antes de programar.');
      }
      if (!item.scheduled_at || new Date(item.scheduled_at).getTime() <= Date.now()) {
        throw new Error("Defina uma data e horário futuros em Publicação antes de programar.");
      }
      await saveSettings(db, data.itemId, data.settings, { auto_publish: true, last_error: null, last_error_at: null });
    } else {
      const { error } = await db.from("content_item_tiktok").update({ auto_publish: false, updated_at: new Date().toISOString() }).eq("item_id", data.itemId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

async function markScheduledTikTokFailure(
  db: any,
  item: { id: string; title: string; orgId: string | undefined; hadPreviousError: boolean },
  errorMessage: string,
) {
  await db.from("content_item_tiktok")
    .update({ last_error: errorMessage, last_error_at: new Date().toISOString() })
    .eq("item_id", item.id);
  if (item.hadPreviousError || !item.orgId) return;
  const { data: masterRoles } = await db.from("user_roles").select("user_id").eq("role", "master");
  const masterIds = new Set((masterRoles ?? []).map((r: any) => r.user_id));
  const { data: orgProfiles } = await db.from("profiles").select("id").eq("org_id", item.orgId);
  const masterProfileIds = (orgProfiles ?? []).map((p: any) => p.id).filter((id: string) => masterIds.has(id));
  if (masterProfileIds.length === 0) return;
  await db.from("notifications").insert(
    masterProfileIds.map((userId: string) => ({
      user_id: userId,
      type: "tiktok_publish_failed",
      item_id: item.id,
      message: `Falha ao publicar "${item.title}" no TikTok: ${errorMessage}`,
    })),
  );
}

/** Chamado pelo cron externo via /api/cron/publish-tiktok. Publica o que
 * está programado e vencido, e também reconcilia envios que ficaram
 * "processando" (vídeo já enviado, TikTok ainda não confirmou). */
export async function runScheduledTikTokPublishes() {
  const db = await admin();
  const results: { itemId: string; ok: boolean; error?: string }[] = [];

  const { data: candidates } = await db
    .from("content_item_tiktok")
    .select("item_id, last_error, content_items!inner(id, title, status, scheduled_at, months(clients!months_client_id_fkey(org_id)))")
    .eq("auto_publish", true);
  const nowMs = Date.now();
  for (const row of candidates ?? []) {
    const ci = row.content_items;
    if (!ci || ci.status !== "PRONTO_PARA_PUBLICAR" || !ci.scheduled_at || new Date(ci.scheduled_at).getTime() > nowMs) continue;
    try {
      await runTikTokPublish(row.item_id);
      results.push({ itemId: row.item_id, ok: true });
    } catch (e: any) {
      const errorMessage = e?.message ?? String(e);
      console.error("[TikTok cron] falha ao publicar", row.item_id, e);
      await markScheduledTikTokFailure(db, {
        id: row.item_id, title: ci.title, orgId: ci.months?.clients?.org_id, hadPreviousError: !!row.last_error,
      }, errorMessage);
      results.push({ itemId: row.item_id, ok: false, error: errorMessage });
    }
  }

  const { data: pending } = await db
    .from("content_item_tiktok")
    .select("item_id, publish_id, content_items!inner(months(client_id))")
    .not("publish_id", "is", null)
    .is("published_at", null);
  for (const row of pending ?? []) {
    const clientId = row.content_items?.months?.client_id;
    if (!clientId) continue;
    try {
      await reconcileTikTokPublish(db, row.item_id, clientId, row.publish_id);
    } catch (e: any) {
      await db.from("content_item_tiktok")
        .update({ last_error: e?.message ?? String(e), last_error_at: new Date().toISOString(), publish_id: null })
        .eq("item_id", row.item_id);
    }
  }
  return results;
}
