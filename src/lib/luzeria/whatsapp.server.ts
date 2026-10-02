// Cliente server-only da API oficial do WhatsApp (Cloud API da Meta), usado
// só internamente pelo Junior (boas-vindas, alertas de suporte, disparo em
// massa). Mesmo cuidado de resend.server.ts: nunca importado no topo de um
// .functions.ts ou rota — sempre via import dinâmico dentro do handler, pra
// o token nunca ir pro bundle do navegador.
//
// Enquanto as variáveis de ambiente não estiverem na Vercel, tudo aqui vira
// no-op silencioso (whatsappConfigured() = false) — dá pra subir o código
// antes de terminar a configuração no painel da Meta.

const GRAPH = "https://graph.facebook.com/v24.0";
const LANG = "pt_BR";

/** Nomes dos modelos que precisam estar aprovados no WhatsApp Manager. */
export const WA_TEMPLATES = {
  welcome: "boas_vindas_modo_criador",
  supportAlert: "alerta_suporte",
  supportReply: "resposta_suporte",
} as const;

/** Palavras que tiram / devolvem o número da lista de envio. "Parar
 * promoções" é o botão automático que a Meta coloca nos modelos de marketing. */
const OPT_OUT_WORDS = ["sair", "parar", "stop", "cancelar", "parar promoções", "parar promocoes"];
const OPT_IN_WORDS = ["voltar"];

