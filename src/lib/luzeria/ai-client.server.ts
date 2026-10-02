// Server-only Anthropic client. Never imported at module scope from a
// .functions.ts or route file — always reached via dynamic import from
// inside a handler, so ANTHROPIC_API_KEY never ends up in the client bundle.
import Anthropic from "@anthropic-ai/sdk";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

export const IMPORT_MODEL = "claude-sonnet-5";

// Constante irmã da acima — mesmo modelo hoje, mas nome próprio pra não
// acoplar a feature de planejamento a mudanças futuras da importação.
export const PLANNING_MODEL = "claude-sonnet-5";

// Idem, pro Chat do Modo Criador (suporte).
export const SUPPORT_MODEL = "claude-sonnet-5";

/* ---------- "Traga sua IA": chave própria da organização ---------- */

// Criptografia da chave em repouso. A chave de cifra deriva do segredo de
// serviço do servidor: se ele for trocado, as chaves salvas deixam de abrir
// e a pessoa só precisa colar a dela de novo.
function cipherKey(): Buffer {
  return createHash("sha256").update(`org-ai-key:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`).digest();
}
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cipherKey(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}
function decryptSecret(blob: string): string | null {
  try {
    const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64"));
    const d = createDecipheriv("aes-256-gcm", cipherKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

async function readOrgKey(orgId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).from("org_ai_credentials").select("api_key").eq("org_id", orgId).maybeSingle();
  return data?.api_key ? decryptSecret(data.api_key) : null;
}

export async function hasOwnAiKey(orgId: string): Promise<boolean> {
  return !!(await readOrgKey(orgId));
}

/** Traduz o erro da Anthropic em algo que a pessoa entende e resolve. */
export function explainAiError(e: any): string {
  const status = e?.status as number | undefined;
  const msg = String(e?.message ?? "");
  if (status === 401 || /invalid x-api-key|authentication/i.test(msg)) return "Sua chave de IA foi recusada. Confira em Configurações → Integrações → Inteligência artificial e cole a chave de novo.";
  if (status === 403) return "Sua conta de IA não tem permissão pra isso. Confira a chave em Configurações → Integrações → Inteligência artificial.";
  if (/credit balance|billing|payment/i.test(msg) || status === 402) return "A conta de IA ligada à sua chave está sem saldo. Adicione créditos no painel do provedor e tente de novo.";
  if (status === 429) return "A sua conta de IA atingiu o limite de uso por agora. Espere um minuto e tente de novo.";
  return msg || "Falha ao falar com a IA.";
}

/** Cliente de IA da organização: a chave dela, quando tem (sem limite de
 * clientes, o custo é da conta dela); senão o da plataforma (só vale dentro
 * dos clientes grátis — quem decide isso é ai-access.server.ts). */
export async function getAiClientForOrg(orgId: string): Promise<{ client: Anthropic; own: boolean }> {
  const key = await readOrgKey(orgId);
  if (!key) return { client: getAnthropicClient(), own: false };
  const c = new Anthropic({ apiKey: key, maxRetries: 1 });
  const orig = c.messages.create.bind(c.messages) as (...a: any[]) => Promise<any>;
  (c.messages as any).create = async (...a: any[]) => {
    try { return await orig(...a); } catch (e: any) { throw new Error(explainAiError(e)); }
  };
  return { client: c, own: true };
}

/** Confere a chave sem gastar nada (listar modelos é gratuito). */
export async function verifyAnthropicKey(key: string): Promise<void> {
  try {
    await new Anthropic({ apiKey: key, maxRetries: 0 }).models.list({ limit: 1 });
  } catch (e: any) {
    throw new Error(explainAiError(e));
  }
}
