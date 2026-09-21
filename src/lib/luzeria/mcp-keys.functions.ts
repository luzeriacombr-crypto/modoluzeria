import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

/** Gestão das chaves do MCP (Configurações → Integrações). Só administradores
 * (master/setor) da agência criam, veem e revogam chaves — sempre as da própria
 * agência. As tabelas não têm RLS de leitura: tudo passa por aqui. */
async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (!isAdmin) throw new Error("Forbidden");
}
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export type McpStatus = {
  eligible: boolean; reason: "plan" | "level" | null; levelLabel: string | null; url: string;
  keys: { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null; mine: boolean }[];
  activity: { tool: string; ok: boolean; at: string; summary: string | null }[];
};

export const getMcpStatus = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<McpStatus> => {
    await assertAdmin(context);
    const { getMcpEligibility, MCP_URL } = await import("./mcp.server");
    const el = await getMcpEligibility(context.orgId);
    const sb = await admin();
    const { data: keys } = await sb.from("mcp_api_keys").select("id, name, key_prefix, created_at, last_used_at, user_id")
      .eq("org_id", context.orgId).is("revoked_at", null).order("created_at", { ascending: false });
    const { data: act } = await sb.from("mcp_audit_log").select("tool, ok, created_at, summary")
      .eq("org_id", context.orgId).order("created_at", { ascending: false }).limit(15);
    return {
      eligible: el.ok, reason: el.reason, levelLabel: el.levelLabel, url: MCP_URL,
      keys: (keys ?? []).map((k: any) => ({ id: k.id, name: k.name, prefix: k.key_prefix, createdAt: k.created_at, lastUsedAt: k.last_used_at, mine: k.user_id === context.userId })),
      activity: (act ?? []).map((a: any) => ({ tool: a.tool, ok: a.ok, at: a.created_at, summary: a.summary })),
    };
  });

export const createMcpKey = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name: string }) => z.object({ name: z.string().trim().min(2).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { getMcpEligibility, generateKey, hashKey } = await import("./mcp.server");
    const el = await getMcpEligibility(context.orgId);
    if (!el.ok) throw new Error(el.reason === "plan" ? "O MCP não está disponível no plano da sua agência." : "O MCP é liberado a partir do nível Prata II do Programa de Níveis.");
    const sb = await admin();
    const { count } = await sb.from("mcp_api_keys").select("id", { count: "exact", head: true }).eq("org_id", context.orgId).is("revoked_at", null);
    if ((count ?? 0) >= 10) throw new Error("Limite de 10 chaves ativas. Revogue alguma antes de criar outra.");
    const { key, prefix } = generateKey();
    const { error } = await sb.from("mcp_api_keys").insert({ org_id: context.orgId, user_id: context.userId, name: data.name, key_hash: hashKey(key), key_prefix: prefix });
    if (error) throw new Error(error.message);
    // A chave completa só existe aqui: no banco fica apenas o hash.
    return { key };
  });

export const revokeMcpKey = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = await admin();
    const { error } = await sb.from("mcp_api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
