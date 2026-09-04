import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";
import { parseDriveId, listDriveFolderImages, withDriveOrg, getAccessToken } from "./drive.functions";
import { protectPhotoBytes, buildPreviewBackground, type WatermarkSpec } from "./photo-watermark.server";

/** Resolve a config de marca d'água salva pra uma org — usado tanto na
 * proteção real das fotos públicas quanto na pré-visualização das
 * Configurações. */
async function resolveWatermarkSpec(orgId: string): Promise<WatermarkSpec> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: orgRow } = await supabaseAdmin
    .from("orgs")
    .select("photo_watermark_mode, photo_watermark_text, photo_watermark_opacity, photo_watermark_density, photo_watermark_path")
    .eq("id", orgId)
    .maybeSingle();
  const row = orgRow as any;
  const mode = (row?.photo_watermark_mode as string) ?? "none";

  if (mode === "text") {
    return {
      mode: "text",
      text: (row?.photo_watermark_text as string) || "REPRODUÇÃO PROIBIDA",
      opacity: (row?.photo_watermark_opacity as number) ?? 35,
      density: (row?.photo_watermark_density as "baixa" | "media" | "alta") ?? "media",
    };
  }
  if (mode === "image" && row?.photo_watermark_path) {
    const { data: wmFile } = await supabaseAdmin.storage.from("avatars").download(row.photo_watermark_path as string);
    if (wmFile) return { mode: "image", buffer: Buffer.from(await wmFile.arrayBuffer()) };
  }
  return { mode: "none" };
}

/** Mesmo gerador de token de feed-share.functions.ts. */
function randomToken(len = 22): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function assertAdmin(supabase: any, userId: string) {
  const { data: ok } = await supabase.rpc("is_admin", { _user_id: userId });
  if (!ok) throw new Error("Apenas administradores podem gerenciar seleções de fotos.");
}

/* ============ CLIENTES DE FOTOGRAFIA ============ */
/** Entidade própria da área "Seleção de Fotos" — independente dos
 * clientes de social media (public.clients): sem posts/reels/meses. */

export type PhotoClient = { id: string; name: string; createdAt: string };

export const listPhotoClients = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("photo_clients")
      .select("id, name, created_at")
      .eq("org_id", context.orgId)
      .order("name");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      name: r.name as string,
      createdAt: r.created_at as string,
    })) as PhotoClient[];
  });

export const getPhotoClient = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("photo_clients")
      .select("id, name, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Cliente de fotografia não encontrado.");
    return { id: row.id as string, name: row.name as string, createdAt: row.created_at as string } as PhotoClient;
  });

export const createPhotoClient = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name: string }) => z.object({ name: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("photo_clients")
      .insert({ org_id: context.orgId, name: data.name, created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deletePhotoClient = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("photo_clients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ ADMIN: seleções ============ */

export type PhotoSelectionSummary = {
  id: string;
  title: string;
  status: "aberta" | "encerrada";
  token: string;
  deadline: string | null;
  createdAt: string;
  submissionCount: number;
};

export const createPhotoSelection = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { photoClientId: string; title: string; driveFolderLink: string; deadline?: string | null }) =>
    z.object({
      photoClientId: z.string().uuid(),
      title: z.string().trim().min(1).max(120),
      driveFolderLink: z.string().trim().min(5).max(500),
      deadline: z.string().trim().max(10).optional().nullable(),
    }).parse(d))
  .handler(async ({ data, context }) => withDriveOrg(context.orgId, async () => {
    await assertAdmin(context.supabase, context.userId);
    const folderId = parseDriveId(data.driveFolderLink);
    if (!folderId) throw new Error("Link/ID da pasta do Drive inválido.");

    // Valida que a pasta existe e está acessível antes de gerar o link
    // público — melhor descobrir agora do que só quando o cliente abrir.
    try {
      await listDriveFolderImages(folderId);
    } catch {
      throw new Error("Não consegui acessar essa pasta do Drive. Confira o link e o compartilhamento.");
    }

    const token = randomToken(22);
    const { data: row, error } = await context.supabase
      .from("photo_selections")
      .insert({
        org_id: context.orgId,
        photo_client_id: data.photoClientId,
        title: data.title,
        drive_folder_id: folderId,
        drive_folder_link: data.driveFolderLink,
        deadline: data.deadline || null,
        token,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, token };
  }));

export const listPhotoSelections = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { photoClientId: string }) => z.object({ photoClientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("photo_selections")
      .select("id, title, status, token, deadline, created_at, photo_selection_submissions(count)")
      .eq("photo_client_id", data.photoClientId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      title: r.title as string,
      status: r.status as "aberta" | "encerrada",
      token: r.token as string,
      deadline: r.deadline as string | null,
      createdAt: r.created_at as string,
      submissionCount: r.photo_selection_submissions?.[0]?.count ?? 0,
    })) as PhotoSelectionSummary[];
  });

export type PhotoSelectionSubmission = {
  id: string;
  respondentName: string;
  finalizedAt: string;
  choices: Array<{ driveFileId: string; fileName: string }>;
};

export type PhotoSelectionDetail = PhotoSelectionSummary & {
  photoClientId: string;
  driveFolderLink: string;
  submissions: PhotoSelectionSubmission[];
};

export const getPhotoSelectionDetail = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("photo_selections")
      .select("id, photo_client_id, title, status, token, deadline, drive_folder_link, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Seleção não encontrada.");

    const { data: subRows, error: subErr } = await context.supabase
      .from("photo_selection_submissions")
      .select("id, respondent_name, finalized_at, photo_selection_choices(drive_file_id, file_name)")
      .eq("selection_id", data.id)
      .order("finalized_at", { ascending: false });
    if (subErr) throw new Error(subErr.message);

    const submissions: PhotoSelectionSubmission[] = (subRows ?? []).map((s: any) => ({
      id: s.id as string,
      respondentName: s.respondent_name as string,
      finalizedAt: s.finalized_at as string,
      choices: (s.photo_selection_choices ?? []).map((c: any) => ({
        driveFileId: c.drive_file_id as string,
        fileName: c.file_name as string,
      })),
    }));

    return {
      id: row.id as string,
      photoClientId: row.photo_client_id as string,
      title: row.title as string,
      status: row.status as "aberta" | "encerrada",
      token: row.token as string,
      deadline: row.deadline as string | null,
      driveFolderLink: row.drive_folder_link as string,
      createdAt: row.created_at as string,
      submissions,
      submissionCount: submissions.length,
    } as PhotoSelectionDetail;
  });

