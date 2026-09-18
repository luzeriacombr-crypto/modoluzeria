import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

function randomToken(len = 22): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function assertClientInOrg(supabase: any, clientId: string, orgId: string) {
  const { data } = await supabase.from("clients").select("id").eq("id", clientId).eq("org_id", orgId).maybeSingle();
  if (!data) throw new Error("Cliente não encontrado.");
}

/* ============ ADMIN: get/create + rotate ============ */

/** Link público separado do preview de feed — só Roteiros e Planejamento
 * desse cliente. Mesmo mecanismo do feed (1 token por cliente, revogável),
 * tabela própria pra rotacionar/revogar sem afetar o link do feed. */
export const getOrCreateDocsShareToken = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Apenas admins podem compartilhar roteiros/planejamento.");
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const { data: existing } = await (context.supabase as any)
      .from("client_docs_share_tokens").select("token, revoked_at")
      .eq("client_id", data.clientId).maybeSingle();
    if (existing && !existing.revoked_at) return { token: existing.token as string };
    const token = randomToken(22);
    if (existing) {
      const { error } = await (context.supabase as any)
        .from("client_docs_share_tokens")
        .update({ token, revoked_at: null, created_by: context.userId })
        .eq("client_id", data.clientId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (context.supabase as any)
        .from("client_docs_share_tokens")
        .insert({ client_id: data.clientId, token, created_by: context.userId });
      if (error) throw new Error(error.message);
    }
    return { token };
  });

export const rotateDocsShareToken = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Apenas admins podem rotacionar o link.");
    await assertClientInOrg(context.supabase, data.clientId, context.orgId);
    const token = randomToken(22);
    const { error } = await (context.supabase as any)
      .from("client_docs_share_tokens")
      .upsert({ client_id: data.clientId, token, revoked_at: null, created_by: context.userId }, { onConflict: "client_id" });
    if (error) throw new Error(error.message);
    return { token };
  });

/* ============ PUBLIC: roteiros + planejamento by token ============ */

export type PublicClientDoc = {
  id: string;
  type: "roteiro" | "planejamento";
  title: string | null;
  content: string;
};

export type PublicRoteiroClientStatus = {
  docId: string;
  roteiroTitle: string;
  clientStatus: "pending" | "aprovado" | "ajustar";
  clientNote: string | null;
};

export type PublicClientDocsPayload = {
  client: { name: string; color: string; photoUrl: string | null };
  orgName: string | null;
  orgLogoUrl: string | null;
  roteiroDocs: PublicClientDoc[];
  planejamentoDocs: PublicClientDoc[];
  roteiroClientStatuses: PublicRoteiroClientStatus[];
};

export const getPublicClientDocs = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(8).max(60) }).parse(d))
  .handler(async ({ data }): Promise<PublicClientDocsPayload | null> => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );

    const { data: clientId } = await supabase.rpc("get_client_id_for_docs_token", { _token: data.token });
    if (!clientId) return null;

    // Sem RLS pra anon em clients/orgs — mesmo motivo de getPublicFeed.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: client } = await supabaseAdmin
      .from("clients").select("name, color, photo_url, org_id").eq("id", clientId as string).maybeSingle();
    if (!client) return null;

    let photoUrl: string | null = null;
    if ((client as any).photo_url) {
      const { data: signed } = await supabaseAdmin.storage
        .from("avatars").createSignedUrl((client as any).photo_url, 60 * 60 * 24 * 365);
      photoUrl = signed?.signedUrl ?? null;
    }

    let orgName: string | null = null;
    let orgLogoUrl: string | null = null;
    const orgId = (client as any).org_id as string | null;
    if (orgId) {
      const { data: org } = await supabaseAdmin.from("orgs").select("name, logo_path").eq("id", orgId).maybeSingle();
      orgName = org?.name ?? null;
      if ((org as any)?.logo_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from("avatars").createSignedUrl((org as any).logo_path, 60 * 60 * 24 * 365);
        orgLogoUrl = signed?.signedUrl ?? null;
      }
    }

    const { data: docRows } = await supabaseAdmin
      .from("client_docs")
      .select("id, type, title, content")
      .eq("client_id", clientId as string)
      .order("created_at", { ascending: true });
    const docs: PublicClientDoc[] = (docRows ?? []).map((d: any) => ({ id: d.id, type: d.type, title: d.title, content: d.content }));
    const roteiroDocs = docs.filter((d) => d.type === "roteiro");
    const planejamentoDocs = docs.filter((d) => d.type === "planejamento");

    const roteiroDocIds = roteiroDocs.map((d) => d.id);
    let roteiroClientStatuses: PublicRoteiroClientStatus[] = [];
    if (roteiroDocIds.length > 0) {
      const { data: statusRows } = await supabaseAdmin
        .from("client_doc_roteiro_status")
        .select("doc_id, roteiro_title, client_status, client_note")
        .in("doc_id", roteiroDocIds);
      roteiroClientStatuses = (statusRows ?? []).map((r: any) => ({
        docId: r.doc_id, roteiroTitle: r.roteiro_title,
        clientStatus: r.client_status, clientNote: r.client_note,
      }));
    }

    return {
      client: {
        name: (client as any).name as string,
        color: ((client as any).color as string) ?? "rgb(var(--lz-brand-rgb))",
        photoUrl,
      },
      orgName, orgLogoUrl, roteiroDocs, planejamentoDocs, roteiroClientStatuses,
    };
  });

/* ============ PUBLIC: roteiro client approval ============ */

export const setRoteiroClientStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; docId: string; roteiroTitle: string; clientStatus: "aprovado" | "ajustar"; clientNote?: string }) =>
    z.object({
      token: z.string().min(8).max(60),
      docId: z.string().uuid(),
      roteiroTitle: z.string().trim().min(1).max(300),
      clientStatus: z.enum(["aprovado", "ajustar"]),
      clientNote: z.string().trim().max(1000).optional(),
    }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
    );
    // set_roteiro_client_status: SECURITY DEFINER function que valida
    // token (contra client_docs_share_tokens) + dono do doc antes de
    // upsertar client_status/client_note.
    const { data: row, error } = await supabase.rpc("set_roteiro_client_status", {
      _token: data.token,
      _doc_id: data.docId,
      _roteiro_title: data.roteiroTitle,
      _client_status: data.clientStatus,
      _client_note: data.clientNote ?? null,
    });
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Link inválido ou roteiro não encontrado.");
    return { ok: true };
  });
