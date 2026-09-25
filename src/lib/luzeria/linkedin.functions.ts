import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";

// LinkedIn — Community Management API (Página da Empresa) +, futuramente,
// Share on LinkedIn (perfil pessoal). Credenciais próprias do LinkedIn
// Developer Portal (LINKEDIN_CLIENT_ID/SECRET). Endpoints modernos
// versionados em /rest/*, substituindo os antigos /v2/ugcPosts e /v2/shares
// (descontinuados). Fonte: documentação oficial learn.microsoft.com/linkedin,
// checada em 2026-09-25 — revisar o LI_VERSION pelo menos uma vez por ano
// (cada versão mensal vale só ~12 meses).
const LI_OAUTH = "https://www.linkedin.com/oauth/v2";
const LI_REST = "https://api.linkedin.com/rest";
const LI_V2 = "https://api.linkedin.com/v2";
const LI_VERSION = "202609";
const LI_REDIRECT_URI = "https://www.modocriador.com.br/oauth/linkedin-callback";
// Mesmo conjunto de escopos pra login e pra publicar — o LinkedIn invalida
// TODOS os tokens anteriores de um membro quando um app pede um conjunto de
// escopos diferente do que ele já tinha concedido, então nunca variar isso
// entre o fluxo de perfil pessoal e o de Página da Empresa.
const LI_SCOPES = "openid profile email w_member_social w_organization_social r_organization_social rw_organization_admin";
// Papéis que permitem postar na Página (a doc usa os dois nomes pro mesmo
// papel em lugares diferentes — aceita os dois).
const LI_POSTER_ROLES = new Set(["ADMINISTRATOR", "DIRECT_SPONSORED_CONTENT_POSTER", "CONTENT_ADMIN", "CONTENT_ADMINISTRATOR"]);

// Limite defensivo (mesmo espírito do TikTok) — o arquivo é baixado do
// Drive pra memória do servidor antes de subir pro LinkedIn.
const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // limite documentado do LinkedIn
const VIDEO_CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB, tamanho fixo exigido pela Videos API
const MEDIA_POLL_ATTEMPTS = 15;
const MEDIA_POLL_INTERVAL_MS = 2000;

// Enquanto o app do LinkedIn não sai do tier de desenvolvimento (só posta em
// páginas associadas ao próprio app no Developer Portal), fica restrito à
// conta interna da Luzeria — mesmo caminho que o TikTok seguiu antes da
// aprovação. Depois que a Standard tier for aprovada, defina
// LINKEDIN_APP_APROVADO=true na Vercel.
function assertLinkedInEnabled(orgId: string) {
  if (orgId === LUZERIA_ORG_ID) return;
  if (process.env.LINKEDIN_APP_APROVADO?.trim() === "true") return;
  throw new Error("A publicação no LinkedIn ainda não está liberada pra todas as agências.");
}

/** Escapa o "little text format" que a Posts API exige no campo
 * `commentary` — sem isso, esses caracteres podem quebrar ou truncar o
 * post. A ordem não importa: cada caractere da classe (barra invertida
 * incluída) recebe sua própria barra na frente. */
function escapeLittleText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
}

function credentials() {
  // trim: colar o valor na Vercel costuma levar uma quebra de linha junto.
  const id = process.env.LINKEDIN_CLIENT_ID?.trim();
  const secret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
  if (!id || !secret) throw new Error("Credenciais do LinkedIn ausentes no servidor.");
  return { id, secret };
}

async function assertCanPublish(supabase: any, userId: string) {
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (isMaster) return;
  // Mesmo balde de permissão do Instagram/Facebook/TikTok: "publicar em rede social".
  const { data: allowed } = await supabase.rpc("has_setor_permission", { _user_id: userId, _perm: "instagram_publish" });
  if (!allowed) throw new Error("Você não tem permissão pra gerenciar o LinkedIn desse cliente.");
}

