// "Traga sua IA": a organização cola a chave de API dela. Só o gestor mexe.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

export type AiConnection = {
  connected: boolean;
  provider: "anthropic";
  keyLast4: string | null;
  verifiedAt: string | null;
  /** Clientes/marcas que já usam as vagas grátis. */
  freeUsed: number;
  freeLimit: number;
  /** A casa (Luzeria) não tem limite. */
  unlimited: boolean;
};

async function assertMaster(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_master", { _user_id: context.userId });
  if (!data) throw new Error("Só o gestor pode conectar a IA.");
}

export const getAiConnection = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<AiConnection> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db: any = supabaseAdmin;
    const { AI_FREE_CLIENTS } = await import("./ai-access.server");
    const { LUZERIA_ORG_ID } = await import("./api.functions");
    const [{ data: cred }, { count }] = await Promise.all([
      db.from("org_ai_credentials").select("key_last4, verified_at").eq("org_id", context.orgId).maybeSingle(),
      db.from("clients").select("id", { count: "exact", head: true }).eq("org_id", context.orgId).eq("ai_planning_enabled", true),
    ]);
    return {
      connected: !!cred, provider: "anthropic", keyLast4: cred?.key_last4 ?? null, verifiedAt: cred?.verified_at ?? null,
      freeUsed: count ?? 0, freeLimit: AI_FREE_CLIENTS, unlimited: context.orgId === LUZERIA_ORG_ID,
    };
  });

export const saveAiKey = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { apiKey: string }) =>
    z.object({ apiKey: z.string().trim().min(20, "Essa chave parece curta demais.").max(300).regex(/^sk-ant-[A-Za-z0-9_\-]+$/, "A chave da Anthropic começa com sk-ant-. Confira se copiou inteira.") }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    const { verifyAnthropicKey, encryptSecret } = await import("./ai-client.server");
    await verifyAnthropicKey(data.apiKey);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("org_ai_credentials").upsert({
      org_id: context.orgId, provider: "anthropic", api_key: encryptSecret(data.apiKey), key_last4: data.apiKey.slice(-4),
      verified_at: new Date().toISOString(), created_by: context.userId, updated_at: new Date().toISOString(),
    }, { onConflict: "org_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeAiKey = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    await assertMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("org_ai_credentials").delete().eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
