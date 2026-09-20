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
