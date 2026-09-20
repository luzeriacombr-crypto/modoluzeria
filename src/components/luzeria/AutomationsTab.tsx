import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pause, Pencil, Play, Plus, Trash2, Zap, FlaskConical, Sparkles, ChevronDown } from "lucide-react";
import { automationRulesQO, clientsQO, profilesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { STATUS_META, getStatusMeta, type Status, type BuiltinStatus } from "@/lib/luzeria/types";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { ClientTemplatesSection } from "@/components/luzeria/ClientTemplatesSection";
import { MonthRolloverSection } from "@/components/luzeria/MonthRolloverSection";
import { TRIGGER_TYPES, ACTION_TYPES, CLIENT_LEVEL_TRIGGERS, ITEM_ONLY_ACTIONS, DAYS_TRIGGER_TYPES, type AutomationRule, type TriggerType, type ActionType } from "@/lib/luzeria/automation-rules.functions";

const STATUS_OPTIONS = Object.keys(STATUS_META) as BuiltinStatus[];

const TRIGGER_LABEL: Record<TriggerType, string> = {
  on_create: "Quando o item for criado",
  status_change: "Quando o status virar",
  deadline_days_before: "N dias antes do prazo",
  deadline_overdue: "Quando o prazo vencer",
  stale_days: "Quando ficar parado N dias",
  feed_approved: "Quando o cliente aprovar o feed",
  feed_feedback: "Quando o cliente pedir ajuste no feed",
  file_attached: "Quando anexarem um arquivo",
  ig_publish_failed: "Quando a publicação no Instagram falhar",
  roteiro_approved: "Quando o cliente aprovar um roteiro",
  roteiro_adjust: "Quando o cliente pedir ajuste num roteiro",
  photo_selection_done: "Quando uma seleção de fotos for finalizada",
  contract_signed: "Quando um contrato for assinado",
  client_no_post_days: "Quando o cliente ficar N dias sem entrega",
  payment_days_before: "N dias antes do vencimento da mensalidade",
  payment_overdue: "Quando a mensalidade do cliente atrasar",
};

const TRIGGER_GROUPS: { label: string; items: TriggerType[] }[] = [
  { label: "No conteúdo", items: ["on_create", "status_change", "feed_approved", "feed_feedback", "file_attached", "ig_publish_failed"] },
  { label: "Prazos e paradas", items: ["deadline_days_before", "deadline_overdue", "stale_days"] },
  { label: "No cliente", items: ["roteiro_approved", "roteiro_adjust", "photo_selection_done", "contract_signed", "client_no_post_days"] },
  { label: "Cobrança", items: ["payment_days_before", "payment_overdue"] },
];

const ACTION_LABEL: Record<ActionType, string> = {
  set_status: "Alterar status para",
  assign_member: "Atribuir para",
  notify: "Notificar",
  whatsapp_link: "Deixar mensagem de WhatsApp pronta",
  schedule_instagram: "Programar no Instagram",
  create_item: "Criar uma tarefa",
  add_comment: "Comentar no item",
  move_next_month: "Mover pro próximo mês",
  send_email: "Enviar e-mail",
};

// Ações que aceitam escolher uma ou mais pessoas (vazio = "os responsáveis
// atuais do item", ou os masters quando não há item).
const USER_SELECT_ACTIONS: ActionType[] = ["assign_member", "notify", "whatsapp_link", "create_item", "send_email"];
const MESSAGE_ACTIONS: ActionType[] = ["notify", "whatsapp_link", "create_item", "add_comment", "send_email"];
const DAYS_LABEL: Partial<Record<TriggerType, string>> = {
  deadline_days_before: "dia(s) antes do prazo", stale_days: "dia(s) parado",
  client_no_post_days: "dia(s) sem entrega", payment_days_before: "dia(s) antes do vencimento",
};
const TYPE_LABEL: Record<string, string> = { post: "Posts", reel: "Reels", story: "Stories" };

function describeTrigger(rule: AutomationRule): ReactNode {
  switch (rule.triggerType) {
    case "on_create": return <>Quando o item for <strong>criado</strong></>;
    case "status_change": return <>Quando o status virar <strong style={{ color: getStatusMeta(rule.triggerStatus as Status).color }}>{getStatusMeta(rule.triggerStatus as Status).label}</strong></>;
    case "deadline_days_before": return <><strong>{rule.triggerDays}</strong> dia(s) antes do prazo</>;
    case "deadline_overdue": return <>Quando o prazo <strong>vencer</strong></>;
    case "stale_days": return <>Quando ficar <strong>{rule.triggerDays} dia(s)</strong> parado {rule.triggerStatus ? <>em <strong style={{ color: getStatusMeta(rule.triggerStatus as Status).color }}>{getStatusMeta(rule.triggerStatus as Status).label}</strong></> : "no mesmo status"}</>;
    case "feed_approved": return <>Quando o cliente <strong>aprovar o feed</strong></>;
    case "feed_feedback": return <>Quando o cliente <strong>pedir ajuste</strong> num post</>;
    case "file_attached": return <>Quando <strong>anexarem um arquivo</strong></>;
    case "ig_publish_failed": return <>Quando a publicação no <strong>Instagram falhar</strong></>;
    case "roteiro_approved": return <>Quando o cliente <strong>aprovar um roteiro</strong></>;
    case "roteiro_adjust": return <>Quando o cliente <strong>pedir ajuste</strong> num roteiro</>;
    case "photo_selection_done": return <>Quando uma <strong>seleção de fotos</strong> for finalizada</>;
    case "contract_signed": return <>Quando um <strong>contrato</strong> for assinado</>;
    case "client_no_post_days": return <>Quando o cliente ficar <strong>{rule.triggerDays} dia(s) sem entrega</strong></>;
    case "payment_days_before": return <><strong>{rule.triggerDays}</strong> dia(s) antes do <strong>vencimento</strong> da mensalidade</>;
    case "payment_overdue": return <>Quando a <strong>mensalidade</strong> do cliente <strong>atrasar</strong></>;
  }
}

function describeAction(rule: AutomationRule, userNames: string): ReactNode {
  switch (rule.actionType) {
    case "set_status": return <>alterar status para <strong style={{ color: getStatusMeta(rule.actionStatus as Status).color }}>{getStatusMeta(rule.actionStatus as Status).label}</strong></>;
    case "assign_member": return <>atribuir para <strong>{userNames}</strong></>;
    case "notify": return <>notificar <strong>{userNames || "os responsáveis (ou os masters)"}</strong></>;
    case "whatsapp_link": return <>deixar mensagem de WhatsApp pronta pra <strong>{userNames || "os responsáveis (ou os masters)"}</strong></>;
    case "schedule_instagram": return <>programar publicação no <strong>Instagram</strong></>;
    case "create_item": return <>criar a tarefa <strong>"{rule.actionMessage}"</strong>{userNames ? <> pra <strong>{userNames}</strong></> : null}</>;
    case "add_comment": return <>comentar <strong>"{rule.actionMessage}"</strong> no item</>;
    case "move_next_month": return <>mover o item pro <strong>próximo mês</strong></>;
    case "send_email": return <>enviar e-mail {rule.actionAudience === "client" ? <>pros <strong>contatos do cliente</strong></> : <>pra <strong>{userNames || "os responsáveis (ou os masters)"}</strong></>}</>;
  }
}

function timeAgo(iso: string) {
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMin < 60) return `há ${Math.max(1, diffMin)} min`;
  if (diffMin < 60 * 24) return `há ${Math.round(diffMin / 60)}h`;
  return `há ${Math.round(diffMin / 60 / 24)} dia(s)`;
}

