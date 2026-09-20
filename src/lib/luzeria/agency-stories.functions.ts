import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

async function ensureAdmin(context: any) {
  const { data } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (!data) throw new Error("Forbidden");
}

export type StoriesShift = {
  id: string;
  date: string;
  userId: string;
  doneAt: string | null;
};

/** Escala do mês inteiro (YYYY-MM) — o calendário monta em cima disso. */
export const listAgencyStories = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { month: string }) =>
    z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<StoriesShift[]> => {
    const [y, m] = data.month.split("-").map(Number);
    const inicio = `${data.month}-01`;
    const fim = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
    const { data: rows, error } = await (context.supabase as any)
      .from("agency_stories_schedule")
      .select("id, date, user_id, done_at")
      .gte("date", inicio)
      .lt("date", fim)
      .order("date");
    // Tabela nova: enquanto a migration não for aplicada, some em silêncio
    // em vez de quebrar a tela de quem abriu a Rotina.
    if (error) return [];
    return ((rows ?? []) as any[]).map((r) => ({
      id: r.id,
      date: r.date,
      userId: r.user_id,
      doneAt: r.done_at,
    }));
  });

/** O que aparece nas demandas: a escala de hoje da pessoa. */
export const listMyStoriesToday = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId?: string }) => d)
  .handler(async ({ data, context }): Promise<StoriesShift[]> => {
    let alvo = context.userId;
    if (data.userId && data.userId !== context.userId) {
      const { data: isAdmin } = await context.supabase.rpc("is_admin", {
        _user_id: context.userId,
      });
      if (!isAdmin) throw new Error("Forbidden");
      alvo = data.userId;
    }
    const hoje = new Date();
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    const { data: rows, error } = await (context.supabase as any)
      .from("agency_stories_schedule")
      .select("id, date, user_id, done_at")
      .eq("user_id", alvo)
      .eq("date", hojeStr);
    if (error) return [];
    return ((rows ?? []) as any[]).map((r) => ({
      id: r.id,
      date: r.date,
      userId: r.user_id,
      doneAt: r.done_at,
    }));
  });

/** Só admin escala — define de uma vez quem fica naquele dia. */
export const setAgencyStoriesDay = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { date: string; userIds: string[] }) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        userIds: z.array(z.string().uuid()).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const sb = context.supabase as any;
    const { data: atuais } = await sb
      .from("agency_stories_schedule")
      .select("id, user_id")
      .eq("org_id", context.orgId)
      .eq("date", data.date);

    const atuaisIds = new Set(((atuais ?? []) as any[]).map((r) => r.user_id));
    const novos = data.userIds.filter((id) => !atuaisIds.has(id));
    const removidos = ((atuais ?? []) as any[]).filter((r) => !data.userIds.includes(r.user_id));

    // Só mexe em quem entrou/saiu, pra não perder o "feito" de quem
    // continua escalado no dia.
    if (removidos.length) {
      const { error } = await sb
        .from("agency_stories_schedule")
        .delete()
        .in(
          "id",
          removidos.map((r: any) => r.id),
        );
      if (error) throw new Error(error.message);
    }
    if (novos.length) {
      const { error } = await sb.from("agency_stories_schedule").insert(
        novos.map((userId) => ({
          org_id: context.orgId,
          date: data.date,
          user_id: userId,
          created_by: context.userId,
        })),
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Marcar/desmarcar como feito — a função no banco garante que só o
 *  escalado (ou um admin da agência) consegue, e só mexe em done_at. */
export const setAgencyStoriesDone = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; done: boolean }) =>
    z.object({ id: z.string().uuid(), done: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("mark_agency_stories_done" as any, {
      _id: data.id,
      _done: data.done,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type StoriesInspiracoes = {
  dias: { titulo: string; subtitulo?: string; objetivo?: string; ideias: string[]; nota?: string }[];
  essencia?: { titulo?: string; itens: { dia: string; texto: string }[] };
  padrao?: { titulo?: string; itens: string[]; rodape?: string[] };
  evitar?: string[];
};

/** Rotina de stories da agência — alimenta o "Ver inspirações". */
export const getStoriesInspiracoes = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<StoriesInspiracoes | null> => {
    const { data, error } = await (context.supabase as any)
      .from("orgs").select("stories_inspirations").eq("id", context.orgId).maybeSingle();
    // Coluna nova: sem a migration aplicada, é como não ter rotina cadastrada.
    if (error || !data?.stories_inspirations) return null;
    return data.stories_inspirations as StoriesInspiracoes;
  });

const inspiracoesSchema = z.object({
  dias: z.array(z.object({
    titulo: z.string().trim().min(1).max(60),
    subtitulo: z.string().trim().max(80).optional(),
    objetivo: z.string().trim().max(300).optional(),
    ideias: z.array(z.string().trim().min(1).max(200)).max(30),
    nota: z.string().trim().max(300).optional(),
  })).max(7),
  essencia: z.object({
    titulo: z.string().trim().max(200).optional(),
    itens: z.array(z.object({ dia: z.string().trim().min(1).max(40), texto: z.string().trim().min(1).max(200) })).max(7),
  }).optional(),
  padrao: z.object({
    titulo: z.string().trim().max(60).optional(),
    itens: z.array(z.string().trim().min(1).max(200)).max(20),
    rodape: z.array(z.string().trim().min(1).max(200)).max(6).optional(),
  }).optional(),
  evitar: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
});

/** Salva a rotina de stories da agência. Rotina vazia limpa o cadastro. */
export const setStoriesInspiracoes = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { rotina: z.infer<typeof inspiracoesSchema> | null }) =>
    z.object({ rotina: inspiracoesSchema.nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const vazia = !data.rotina || data.rotina.dias.length === 0;
    const { data: atualizada, error } = await (context.supabase as any)
      .from("orgs")
      .update({ stories_inspirations: vazia ? null : data.rotina })
      .eq("id", context.orgId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    // Update barrado por RLS não devolve erro, só zero linha — mesmo
    // cuidado que updateMyOrg já toma.
    if (!atualizada) throw new Error("Não foi possível salvar (permissão negada).");
    return { ok: true };
  });

/**
 * Esqueleto de uma boa rotina de stories — método, não conteúdo.
 *
 * De propósito NÃO carrega nada da rotina da Luzeria: nomes de quadros,
 * bordões e frases dela são ativos dela, e o app é white-label. O que vai
 * pro modelo é o princípio genérico de social media (dia de bastidor, dia
 * de autoridade, dia de humanização), que qualquer bom profissional
 * conhece, mais o contexto da própria agência que está pedindo.
 */
const METODO_STORIES = `Uma rotina de stories que funciona costuma ter:
- Dias fixos, poucos e sustentáveis (2 a 3 por semana é mais realista que todo dia).
- Um tema por dia, com um objetivo claro por trás: um dia mostra bastidor e rotina (aproxima), um dia entrega algo útil (constrói autoridade), um dia humaniza o time (cria memória de marca).
- Ideias concretas o suficiente pra alguém gravar sem pensar muito no dia.
- Um padrão de publicação: quantos stories por sequência, usar interação (enquete, caixinha), mostrar pessoas e não só telas.
- Uma lista curta do que evitar, tirada dos erros que a equipe realmente comete.`;

const ROTINA_TOOL = {
  name: "report_stories_routine",
  description: "Devolve a rotina de stories montada pra agência.",
  input_schema: {
    type: "object",
    properties: {
      dias: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string", description: "Dia da semana, ex: Segunda-feira" },
            subtitulo: { type: "string", description: "Nome do tema do dia, curto e próprio da agência" },
            objetivo: { type: "string", description: "O que esse dia comunica, em uma frase" },
            ideias: { type: "array", items: { type: "string" }, description: "5 a 10 ideias concretas de gravação" },
            nota: { type: "string", description: "Observação prática do dia" },
          },
          required: ["titulo", "subtitulo", "objetivo", "ideias"],
        },
      },
      essencia: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          itens: {
            type: "array",
            items: {
              type: "object",
              properties: { dia: { type: "string" }, texto: { type: "string" } },
              required: ["dia", "texto"],
            },
          },
        },
        required: ["titulo", "itens"],
      },
      padrao: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          itens: { type: "array", items: { type: "string" } },
          rodape: { type: "array", items: { type: "string" } },
        },
        required: ["itens"],
      },
      evitar: { type: "array", items: { type: "string" } },
    },
    required: ["dias", "padrao", "evitar"],
  },
};

