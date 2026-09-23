import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";

const PLATFORM_SUPPORT_EMAIL = "junioreisfoto2@gmail.com";

export type SupportMessage = { id: string; role: "user" | "assistant" | "admin"; content: string; createdAt: string };
export type SupportThreadStatus = "open" | "escalated" | "closed";

export const getMySupportThread = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<{ threadId: string | null; status: SupportThreadStatus | null; messages: SupportMessage[] }> => {
    const db = context.supabase as any;
    const { data: thread } = await db
      .from("support_threads")
      .select("id, status")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!thread) return { threadId: null, status: null, messages: [] };

    const { data: messages, error } = await db
      .from("support_messages")
      .select("id, role, content, created_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    return {
      threadId: thread.id,
      status: thread.status as SupportThreadStatus,
      messages: (messages ?? []).map((m: any) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.created_at })),
    };
  });

/** Prefixo interno que o modelo usa pra sinalizar "não sei responder /
 * pediram uma pessoa" — nunca chega até o usuário (removido antes de
 * gravar a mensagem). */
const ESCALATE_TAG = "[ESCALAR]";

export const sendSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { threadId?: string; text: string }) =>
    z.object({
      threadId: z.string().uuid().optional(),
      text: z.string().trim().min(1).max(2000),
    }).parse(d))
  .handler(async ({ data, context }): Promise<{ threadId: string; escalated: boolean; reply: string | null }> => {
    const db = context.supabase as any;
    let threadId: string;
    let threadStatus: SupportThreadStatus = "open";

    if (data.threadId) {
      threadId = data.threadId;
      const { data: t } = await db
        .from("support_threads").select("id, status, user_id").eq("id", threadId).maybeSingle();
      if (!t || t.user_id !== context.userId) throw new Error("Conversa não encontrada.");
      threadStatus = t.status as SupportThreadStatus;
    } else {
      const { data: t, error } = await db
        .from("support_threads")
        .insert({ org_id: context.orgId, user_id: context.userId })
        .select("id, status")
        .single();
      if (error) throw new Error(error.message);
      threadId = t.id;
      threadStatus = t.status as SupportThreadStatus;
    }

    const { error: insErr } = await db
      .from("support_messages").insert({ thread_id: threadId, role: "user", content: data.text });
    if (insErr) throw new Error(insErr.message);

    // Já escalado pra uma pessoa: só guarda a mensagem, sem chamar a IA de
    // novo — o Junior já foi avisado e responde pelo painel dele, na mesma
    // conversa (evita a IA "atropelar" a resposta dele).
    if (threadStatus === "escalated") {
      await db.from("support_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
      return { threadId, escalated: true, reply: null };
    }

    const { data: history } = await db
      .from("support_messages").select("role, content").eq("thread_id", threadId).order("created_at", { ascending: true });

    const [{ data: profile }, { data: org }] = await Promise.all([
      db.from("profiles").select("name").eq("id", context.userId).maybeSingle(),
      db.from("orgs").select("name").eq("id", context.orgId).maybeSingle(),
    ]);

    const { buildHelpKnowledgeText } = await import("./help-content");
    const { getAnthropicClient, SUPPORT_MODEL } = await import("./ai-client.server");
    const anthropic = getAnthropicClient();

    const systemPrompt = [
      `Você é o "Chat do Modo Criador", o canal de suporte dentro do próprio app Modo Criador (plataforma que agências de social media usam pra organizar o conteúdo dos clientes delas).`,
      `Responda sempre em português do Brasil, com um tom natural, cordial e direto — como alguém de suporte experiente, nunca robótico ou genérico. Nunca use travessão.`,
      `Nunca se apresente como inteligência artificial, IA, "assistente virtual" ou robô por conta própria. Se perguntarem diretamente se você é um robô/uma IA, não negue nem minta — responda de forma simples e natural, algo como "sou o chat de suporte do Modo Criador", e ofereça chamar o Junior (quem toca o produto) se a pessoa preferir.`,
      `Use só as informações reais abaixo pra responder. Não invente funcionalidade que não está descrita aqui.`,
      `Se perguntarem sobre segurança, privacidade, proteção de dados, ou o que acontece se o site sair do ar/tiver instabilidade, responda com muita confiança e respaldo — não seja vago nem genérico, e nunca deixe a pessoa com a sensação de que os dados dela podem sumir. Use os fatos reais da base de conhecimento abaixo (aprovação oficial do Google, autorização como desenvolvedor Meta com API oficial do Instagram/Facebook, política de privacidade alinhada à LGPD, backup diário automático) pra mostrar que é um site sério e seguro de verdade. Nunca cite o nome de nenhum fornecedor/provedor de infraestrutura (hospedagem, banco de dados, backup) — só confirme que a proteção existe.`,
      `Formatação: destaque em **negrito** (dois asteriscos) só a informação mais importante da resposta — o nome de um botão/tela, um aviso, o passo decisivo — sem exagerar, no máximo 1-2 trechos por resposta. Quando a resposta apontar pra um lugar do app que está na lista de LINKS REAIS DO APP abaixo, sempre ofereça o link nesse formato: [texto do botão](caminho) — por exemplo [Configurações → Integrações](/configuracoes?tab=integrations). Nunca invente um caminho fora dessa lista; se o lugar certo não estiver nela, só explique em texto, sem link.`,
      ``,
      buildHelpKnowledgeText(),
      ``,
      `Excluir a conta: quem é administrador master da agência pode excluir sozinho em **Configurações → Plano e Cobrança**, na seção **Excluir conta** (no fim da página). Isso apaga tudo e cancela a assinatura, e não dá pra desfazer; a pessoa precisa digitar o nome da agência pra confirmar. Se estiver no teste grátis, não precisa excluir: o teste acaba sozinho e não há cobrança. Se quem perguntou não for master, precisa pedir a quem é master. Explique isso diretamente, sem chamar o Junior, a menos que a pessoa tenha algum problema ao excluir.`,
      ``,
      `Quem está perguntando agora: ${profile?.name ?? "um usuário"}, da agência ${org?.name ?? "—"}.`,
      ``,
      `Antes de responder, releia com atenção TODA a base de conhecimento acima (perguntas frequentes, tutoriais e os parágrafos avulsos) procurando qualquer trecho relacionado à pergunta, mesmo que indireto ou espalhado em mais de um item — muita coisa só fica clara combinando 2-3 informações diferentes (ex.: "como o cliente aprova" + "onde fica o link" + "o que acontece depois que ele aprova"). Reformule a pergunta da pessoa de outras formas na sua cabeça antes de concluir que não está coberta — perguntas de suporte raramente usam os mesmos termos exatos da base.`,
      `NÃO escale só porque a pergunta não é sobre uma tela específica ou porque exige juntar informação de mais de um lugar — isso é o trabalho normal do suporte, não motivo pra chamar o Junior. Only escale de verdade quando: (a) depende de dado da conta específica dessa pessoa que você não tem acesso (cobrança, um erro técnico que precisa investigar no banco, um valor cobrado errado), (b) é uma decisão de negócio/exceção (reembolso, prazo especial, desconto), (c) a pessoa pede explicitamente pra falar com uma pessoa/o Junior, ou (d) você releu tudo com cuidado e genuinamente não há informação suficiente pra responder com segurança. Uma dúvida de "como uso a função X" quase sempre está coberta — vale reler antes de desistir.`,
      `Quando escalar, comece a resposta com a tag ${ESCALATE_TAG} seguida de uma frase curta e natural avisando que você vai chamar o Junior pra continuar ali mesmo, sem prometer um prazo específico.`,
    ].join("\n");

    // Antes, um erro aqui (rate limit, timeout, resposta malformada da IA)
    // deixava a mensagem da pessoa salva sem NENHUMA resposta e sem
    // escalar — ela ficava esperando pra sempre e ninguém era avisado
    // (achado revisando conversas reais: 3 perguntas, incluindo uma sobre
    // disponibilidade do site, sumiram assim). Agora qualquer falha vira
    // uma resposta amigável + escalação, igual ao caminho normal de "não
    // sei responder".
    let replyText: string;
    let escalate: boolean;
    try {
      const response = await anthropic.messages.create({
        model: SUPPORT_MODEL,
        max_tokens: 4096,
        // Pensamento estendido: o modelo relê a base de conhecimento e
        // considera a pergunta com mais calma antes de responder, em vez de
        // ir direto pro "não sei" na primeira leitura — isso reduziu bastante
        // as escaladas desnecessárias vistas nos chats reais das agências.
        // claude-sonnet-5 usa o formato novo de thinking ("adaptive" +
        // output_config.effort) — o antigo ("enabled" + budget_tokens) dá 400
        // nesse modelo (bug real visto em produção, chat parou de responder).
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        system: systemPrompt,
        messages: (history ?? []).map((m: any) => ({
          role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: m.content as string,
        })),
      });

      const textBlock = response.content.find((b) => b.type === "text");
      replyText = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
      if (!replyText) {
        replyText = "Desculpa, não consegui responder agora. Já chamei o Junior pra te ajudar por aqui.";
      }

      escalate = replyText.startsWith(ESCALATE_TAG);
      if (escalate) {
        replyText = replyText.slice(ESCALATE_TAG.length).trim();
      }
    } catch (aiError) {
      console.error("[sendSupportMessage] falha ao chamar a IA:", aiError);
      replyText = "Desculpa, tive um problema técnico agora e não consegui responder. Já chamei o Junior pra continuar por aqui.";
      escalate = true;
    }

    // A RLS de support_messages só deixa a própria pessoa inserir role='user'
    // (de propósito, pra ninguém forjar uma mensagem 'assistant'/'admin' via
    // API direta) — a resposta da IA precisa do client admin pra gravar.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: replyErr } = await (supabaseAdmin as any)
      .from("support_messages").insert({ thread_id: threadId, role: "assistant", content: replyText });
    if (replyErr) throw new Error(replyErr.message);

    // O UPDATE de status pra 'escalated' dispara o trigger
    // notify_support_chat_escalated (avisa todo master da Luzeria).
    await db
      .from("support_threads")
      .update({ status: escalate ? "escalated" : "open", updated_at: new Date().toISOString() })
      .eq("id", threadId);

    if (escalate) {
      try {
        const { sendEmail } = await import("./resend.server");
        await sendEmail({
          to: PLATFORM_SUPPORT_EMAIL,
          subject: `Chat do Modo Criador — ${org?.name ?? "agência"} precisa de ajuda`,
          html: `<p><strong>${profile?.name ?? "Alguém"}</strong> da agência <strong>${org?.name ?? "—"}</strong> perguntou algo no Chat do Modo Criador que não deu pra responder sozinho.</p><p>Entre em Central de Ajuda → Chats pra responder — sua resposta aparece direto na conversa da pessoa.</p>`,
        });
      } catch (e) {
        console.error("[sendSupportMessage] falha ao mandar e-mail de escalonamento:", e);
      }
    }

    return { threadId, escalated: escalate, reply: replyText };
  });

// ============ Admin (só masters da Luzeria) ============

async function assertPlatformAdmin(supabase: any, orgId: string, userId: string) {
  if (orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (!isMaster) throw new Error("Forbidden");
}

export type SupportThreadSummary = {
  id: string; status: SupportThreadStatus; createdAt: string; updatedAt: string;
  orgName: string; userName: string; lastMessage: string | null; lastMessageRole: string | null;
};

export const listOpenSupportThreads = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<SupportThreadSummary[]> => {
    await assertPlatformAdmin(context.supabase, context.orgId, context.userId);
    const db = context.supabase as any;
    const { data, error } = await db.rpc("platform_list_support_threads");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at,
      orgName: r.org_name ?? "—", userName: r.user_name ?? "—",
      lastMessage: r.last_message, lastMessageRole: r.last_message_role,
    }));
  });

