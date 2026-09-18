// Server-only Anthropic client. Never imported at module scope from a
// .functions.ts or route file — always reached via dynamic import from
// inside a handler, so ANTHROPIC_API_KEY never ends up in the client bundle.
import Anthropic from "@anthropic-ai/sdk";

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