export const deletePhotoSelection = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("photo_selections").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPhotoSelectionStatus = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; status: "aberta" | "encerrada" }) =>
    z.object({ id: z.string().uuid(), status: z.enum(["aberta", "encerrada"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("photo_selections").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ PUBLIC (sem login, por token) ============ */

export type PublicPhotoSelection = {
  selectionId: string;
  title: string;
  status: "aberta" | "encerrada";
  clientName: string;
  deadline: string | null;
  // Sem thumbnailUrl aqui de propósito — a foto em si nunca sai do Drive
  // direto pro navegador do cliente final. O visual de cada foto vem de
  // getPublicPhotoThumbnail, que devolve os bytes já com a marca d'água
  // da agência queimada (ver photo-watermark.server.ts).
  photos: Array<{ id: string; name: string }>;
};

export const getPublicPhotoSelection = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(8).max(60) }).parse(d))
  .handler(async ({ data }): Promise<PublicPhotoSelection | null> => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );
    const { data: info, error } = await supabase.rpc("get_public_photo_selection_info", { _token: data.token });
    if (error || !info) return null;
    const r = info as any;

    let photos: Array<{ id: string; name: string }> = [];
    try {
      const files = await withDriveOrg(r.orgId as string, () => listDriveFolderImages(r.driveFolderId as string));
      photos = files.map((f) => ({ id: f.id, name: f.name }));
    } catch (e) {
      console.error("[getPublicPhotoSelection] Drive listing failed:", e);
    }

    return {
      selectionId: r.selectionId as string,
      title: r.title as string,
      status: r.status as "aberta" | "encerrada",
      clientName: (r.clientName as string) ?? "",
      deadline: (r.deadline as string) ?? null,
      photos,
    };
  });

/** Diagnóstico temporário (tabela `_debug_photo_thumb_log`, sem RLS pra
 * anon/authenticated — só service_role escreve e só eu leio via SQL
 * direto) — investigando por que fotos de uma seleção específica não
 * carregavam em produção. Nunca expõe nada pro visitante público; remove
 * assim que o bug real for identificado. */
async function logDebug(stage: string, fileId: string, detail: string) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("_debug_photo_thumb_log").insert({ stage, file_id: fileId, detail });
  } catch { /* diagnóstico não pode derrubar a resposta real */ }
}

/** Único jeito de uma foto chegar no navegador do visitante público: os
 * bytes originais nunca são expostos — sempre passam por aqui, que confirma
 * que cada `fileId` realmente pertence à pasta dessa seleção (evita virar
 * proxy pra qualquer arquivo do Drive) e devolve a imagem já com a marca
 * d'água da agência queimada nos pixels (protectPhotoBytes).
 *
 * Em LOTE de propósito: cada acesso ao Drive busca (e cacheia só na memória
 * do processo) um access token via refresh_token — uma galeria de 60+ fotos
 * pedindo uma foto por invocação bate em 60+ invocações "frias" cada uma
 * tentando renovar o token ao mesmo tempo, e a própria Google limita esse
 * ritmo de renovação (foi exatamente o que quebrou a seleção "Safira e
 * Clylton" em produção). Um lote de N fotos gasta 1 token só, pro lote
 * inteiro — mesma lógica de getGridThumbnails em drive.functions.ts. */