type RulePayload = {
  triggerType: TriggerType; triggerStatus?: string; triggerDays?: number;
  actionType: ActionType; actionStatus?: string; actionUserIds?: string[]; actionMessage?: string;
  filterClientId?: string; filterContentType?: string; actionAudience?: "team" | "client"; actionSubject?: string;
};

// Modelos prontos: 1 clique cria a regra já com texto. Sem pessoa fixa —
// notifica os responsáveis do item (ou os masters quando não há item).
const TEMPLATES: { id: string; title: string; desc: string; payload: RulePayload }[] = [
  {
    id: "cobrar-aprovacao", title: "Cobrar cliente que demora pra aprovar",
    desc: "Se um post ficar 2 dias em Revisão cliente, deixa o WhatsApp de cobrança pronto.",
    payload: { triggerType: "stale_days", triggerStatus: "REVISAO_CLIENTE", triggerDays: 2, actionType: "whatsapp_link",
      actionMessage: 'Oi {cliente}! Passando pra lembrar do "{titulo}", que está aguardando a sua aprovação 🙂' },
  },
  {
    id: "cliente-pediu-ajuste", title: "Avisar quando o cliente pedir ajuste",
    desc: "Notifica os responsáveis assim que o cliente comentar num post do feed.",
    payload: { triggerType: "feed_feedback", actionType: "notify", actionMessage: 'O cliente pediu um ajuste em "{titulo}".' },
  },
  {
    id: "prazo-amanha", title: "Lembrete 1 dia antes do prazo",
    desc: "Notifica os responsáveis na véspera do prazo, se o item ainda não está pronto.",
    payload: { triggerType: "deadline_days_before", triggerDays: 1, actionType: "notify", actionMessage: '"{titulo}" ({cliente}) vence amanhã.' },
  },
  {
    id: "prazo-vencido", title: "Avisar prazo vencido",
    desc: "Notifica os responsáveis quando um item passa do prazo sem ficar pronto.",
    payload: { triggerType: "deadline_overdue", actionType: "notify", actionMessage: '"{titulo}" ({cliente}) passou do prazo.' },
  },
  {
    id: "falha-instagram", title: "Avisar falha na publicação do Instagram",
    desc: "Se um post não subir, notifica na hora com o motivo — sem esperar alguém descobrir.",
    payload: { triggerType: "ig_publish_failed", actionType: "notify", actionMessage: 'Não consegui publicar "{titulo}" ({cliente}) no Instagram: {erro}' },
  },
  {
    id: "aprovou-feed-agendar", title: "Cliente aprovou o feed → criar tarefa de agendar",
    desc: "Quando o cliente aprovar o feed, cria uma tarefa \"Agendar\" pra equipe não esquecer.",
    payload: { triggerType: "feed_approved", actionType: "create_item", actionMessage: "Agendar posts aprovados de {cliente}" },
  },
  {
    id: "contrato-onboarding", title: "Contrato assinado → tarefa de onboarding",
    desc: "Cria a tarefa de onboarding do cliente assim que ele assinar o contrato.",
    payload: { triggerType: "contract_signed", actionType: "create_item", actionMessage: "Onboarding de {cliente}: acessos, briefing e pasta do Drive" },
  },
  {
    id: "roteiro-aprovado", title: "Avisar quando o cliente aprovar um roteiro",
    desc: "Notifica os masters quando um roteiro for aprovado pelo cliente.",
    payload: { triggerType: "roteiro_approved", actionType: "notify", actionMessage: '{cliente} aprovou o roteiro "{titulo}".' },
  },
  {
    id: "cobranca-3-dias", title: "Lembrar cobrança 3 dias antes do vencimento",
    desc: "Deixa a mensagem de WhatsApp pronta antes da mensalidade do cliente vencer.",
    payload: { triggerType: "payment_days_before", triggerDays: 3, actionType: "whatsapp_link",
      actionMessage: "Oi {cliente}! Só passando pra lembrar que a mensalidade vence em breve 🙂" },
  },
  {
    id: "mensalidade-atrasada", title: "Avisar mensalidade atrasada",
    desc: "Notifica os masters quando a mensalidade de um cliente passar do vencimento sem pagamento registrado.",
    payload: { triggerType: "payment_overdue", actionType: "notify", actionMessage: "A mensalidade de {cliente} está atrasada." },
  },
  {
    id: "cliente-sem-entrega", title: "Cliente sem entrega há 15 dias",
    desc: "Alerta de retenção: nenhum post/reel/story finalizado há 15 dias (repete no máximo 1x por semana).",
    payload: { triggerType: "client_no_post_days", triggerDays: 15, actionType: "notify", actionMessage: "{cliente} está há bastante tempo sem entrega — vale checar." },
  },
];

