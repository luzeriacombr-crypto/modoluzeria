import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";
import { parseDriveId, listDriveFolderImages, withDriveOrg } from "./drive.functions";

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
  status: "aberta" | "finalizada";
  token: string;
  deadline: string | null;
  createdAt: string;
  choiceCount: number;
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
      .select("id, title, status, token, deadline, created_at, photo_selection_choices(count)")
      .eq("photo_client_id", data.photoClientId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id as string,
      title: r.title as string,
      status: r.status as "aberta" | "finalizada",
      token: r.token as string,
      deadline: r.deadline as string | null,
      createdAt: r.created_at as string,
      choiceCount: r.photo_selection_choices?.[0]?.count ?? 0,
    })) as PhotoSelectionSummary[];
  });

export type PhotoSelectionDetail = PhotoSelectionSummary & {
  photoClientId: string;
  driveFolderLink: string;
  choices: Array<{ driveFileId: string; fileName: string }>;
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

    const { data: choiceRows, error: choiceErr } = await context.supabase
      .from("photo_selection_choices")
      .select("drive_file_id, file_name")
      .eq("selection_id", data.id)
      .order("file_name");
    if (choiceErr) throw new Error(choiceErr.message);

    const choices = (choiceRows ?? []).map((c: any) => ({
      driveFileId: c.drive_file_id as string,
      fileName: c.file_name as string,
    }));

    return {
      id: row.id as string,
      photoClientId: row.photo_client_id as string,
      title: row.title as string,
      status: row.status as "aberta" | "finalizada",
      token: row.token as string,
      deadline: row.deadline as string | null,
      driveFolderLink: row.drive_folder_link as string,
      createdAt: row.created_at as string,
      choices,
      choiceCount: choices.length,
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

/* ============ PUBLIC (sem login, por token) ============ */

export type PublicPhotoSelection = {
  selectionId: string;
  title: string;
  status: "aberta" | "finalizada";
  clientName: string;
  deadline: string | null;
  photos: Array<{ id: string; name: string; thumbnailUrl: string | null }>;
  selectedFileIds: string[];
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

    let photos: Array<{ id: string; name: string; thumbnailUrl: string | null }> = [];
    try {
      photos = await withDriveOrg(r.orgId as string, () => listDriveFolderImages(r.driveFolderId as string));
    } catch (e) {
      console.error("[getPublicPhotoSelection] Drive listing failed:", e);
    }

    return {
      selectionId: r.selectionId as string,
      title: r.title as string,
      status: r.status as "aberta" | "finalizada",
      clientName: (r.clientName as string) ?? "",
      deadline: (r.deadline as string) ?? null,
      photos,
      selectedFileIds: ((r.choices ?? []) as any[]).map((c) => c.driveFileId as string),
    };
  });

export const submitPublicPhotoSelection = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; choices: Array<{ driveFileId: string; fileName: string }> }) =>
    z.object({
      token: z.string().min(8).max(60),
      choices: z.array(z.object({
        driveFileId: z.string().min(1).max(200),
        fileName: z.string().min(1).max(255),
      })).max(2000),
    }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );
    const { data: ok, error } = await supabase.rpc("submit_photo_selection", {
      _token: data.token,
      _choices: data.choices,
    });
    if (error) throw new Error(error.message);
    if (!ok) throw new Error("Link inválido ou seleção já finalizada.");
    return { ok: true };
  });

export const finalizePublicPhotoSelection = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(8).max(60) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );
    const { data: ok, error } = await supabase.rpc("finalize_photo_selection", { _token: data.token });
    if (error) throw new Error(error.message);
    if (!ok) throw new Error("Link inválido.");
    return { ok: true };
  });
