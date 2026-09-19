import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PLATFORM_SUPPORT_EMAIL = "junioreisfoto2@gmail.com";
const WHATSAPP_LINK = "https://wa.me/5599991135486?text=Oi!%20Fiquei%20com%20uma%20d%C3%BAvida%20sobre%20o%20Modo%20Criador.";
// Depois desse tanto de perguntas já respondidas na conversa, para de
// chamar a IA e manda pro WhatsApp — protege contra gasto alto de token
// num chat sem login (qualquer um pode abrir a página).
const MAX_VISITOR_TURNS = 5;
const ESCALATE_TAG = "[ESCALAR]";

export type PublicSalesChatMessage = { role: "user" | "assistant"; content: string };

export const sendPublicSalesMessage = createServerFn({ method: "POST" })
  .inputValidator((d: { history: PublicSalesChatMessage[]; text: string }) =>
    z.object({
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(30),
      text: z.string().trim().min(1).max(2000),
    }).parse(d))
  .handler(async ({ data }): Promise<{ reply: string; capped: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkPublicSalesChatRateLimit } = await import("./public-sales-chat-rate-limit.server");
    await checkPublicSalesChatRateLimit(supabaseAdmin);

    const priorUserTurns = data.history.filter((m) => m.role === "user").length;
    if (priorUserTurns >= MAX_VISITOR_TURNS) {
      return {
        reply: `Já te ajudei com bastante coisa por aqui! Pra continuar, me chama direto no WhatsApp: [Falar no WhatsApp](${WHATSAPP_LINK})`,
        capped: true,
      };
    }

    const { buildSalesKnowledgeText } = await import("./sales-knowledge");
    const { getAnthropicClient, SUPPORT_MODEL } = await import("./ai-client.server");
    const anthropic = getAnthropicClient();

    const [{ data: plans }, knowledge] = await Promise.all([
      (supabaseAdmin as any).from("plans").select("name, price_cents, max_clients, max_collaborators").order("sort_order"),
      buildSalesKnowledgeText(),
    ]);
    const plansText = (plans ?? []).map((p: any) => {
      const price = p.price_cents != null ? `R$${(p.price_cents / 100).toFixed(2).replace(".", ",")}/mês` : "sob consulta";
      const clients = p.max_clients != null ? `até ${p.max_clients} clientes` : "clientes ilimitados";
      const collabs = p.max_collaborators != null ? `até ${p.max_collaborators} colaboradores` : "colaboradores ilimitados";
      return `${p.name}: ${price}, ${clients}, ${collabs}`;
    }).join("\n");

    const systemPrompt = [
      `Você é o "Chat do Modo Criador" na página de vendas do site (modocriador.com.br/assinar) — conversa com visitantes que ainda não têm conta, tirando dúvida sobre o produto pra ajudar a decidir se vale testar.`,
      `Responda sempre em português do Brasil, com um tom natural, cordial e vendedor sem forçar a barra — direto ao ponto, nunca robótico. Nunca use travessão.`,
      `Nunca se apresente como inteligência artificial, IA, "assistente virtual" ou robô por conta própria. Se perguntarem diretamente se você é um robô/uma IA, não negue nem minta — responda de forma simples e natural, algo como "sou o chat do Modo Criador", e ofereça o WhatsApp se a pessoa preferir falar com alguém de verdade.`,
      `Use só as informações reais abaixo. Não invente funcionalidade, preço ou prazo que não estejam descritos aqui. O teste grátis é sempre 30 dias, sem cobrar o cartão nesse período.`,
      `Seja proativo em responder: as informações abaixo cobrem a maioria das perguntas sobre como o produto funciona, mesmo perguntas mais abertas tipo "como funciona X" ou "como é a tela de Y" — junte o que estiver descrito e dê uma resposta completa e concreta, sem ficar vago. NÃO escale uma pergunta só porque ela pede mais detalhe ou é formulada de um jeito diferente do FAQ — primeiro tente responder com o que você tem.`,
      `Formatação: destaque em **negrito** (dois asteriscos) só a informação mais importante — no máximo 1-2 trechos por resposta.`,
      `Se perguntarem sobre segurança, privacidade ou proteção de dados, responda com muita confiança e respaldo — não seja vago nem genérico. Use os fatos reais do FAQ abaixo (aprovação oficial do Google, autorização como desenvolvedor Meta com API oficial do Instagram/Facebook, política de privacidade alinhada à LGPD) pra mostrar que é um site sério e seguro de verdade.`,
      ``,
      knowledge,
      ``,
      `PLANOS E PREÇOS ATUAIS:\n${plansText}`,
      ``,
      `Escale (veja a tag abaixo) só nesses casos: a resposta genuinamente não está nas informações acima nem dá pra deduzir delas, envolve um caso bem específico da conta/negócio da pessoa que você não tem como avaliar, ou ela pede claramente pra falar com uma pessoa. Uma dúvida geral sobre como uma tela ou fluxo funciona NUNCA é motivo de escalar sozinha — isso é o que você está aqui pra responder. Quando precisar mesmo escalar, comece sua resposta com a tag ${ESCALATE_TAG} seguida de uma frase curta e natural convidando a continuar no WhatsApp — logo depois, inclua sempre o link [Falar no WhatsApp](${WHATSAPP_LINK}).`,
    ].join("\n");

    const response = await anthropic.messages.create({
      model: SUPPORT_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [...data.history, { role: "user" as const, content: data.text }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    let replyText = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
    if (!replyText) {
      replyText = `Desculpa, deu um probleminha aqui. Me chama no WhatsApp que te ajudo: [Falar no WhatsApp](${WHATSAPP_LINK})`;
    }

    const escalate = replyText.startsWith(ESCALATE_TAG);
    if (escalate) replyText = replyText.slice(ESCALATE_TAG.length).trim();

    if (escalate) {
      try {
        const { sendEmail } = await import("./resend.server");
        const transcript = [...data.history, { role: "user", content: data.text }]
          .map((m) => `${m.role === "user" ? "Visitante" : "Chat"}: ${m.content}`).join("\n\n");
        await sendEmail({
          to: PLATFORM_SUPPORT_EMAIL,
          subject: "Chat do Modo Criador (vendas) — visitante precisa de ajuda",
          html: `<p>Um visitante da página de vendas perguntou algo que o chat não conseguiu resolver sozinho:</p><pre style="white-space:pre-wrap;font-family:inherit">${transcript.replace(/</g, "&lt;")}</pre>`,
        });
      } catch (e) {
        console.error("[sendPublicSalesMessage] falha ao mandar e-mail de escalonamento:", e);
      }
    }

    return { reply: replyText, capped: false };
  });
