import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

export type JourneyTrack = "onboarding" | "operational";
export type StageUpdateTrigger = "stage_change" | "weekly_nudge" | "manual";
export type StageMilestoneType = "analise";

export type JourneyStage = {
  id: string;
  track: JourneyTrack;
  name: string;
  description: string;
  sortOrder: number;
  milestoneType: StageMilestoneType | null;
};

/** Mesmas 13 (onboarding) + 10 (operational) etapas semeadas pra toda
 * agência via CROSS JOIN em supabase/migrations/20260810020000_client_journey_stages.sql —
 * reaproveitado aqui pra semear agências novas (o migration só cobre as que
 * já existiam no momento em que rodou). */
export const DEFAULT_JOURNEY_STAGES: { track: JourneyTrack; name: string; description: string; sortOrder: number }[] = [
  { track: "onboarding", sortOrder: 0, name: "Contrato e início do projeto", description: "Fechouuu! 🤝 Seu projeto já está oficialmente com a gente. A equipe já foi alinhada por aqui e agora começamos a organizar tudo para dar início aos trabalhos." },
  { track: "onboarding", sortOrder: 1, name: "Onboarding e coleta de informações", description: "Agora queremos mergulhar um pouquinho mais no seu negócio. 👀 Estamos olhando tudo que você compartilhou com a gente e entendendo melhor sua marca, seus objetivos e onde queremos chegar juntos." },
  { track: "onboarding", sortOrder: 2, name: "Organização dos materiais", description: "Bastidores funcionando por aquiii! 📂 Estamos separando fotos, vídeos, identidade visual, acessos e tudo que vamos precisar durante a produção. Se faltar alguma coisinha, a gente chama você." },
  { track: "onboarding", sortOrder: 3, name: "Planejamento estratégico/Sistema de conteúdo", description: "Agora entramos naquela parte de pensar antes de sair postando qualquer coisa. 🧠 Estamos cruzando tudo que você contou pra gente e definindo os caminhos que vamos seguir na comunicação e nos conteúdos." },
  { track: "onboarding", sortOrder: 4, name: "Entrega do planejamento do primeiro mês", description: "Temos um plano! 📝 Os conteúdos do seu primeiro mês já foram pensados e organizados. Definimos o que vamos falar, quais assuntos entram primeiro e como vamos distribuir tudo ao longo do mês." },
  { track: "onboarding", sortOrder: 5, name: "Criação dos roteiros / Copys de Posts", description: "As ideias já estão virando conteúdo! ✍️ Agora estamos escrevendo os roteiros, pensando nos ganchos dos vídeos e preparando os textos dos posts e carrosséis." },
  { track: "onboarding", sortOrder: 6, name: "Gravação de conteúdo", description: "Câmeras prontaaas! 🎥 Chegou o dia de tirar tudo do papel e gravar. Já estamos com os roteiros organizados para aproveitar bem nosso tempo e sair daqui com bastante material bom." },
  { track: "onboarding", sortOrder: 7, name: "Edição dos conteúdos", description: "Gravamosss! 💻 Agora os vídeos seguem para edição e, ao mesmo tempo, nosso time começa a trabalhar nas artes e carrosséis. Aos poucos, tudo que planejamos começa a ganhar cara." },
  { track: "onboarding", sortOrder: 8, name: "Revisão interna", description: "Boaaa!!! 🔎 O material já passou pela produção. Agora estamos naquela conferida geral antes de mandar pra você. Texto, vídeo, arte, informação... estamos olhando tudinho." },
  { track: "onboarding", sortOrder: 9, name: "Aprovação do cliente", description: "Chegou sua vez! 👀 Os conteúdos já estão disponíveis para você conferir. Dá uma olhada com calma e, se tiver algum ponto que queira ajustar, manda pra gente." },
  { track: "onboarding", sortOrder: 10, name: "Programação das publicações", description: "Aprovado? Então deixa com a genteee! 🗓️ Estamos colocando cada conteúdo no seu lugar e organizando as publicações conforme o calendário que planejamos." },
  { track: "onboarding", sortOrder: 11, name: "Início das publicações", description: "Estamos no aaar! 🚀 Depois de todo esse processo, os primeiros conteúdos começaram a sair. Agora é acompanhar de perto como o público vai responder." },
  { track: "onboarding", sortOrder: 12, name: "Acompanhamento inicial", description: "Agora ficamos de olho nos números. 📊 Vamos observar como o público está reagindo, quais conteúdos estão chamando mais atenção e o que já podemos aprender para o próximo mês." },
  { track: "operational", sortOrder: 0, name: "Análise do mês anterior", description: "Começando mais um mês dando aquela olhada no retrovisor. 🔎 Estamos vendo o que foi bem, o que chamou atenção do público e o que não respondeu tão bem quanto esperávamos. Tudo isso entra na conta do próximo planejamento." },
  { track: "operational", sortOrder: 1, name: "Planejamento do próximo ciclo", description: "Bora pensar no próximo mês? 🧠 Já estamos escolhendo os assuntos que fazem mais sentido agora e organizando as próximas ideias de conteúdo." },
  { track: "operational", sortOrder: 2, name: "Criação dos roteiros", description: "Planejamento aprovado. Boraaa colocar a mão na massa! ✍️ Os roteiros já estão sendo escritos e estamos preparando tudo para chegar na gravação sabendo exatamente o que precisamos produzir." },
  { track: "operational", sortOrder: 3, name: "Gravação de conteúdo", description: "Dia de gravaçãooo! 🎥 Roteiros na mão, câmera pronta e bora produzir os conteúdos das próximas semanas." },
  { track: "operational", sortOrder: 4, name: "Produção dos conteúdos", description: "Agora é com o nosso time! 💻 O material gravado já está sendo editado e as artes do mês também estão saindo do papel. Daqui a pouco tudo começa a chegar até você." },
  { track: "operational", sortOrder: 5, name: "Revisão interna", description: "Boaaa, produção finalizada! 🔎 Antes de mandar pra você, estamos passando conteúdo por conteúdo para conferir se está tudo certinho." },
  { track: "operational", sortOrder: 6, name: "Aprovação do cliente", description: "Sua vez! 👀 Os conteúdos já estão com você para aprovação. Encontrou algo que precisa mudar? Sinaliza pra gente que fazemos os ajustes por aqui." },
  { track: "operational", sortOrder: 7, name: "Programação das publicações", description: "Aprovado? Deixa com a genteee! 🗓️ Agora estamos organizando tudo no calendário e deixando os conteúdos preparados para entrarem no ar nas datas certas." },
  { track: "operational", sortOrder: 8, name: "Publicação e acompanhamento", description: "Conteúdo na rua! 🚀 Enquanto as publicações vão acontecendo, a gente continua por aqui acompanhando o que está funcionando e guardando esses aprendizados para o próximo planejamento." },
  { track: "operational", sortOrder: 9, name: "Recomeço do ciclo", description: "Fechamos mais uma rodadaaa! 🔄 E tudo que aprendemos neste mês já começa a alimentar as decisões do próximo. Agora o ciclo começa novamente, só que com mais informação na mão." },
];