export const getPublicPhotoThumbnails = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; fileIds: string[] }) =>
    z.object({
      token: z.string().min(8).max(60),
      fileIds: z.array(z.string().min(5).max(200)).min(1).max(20),
    }).parse(d))
  .handler(async ({ data }) => {
    const result: Record<string, string | null> = {};
    for (const id of data.fileIds) result[id] = null;

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );
    const { data: info, error } = await supabase.rpc("get_public_photo_selection_info", { _token: data.token });
    if (error || !info) return result;
    const r = info as any;

    return withDriveOrg(r.orgId as string, async () => {
      let accessToken: string;
      try {
        accessToken = await getAccessToken();
      } catch (e) {
        console.error("[getPublicPhotoThumbnails] getAccessToken failed:", e);
        return result;
      }
      const watermark = await resolveWatermarkSpec(r.orgId as string);

      await Promise.all(data.fileIds.map(async (fileId) => {
        try {
          const metaRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=parents&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          if (!metaRes.ok) {
            const body = await metaRes.text().catch(() => "");
            await logDebug("meta", fileId, `${metaRes.status}: ${body.slice(0, 300)}`);
            return;
          }
          const meta: any = await metaRes.json();
          if (!((meta.parents ?? []) as string[]).includes(r.driveFolderId as string)) {
            await logDebug("parents-mismatch", fileId, `parents=${JSON.stringify(meta.parents)} want=${r.driveFolderId}`);
            return;
          }

          const contentRes = await fetch(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
            { headers: { Authorization: `Bearer ${accessToken}` } },
          );
          if (!contentRes.ok) {
            const body = await contentRes.text().catch(() => "");
            await logDebug("content", fileId, `${contentRes.status}: ${body.slice(0, 300)}`);
            return;
          }
          const imageBuf = Buffer.from(await contentRes.arrayBuffer());
          try {
            const outBuf = await protectPhotoBytes(imageBuf, watermark);
            result[fileId] = `data:image/jpeg;base64,${outBuf.toString("base64")}`;
          } catch (e: any) {
            await logDebug("composite", fileId, `${e?.message ?? e}`);
          }
        } catch (e: any) {
          await logDebug("throw", fileId, `${e?.message ?? e}`);
        }
      }));

      return result;
    });
  });

/** Admin: pré-visualiza a marca d'água de TEXTO com valores ainda não
 * salvos (pra tela de Configurações reagir a cada ajuste do slider/campo),
 * num fundo neutro — não precisa de foto real. A marca por imagem já dá
 * pra conferir olhando o próprio arquivo escolhido, sem round-trip. */
export const getWatermarkPreview = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { text: string; opacity: number; density: "baixa" | "media" | "alta" }) =>
    z.object({
      text: z.string().trim().max(60),
      opacity: z.number().int().min(5).max(90),
      density: z.enum(["baixa", "media", "alta"]),
    }).parse(d))
  .handler(async ({ data }) => {
    const bg = await buildPreviewBackground(800, 450);
    const outBuf = await protectPhotoBytes(bg, { mode: "text", ...data });
    return { dataUrl: `data:image/jpeg;base64,${outBuf.toString("base64")}` };
  });

/** Uma pessoa finaliza sua própria resposta — sem rascunho salvo antes:
 * escolhe as fotos numa única visita e só grava aqui, no final, com o
 * nome dela. Cada chamada cria uma resposta NOVA (várias pessoas podem
 * usar o mesmo link, cada uma com seu nome e suas fotos). */
export const submitPhotoSelectionResponse = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; respondentName: string; choices: Array<{ driveFileId: string; fileName: string }> }) =>
    z.object({
      token: z.string().min(8).max(60),
      respondentName: z.string().trim().min(1).max(80),
      choices: z.array(z.object({
        driveFileId: z.string().min(1).max(200),
        fileName: z.string().min(1).max(255),
      })).min(1).max(2000),
    }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );
    const { data: ok, error } = await supabase.rpc("submit_photo_selection_response", {
      _token: data.token,
      _respondent_name: data.respondentName,
      _choices: data.choices,
    });
    if (error) throw new Error(error.message);
    if (!ok) throw new Error("Link inválido ou essa seleção foi encerrada.");
    return { ok: true };
  });
