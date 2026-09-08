import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

/** Mesmo gerador de token de photo-selection.functions.ts/feed-share.functions.ts. */
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
  if (!ok) throw new Error("Apenas administradores podem gerenciar contratos.");
}

export type ContractRequest = {
  id: string;
  token: string;
  status: "aguardando" | "assinado" | "cancelado";
  contractText: string;
  signerName: string | null;
  signerCpf: string | null;
  signatureDataUrl: string | null;
  signedAt: string | null;
  createdAt: string;
};

export const listContractRequests = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ContractRequest[]> => {
    // `client_contract_requests` é tabela nova — cast até os tipos do
    // Supabase serem regenerados depois da migração rodar.
    const db = context.supabase as any;
    const { data: rows, error } = await db
      .from("client_contract_requests")
      .select("id, token, status, contract_text, signer_name, signer_cpf, signature_data_url, signed_at, created_at")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id, token: r.token, status: r.status, contractText: r.contract_text,
      signerName: r.signer_name, signerCpf: r.signer_cpf, signatureDataUrl: r.signature_data_url,
      signedAt: r.signed_at, createdAt: r.created_at,
    }));
  });

export const createContractRequest = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; contractText: string }) =>
    z.object({
      clientId: z.string().uuid(),
      contractText: z.string().trim().min(1).max(20000),
    }).parse(d))
  .handler(async ({ data, context }): Promise<{ token: string }> => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase as any;
    const token = randomToken();
    const { error } = await db.from("client_contract_requests").insert({
      org_id: context.orgId,
      client_id: data.clientId,
      token,
      contract_text: data.contractText,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { token };
  });

export const cancelContractRequest = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase as any;
    const { error } = await db.from("client_contract_requests").update({ status: "cancelado" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type PublicContractRequest = {
  contractText: string;
  status: "aguardando" | "assinado" | "cancelado";
  signerName: string | null;
  signedAt: string | null;
  clientName: string;
  orgName: string;
  orgLogoUrl: string | null;
};

/** GET pública, sem sessão — mesmo padrão de getPublicPhotoSelection:
 * cliente anon + RPC SECURITY DEFINER, que valida o token por dentro. */
export const getPublicContractRequest = createServerFn({ method: "GET" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(8).max(60) }).parse(d))
  .handler(async ({ data }): Promise<PublicContractRequest | null> => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
    const { data: info, error } = await supabase.rpc("get_public_contract_request", { _token: data.token });
    if (error || !info) return null;
    const r = info as any;

    let orgLogoUrl: string | null = null;
    if (r.orgLogoPath) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: signed } = await supabaseAdmin.storage
          .from("avatars").createSignedUrl(r.orgLogoPath as string, 60 * 60 * 24);
        orgLogoUrl = signed?.signedUrl ?? null;
      } catch { /* branding é só cosmético, segue sem logo se falhar */ }
    }

    return {
      contractText: r.contractText,
      status: r.status,
      signerName: r.signerName ?? null,
      signedAt: r.signedAt ?? null,
      clientName: r.clientName,
      orgName: r.orgName,
      orgLogoUrl,
    };
  });

/** POST pública, sem sessão — mesmo padrão de submitPhotoSelectionResponse. */
export const signContractRequest = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; signerName: string; signerCpf: string; signatureDataUrl: string }) =>
    z.object({
      token: z.string().min(8).max(60),
      signerName: z.string().trim().min(1).max(120),
      signerCpf: z.string().trim().min(1).max(20),
      signatureDataUrl: z.string().min(1),
    }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
    const { data: ok, error } = await supabase.rpc("sign_client_contract_request", {
      _token: data.token,
      _signer_name: data.signerName,
      _signer_cpf: data.signerCpf,
      _signature_data_url: data.signatureDataUrl,
    });
    if (error || !ok) throw new Error("Não foi possível assinar — o link pode ter expirado ou já foi usado.");
    return { ok: true };
  });
