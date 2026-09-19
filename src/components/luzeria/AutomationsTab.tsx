import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Calendar, Plus, Repeat, Sparkles, Timer, Trash2, Zap } from "lucide-react";
import { cronJobsQO, automationRulesQO, profilesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { STATUS_META, getStatusMeta, type Status, type BuiltinStatus } from "@/lib/luzeria/types";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { TRIGGER_TYPES, ACTION_TYPES, type AutomationRule, type TriggerType, type ActionType } from "@/lib/luzeria/automation-rules.functions";

const STATUS_OPTIONS = Object.keys(STATUS_META) as BuiltinStatus[];

const TRIGGER_LABEL: Record<TriggerType, string> = {
  on_create: "Quando o item for criado",
  status_change: "Quando o status virar",
  deadline_days_before: "N dias antes do prazo",
  deadline_overdue: "Quando o prazo vencer",
  stale_days: "Quando ficar parado N dias",
  feed_approved: "Quando o cliente aprovar o feed",
  feed_feedback: "Quando o cliente pedir ajuste",
  file_attached: "Quando anexarem um arquivo",
};

const ACTION_LABEL: Record<ActionType, string> = {
  set_status: "Alterar status para",
  assign_member: "Atribuir para",
  notify: "Notificar",
  whatsapp_link: "Deixar mensagem de WhatsApp pronta",
  schedule_instagram: "Programar no Instagram",
};

// Ações que aceitam escolher uma ou mais pessoas (vazio = "os responsáveis
// atuais do item", só faz sentido pra notify/whatsapp_link).
const USER_SELECT_ACTIONS: ActionType[] = ["assign_member", "notify", "whatsapp_link"];
const MESSAGE_ACTIONS: ActionType[] = ["notify", "whatsapp_link"];
const DAYS_TRIGGERS: TriggerType[] = ["deadline_days_before", "stale_days"];

function describeTrigger(rule: AutomationRule): ReactNode {
  switch (rule.triggerType) {
    case "on_create": return <>Quando o item for <strong>criado</strong></>;
    case "status_change": return <>Quando o status virar <strong style={{ color: getStatusMeta(rule.triggerStatus as Status).color }}>{getStatusMeta(rule.triggerStatus as Status).label}</strong></>;
    case "deadline_days_before": return <><strong>{rule.triggerDays}</strong> dia(s) antes do prazo</>;
    case "deadline_overdue": return <>Quando o prazo <strong>vencer</strong></>;
    case "stale_days": return <>Quando ficar <strong>{rule.triggerDays} dia(s)</strong> parado no mesmo status</>;
    case "feed_approved": return <>Quando o cliente <strong>aprovar o feed</strong></>;
    case "feed_feedback": return <>Quando o cliente <strong>pedir ajuste</strong> num post</>;
    case "file_attached": return <>Quando <strong>anexarem um arquivo</strong></>;
  }
}

function describeAction(rule: AutomationRule, userNames: string): ReactNode {
  switch (rule.actionType) {
    case "set_status": return <>alterar status para <strong style={{ color: getStatusMeta(rule.actionStatus as Status).color }}>{getStatusMeta(rule.actionStatus as Status).label}</strong></>;
    case "assign_member": return <>atribuir para <strong>{userNames}</strong></>;
    case "notify": return <>notificar <strong>{userNames || "os responsáveis do item"}</strong></>;
    case "whatsapp_link": return <>deixar mensagem de WhatsApp pronta pra <strong>{userNames || "os responsáveis do item"}</strong></>;
    case "schedule_instagram": return <>programar publicação no <strong>Instagram</strong></>;
  }
}

const JOB_META: Record<string, { label: string; description: string; icon: React.ComponentType<any> }> = {
  luzeria_deadline_reminders: {
    label: "Alertas de prazo",
    description: "Avisa responsáveis sobre demandas que vencem hoje, amanhã ou estão atrasadas.",
    icon: Bell,
  },
  luzeria_daily_digest: {
    label: "Resumo diário",
    description: "Envia 1 notificação por colaborador com a agenda do dia (demandas, stories e limpeza).",
    icon: Calendar,
  },
  luzeria_recurring_daily: {
    label: "Geração de recorrências",
    description: "Cria automaticamente os itens recorrentes do mês para cada cliente.",
    icon: Repeat,
  },
  "auto-mark-missed-daily": {
    label: "Marcar não-feitos",
    description: "Marca como 'não feito' stories e limpeza do dia anterior que não foram concluídos.",
    icon: Timer,
  },
};

function humanCron(expr: string) {
  // very small helper for the few crons we use
  const map: Record<string, string> = {
    "0 12 * * *": "Todo dia às 09:00 (Brasília)",
    "0 11 * * *": "Todo dia às 08:00 (Brasília)",
    "0 6 * * *":  "Todo dia às 03:00 (Brasília)",
    "59 2 * * *": "Todo dia às 23:59 (Brasília)",
  };
  return map[expr] ?? expr;
}

function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  return `há ${d}d`;
}

