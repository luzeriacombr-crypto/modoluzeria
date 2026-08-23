import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Calendar, Plus, PlayCircle, Repeat, Sparkles, Timer, Trash2, Zap } from "lucide-react";
import { cronJobsQO, automationRulesQO, profilesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { STATUS_META, type Status } from "@/lib/luzeria/types";
import { requestConfirm } from "@/lib/luzeria/confirm-store";

const STATUS_OPTIONS = Object.keys(STATUS_META) as Status[];

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
  const { runDailyDigestNow, runDeadlineRemindersNow } = useApi();

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

      <div>
        <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
          <PlayCircle size={12} /> Disparar agora
        </h2>
        <div className="bg-card rounded-lg p-5 grid sm:grid-cols-2 gap-3">
          <button
            disabled={runDeadlineRemindersNow.isPending}
            onClick={() => runDeadlineRemindersNow.mutate({} as any, {
              onSuccess: (r: any) => toast.success(`Alertas enviados: ${r.sent}`),
              onError: (e: any) => toast.error(e?.message ?? "Falhou"),
            })}
            className="lz-btn-primary rounded-md py-2.5 text-xs disabled:opacity-50">
            {runDeadlineRemindersNow.isPending ? "Enviando…" : "Rodar alertas de prazo"}
          </button>
          <button
            disabled={runDailyDigestNow.isPending}
            onClick={() => runDailyDigestNow.mutate({} as any, {
              onSuccess: (r: any) => toast.success(`Resumos enviados: ${r.sent}`),
              onError: (e: any) => toast.error(e?.message ?? "Falhou"),
            })}
            className="lz-btn-primary rounded-md py-2.5 text-xs disabled:opacity-50">
            {runDailyDigestNow.isPending ? "Enviando…" : "Rodar resumo diário"}
          </button>
        </div>
        <p className="text-[11px] text-foreground/30 mt-3">
          Útil para testar. As notificações respeitam as preferências de cada colaborador (configuráveis no perfil).
        </p>
      </div>
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

  return (
    <div>
      <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
        <Zap size={12} /> Minhas automações
      </h2>
      <div className="bg-card rounded-lg overflow-hidden">
        {rules.length === 0 && !adding && (
          <div className="px-5 py-6 text-sm text-foreground/40">Nenhuma automação criada ainda.</div>
        )}
        {rules.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-foreground/5 last:border-b-0">
            <span className="text-sm text-foreground/85 flex-1 min-w-0">
              {r.onCreate ? (
                <>Quando o item for <strong>criado</strong></>
              ) : (
                <>Quando o status virar <strong style={{ color: STATUS_META[r.triggerStatus as Status]?.color }}>{STATUS_META[r.triggerStatus as Status]?.label ?? r.triggerStatus}</strong></>
              )}
              {" → "}
              {r.actionType === "set_status" ? (
                <>alterar status para <strong style={{ color: STATUS_META[r.actionStatus as Status]?.color }}>{STATUS_META[r.actionStatus as Status]?.label ?? r.actionStatus}</strong></>
              ) : (
                <>atribuir para <strong>{memberName(r.actionUserId)}</strong></>
              )}
            </span>
            {isMaster && (
              <button
                onClick={async () => { if (await requestConfirm("Excluir essa automação?", { danger: true })) deleteAutomationRule.mutate({ data: { id: r.id } }); }}
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
              onSubmit={(payload) => createAutomationRule.mutate({ data: payload }, { onSuccess: () => setAdding(false) })}
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
  onSubmit: (payload: { triggerStatus?: string; onCreate?: boolean; actionType: "set_status" | "assign_member"; actionStatus?: string; actionUserId?: string }) => void;
}) {
  const [triggerMode, setTriggerMode] = useState<"status" | "create">("status");
  const [triggerStatus, setTriggerStatus] = useState<Status>(STATUS_OPTIONS[0]);
  const [actionType, setActionType] = useState<"set_status" | "assign_member">("set_status");
  const [actionStatus, setActionStatus] = useState<Status>(STATUS_OPTIONS[0]);
  const [actionUserId, setActionUserId] = useState(profiles[0]?.id ?? "");

  const selectClass = "bg-background border border-foreground/10 rounded-md px-2.5 py-2 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";

  return (
    <div className="px-5 py-4 border-t border-foreground/6 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/70">
        <select value={triggerMode} onChange={(e) => setTriggerMode(e.target.value as any)} className={selectClass}>
          <option value="status">Quando o status virar</option>
          <option value="create">Quando o item for criado</option>
        </select>
        {triggerMode === "status" && (
          <select value={triggerStatus} onChange={(e) => setTriggerStatus(e.target.value as Status)} className={selectClass}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        )}
        <span>então</span>
        <select value={actionType} onChange={(e) => setActionType(e.target.value as any)} className={selectClass}>
          <option value="set_status">Alterar status para</option>
          <option value="assign_member">Atribuir para</option>
        </select>
        {actionType === "set_status" ? (
          <select value={actionStatus} onChange={(e) => setActionStatus(e.target.value as Status)} className={selectClass}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        ) : (
          <select value={actionUserId} onChange={(e) => setActionUserId(e.target.value)} className={selectClass}>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-xs text-foreground/60 hover:text-foreground">Cancelar</button>
        <button
          disabled={actionType === "assign_member" && !actionUserId}
          onClick={() => onSubmit({
            triggerStatus: triggerMode === "status" ? triggerStatus : undefined,
            onCreate: triggerMode === "create" ? true : undefined,
            actionType,
            actionStatus: actionType === "set_status" ? actionStatus : undefined,
            actionUserId: actionType === "assign_member" ? actionUserId : undefined,
          })}
          className="px-3 py-1.5 rounded-md text-xs font-bold disabled:opacity-40"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >Salvar</button>
      </div>
    </div>
  );
}