async function assertClientInOrg(supabase: any, clientId: string, orgId: string) {
  const { data } = await supabase.from("clients").select("id").eq("id", clientId).eq("org_id", orgId).maybeSingle();
  if (!data) throw new Error("Cliente não encontrado.");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

/** Chamada às APIs REST versionadas do LinkedIn (/rest/*). Devolve o corpo
 * já parseado e, quando pedido, os headers de resposta — a criação de post
 * devolve o URN só no header `x-restli-id`, nunca no corpo. */
async function liRest(path: string, token: string, init?: { method?: string; body?: unknown }): Promise<{ json: any; headers: Headers; status: number }> {
  const res = await fetch(`${LI_REST}${path}`, {
    method: init?.body !== undefined ? (init.method ?? "POST") : (init?.method ?? "GET"),
    headers: {
      Authorization: `Bearer ${token}`,
      "Linkedin-Version": LI_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    console.error("[LinkedIn]", path, res.status, JSON.stringify(json));
    throw new Error(json?.message || `O LinkedIn recusou a requisição (${res.status}).`);
  }
  return { json, headers: res.headers, status: res.status };
}

async function liToken(params: Record<string, string>): Promise<any> {
  const { id, secret } = credentials();
  const res = await fetch(`${LI_OAUTH}/accessToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...params }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    console.error("[LinkedIn token]", res.status, JSON.stringify(json));
    throw new Error(json?.error_description || "Não foi possível autorizar no LinkedIn.");
  }
  return json;
}

/** Devolve um access token válido, renovando com o refresh token se faltar
 * menos de 5 minutos pra expirar. Nem todo app do LinkedIn recebe refresh
 * token (depende do tier aprovado) — sem ele, expira e pede reconexão. */
async function getFreshLinkedInToken(clientId: string): Promise<{ token: string }> {
  const db = await admin();
  const { data: creds } = await db.from("client_linkedin_credentials").select("*").eq("client_id", clientId).maybeSingle();
  if (!creds) throw new Error("Esse cliente ainda não conectou o LinkedIn. Vá na Ficha do Cliente e conecte.");

  if (new Date(creds.access_token_expires_at).getTime() - Date.now() > 5 * 60 * 1000) {
    return { token: creds.access_token };
  }
  if (!creds.refresh_token || !creds.refresh_token_expires_at || new Date(creds.refresh_token_expires_at).getTime() <= Date.now()) {
    throw new Error("A conexão com o LinkedIn expirou. Reconecte o LinkedIn na Ficha do Cliente.");
  }
  let json: any;
  try {
    json = await liToken({ grant_type: "refresh_token", refresh_token: creds.refresh_token });
  } catch {
    throw new Error("Não foi possível renovar o acesso ao LinkedIn. Reconecte o LinkedIn na Ficha do Cliente.");
  }
  const now = Date.now();
  await db.from("client_linkedin_credentials").update({
    access_token: json.access_token,
    access_token_expires_at: new Date(now + (json.expires_in ?? 5_184_000) * 1000).toISOString(),
    refresh_token: json.refresh_token ?? creds.refresh_token,
    refresh_token_expires_at: json.refresh_token_expires_in ? new Date(now + json.refresh_token_expires_in * 1000).toISOString() : creds.refresh_token_expires_at,
  }).eq("client_id", clientId);
  return { token: json.access_token };
}

export const getLinkedInConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const db = await admin();
    const { data: row } = await db
      .from("client_linkedin_credentials")
      .select("organization_name, person_name, connected_at")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!row) return { connected: false, name: null, connectedAt: null };
    return { connected: true, name: (row.organization_name ?? row.person_name) as string | null, connectedAt: row.connected_at as string };
  });

export const getLinkedInConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    assertLinkedInEnabled(context.orgId);
    const { id } = credentials();
    const params = new URLSearchParams({
      response_type: "code",
      client_id: id,
      redirect_uri: LI_REDIRECT_URI,
      scope: LI_SCOPES,
      state: data.clientId,
    });
    return { url: `${LI_OAUTH}/authorization?${params.toString()}` };
  });

export type LinkedInOrgOption = { urn: string; name: string };

/** Troca o código OAuth por tokens e lista as Páginas que esse membro
 * administra (ou tem papel de postar) — mesmo padrão de duas etapas do
 * Facebook: aqui só troca e lista, quem persiste é connectLinkedInOrganization
 * depois que a pessoa escolhe qual Página conectar. Sem middleware de sessão
 * de propósito (mesmo motivo do exchangeFacebookCode): roda no meio do
 * redirect de volta do LinkedIn. */
export const exchangeLinkedInCode = createServerFn({ method: "POST" })
  .inputValidator((d: { code: string; clientId: string }) =>
    z.object({ code: z.string().min(1), clientId: z.string().uuid() }).parse(d))
  .handler(async (
    { data },
  ): Promise<{ organizations: LinkedInOrgOption[]; accessToken: string; accessTokenExpiresAt: string; refreshToken: string | null; refreshTokenExpiresAt: string | null; scopes: string | null; personUrn: string | null; personName: string | null }> => {
    const json = await liToken({ grant_type: "authorization_code", code: data.code, redirect_uri: LI_REDIRECT_URI });
    const now = Date.now();
    const accessToken = json.access_token as string;

    // Dados do perfil pessoal (pra quando o perfil pessoal for liberado, e
    // pra mostrar um nome amigável mesmo na conexão de Página).
    let personUrn: string | null = null;
    let personName: string | null = null;
    try {
      const infoRes = await fetch(`${LI_V2}/userinfo`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const info: any = await infoRes.json();
      if (infoRes.ok && info?.sub) {
        personUrn = `urn:li:person:${info.sub}`;
        personName = info.name ?? null;
      }
    } catch { /* segue sem — a lista de Páginas ainda funciona */ }

    // Lista as Páginas onde esse membro pode postar. A doc é inconsistente
    // no nome do campo do URN da organização ("organization" numa página,
    // "organizationTarget" noutra) — lê os dois.
    const organizations: LinkedInOrgOption[] = [];
    try {
      const aclRes = await liRest(
        `/organizationAcls?q=roleAssignee&state=APPROVED&count=100&start=0`,
        accessToken,
      );
      const elements: any[] = aclRes.json?.elements ?? [];
      for (const el of elements) {
        if (!LI_POSTER_ROLES.has(el.role)) continue;
        const orgUrn: string | undefined = el.organization ?? el.organizationTarget;
        if (!orgUrn || organizations.some((o) => o.urn === orgUrn)) continue;
        const orgId = orgUrn.split(":").pop();
        let name = orgUrn;
        try {
          const orgRes = await liRest(`/organizations/${orgId}`, accessToken);
          name = orgRes.json?.localizedName ?? name;
        } catch { /* mantém o URN como nome se não conseguir o nome de verdade */ }
        organizations.push({ urn: orgUrn, name });
      }
    } catch (e: any) {
      console.error("[LinkedIn connect] falha ao listar Páginas:", e?.message ?? e);
      // Sem `rw_organization_admin` aprovado ainda, essa chamada pode falhar
      // — a pessoa ainda consegue ver o erro e tentar de novo depois.
    }

    return {
      organizations,
      accessToken,
      accessTokenExpiresAt: new Date(now + (json.expires_in ?? 5_184_000) * 1000).toISOString(),
      refreshToken: json.refresh_token ?? null,
      refreshTokenExpiresAt: json.refresh_token_expires_in ? new Date(now + json.refresh_token_expires_in * 1000).toISOString() : null,
      scopes: json.scope ?? null,
      personUrn,
      personName,
    };
  });

/** Segundo passo — depois que a pessoa escolhe qual Página conectar (ou
 * automático, se só veio 1 opção). Os tokens já vieram prontos da troca
 * anterior, não precisa pedir de novo ao LinkedIn. */
export const connectLinkedInOrganization = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    clientId: string; organizationUrn: string; organizationName: string;
    accessToken: string; accessTokenExpiresAt: string; refreshToken: string | null; refreshTokenExpiresAt: string | null; scopes: string | null;
  }) => z.object({
    clientId: z.string().uuid(),
    organizationUrn: z.string().min(1),
    organizationName: z.string().min(1).max(300),
    accessToken: z.string().min(1),
    accessTokenExpiresAt: z.string().min(1),
    refreshToken: z.string().nullable(),
    refreshTokenExpiresAt: z.string().nullable(),
    scopes: z.string().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    assertLinkedInEnabled(context.orgId);
    const db = await admin();
    const { error } = await db.from("client_linkedin_credentials").upsert({
      client_id: data.clientId,
      organization_urn: data.organizationUrn,
      organization_name: data.organizationName,
      person_urn: null,
      person_name: null,
      access_token: data.accessToken,
      access_token_expires_at: data.accessTokenExpiresAt,
      refresh_token: data.refreshToken,
      refresh_token_expires_at: data.refreshTokenExpiresAt,
      scopes: data.scopes,
      connected_by: context.userId,
      connected_at: new Date().toISOString(),
    }, { onConflict: "client_id" });
    if (error) throw new Error(error.message);
    return { ok: true as const, name: data.organizationName };
  });

export const disconnectLinkedIn = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const db = await admin();
    const { error } = await db.from("client_linkedin_credentials").delete().eq("client_id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type LinkedInItemState = {
  autoPublish: boolean;
  postUrn: string | null;
  publishedAt: string | null;
  lastError: string | null;
};

export const getLinkedInItemState = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string }) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<LinkedInItemState | null> => {
    const { data: item } = await context.supabase
      .from("content_items")
      .select("id, months(clients!months_client_id_fkey(org_id))")
      .eq("id", data.itemId).maybeSingle();
    if (!item || (item as any).months?.clients?.org_id !== context.orgId) throw new Error("Item não encontrado.");
    const db = await admin();
    const { data: row } = await db.from("content_item_linkedin").select("*").eq("item_id", data.itemId).maybeSingle();
    if (!row) return null;
    return { autoPublish: row.auto_publish, postUrn: row.post_urn, publishedAt: row.published_at, lastError: row.last_error };
  });

/** Espera um asset (imagem ou vídeo) sair de PROCESSING/WAITING_UPLOAD e
 * chegar em AVAILABLE — postar antes disso deixa a mídia invisível no post. */
async function pollMediaAvailable(kind: "images" | "videos", urn: string, token: string) {
  for (let attempt = 0; attempt < MEDIA_POLL_ATTEMPTS; attempt++) {
    const r = await liRest(`/${kind}/${encodeURIComponent(urn)}`, token);
    const status = r.json?.status;
    if (status === "AVAILABLE") return;
    if (status === "PROCESSING_FAILED") throw new Error(`O LinkedIn não conseguiu processar ${kind === "videos" ? "o vídeo" : "a imagem"} (${r.json?.processingFailureReason ?? "motivo desconhecido"}).`);
    await new Promise((res) => setTimeout(res, MEDIA_POLL_INTERVAL_MS));
  }
  throw new Error(`O LinkedIn demorou demais pra processar ${kind === "videos" ? "o vídeo" : "a imagem"}.`);
}

async function uploadLinkedInImage(buffer: Buffer, owner: string, token: string): Promise<string> {
  const init = await liRest("/images?action=initializeUpload", token, {
    body: { initializeUploadRequest: { owner } },
  });
  const uploadUrl: string = init.json?.value?.uploadUrl;
  const imageUrn: string = init.json?.value?.image;
  if (!uploadUrl || !imageUrn) throw new Error("O LinkedIn não devolveu o endereço de envio da imagem.");
  const put = await fetch(uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body: new Uint8Array(buffer) });
  if (!put.ok) throw new Error(`Falha ao enviar a imagem ao LinkedIn (${put.status}).`);
  await pollMediaAvailable("images", imageUrn, token);
  return imageUrn;
}

async function uploadLinkedInVideo(buffer: Buffer, owner: string, token: string): Promise<string> {
  const size = buffer.length;
  const init = await liRest("/videos?action=initializeUpload", token, {
    body: { initializeUploadRequest: { owner, fileSizeBytes: size, uploadCaptions: false, uploadThumbnail: false } },
  });
  const videoUrn: string = init.json?.value?.video;
  const uploadToken: string = init.json?.value?.uploadToken;
  const instructions: { firstByte: number; lastByte: number; uploadUrl: string }[] = init.json?.value?.uploadInstructions ?? [];
  if (!videoUrn || instructions.length === 0) throw new Error("O LinkedIn não devolveu o endereço de envio do vídeo.");

  // Cada parte é enviada SEM Authorization — assim a doc oficial da Videos API.
  const etags: string[] = [];
  for (const part of instructions) {
    const chunk = buffer.subarray(part.firstByte, part.lastByte + 1);
    const put = await fetch(part.uploadUrl, { method: "PUT", body: new Uint8Array(chunk) });
    if (!put.ok) throw new Error(`Falha ao enviar o vídeo ao LinkedIn (${put.status}).`);
    const etag = put.headers.get("etag");
    if (!etag) throw new Error("O LinkedIn não confirmou uma das partes do vídeo (sem ETag).");
    etags.push(etag);
  }

  await liRest("/videos?action=finalizeUpload", token, {
    body: { finalizeUploadRequest: { video: videoUrn, uploadToken: uploadToken ?? "", uploadedPartIds: etags } },
  });
  await pollMediaAvailable("videos", videoUrn, token);
  return videoUrn;
}

/** Publica um item no LinkedIn — usado pelo botão manual e pelo cron.
 * Sempre via service_role (o cron não tem sessão); `expectedOrgId`, quando
 * informado, confirma que o item é da org de quem chamou. Imagem única ou
 * carrossel (multiImage) pra "post"; vídeo único pra "reel" — o LinkedIn não
 * tem um formato de Stories/Reels próprio, então um Reel do Modo Criador
 * vira só um post de vídeo comum no feed. */
async function runLinkedInPublish(itemId: string, expectedOrgId?: string) {
  const db = await admin();

  const { data: item } = await db
    .from("content_items")
    .select("id, type, status, caption, months(client_id, clients!months_client_id_fkey(id, org_id))")
    .eq("id", itemId).maybeSingle();
  if (!item) throw new Error("Item não encontrado.");
  if (item.type !== "post" && item.type !== "reel") throw new Error("A publicação no LinkedIn só está disponível pra Posts e Reels.");
  if (item.status !== "PRONTO_PARA_PUBLICAR") {
    throw new Error('Marque o status como "Pronto para publicar" antes de publicar no LinkedIn.');
  }
  const clientId: string | undefined = item.months?.client_id;
  const clientOrgId: string | undefined = item.months?.clients?.org_id;
  if (!clientId || !clientOrgId) throw new Error("Cliente não encontrado.");
  if (expectedOrgId && clientOrgId !== expectedOrgId) throw new Error("Cliente não encontrado.");
  assertLinkedInEnabled(clientOrgId);

  const { data: creds } = await db.from("client_linkedin_credentials").select("organization_urn, person_urn").eq("client_id", clientId).maybeSingle();
  if (!creds) throw new Error("Esse cliente ainda não conectou o LinkedIn. Vá na Ficha do Cliente e conecte.");
  const author: string | null = creds.organization_urn ?? creds.person_urn;
  if (!author) throw new Error("Conexão do LinkedIn incompleta — reconecte na Ficha do Cliente.");

  const { data: files } = await db
    .from("item_files").select("drive_file_id, mime_type")
    .eq("item_id", itemId).eq("kind", "media").order("sort_order").order("created_at");
  const relevantFiles = (files ?? []).filter((f: any) => {
    const mime = f.mime_type ?? "";
    return mime.startsWith("image/") || mime.startsWith("video/");
  });
  if (relevantFiles.length === 0) throw new Error("Anexe uma imagem ou vídeo ao item antes de publicar no LinkedIn.");

  const { token } = await getFreshLinkedInToken(clientId);
  const { getAccessToken, withDriveOrg } = await import("./drive.functions");

  async function downloadFile(file: { drive_file_id: string; mime_type: string | null }): Promise<Buffer> {
    return withDriveOrg(clientOrgId!, async () => {
      const driveToken = await getAccessToken();
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.drive_file_id)}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${driveToken}` } },
      );
      if (!res.ok) throw new Error(`Falha ao baixar arquivo do Drive (${res.status}).`);
      return Buffer.from(await res.arrayBuffer());
    });
  }

  const commentary = escapeLittleText(item.caption?.trim() ?? "");
  const basePost: Record<string, unknown> = {
    author,
    commentary,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const allImages = relevantFiles.every((f: any) => (f.mime_type ?? "").startsWith("image/"));
  if (allImages && relevantFiles.length > 1) {
    const images: { id: string }[] = [];
    for (const file of relevantFiles.slice(0, 20)) {
      const buffer = await downloadFile(file);
      images.push({ id: await uploadLinkedInImage(buffer, author, token) });
    }
    basePost.content = { multiImage: { images } };
  } else {
    const file = relevantFiles[0];
    const isVideo = (file.mime_type ?? "").startsWith("video/");
    const buffer = await downloadFile(file);
    if (isVideo && buffer.length > MAX_VIDEO_BYTES) throw new Error("O vídeo passa de 500 MB, que é o limite do LinkedIn.");
    const mediaId = isVideo ? await uploadLinkedInVideo(buffer, author, token) : await uploadLinkedInImage(buffer, author, token);
    basePost.content = { media: { id: mediaId } };
  }

  const res = await liRest("/posts", token, { body: basePost });
  const postUrn = res.headers.get("x-restli-id");
  if (!postUrn) throw new Error("O LinkedIn não confirmou o ID da publicação.");

  await db.from("content_items").update({ status: "FINALIZADO" }).eq("id", itemId);
  await db.from("content_item_linkedin").upsert({
    item_id: itemId, auto_publish: false, post_urn: postUrn, published_at: new Date().toISOString(),
    last_error: null, last_error_at: null, updated_at: new Date().toISOString(),
  }, { onConflict: "item_id" });

  return { ok: true as const, postUrn };
}