/** Chamado na criação de uma agência nova (signup.functions.ts) — o seed do
 * migration só cobre agências que já existiam quando ele rodou. */
export async function seedJourneyStagesForOrg(supabase: any, orgId: string): Promise<void> {
  const rows = DEFAULT_JOURNEY_STAGES.map((s) => ({
    org_id: orgId, track: s.track, name: s.name, description: s.description, sort_order: s.sortOrder,
    milestone_type: s.name === "Análise do mês anterior" ? "analise" : null,
  }));
  const { error } = await supabase.from("client_journey_stages").insert(rows);
  if (error) console.error("[seedJourneyStagesForOrg] failed:", error.message);
}

export const listJourneyStages = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("client_journey_stages")
      .select("id, track, name, description, sort_order, milestone_type")
      .eq("org_id", context.orgId)
      .order("track").order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map((s: any) => ({
      id: s.id, track: s.track, name: s.name,
      description: s.description, sortOrder: s.sort_order,
      milestoneType: s.milestone_type ?? null,
    })) as JourneyStage[];
  });

export const upsertJourneyStage = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id?: string; track: JourneyTrack; name: string; description?: string; milestoneType?: StageMilestoneType | null }) =>
    z.object({
      id: z.string().uuid().optional(),
      track: z.enum(["onboarding", "operational"]),
      name: z.string().trim().min(1).max(160),
      description: z.string().trim().max(2000).optional(),
      milestoneType: z.enum(["analise"]).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;
    if (data.id) {
      const { error } = await db.from("client_journey_stages")
        .update({ track: data.track, name: data.name, description: data.description ?? "", milestone_type: data.milestoneType ?? null })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { data: existing } = await db.from("client_journey_stages")
        .select("sort_order").eq("org_id", context.orgId).eq("track", data.track)
        .order("sort_order", { ascending: false }).limit(1).maybeSingle();
      const nextOrder = (existing?.sort_order ?? -1) + 1;
      const { error } = await db.from("client_journey_stages").insert({
        org_id: context.orgId, track: data.track, name: data.name,
        description: data.description ?? "", sort_order: nextOrder,
        milestone_type: data.milestoneType ?? null,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteJourneyStage = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("client_journey_stages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setClientStage = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; stageId: string }) =>
    z.object({ clientId: z.string().uuid(), stageId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("clients").update({ current_stage_id: data.stageId }).eq("id", data.clientId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const logClientStageUpdate = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; stageId?: string | null; message: string; trigger: StageUpdateTrigger }) =>
    z.object({
      clientId: z.string().uuid(),
      stageId: z.string().uuid().nullable().optional(),
      message: z.string().trim().min(1).max(2000),
      trigger: z.enum(["stage_change", "weekly_nudge", "manual"]),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("client_stage_updates").insert({
      org_id: context.orgId, client_id: data.clientId, stage_id: data.stageId ?? null,
      message: data.message, trigger: data.trigger, sent_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getClientStageHistory = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_stage_updates")
      .select("id, stage_id, trigger, message, sent_by, sent_at, profiles(name)")
      .eq("client_id", data.clientId)
      .order("sent_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id, stageId: r.stage_id, trigger: r.trigger, message: r.message,
      sentByName: r.profiles?.name ?? null, sentAt: r.sent_at,
    }));
  });

export type WeeklyClientReminder = {
  clientId: string;
  clientName: string;
  clientColor: string;
  stageId: string | null;
  stageName: string | null;
  stageDescription: string | null;
  lastUpdateAt: string | null;
};

/** Mesma regra de "atrasado" do cron semanal (notify_stale_client_updates,
 * 20260810040000...sql) — mas computada ao vivo, pra mostrar em Minhas
 * Demandas. Como o "feito" vem de existir uma linha em client_stage_updates
 * (não de um flag por usuário), assim que qualquer admin/setor manda ou
 * marca a atualização, o cliente some da lista pra todo mundo da agência —
 * sem precisar de nenhuma tabela nova. */
export const getWeeklyClientReminders = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data: clients } = await context.supabase
      .from("clients")
      .select("id, name, color, current_stage_id, created_at")
      .eq("archived", false)
      .neq("category", "Ex-clientes");
    const list = clients ?? [];
    if (list.length === 0) return [] as WeeklyClientReminder[];
    const clientIds = list.map((c: any) => c.id);

    const { data: updates } = await context.supabase
      .from("client_stage_updates")
      .select("client_id, sent_at")
      .in("client_id", clientIds)
      .order("sent_at", { ascending: false });
    const lastByClient = new Map<string, string>();
    (updates ?? []).forEach((u: any) => {
      if (!lastByClient.has(u.client_id)) lastByClient.set(u.client_id, u.sent_at);
    });

    const stageIds = [...new Set(list.map((c: any) => c.current_stage_id).filter(Boolean))];
    const { data: stages } = stageIds.length
      ? await context.supabase.from("client_journey_stages").select("id, name, description").in("id", stageIds)
      : { data: [] as any[] };
    const stageMap = new Map((stages ?? []).map((s: any) => [s.id, s]));

    const cutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return list
      .map((c: any) => {
        const lastUpdateAt = lastByClient.get(c.id) ?? null;
        const lastMs = new Date(lastUpdateAt ?? c.created_at).getTime();
        const stage = c.current_stage_id ? stageMap.get(c.current_stage_id) : null;
        return {
          clientId: c.id, clientName: c.name, clientColor: c.color,
          stageId: stage?.id ?? null, stageName: stage?.name ?? null,
          stageDescription: stage?.description ?? null, lastUpdateAt,
          _lastMs: lastMs,
        };
      })
      .filter((c: any) => c._lastMs < cutoffMs)
      .sort((a: any, b: any) => a._lastMs - b._lastMs)
      .map(({ _lastMs, ...rest }: any) => rest) as WeeklyClientReminder[];
  });

/* ===== VISÃO GERAL OPERACIONAL ===== */

export type ClientOperationsRow = {
  clientId: string;
  clientName: string;
  clientColor: string;
  stageId: string | null;
  stageName: string | null;
  stageTrack: JourneyTrack | null;
  lastGravacaoAt: string | null;
  gravacaoVideoCount: number | null;
  nextGravacaoDue: string | null;
  lastAnaliseAt: string | null;
};

/** Menos de 6 vídeos: grava de novo em 30 dias. 6 a 11: 45 dias. 12 ou
 * mais: 60 dias (2 meses) — regra combinada com o Junior. */
function gravacaoIntervalDays(videoCount: number): number {
  if (videoCount < 6) return 30;
  if (videoCount < 12) return 45;
  return 60;
}

export const getClientOperationsOverview = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    // Avulsos não entram: são trabalhos pontuais, sem ciclo mensal de
    // gravação/análise pra acompanhar aqui.
    const { data: clients, error } = await context.supabase
      .from("clients")
      .select("id, name, color, current_stage_id")
      .eq("archived", false)
      .neq("category", "Ex-clientes")
      .neq("category", "Avulsos")
      .order("name");
    if (error) throw new Error(error.message);
    const list = clients ?? [];
    if (list.length === 0) return [] as ClientOperationsRow[];
    const clientIds = list.map((c: any) => c.id);

    const { data: stages } = await context.supabase
      .from("client_journey_stages")
      .select("id, name, track, milestone_type")
      .eq("org_id", context.orgId);
    const stageMap = new Map((stages ?? []).map((s: any) => [s.id, s]));
    const analiseStageIds = (stages ?? []).filter((s: any) => s.milestone_type === "analise").map((s: any) => s.id);

    const { data: history } = analiseStageIds.length
      ? await context.supabase
          .from("client_stage_history")
          .select("client_id, entered_at")
          .in("client_id", clientIds)
          .in("stage_id", analiseStageIds)
          .order("entered_at", { ascending: false })
      : { data: [] as any[] };
    const lastAnaliseByClient = new Map<string, string>();
    (history ?? []).forEach((h: any) => {
      if (!lastAnaliseByClient.has(h.client_id)) lastAnaliseByClient.set(h.client_id, h.entered_at);
    });

    // "Última gravação" e "vídeos gravados" vêm direto de Mais Atividades —
    // não precisa de campo manual: cada atividade tipo "gravacao" já tem sua
    // própria "Data para gravação" e quantidade. Pega a data mais recente por
    // cliente, e soma a quantidade de todas as gravações registradas naquele
    // mesmo mês (cobre o caso de mais de uma sessão de gravação no mês).
    const { data: gravacaoItems } = await context.supabase
      .from("content_items")
      .select("activity_quantity, due_date, months!inner(client_id)")
      .eq("type", "gravacao")
      .not("due_date", "is", null);
    const latestDueDateByClient = new Map<string, string>();
    const videoCountByClientMonth = new Map<string, number>();
    (gravacaoItems ?? []).forEach((it: any) => {
      const clientId = it.months?.client_id;
      if (!clientId) return;
      const dueDate = String(it.due_date);
      const current = latestDueDateByClient.get(clientId);
      if (!current || dueDate > current) latestDueDateByClient.set(clientId, dueDate);
      const monthKey = dueDate.slice(0, 7);
      const key = `${clientId}|${monthKey}`;
      const qty = it.activity_quantity > 0 ? it.activity_quantity : 1;
      videoCountByClientMonth.set(key, (videoCountByClientMonth.get(key) ?? 0) + qty);
    });

    return list.map((c: any) => {
      const stage = c.current_stage_id ? stageMap.get(c.current_stage_id) : null;
      const lastGravacaoAt = latestDueDateByClient.get(c.id) ?? null;
      let gravacaoVideoCount: number | null = null;
      let nextGravacaoDue: string | null = null;
      if (lastGravacaoAt) {
        const monthKey = lastGravacaoAt.slice(0, 7);
        gravacaoVideoCount = videoCountByClientMonth.get(`${c.id}|${monthKey}`) ?? 0;
        const days = gravacaoIntervalDays(gravacaoVideoCount);
        nextGravacaoDue = new Date(new Date(`${lastGravacaoAt}T00:00:00Z`).getTime() + days * 86400000).toISOString();
      }
      return {
        clientId: c.id, clientName: c.name, clientColor: c.color,
        stageId: stage?.id ?? null, stageName: stage?.name ?? null, stageTrack: stage?.track ?? null,
        lastGravacaoAt, gravacaoVideoCount, nextGravacaoDue,
        lastAnaliseAt: lastAnaliseByClient.get(c.id) ?? null,
      };
    }) as ClientOperationsRow[];
  });