function templateKey(p: RulePayload) {
  return `${p.triggerType}|${p.triggerStatus ?? null}|${p.triggerDays ?? null}|${p.actionType}|${p.actionMessage ?? null}`;
}

export function AutomationsTab() {
  return (
    <div className="space-y-8 max-w-3xl">
      <ClientTemplatesSection />
      <MonthRolloverSection />
      <AutomationRulesSection />
    </div>
  );
}

function AutomationRulesSection() {
  const me = useMe().data;
  const isMaster = me?.role === "master";
  const { data: rules = [] } = useQuery(automationRulesQO());
  const { data: profiles = [] } = useQuery(profilesQO());
  const { data: clients = [] } = useQuery(clientsQO());
  const { createAutomationRule, deleteAutomationRule, setAutomationRuleActive, testAutomationRule } = useApi();
  // null = fechado, "add" = criando nova, ou a chave do grupo sendo editado.
  const [formTarget, setFormTarget] = useState<null | "add" | string>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  function memberName(userId: string | null) {
    return profiles.find((p) => p.id === userId)?.name ?? "—";
  }
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "cliente removido";

  // Cada pessoa atribuída é uma linha própria no banco (o gatilho já soma
  // todas as regras que baterem no mesmo status), mas na tela agrupamos por
  // gatilho+ação pra "atribuir pra 3 pessoas" aparecer como 1 linha só, não 3
  // repetidas — só muda o que aprece, o dado por trás continua 1 regra por pessoa.
  const grouped = (() => {
    const map = new Map<string, { key: string; rule: (typeof rules)[number]; ids: string[]; userIds: string[]; fires: number; last: string | null; active: boolean }>();
    for (const r of rules) {
      const key = `${r.triggerType}|${r.triggerStatus}|${r.triggerDays}|${r.actionType}|${r.actionStatus}|${r.actionMessage}|${r.filterClientId}|${r.filterContentType}|${r.actionAudience}|${r.actionSubject}`;
      const existing = map.get(key);
      if (existing) {
        existing.ids.push(r.id);
        existing.fires += r.fires;
        if (r.lastFiredAt && (!existing.last || r.lastFiredAt > existing.last)) existing.last = r.lastFiredAt;
        existing.active = existing.active && r.active;
        if (r.actionUserId) existing.userIds.push(r.actionUserId);
      } else {
        map.set(key, { key, rule: r, ids: [r.id], userIds: r.actionUserId ? [r.actionUserId] : [], fires: r.fires, last: r.lastFiredAt, active: r.active });
      }
    }
    return [...map.values()];
  })();

  function submitCreate(payload: RulePayload) {
    const { actionUserIds, ...rest } = payload;
    const ids = actionUserIds && actionUserIds.length > 0 ? actionUserIds : [undefined];
    return Promise.all(ids.map((actionUserId) =>
      createAutomationRule.mutateAsync({ data: { ...rest, actionUserId } as any }),
    ));
  }

  const editingGroup = typeof formTarget === "string" && formTarget !== "add"
    ? grouped.find((g) => g.key === formTarget) ?? null
    : null;
  const existingTemplateKeys = new Set(grouped.map((g) => templateKey({
    triggerType: g.rule.triggerType, triggerStatus: g.rule.triggerStatus ?? undefined, triggerDays: g.rule.triggerDays ?? undefined,
    actionType: g.rule.actionType, actionMessage: g.rule.actionMessage ?? undefined,
  })));
  const templatesOpen = showTemplates || (rules.length === 0 && formTarget === null);

  return (
    <div>
      <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
        <Zap size={12} /> Minhas automações
      </h2>
      <div className="bg-card rounded-lg overflow-hidden">
        {rules.length === 0 && formTarget === null && (
          <div className="px-5 py-6 text-sm text-foreground/40">Nenhuma automação criada ainda — comece por um modelo pronto abaixo ou crie a sua.</div>
        )}
        {grouped.map((g) => (
          editingGroup?.key === g.key ? (
            <NewRuleForm
              key={g.key}
              profiles={profiles}
              clients={clients}
              submitLabel="Salvar alterações"
              initial={{
                triggerType: g.rule.triggerType, triggerStatus: g.rule.triggerStatus ?? undefined,
                triggerDays: g.rule.triggerDays ?? undefined, actionType: g.rule.actionType,
                actionStatus: g.rule.actionStatus ?? undefined, actionUserIds: g.userIds,
                actionMessage: g.rule.actionMessage ?? undefined,
                filterClientId: g.rule.filterClientId ?? undefined, filterContentType: g.rule.filterContentType ?? undefined,
                actionAudience: (g.rule.actionAudience as "team" | "client" | null) ?? undefined, actionSubject: g.rule.actionSubject ?? undefined,
              }}
              onCancel={() => setFormTarget(null)}
              onSubmit={(payload) => {
                Promise.all(g.ids.map((id) => deleteAutomationRule.mutateAsync({ data: { id } })))
                  .then(() => submitCreate(payload))
                  .then(() => setFormTarget(null))
                  .catch((e: any) => toast.error(e?.message ?? "Erro ao salvar automação"));
              }}
            />
          ) : (
            <div key={g.key} className={`flex items-center gap-3 px-5 py-3.5 border-b border-foreground/5 last:border-b-0 ${g.active ? "" : "opacity-55"}`}>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-foreground/85">
                  {describeTrigger(g.rule)}
                  {" → "}
                  {describeAction(g.rule, g.userIds.map(memberName).join(", "))}
                </span>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {!g.active && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-foreground/10 text-foreground/60">Pausada</span>}
                  {g.rule.filterClientId && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-foreground/[0.06] text-foreground/60">só {clientName(g.rule.filterClientId)}</span>}
                  {g.rule.filterContentType && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-foreground/[0.06] text-foreground/60">só {TYPE_LABEL[g.rule.filterContentType]}</span>}
                  <span className="text-[10.5px] text-foreground/35">
                    {g.fires > 0 ? `Disparou ${g.fires}x${g.last ? ` · última ${timeAgo(g.last)}` : ""}` : "Ainda não disparou"}
                  </span>
                </div>
              </div>
              {isMaster && (
                <>
                  {MESSAGE_ACTIONS.includes(g.rule.actionType) && (
                    <button
                      title="Testar: manda a mensagem como notificação pra você"
                      onClick={() => testAutomationRule.mutate({ data: {
                        message: g.rule.actionMessage || (g.rule.actionType === "create_item" ? "Tarefa automática — {cliente}" : "Automação: {titulo}"),
                        description: TRIGGER_LABEL[g.rule.triggerType],
                      } })}
                      className="p-1.5 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5 shrink-0"
                    ><FlaskConical size={13} /></button>
                  )}
                  <button
                    title={g.active ? "Pausar" : "Retomar"}
                    onClick={() => setAutomationRuleActive.mutate({ data: { ids: g.ids, active: !g.active } })}
                    className="p-1.5 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5 shrink-0"
                  >{g.active ? <Pause size={13} /> : <Play size={13} />}</button>
                  <button
                    onClick={() => setFormTarget(g.key)}
                    className="p-1.5 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5 shrink-0"
                  ><Pencil size={13} /></button>
                  <button
                    onClick={async () => {
                      if (await requestConfirm(g.ids.length > 1 ? "Excluir essa automação pra todas as pessoas atribuídas?" : "Excluir essa automação?", { danger: true })) {
                        g.ids.forEach((id) => deleteAutomationRule.mutate({ data: { id } }));
                      }
                    }}
                    className="p-1.5 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5 shrink-0"
                  ><Trash2 size={13} /></button>
                </>
              )}
            </div>
          )
        ))}
        {isMaster && (
          formTarget === "add" ? (
            <NewRuleForm
              profiles={profiles}
              clients={clients}
              onCancel={() => setFormTarget(null)}
              onSubmit={(payload) => {
                submitCreate(payload).then(() => setFormTarget(null)).catch((e: any) => toast.error(e?.message ?? "Erro ao criar automação"));
              }}
            />
          ) : formTarget === null ? (
            <button
              onClick={() => setFormTarget("add")}
              className="w-full flex items-center justify-center gap-1.5 px-5 py-3.5 text-xs font-semibold text-foreground/60 hover:text-foreground hover:bg-foreground/[0.03] transition-colors"
            ><Plus size={13} /> Nova automação</button>
          ) : null
        )}
      </div>

      {isMaster && (
        <div className="mt-4">
          <button
            onClick={() => setShowTemplates((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-foreground/50 hover:text-foreground transition"
          >
            <Sparkles size={12} /> Modelos prontos
            <ChevronDown size={12} className={`transition-transform ${templatesOpen ? "rotate-180" : ""}`} />
          </button>
          {templatesOpen && (
            <div className="grid sm:grid-cols-2 gap-2.5 mt-3">
              {TEMPLATES.map((t) => {
                const added = existingTemplateKeys.has(templateKey(t.payload));
                return (
                  <div key={t.id} className="bg-card rounded-lg p-3.5 flex flex-col gap-2">
                    <div className="text-[13px] font-semibold text-foreground">{t.title}</div>
                    <p className="text-[11.5px] text-foreground/45 leading-relaxed flex-1">{t.desc}</p>
                    <button
                      disabled={added}
                      onClick={() => submitCreate(t.payload).then(() => toast.success("Automação adicionada.")).catch((e: any) => toast.error(e?.message ?? "Erro ao criar automação"))}
                      className="self-start text-[11px] font-bold px-3 py-1.5 rounded-md disabled:opacity-40 transition"
                      style={added ? { backgroundColor: "color-mix(in srgb, var(--foreground) 8%, transparent)" } : { backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
                    >{added ? "Já adicionada" : "Adicionar"}</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-foreground/30 mt-3">
        As automações rodam direto no sistema, mesmo que ninguém esteja com a tela aberta. Os gatilhos de tempo (prazo, item parado, cliente sem entrega, cobrança) são conferidos uma vez por dia, de manhã.
      </p>
    </div>
  );
}

function NewRuleForm({
  profiles, clients, initial, submitLabel, onCancel, onSubmit,
}: {
  profiles: { id: string; name: string }[];
  clients: { id: string; name: string }[];
  initial?: RulePayload;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (payload: RulePayload) => void;
}) {
  const [triggerType, setTriggerType] = useState<TriggerType>(initial?.triggerType ?? "status_change");
  const [triggerStatus, setTriggerStatus] = useState<string>(initial?.triggerStatus ?? STATUS_OPTIONS[0]);
  const [triggerDays, setTriggerDays] = useState(initial?.triggerDays ?? 3);
  const [actionType, setActionType] = useState<ActionType>(initial?.actionType ?? "set_status");
  const [actionStatus, setActionStatus] = useState<Status>((initial?.actionStatus as Status) ?? STATUS_OPTIONS[0]);
  const [actionUserIds, setActionUserIds] = useState<string[]>(initial?.actionUserIds ?? (initial ? [] : (profiles[0] ? [profiles[0].id] : [])));
  const [actionMessage, setActionMessage] = useState(initial?.actionMessage ?? "");
  const [filterClientId, setFilterClientId] = useState(initial?.filterClientId ?? "");
  const [filterContentType, setFilterContentType] = useState(initial?.filterContentType ?? "");
  const [actionAudience, setActionAudience] = useState<"team" | "client">(initial?.actionAudience ?? "team");
  const [actionSubject, setActionSubject] = useState(initial?.actionSubject ?? "");

  function toggleUser(id: string) {
    setActionUserIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  const isClientLevel = CLIENT_LEVEL_TRIGGERS.includes(triggerType);
  const availableActions = ACTION_TYPES.filter((a) => !(isClientLevel && ITEM_ONLY_ACTIONS.includes(a)));
  function changeTrigger(t: TriggerType) {
    setTriggerType(t);
    if (CLIENT_LEVEL_TRIGGERS.includes(t) && ITEM_ONLY_ACTIONS.includes(actionType)) setActionType("notify");
  }

  const selectClass = "bg-background border border-foreground/10 rounded-md px-2.5 py-2 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";
  const inputClass = "w-full bg-background border border-foreground/10 rounded-md px-2.5 py-2 text-xs text-foreground placeholder:text-foreground/30 outline-none focus:border-[rgb(var(--lz-brand-rgb))]";
  const isEmailToClient = actionType === "send_email" && actionAudience === "client";
  const showUserSelect = USER_SELECT_ACTIONS.includes(actionType) && !isEmailToClient;
  const showMessage = MESSAGE_ACTIONS.includes(actionType);
  const requiresUser = actionType === "assign_member";
  const requiresMessage = actionType === "add_comment" || actionType === "create_item" || actionType === "send_email";
  const showTypeFilter = !isClientLevel;

  const messagePlaceholder =
    actionType === "whatsapp_link" ? 'Oi {cliente}! Sobre "{titulo}"...'
    : actionType === "create_item" ? "Título da tarefa (ex: Agendar posts de {cliente})"
    : actionType === "add_comment" ? "Texto do comentário"
    : actionType === "send_email" ? "Mensagem do e-mail"
    : "Mensagem da notificação (opcional)";

  return (
    <div className="px-5 py-4 border-t border-foreground/6 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/70">
        <select value={triggerType} onChange={(e) => changeTrigger(e.target.value as TriggerType)} className={selectClass}>
          {TRIGGER_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.filter((t) => TRIGGER_TYPES.includes(t)).map((t) => <option key={t} value={t}>{TRIGGER_LABEL[t]}</option>)}
            </optgroup>
          ))}
        </select>
        {(triggerType === "status_change" || triggerType === "stale_days") && (
          <select value={triggerStatus} onChange={(e) => setTriggerStatus(e.target.value)} className={selectClass}>
            {triggerType === "stale_days" && <option value="">qualquer status</option>}
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        )}
        {DAYS_TRIGGER_TYPES.includes(triggerType) && (
          <span className="inline-flex items-center gap-1.5">
            <input
              type="number" min={0} max={365} value={triggerDays}
              onChange={(e) => setTriggerDays(Math.max(0, Number(e.target.value) || 0))}
              className={`${selectClass} w-16`}
            />
            <span className="text-foreground/40">{DAYS_LABEL[triggerType]}</span>
          </span>
        )}
        <span>então</span>
        <select value={actionType} onChange={(e) => setActionType(e.target.value as ActionType)} className={selectClass}>
          {availableActions.map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
        </select>
        {actionType === "set_status" && (
          <select value={actionStatus} onChange={(e) => setActionStatus(e.target.value as Status)} className={selectClass}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        )}
        {actionType === "send_email" && (
          <select value={actionAudience} onChange={(e) => setActionAudience(e.target.value as "team" | "client")} className={selectClass}>
            <option value="team">pra equipe</option>
            <option value="client">pros contatos do cliente</option>
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/50">
        <span>Só quando for</span>
        <select value={filterClientId} onChange={(e) => setFilterClientId(e.target.value)} className={selectClass}>
          <option value="">qualquer cliente</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {showTypeFilter && (
          <select value={filterContentType} onChange={(e) => setFilterContentType(e.target.value)} className={selectClass}>
            <option value="">qualquer tipo de conteúdo</option>
            <option value="post">só Posts</option>
            <option value="reel">só Reels</option>
            <option value="story">só Stories</option>
          </select>
        )}
      </div>

      {showUserSelect && (
        <div className="flex flex-wrap gap-1.5">
          {profiles.map((p) => {
            const selected = actionUserIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggleUser(p.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border transition ${
                  selected
                    ? "border-transparent text-[#0D0D0D]"
                    : "border-foreground/10 text-foreground/60 hover:text-foreground hover:border-foreground/20"
                }`}
                style={selected ? { backgroundColor: "rgb(var(--lz-brand-rgb))" } : undefined}
              >
                {p.name}
              </button>
            );
          })}
          <p className="w-full text-[10.5px] text-foreground/35 mt-0.5">
            {requiresUser
              ? "Pode escolher mais de uma pessoa — cria uma atribuição pra cada."
              : actionType === "create_item"
                ? "Escolha quem fica responsável pela tarefa (uma tarefa por pessoa escolhida), ou deixe sem ninguém."
                : "Deixe sem ninguém selecionado pra avisar os responsáveis do item (ou os masters, quando não há item), ou escolha pessoas específicas."}
          </p>
        </div>
      )}
      {actionType === "send_email" && (
        <input
          value={actionSubject}
          onChange={(e) => setActionSubject(e.target.value)}
          placeholder="Assunto do e-mail (opcional — padrão: Atualização — {cliente})"
          maxLength={150}
          className={inputClass}
        />
      )}
      {showMessage && (
        <div>
          <textarea
            value={actionMessage}
            onChange={(e) => setActionMessage(e.target.value)}
            placeholder={messagePlaceholder}
            rows={2}
            className={`${inputClass} resize-none`}
          />
          <p className="text-[10.5px] text-foreground/35 mt-1">
            Pode usar {"{cliente}"} e {"{titulo}"} (nome do cliente e título do item{isClientLevel ? " — nesses gatilhos, o título é o do roteiro/seleção/contrato" : ""}){triggerType === "ig_publish_failed" ? <>, e {"{erro}"} (o motivo que o Instagram devolveu)</> : null}.
            {actionType === "send_email" ? " O e-mail sai em até 10 minutos." : ""}
          </p>
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-foreground/60 hover:text-foreground">Cancelar</button>
        <button
          disabled={(requiresUser && actionUserIds.length === 0) || (requiresMessage && !actionMessage.trim())}
          onClick={() => onSubmit({
            triggerType,
            triggerStatus: triggerType === "status_change" ? triggerStatus : triggerType === "stale_days" ? (triggerStatus || undefined) : undefined,
            triggerDays: DAYS_TRIGGER_TYPES.includes(triggerType) ? triggerDays : undefined,
            actionType,
            actionStatus: actionType === "set_status" ? actionStatus : undefined,
            actionUserIds: showUserSelect ? actionUserIds : undefined,
            actionMessage: showMessage ? (actionMessage.trim() || undefined) : undefined,
            filterClientId: filterClientId || undefined,
            filterContentType: showTypeFilter ? (filterContentType || undefined) : undefined,
            actionAudience: actionType === "send_email" ? actionAudience : undefined,
            actionSubject: actionType === "send_email" ? (actionSubject.trim() || undefined) : undefined,
          })}
          className="px-3 py-1.5 rounded-md text-xs font-bold disabled:opacity-40"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >{submitLabel ?? "Salvar"}</button>
      </div>
    </div>
  );
}
