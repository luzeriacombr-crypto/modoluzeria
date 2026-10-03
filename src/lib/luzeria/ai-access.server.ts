// Quem pode usar a IA do app e com qual chave.
//  - Com chave própria (Configurações → Integrações → IA): sempre, qualquer
//    cliente/marca, o custo é da conta da pessoa.
//  - Sem chave: só nos 2 primeiros clientes/marcas (teste grátis, custo nosso).
//  - Luzeria (a casa): usa a chave da plataforma sem limite.
import { getAiClientForOrg } from "./ai-client.server";

export const AI_FREE_CLIENTS = 2;
export const NEEDS_OWN_AI_MESSAGE =
  "Pra usar a IA além dos 2 primeiros clientes (ou marcas), conecte a sua em Configurações → Integrações → Inteligência artificial. Sem isso, o Modo Criador continua funcionando normalmente, só sem a IA.";

async function isLuzeriaOrg(orgId: string): Promise<boolean> {
  const { LUZERIA_ORG_ID } = await import("./api.functions");
  return orgId === LUZERIA_ORG_ID;
}

/** Libera a IA pra um cliente/marca: chave própria, ou uma das 2 vagas grátis
 * (ocupa a vaga na primeira vez e a mantém). Sem cliente (recurso da
 * organização toda): só com chave própria. */
export async function resolveAi(orgId: string, clientId?: string | null) {
  const ai = await getAiClientForOrg(orgId);
  if (ai.own || (await isLuzeriaOrg(orgId))) return ai;
  if (!clientId) throw new Error(NEEDS_OWN_AI_MESSAGE);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db: any = supabaseAdmin;
  const { data: c } = await db.from("clients").select("ai_planning_enabled").eq("id", clientId).eq("org_id", orgId).maybeSingle();
  if (!c) throw new Error("Cliente não encontrado.");
  if (c.ai_planning_enabled) return ai;
  const { count } = await db.from("clients").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("ai_planning_enabled", true);
  if ((count ?? 0) >= AI_FREE_CLIENTS) throw new Error(NEEDS_OWN_AI_MESSAGE);
  await db.from("clients").update({ ai_planning_enabled: true }).eq("id", clientId);
  return ai;
}

/** Recurso da organização (sem cliente) que exige a IA própria. */
export async function requireOwnAi(orgId: string) {
  return resolveAi(orgId, null);
}

/** Só consulta (não ocupa vaga): como a IA está liberada pra esse cliente. */
export async function peekAi(orgId: string, clientId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db: any = supabaseAdmin;
  const { data: cred } = await db.from("org_ai_credentials").select("key_last4").eq("org_id", orgId).maybeSingle();
  if (cred) return { own: true, keyLast4: String(cred.key_last4 ?? ""), allowed: true, freeUsed: 0, freeLimit: AI_FREE_CLIENTS, house: false };
  if (await isLuzeriaOrg(orgId)) return { own: false, keyLast4: "", allowed: true, freeUsed: 0, freeLimit: AI_FREE_CLIENTS, house: true };
  const { data: c } = await db.from("clients").select("ai_planning_enabled").eq("id", clientId).eq("org_id", orgId).maybeSingle();
  const { count } = await db.from("clients").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("ai_planning_enabled", true);
  const used = count ?? 0;
  return { own: false, keyLast4: "", allowed: !!c?.ai_planning_enabled || used < AI_FREE_CLIENTS, freeUsed: used, freeLimit: AI_FREE_CLIENTS, house: false };
}