export const publishToLinkedIn = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string }) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
    const { data: item } = await context.supabase
      .from("content_items")
      .select("id, months(clients!months_client_id_fkey(org_id))")
      .eq("id", data.itemId).maybeSingle();
    if (!item || (item as any).months?.clients?.org_id !== context.orgId) throw new Error("Item não encontrado.");
    return runLinkedInPublish(data.itemId, context.orgId);
  });

export const setLinkedInAutoPublish = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; enabled: boolean }) =>
    z.object({ itemId: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanPublish(context.supabase, context.userId);
    const { data: item } = await context.supabase
      .from("content_items")
      .select("id, type, status, scheduled_at, months(clients!months_client_id_fkey(org_id))")
      .eq("id", data.itemId).maybeSingle();
    if (!item || (item as any).months?.clients?.org_id !== context.orgId) throw new Error("Item não encontrado.");
    if (item.type !== "post" && item.type !== "reel") throw new Error("Só é possível programar Posts e Reels no LinkedIn.");
    const db = await admin();
    if (data.enabled) {
      if (item.status !== "PRONTO_PARA_PUBLICAR") {
        throw new Error('Marque o status como "Pronto para publicar" antes de programar.');
      }
      if (!item.scheduled_at || new Date(item.scheduled_at).getTime() <= Date.now()) {
        throw new Error("Defina uma data e horário futuros em Publicação antes de programar.");
      }
      await db.from("content_item_linkedin").upsert({
        item_id: data.itemId, auto_publish: true, last_error: null, last_error_at: null, updated_at: new Date().toISOString(),
      }, { onConflict: "item_id" });
    } else {
      const { error } = await db.from("content_item_linkedin").update({ auto_publish: false, updated_at: new Date().toISOString() }).eq("item_id", data.itemId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

async function markScheduledLinkedInFailure(
  db: any,
  item: { id: string; title: string; orgId: string | undefined; hadPreviousError: boolean },
  errorMessage: string,
) {
  await db.from("content_item_linkedin")
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
      type: "linkedin_publish_failed",
      item_id: item.id,
      message: `Falha ao publicar "${item.title}" no LinkedIn: ${errorMessage}`,
    })),
  );
}