/** Gera uma proposta de rotina. Não salva: volta pro editor pra pessoa revisar. */
export const gerarStoriesInspiracoes = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { contexto?: string }) =>
    z.object({ contexto: z.string().trim().max(1500).optional() }).parse(d))
  .handler(async ({ data, context }): Promise<StoriesInspiracoes> => {
    await ensureAdmin(context);

    const { data: org } = await context.supabase
      .from("orgs").select("name, tagline").eq("id", context.orgId).maybeSingle();

    const instrucao = [
      `Você vai montar a rotina de stories do perfil de uma agência de marketing/conteúdo.`,
      ``,
      `AGÊNCIA: ${(org as any)?.name ?? "uma agência"}${(org as any)?.tagline ? ` — ${(org as any).tagline}` : ""}`,
      data.contexto ? `\nO QUE A AGÊNCIA PEDIU:\n${data.contexto}` : `\nA agência não deu contexto: monte algo sólido e aplicável pra uma agência de conteúdo, sem inventar fatos sobre ela.`,
      ``,
      METODO_STORIES,
      ``,
      `REGRAS:`,
      `- Escreva tudo em português do Brasil, no tom de quem fala com a própria equipe.`,
      `- Os nomes dos temas precisam ser da cara DESSA agência. Não use nomes de quadros, bordões ou apelidos de outras agências.`,
      `- Ideias concretas e graváveis ("Bastidor da gravação de hoje"), nunca conselho vago ("poste mais bastidores").`,
      `- 3 dias, a não ser que o contexto peça outra coisa. De 5 a 10 ideias por dia.`,
      `- A lista de "evitar" vem dos erros reais de quem grava story com pressa.`,
      `- Termine SEMPRE chamando a tool report_stories_routine.`,
    ].join("\n");

    const { getAnthropicClient, PLANNING_MODEL } = await import("./ai-client.server");
    const anthropic = getAnthropicClient();
    const resposta = await anthropic.messages.create({
      model: PLANNING_MODEL,
      max_tokens: 4000,
      tools: [ROTINA_TOOL as any],
      tool_choice: { type: "tool", name: "report_stories_routine" } as any,
      messages: [{ role: "user", content: instrucao }],
    } as any);

    const toolUse = [...resposta.content].reverse().find(
      (b: any) => b.type === "tool_use" && b.name === "report_stories_routine",
    ) as any;
    if (!toolUse) throw new Error("Não consegui gerar as inspirações — tenta de novo.");
    return toolUse.input as StoriesInspiracoes;
  });