export function whatsappConfigured() {
  return !!(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Número só com dígitos e com o 55 na frente (mesmo formato de orgs.whatsapp). */
export function toWaDigits(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  return d.length <= 11 ? `55${d}` : d;
}

/** Chave pra comparar números: o WhatsApp às vezes devolve celular
 * brasileiro sem o 9º dígito (conta antiga), então 5599981234567 e
 * 559981234567 precisam bater como o mesmo número. */
export function phoneKey(phone: string | null | undefined): string {
  const d = toWaDigits(phone) ?? "";
  if (d.startsWith("55") && d.length === 13 && d[4] === "9") return d.slice(0, 4) + d.slice(5);
  return d;
}

export function isAdminPhone(phone: string) {
  const admin = process.env.WHATSAPP_ADMIN_PHONE;
  return !!admin && phoneKey(admin) === phoneKey(phone);
}

/** Variável de modelo não aceita quebra de linha, tab nem 4+ espaços
 * seguidos (erro 132018 da Meta) — junta tudo numa linha só. */
export function templateParam(text: string, max = 900) {
  const clean = text.replace(/\s*\n+\s*/g, " · ").replace(/\s{2,}/g, " ").replace(/^ · | · $/g, "").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean || "-";
}

export function isOptOutText(text: string) {
  return OPT_OUT_WORDS.includes(text.trim().toLowerCase());
}
export function isOptInText(text: string) {
  return OPT_IN_WORDS.includes(text.trim().toLowerCase());
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export async function isOptedOut(phone: string) {
  const db = await admin();
  const { data } = await db.from("whatsapp_opt_outs").select("phone_key").eq("phone_key", phoneKey(phone)).maybeSingle();
  return !!data;
}

export type WaSendResult = { ok: true; wamid: string } | { ok: false; error: string; code?: number };

type LogExtra = {
  kind: string;
  orgId?: string | null;
  campaignId?: string | null;
  supportThreadId?: string | null;
  replyToPhone?: string | null;
  replyLabel?: string | null;
};

async function postMessage(payload: Record<string, unknown>): Promise<WaSendResult> {
  const res = await fetch(`${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body?.messages?.[0]?.id) {
    const err = body?.error;
    return { ok: false, error: err?.error_data?.details ?? err?.message ?? `WhatsApp retornou ${res.status}`, code: err?.code };
  }
  return { ok: true, wamid: body.messages[0].id };
}

async function logOutgoing(to: string, result: WaSendResult, body: string, templateName: string | null, extra: LogExtra) {
  const db = await admin();
  const { error } = await db.from("whatsapp_messages").insert({
    direction: "out",
    phone: to,
    kind: extra.kind,
    template_name: templateName,
    body,
    wamid: result.ok ? result.wamid : null,
    status: result.ok ? "sent" : "failed",
    error: result.ok ? null : result.error,
    org_id: extra.orgId ?? null,
    campaign_id: extra.campaignId ?? null,
    support_thread_id: extra.supportThreadId ?? null,
    reply_to_phone: extra.replyToPhone ?? null,
    reply_label: extra.replyLabel ?? null,
  });
  if (error) console.error("[whatsapp] falha ao registrar mensagem:", error.message);
}

/** Envia um modelo aprovado. `params` preenche {{1}}, {{2}}… do corpo, na ordem. */
export async function sendTemplate(to: string, template: string, params: string[], extra: LogExtra): Promise<WaSendResult> {
  if (!whatsappConfigured()) return { ok: false, error: "WhatsApp não configurado." };
  const digits = toWaDigits(to);
  if (!digits) return { ok: false, error: "Número inválido." };
  const safeParams = params.map((p) => templateParam(p));
  const result = await postMessage({
    to: digits,
    type: "template",
    template: {
      name: template,
      language: { code: LANG },
      ...(safeParams.length > 0 && {
        components: [{ type: "body", parameters: safeParams.map((text) => ({ type: "text", text })) }],
      }),
    },
  });
  await logOutgoing(digits, result, safeParams.join(" | "), template, extra);
  return result;
}

/** Texto livre — só funciona dentro da janela de 24h desde a última
 * mensagem que a pessoa mandou pro número do Modo Criador (fora dela a Meta
 * devolve o erro 131047 e é preciso usar um modelo). */
export async function sendText(to: string, text: string, extra: LogExtra & { contextWamid?: string }): Promise<WaSendResult> {
  if (!whatsappConfigured()) return { ok: false, error: "WhatsApp não configurado." };
  const digits = toWaDigits(to);
  if (!digits) return { ok: false, error: "Número inválido." };
  const result = await postMessage({
    to: digits,
    type: "text",
    text: { body: text.slice(0, 4000) },
    ...(extra.contextWamid && { context: { message_id: extra.contextWamid } }),
  });
  await logOutgoing(digits, result, text, null, extra);
  return result;
}

/** Manda um alerta pro WhatsApp pessoal do Junior. Ele responde arrastando
 * a mensagem pro lado e o webhook usa o wamid desse alerta pra saber pra
 * onde a resposta vai (conversa de suporte do app ou número de WhatsApp). */
export async function alertAdmin(params: {
  label: string;
  message: string;
  orgId?: string | null;
  supportThreadId?: string | null;
  replyToPhone?: string | null;
}) {
  const adminPhone = process.env.WHATSAPP_ADMIN_PHONE;
  if (!whatsappConfigured() || !adminPhone) return;
  const result = await sendTemplate(adminPhone, WA_TEMPLATES.supportAlert, [params.label, params.message], {
    kind: "support_alert",
    orgId: params.orgId,
    supportThreadId: params.supportThreadId,
    replyToPhone: params.replyToPhone,
    replyLabel: params.label,
  });
  if (!result.ok) console.error("[whatsapp] falha ao alertar o Junior:", result.error);
}

export type WaPhoneHealth = { quality: "GREEN" | "YELLOW" | "RED" | "UNKNOWN"; limitTier: string | null };

/** Nota de qualidade do número (cai quando muita gente bloqueia/denuncia) e
 * o limite de conversas iniciadas por dia que a Meta liberou. */
export async function getPhoneHealth(): Promise<WaPhoneHealth> {
  if (!whatsappConfigured()) return { quality: "UNKNOWN", limitTier: null };
  const res = await fetch(
    `${GRAPH}/${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=quality_rating,messaging_limit_tier`,
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } },
  );
  const body = await res.json().catch(() => ({}));
  const q = String(body?.quality_rating ?? "").toUpperCase();
  return {
    quality: q === "GREEN" || q === "YELLOW" || q === "RED" ? q : "UNKNOWN",
    limitTier: body?.messaging_limit_tier ?? null,
  };
}

export type WaTemplate ={ name: string; category: string; body: string; variableCount: number };

/** Modelos já aprovados na conta do WhatsApp Business. */
export async function listApprovedTemplates(): Promise<WaTemplate[]> {
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!whatsappConfigured() || !wabaId) return [];
  const res = await fetch(
    `${GRAPH}/${wabaId}/message_templates?status=APPROVED&fields=name,category,language,components&limit=100`,
    { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message ?? `WhatsApp retornou ${res.status}`);
  return (body.data ?? [])
    .filter((t: any) => t.language === LANG)
    .map((t: any) => {
      const text: string = t.components?.find((c: any) => c.type === "BODY")?.text ?? "";
      const vars = new Set(Array.from(text.matchAll(/\{\{(\d+)\}\}/g)).map((m) => m[1]));
      return { name: t.name, category: t.category, body: text, variableCount: vars.size };
    });
}