export const getSupportThreadMessages = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { threadId: string }) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<SupportMessage[]> => {
    await assertPlatformAdmin(context.supabase, context.orgId, context.userId);
    const db = context.supabase as any;
    const { data: rows, error } = await db.rpc("platform_get_support_messages", { _thread_id: data.threadId });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({ id: r.id, role: r.role, content: r.content, createdAt: r.created_at }));
  });

export const replyToSupportThread = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { threadId: string; text: string }) =>
    z.object({ threadId: z.string().uuid(), text: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.orgId, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: thread } = await admin
      .from("support_threads").select("id, user_id").eq("id", data.threadId).maybeSingle();
    if (!thread) throw new Error("Conversa não encontrada.");

    // Reply e mudança de status usam o client admin — quem responde (o
    // Junior) não é o dono da thread, então a RLS normal não libera.
    const { error: insErr } = await admin
      .from("support_messages").insert({ thread_id: data.threadId, role: "admin", content: data.text });
    if (insErr) throw new Error(insErr.message);

    await admin
      .from("support_threads").update({ updated_at: new Date().toISOString() }).eq("id", data.threadId);

    const { error: notifErr } = await admin.from("notifications").insert({
      user_id: thread.user_id,
      type: "support_chat_reply",
      message: "Você tem uma resposta nova no Chat do Modo Criador.",
    });
    if (notifErr) console.error("[replyToSupportThread] falha ao notificar usuário:", notifErr);

    return { ok: true };
  });