/** Chamado pelo cron externo via /api/cron/publish-linkedin. */
export async function runScheduledLinkedInPublishes() {
  const db = await admin();
  const results: { itemId: string; ok: boolean; error?: string }[] = [];

  const { data: candidates } = await db
    .from("content_item_linkedin")
    .select("item_id, last_error, content_items!inner(id, title, status, scheduled_at, months(clients!months_client_id_fkey(org_id)))")
    .eq("auto_publish", true);
  const nowMs = Date.now();
  for (const row of candidates ?? []) {
    const ci = row.content_items;
    if (!ci || ci.status !== "PRONTO_PARA_PUBLICAR" || !ci.scheduled_at || new Date(ci.scheduled_at).getTime() > nowMs) continue;
    try {
      await runLinkedInPublish(row.item_id);
      results.push({ itemId: row.item_id, ok: true });
    } catch (e: any) {
      const errorMessage = e?.message ?? String(e);
      console.error("[LinkedIn cron] falha ao publicar", row.item_id, e);
      await markScheduledLinkedInFailure(db, {
        id: row.item_id, title: ci.title, orgId: ci.months?.clients?.org_id, hadPreviousError: !!row.last_error,
      }, errorMessage);
      results.push({ itemId: row.item_id, ok: false, error: errorMessage });
    }
  }
  return results;
}