export function AutomationsTab() {
  const { data: jobs = [], isLoading } = useQuery(cronJobsQO());

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
          <Sparkles size={12} /> Automações ativas
        </h2>
        <div className="bg-card rounded-lg overflow-hidden">
          {isLoading && (
            <div className="px-5 py-6 text-sm text-foreground/40">Carregando…</div>
          )}
          {!isLoading && jobs.length === 0 && (
            <div className="px-5 py-6 text-sm text-foreground/40">Nenhuma automação encontrada.</div>
          )}
          {jobs.map((j) => {
            const meta = JOB_META[j.jobname] ?? {
              label: j.jobname, description: "", icon: Sparkles,
            };
            const Icon = meta.icon;
            return (
              <div key={j.jobname}
                className="flex items-start gap-4 px-5 py-4 border-b border-foreground/5 last:border-b-0">
                <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-foreground truncate">{meta.label}</div>
                    {j.active ? (
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.18)", color: "var(--lz-accent-ink)" }}>Ativa</span>
                    ) : (
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-foreground/10 text-foreground/50">Pausada</span>
                    )}
                  </div>
                  {meta.description && (
                    <div className="text-[11px] text-foreground/50 mt-1">{meta.description}</div>
                  )}
                  <div className="text-[11px] text-foreground/40 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>⏱ {humanCron(j.schedule)}</span>
                    <span>Última execução: {relativeTime(j.lastStart)}{j.lastStatus ? ` · ${j.lastStatus}` : ""}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AutomationRulesSection />
    </div>
  );
}

function AutomationRulesSection() {
  const me = useMe().data;
  const isMaster = me?.role === "master";
  const { data: rules = [] } = useQuery(automationRulesQO());
  const { data: profiles = [] } = useQuery(profilesQO());
  const { createAutomationRule, deleteAutomationRule } = useApi();
  const [adding, setAdding] = useState(false);

  function memberName(userId: string | null) {
    return profiles.find((p) => p.id === userId)?.name ?? "—";
  }

  // Cada pessoa atribuída é uma linha própria no banco (o gatilho já soma
  // todas as regras que baterem no mesmo status), mas na tela agrupamos por
  // gatilho+ação pra "atribuir pra 3 pessoas" aparecer como 1 linha só, não 3
  // repetidas — só muda o que aprece, o dado por trás continua 1 regra por pessoa.
  const grouped = (() => {
    const map = new Map<string, { rule: (typeof rules)[number]; ids: string[]; userIds: string[] }>();
    for (const r of rules) {
      const key = `${r.triggerType}|${r.triggerStatus}|${r.triggerDays}|${r.actionType}|${r.actionStatus}|${r.actionMessage}`;
      const existing = map.get(key);
      if (existing) {
        existing.ids.push(r.id);
        if (r.actionUserId) existing.userIds.push(r.actionUserId);
      } else {
        map.set(key, { rule: r, ids: [r.id], userIds: r.actionUserId ? [r.actionUserId] : [] });
      }
    }
    return [...map.values()];
  })();

  return (
    <div>
      <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
        <Zap size={12} /> Minhas automações
      </h2>
      <div className="bg-card rounded-lg overflow-hidden">
        {rules.length === 0 && !adding && (
          <div className="px-5 py-6 text-sm text-foreground/40">Nenhuma automação criada ainda.</div>
        )}
        {grouped.map((g) => (
          <div key={g.ids.join(",")} className="flex items-center gap-3 px-5 py-3.5 border-b border-foreground/5 last:border-b-0">
            <span className="text-sm text-foreground/85 flex-1 min-w-0">
              {describeTrigger(g.rule)}
              {" → "}
              {describeAction(g.rule, g.userIds.map(memberName).join(", "))}
            </span>
            {isMaster && (
              <button
                onClick={async () => {
                  if (await requestConfirm(g.ids.length > 1 ? "Excluir essa automação pra todas as pessoas atribuídas?" : "Excluir essa automação?", { danger: true })) {
                    g.ids.forEach((id) => deleteAutomationRule.mutate({ data: { id } }));
                  }
                }}
                className="p-1.5 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5 shrink-0"
              ><Trash2 size={13} /></button>
            )}
          </div>
        ))}
        {isMaster && (
          adding ? (
            <NewRuleForm
              profiles={profiles}
              onCancel={() => setAdding(false)}
              onSubmit={(payload) => {
                const { actionUserIds, ...rest } = payload;
                const ids = actionUserIds && actionUserIds.length > 0 ? actionUserIds : [undefined];
                Promise.all(ids.map((actionUserId) =>
                  createAutomationRule.mutateAsync({ data: { ...rest, actionUserId } }),
                )).then(() => setAdding(false)).catch((e: any) => toast.error(e?.message ?? "Erro ao criar automação"));
              }}
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center justify-center gap-1.5 px-5 py-3.5 text-xs font-semibold text-foreground/60 hover:text-foreground hover:bg-foreground/[0.03] transition-colors"
            ><Plus size={13} /> Nova automação</button>
          )
        )}
      </div>
      <p className="text-[11px] text-foreground/30 mt-3">
        As automações rodam direto no sistema, mesmo que ninguém esteja com a tela aberta.
      </p>
    </div>
  );
}

function NewRuleForm({
  profiles, onCancel, onSubmit,
}: {
  profiles: { id: string; name: string }[];
  onCancel: () => void;
  onSubmit: (payload: {
    triggerType: TriggerType; triggerStatus?: string; triggerDays?: number;
    actionType: ActionType; actionStatus?: string; actionUserIds?: string[]; actionMessage?: string;
  }) => void;
}) {
  const [triggerType, setTriggerType] = useState<TriggerType>("status_change");
  const [triggerStatus, setTriggerStatus] = useState<Status>(STATUS_OPTIONS[0]);
  const [triggerDays, setTriggerDays] = useState(3);
  const [actionType, setActionType] = useState<ActionType>("set_status");
  const [actionStatus, setActionStatus] = useState<Status>(STATUS_OPTIONS[0]);
  const [actionUserIds, setActionUserIds] = useState<string[]>(profiles[0] ? [profiles[0].id] : []);
  const [actionMessage, setActionMessage] = useState("");

  function toggleUser(id: string) {
    setActionUserIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  const selectClass = "bg-background border border-foreground/10 rounded-md px-2.5 py-2 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";
  const showUserSelect = USER_SELECT_ACTIONS.includes(actionType);
  const showMessage = MESSAGE_ACTIONS.includes(actionType);
  const requiresUser = actionType === "assign_member";

  return (
    <div className="px-5 py-4 border-t border-foreground/6 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/70">
        <select value={triggerType} onChange={(e) => setTriggerType(e.target.value as TriggerType)} className={selectClass}>
          {TRIGGER_TYPES.map((t) => <option key={t} value={t}>{TRIGGER_LABEL[t]}</option>)}
        </select>
        {triggerType === "status_change" && (
          <select value={triggerStatus} onChange={(e) => setTriggerStatus(e.target.value as Status)} className={selectClass}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        )}
        {DAYS_TRIGGERS.includes(triggerType) && (
          <span className="inline-flex items-center gap-1.5">
            <input
              type="number" min={0} max={365} value={triggerDays}
              onChange={(e) => setTriggerDays(Math.max(0, Number(e.target.value) || 0))}
              className={`${selectClass} w-16`}
            />
            <span className="text-foreground/40">dia(s)</span>
          </span>
        )}
        <span>então</span>
        <select value={actionType} onChange={(e) => setActionType(e.target.value as ActionType)} className={selectClass}>
          {ACTION_TYPES.map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
        </select>
        {actionType === "set_status" && (
          <select value={actionStatus} onChange={(e) => setActionStatus(e.target.value as Status)} className={selectClass}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        )}
        {showUserSelect && <span className="text-foreground/40">(escolha abaixo)</span>}
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
              : "Deixe sem ninguém selecionado pra avisar os responsáveis atuais do item, ou escolha pessoas específicas."}
          </p>
        </div>
      )}
      {showMessage && (
        <div>
          <textarea
            value={actionMessage}
            onChange={(e) => setActionMessage(e.target.value)}
            placeholder={actionType === "whatsapp_link" ? 'Oi {cliente}! Sobre "{titulo}"...' : "Mensagem da notificação (opcional)"}
            rows={2}
            className="w-full bg-background border border-foreground/10 rounded-md px-2.5 py-2 text-xs text-foreground placeholder:text-foreground/30 outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-none"
          />
          <p className="text-[10.5px] text-foreground/35 mt-1">Pode usar {"{cliente}"} e {"{titulo}"} — são trocados pelo nome do cliente e o título do item.</p>
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-foreground/60 hover:text-foreground">Cancelar</button>
        <button
          disabled={requiresUser && actionUserIds.length === 0}
          onClick={() => onSubmit({
            triggerType,
            triggerStatus: triggerType === "status_change" ? triggerStatus : undefined,
            triggerDays: DAYS_TRIGGERS.includes(triggerType) ? triggerDays : undefined,
            actionType,
            actionStatus: actionType === "set_status" ? actionStatus : undefined,
            actionUserIds: showUserSelect ? actionUserIds : undefined,
            actionMessage: showMessage ? (actionMessage.trim() || undefined) : undefined,
          })}
          className="px-3 py-1.5 rounded-md text-xs font-bold disabled:opacity-40"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >Salvar</button>
      </div>
    </div>
  );
}