export const closeSupportThread = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { threadId: string }) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.supabase, context.orgId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("support_threads").update({ status: "closed" }).eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type SupportChatTopic = { topic: string; count: number; examples: string[] };

/** Platform-admin only: pega as últimas perguntas reais já feitas no chat
 * de suporte (inclusive de conversas já fechadas — o painel de "Chats" só
 * mostra as abertas) e pede pra IA agrupar em temas recorrentes, pra Junior
 * ver de uma vez só sobre o que as agências mais perguntam, sem precisar
 * ler conversa por conversa. Rodado sob demanda (custa uma chamada de IA),
 * nunca automático. */
export const getSupportChatTopics = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<{ totalQuestions: number; topics: SupportChatTopic[] }> => {
    await assertPlatformAdmin(context.supabase, context.orgId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("support_messages")
      .select("content, created_at")
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);

    const questions = (rows ?? []).map((r: any) => r.content as string);
    if (questions.length === 0) {
      return { totalQuestions: 0, topics: [] };
    }

    const { getAnthropicClient, SUPPORT_MODEL } = await import("./ai-client.server");
    const anthropic = getAnthropicClient();

    const response = await anthropic.messages.create({
      model: SUPPORT_MODEL,
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: [
        "Você recebe uma lista de perguntas reais que usuários de um SaaS brasileiro (Modo Criador, plataforma pra agências de social media) fizeram num chat de suporte.",
        "Agrupe essas perguntas em temas recorrentes — junte perguntas parecidas mesmo que escritas de formas diferentes.",
        "Responda só com JSON puro, sem markdown, sem texto antes ou depois, no formato exato:",
        `{"topics": [{"topic": "nome curto do tema em português", "count": N, "examples": ["pergunta original 1", "pergunta original 2"]}]}`,
        "Ordene do tema mais frequente pro menos frequente. No máximo 15 temas. Cada tema com no máximo 3 exemplos, copiados literalmente da lista (nunca invente ou parafraseie os exemplos).",
      ].join("\n"),
      messages: [{ role: "user", content: questions.map((q: string, i: number) => `${i + 1}. ${q}`).join("\n") }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
    let topics: SupportChatTopic[] = [];
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      topics = Array.isArray(parsed.topics) ? parsed.topics : [];
    } catch {
      throw new Error("Não consegui organizar os temas agora. Tenta de novo em instantes.");
    }

    return { totalQuestions: questions.length, topics };
  });
