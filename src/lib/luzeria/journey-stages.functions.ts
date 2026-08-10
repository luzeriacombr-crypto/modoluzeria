import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

export type JourneyTrack = "onboarding" | "operational";
export type StageUpdateTrigger = "stage_change" | "weekly_nudge" | "manual";

export type JourneyStage = {
  id: string;
  track: JourneyTrack;
  name: string;
  description: string;
  sortOrder: number;
};

/** Mesmas 13 (onboarding) + 10 (operational) etapas semeadas pra toda
 * agência via CROSS JOIN em supabase/migrations/20260810020000_client_journey_stages.sql —
 * reaproveitado aqui pra semear agências novas (o migration só cobre as que
 * já existiam no momento em que rodou). */
export const DEFAULT_JOURNEY_STAGES: { track: JourneyTrack; name: string; description: string; sortOrder: number }[] = [
  { track: "onboarding", sortOrder: 0, name: "Contrato e início do projeto", description: "Contrato fechado e tudo certo para começarmos oficialmente o trabalho com a sua marca." },
  { track: "onboarding", sortOrder: 1, name: "Onboarding e coleta de informações", description: "Vamos entender sua marca, objetivos, público, serviços, diferenciais, referências e tudo que precisamos para construir a estratégia." },
  { track: "onboarding", sortOrder: 2, name: "Organização dos materiais", description: "Reunimos fotos, vídeos, identidade visual, acessos e outros materiais necessários para iniciar a produção." },
  { track: "onboarding", sortOrder: 3, name: "Planejamento estratégico/Sistema de conteúdo", description: "Com as informações em mãos, definimos posicionamento, pilares de conteúdo, formatos e direcionamento da comunicação." },
  { track: "onboarding", sortOrder: 4, name: "Entrega do planejamento do primeiro mês", description: "Escolhemos os temas e conteúdos que serão trabalhados durante o primeiro ciclo de produção." },
  { track: "onboarding", sortOrder: 5, name: "Criação dos roteiros / Copys de Posts", description: "Transformamos os temas planejados em roteiros prontos para orientar a gravação dos vídeos e Copys para os posts e carrosséis." },
  { track: "onboarding", sortOrder: 6, name: "Gravação de conteúdo", description: "Realizamos a captação dos vídeos e demais materiais necessários para produzir os conteúdos do bimestre (na maioria das vezes)." },
  { track: "onboarding", sortOrder: 7, name: "Edição dos conteúdos", description: "Nossa equipe entra na fase de edição dos vídeos, criação das artes, carrosséis e demais peças planejadas." },
  { track: "onboarding", sortOrder: 8, name: "Revisão interna", description: "Antes de chegar até você, os conteúdos passam pela revisão da nossa equipe para conferir texto, design, edição e estratégia." },
  { track: "onboarding", sortOrder: 9, name: "Aprovação do cliente", description: "Enviamos os conteúdos para sua aprovação e realizamos os ajustes necessários dentro do processo combinado." },
  { track: "onboarding", sortOrder: 10, name: "Programação das publicações", description: "Com tudo aprovado, organizamos e programamos os conteúdos de acordo com o calendário definido." },
  { track: "onboarding", sortOrder: 11, name: "Início das publicações", description: "O planejamento começa oficialmente a rodar e os conteúdos passam a ser publicados." },
  { track: "onboarding", sortOrder: 12, name: "Acompanhamento inicial", description: "Acompanhamos o desempenho dos primeiros conteúdos e usamos essas informações para melhorar os próximos ciclos." },
  { track: "operational", sortOrder: 0, name: "Análise do mês anterior", description: "Avaliamos o desempenho dos conteúdos e identificamos o que funcionou melhor e o que precisa ser ajustado." },
  { track: "operational", sortOrder: 1, name: "Planejamento do próximo ciclo", description: "Definimos os temas, oportunidades e direcionamentos dos conteúdos que serão produzidos no novo mês." },
  { track: "operational", sortOrder: 2, name: "Criação dos roteiros", description: "Desenvolvemos os roteiros dos vídeos de acordo com o planejamento aprovado para o período." },
  { track: "operational", sortOrder: 3, name: "Gravação de conteúdo", description: "Realizamos a captação dos novos conteúdos que irão alimentar as próximas semanas." },
  { track: "operational", sortOrder: 4, name: "Produção dos conteúdos", description: "A equipe edita os vídeos e desenvolve as artes, carrosséis e demais materiais previstos." },
  { track: "operational", sortOrder: 5, name: "Revisão interna", description: "Todo o material passa pela conferência da nossa equipe antes de seguir para aprovação." },
  { track: "operational", sortOrder: 6, name: "Aprovação do cliente", description: "Os conteúdos são enviados para você conferir e solicitar eventuais ajustes." },
  { track: "operational", sortOrder: 7, name: "Programação das publicações", description: "Após a aprovação, organizamos os conteúdos no calendário e deixamos as publicações programadas." },
  { track: "operational", sortOrder: 8, name: "Publicação e acompanhamento", description: "Os conteúdos entram no ar e acompanhamos o desempenho para alimentar as decisões do próximo ciclo." },
  { track: "operational", sortOrder: 9, name: "Recomeço do ciclo", description: "Os resultados do período se tornam informação para o próximo planejamento, mantendo a produção em evolução contínua." },
];

/** Chamado na criação de uma agência nova (signup.functions.ts) — o seed do
 * migration só cobre agências que já existiam quando ele rodou. */
export async function seedJourneyStagesForOrg(supabase: any, orgId: string): Promise<void> {
  const rows = DEFAULT_JOURNEY_STAGES.map((s) => ({
    org_id: orgId, track: s.track, name: s.name, description: s.description, sort_order: s.sortOrder,
  }));
  const { error } = await supabase.from("client_journey_stages").insert(rows);
  if (error) console.error("[seedJourneyStagesForOrg] failed:", error.message);
}

export const listJourneyStages = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("client_journey_stages")
      .select("id, track, name, description, sort_order")
      .eq("org_id", context.orgId)
      .order("track").order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map((s: any) => ({
      id: s.id, track: s.track, name: s.name,
      description: s.description, sortOrder: s.sort_order,
    })) as JourneyStage[];
  });

export const upsertJourneyStage = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id?: string; track: JourneyTrack; name: string; description?: string }) =>
    z.object({
      id: z.string().uuid().optional(),
      track: z.enum(["onboarding", "operational"]),
      name: z.string().trim().min(1).max(160),
      description: z.string().trim().max(2000).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;
    if (data.id) {
      const { error } = await db.from("client_journey_stages")
        .update({ track: data.track, name: data.name, description: data.description ?? "" })
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
