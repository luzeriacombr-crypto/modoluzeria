// House (Fase 4) — Projetos de marketing: lista, criação a partir de modelo
// (Evento, Programa de rádio, Campanha ou em branco) e o projeto aberto com
// etapas, tarefas (responsável + prazo) e checklist próprio.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CalendarDays, Check, FolderKanban, Mic, Megaphone, PartyPopper, Plus, Trash2, X, FilePlus2 } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { useMe, profilesQO } from "@/lib/luzeria/queries";
import {
  listProjects, createProject, updateProject, deleteProject, upsertProjectTask, setProjectTaskDone, deleteProjectTask,
  type Project, type ProjectTask,
} from "@/lib/luzeria/house-owner.functions";
import { PROJECT_TEMPLATES, PROJECT_STATUS_LABEL, type ProjectStatus, type ProjectTemplateId } from "@/lib/luzeria/house-projects";
import { houseDateKey } from "@/lib/luzeria/house-checklists";
import { Avatar } from "./Avatar";
import { useHouseBrand } from "@/lib/luzeria/house-brand-store";
import { HouseBrandSwitcher, HouseBrandSelect } from "./HouseBrandSwitcher";

const KEY = ["house-projects"];
const TEMPLATE_ICON: Record<ProjectTemplateId, typeof PartyPopper> = { evento: PartyPopper, radio: Mic, campanha: Megaphone, livre: FilePlus2 };
const fmtDate = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");

export function HouseProjects({ projectId, onOpen }: { projectId?: string; onOpen: (id: string | undefined) => void }) {
  const listFn = useServerFn(listProjects);
  const { brandParam } = useHouseBrand();
  const { data: projects = [], isLoading } = useQuery({ queryKey: [...KEY, brandParam ?? "all"], queryFn: () => listFn({ data: { brandId: brandParam } }) });
  const [creating, setCreating] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const open = projects.find((p) => p.id === projectId);

  if (open) return <ProjectDetail project={open} onBack={() => onOpen(undefined)} />;

  const active = projects.filter((p) => p.status === "andamento" || p.status === "planejado");
  const closed = projects.filter((p) => p.status === "concluido" || p.status === "cancelado");

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-10 max-w-5xl mx-auto pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase font-bold tracking-wider text-foreground/40">Marketing</div>
          <h1 className="text-[28px] md:text-[32px] font-bold text-foreground tracking-tight mt-0.5">Projetos</h1>
        </div>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-bold"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          <Plus size={15} /> Novo projeto
        </button>
      </div>

      <HouseBrandSwitcher className="mt-4" />
      {isLoading ? <div className="mt-8 text-sm text-foreground/40">Carregando…</div> : (
        <div className="mt-6 space-y-3">
          {active.length === 0 && (
            <div className="border border-dashed border-foreground/10 rounded-2xl p-10 text-center">
              <FolderKanban size={28} className="mx-auto text-foreground/25" />
              <p className="text-sm text-foreground/50 mt-3">Nenhum projeto em andamento. Comece por um evento, um programa de rádio ou uma campanha.</p>
            </div>
          )}
          {active.map((p) => <ProjectRow key={p.id} project={p} onClick={() => onOpen(p.id)} />)}
          {closed.length > 0 && (
            <>
              <button onClick={() => setShowDone((v) => !v)} className="text-xs font-semibold text-foreground/50 hover:text-foreground pt-3">
                {showDone ? "Esconder" : "Ver"} concluídos e cancelados ({closed.length})
              </button>
              {showDone && closed.map((p) => <ProjectRow key={p.id} project={p} onClick={() => onOpen(p.id)} />)}
            </>
          )}
        </div>
      )}
      {creating && <NewProjectModal onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); onOpen(id); }} />}
    </div>
  );
}

function ProjectRow({ project: p, onClick }: { project: Project; onClick: () => void }) {
  const today = houseDateKey();
  const done = p.tasks.filter((t) => t.doneAt).length;
  const late = p.tasks.filter((t) => !t.doneAt && t.dueDate && t.dueDate < today).length;
  const next = p.tasks.filter((t) => !t.doneAt && t.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0];
  const Icon = TEMPLATE_ICON[p.template];
  const pctDone = p.tasks.length ? done / p.tasks.length : 0;
  return (
    <button onClick={onClick} className="w-full text-left bg-card rounded-2xl p-5 border border-foreground/[0.06] hover:border-foreground/15 transition">
      <div className="flex items-start gap-4">
        <span className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.12)", color: "var(--lz-accent-ink)" }}>
          <Icon size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-foreground truncate">{p.title}</span>
            {p.status !== "andamento" && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-foreground/[0.06] text-foreground/55">{PROJECT_STATUS_LABEL[p.status]}</span>}
          </div>
          <div className="text-xs text-foreground/50 mt-0.5">
            {PROJECT_TEMPLATES.find((t) => t.id === p.template)?.label}{p.eventDate ? ` · ${fmtDate(p.eventDate)}` : ""}
            {next ? ` · próxima: ${next.title} (${fmtDate(next.dueDate)})` : ""}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex-1 h-2 rounded-full bg-foreground/[0.08] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.round(pctDone * 100)}%`, background: "rgb(var(--lz-brand-rgb))" }} />
            </div>
            <span className="text-xs tabular-nums text-foreground/55">{done}/{p.tasks.length}</span>
            {late > 0 && <span className="inline-flex items-center gap-0.5 text-xs font-semibold" style={{ color: "#FF6B6B" }}><AlertTriangle size={12} /> {late}</span>}
          </div>
        </div>
      </div>
    </button>
  );
}

function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const me = useMe().data;
  const createFn = useServerFn(createProject);
  const { data: profiles = [] } = useQuery(profilesQO());
  const [template, setTemplate] = useState<ProjectTemplateId>("evento");
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [ownerId, setOwnerId] = useState(me?.id ?? "");
  const { brandParam } = useHouseBrand();
  const [pickBrand, setPickBrand] = useState<string | undefined>(undefined);
  const tpl = PROJECT_TEMPLATES.find((t) => t.id === template)!;
  const taskCount = tpl.stages.reduce((n, s) => n + s.tasks.length, 0);
  const create = useMutation({
    mutationFn: () => createFn({ data: { template, title: title.trim(), eventDate: eventDate || null, ownerId: ownerId || null, brandId: pickBrand ?? brandParam } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Projeto criado."); onCreated(r.id); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui criar o projeto"),
  });

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="w-full md:max-w-lg bg-card rounded-t-2xl md:rounded-2xl p-6 border border-foreground/10 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-foreground">Novo projeto</h3>
          <button onClick={onClose} className="p-1 rounded text-foreground/50 hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="mb-4"><HouseBrandSelect value={pickBrand ?? brandParam} onChange={setPickBrand} /></div>
        <div className="grid grid-cols-2 gap-2">
          {PROJECT_TEMPLATES.map((t) => {
            const Icon = TEMPLATE_ICON[t.id];
            const on = t.id === template;
            return (
              <button key={t.id} onClick={() => setTemplate(t.id)} className="text-left rounded-xl p-3 border transition"
                style={on ? { borderColor: "rgb(var(--lz-brand-rgb))", background: "rgba(var(--lz-brand-rgb),0.08)" } : { borderColor: "color-mix(in srgb, var(--foreground) 12%, transparent)" }}>
                <Icon size={16} style={{ color: "var(--lz-accent-ink)" }} />
                <div className="text-sm font-bold text-foreground mt-1.5">{t.label}</div>
                <div className="text-[11px] text-foreground/50 leading-snug mt-0.5">{t.description}</div>
              </button>
            );
          })}
        </div>
        <div className="space-y-3 mt-5">
          <label className="block">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-foreground/45 mb-1">Nome do projeto</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className="lz-input w-full"
              placeholder={template === "evento" ? "ex: Dia da Saúde Bucal na praça" : template === "radio" ? "ex: Programa Sorriso em Dia, ep. 12" : template === "campanha" ? "ex: Campanha de clareamento de novembro" : "ex: Novo site"} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-foreground/45 mb-1">{tpl.dateLabel}</span>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="lz-input w-full" />
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-foreground/45 mb-1">Responsável</span>
              <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="lz-input w-full">
                {profiles.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
          {taskCount > 0 && (
            <p className="text-[11px] text-foreground/50">
              Cria {tpl.stages.length} etapas e {taskCount} tarefas{eventDate ? " com os prazos já calculados a partir da data" : " (coloque a data pra calcular os prazos)"}.
            </p>
          )}
        </div>
        <button onClick={() => create.mutate()} disabled={!title.trim() || create.isPending}
          className="mt-5 w-full rounded-md py-3 text-sm font-bold disabled:opacity-40"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          {create.isPending ? "Criando…" : "Criar projeto"}
        </button>
      </div>
    </div>
  );
}

function ProjectDetail({ project: p, onBack }: { project: Project; onBack: () => void }) {
  const qc = useQueryClient();
  const me = useMe().data;
  const { data: profiles = [] } = useQuery(profilesQO());
  const byId = new Map(profiles.map((x) => [x.id, x]));
  const updateFn = useServerFn(updateProject);
  const deleteFn = useServerFn(deleteProject);
  const toggleFn = useServerFn(setProjectTaskDone);
  const upsertFn = useServerFn(upsertProjectTask);
  const deleteTaskFn = useServerFn(deleteProjectTask);
  const invalidate = () => { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: ["house-owner-panel"] }); };
  const [editingTask, setEditingTask] = useState<ProjectTask | { stage: string } | null>(null);
  const today = houseDateKey();

  const toggle = useMutation({
    mutationFn: (v: { id: string; done: boolean }) => toggleFn({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<Project[]>(KEY);
      if (prev) qc.setQueryData<Project[]>(KEY, prev.map((pr) => pr.id !== p.id ? pr : { ...pr, tasks: pr.tasks.map((t) => t.id === v.id ? { ...t, doneAt: v.done ? new Date().toISOString() : null } : t) }));
      return { prev };
    },
    onError: (e: any, _v, ctx) => { if (ctx?.prev) qc.setQueryData(KEY, ctx.prev); toastFriendlyError(e, "Não consegui salvar"); },
    onSettled: invalidate,
  });
  const setStatus = useMutation({
    mutationFn: (status: ProjectStatus) => updateFn({ data: { id: p.id, status } }),
    onSuccess: invalidate,
    onError: (e: any) => toastFriendlyError(e, "Não consegui salvar"),
  });
  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { id: p.id } }),
    onSuccess: () => { invalidate(); onBack(); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui apagar"),
  });

  const stages = useMemo(() => {
    const order: string[] = [];
    for (const t of p.tasks) if (!order.includes(t.stage)) order.push(t.stage);
    return order.map((s) => ({ stage: s, tasks: p.tasks.filter((t) => t.stage === s) }));
  }, [p.tasks]);
  const done = p.tasks.filter((t) => t.doneAt).length;
  const Icon = TEMPLATE_ICON[p.template];

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-10 max-w-4xl mx-auto pb-28">
      <button onClick={onBack} className="inline-flex items-center gap-1 text-xs text-foreground/50 hover:text-foreground mb-4"><ArrowLeft size={13} /> Projetos</button>
      <div className="bg-card rounded-2xl p-5 sm:p-6 border border-foreground/[0.06]" style={{ background: "linear-gradient(135deg, rgba(var(--lz-brand-rgb),0.1), var(--card) 65%)" }}>
        <div className="flex items-start gap-4">
          <span className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.16)", color: "var(--lz-accent-ink)" }}><Icon size={20} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase font-bold tracking-wider" style={{ color: "var(--lz-accent-ink)" }}>{PROJECT_TEMPLATES.find((t) => t.id === p.template)?.label}</div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight mt-0.5">{p.title}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/55 mt-1.5">
              {p.eventDate && <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {new Date(`${p.eventDate}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</span>}
              {p.ownerId && byId.get(p.ownerId) && <span>Responsável: {byId.get(p.ownerId)!.name}</span>}
              <span>{done} de {p.tasks.length} tarefas</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <select value={p.status} onChange={(e) => setStatus.mutate(e.target.value as ProjectStatus)} className="lz-input text-xs">
            {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((s) => <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>)}
          </select>
          <span className="flex-1" />
          {(me?.role === "master" || p.createdBy === me?.id) && (
            <button onClick={async () => { if (await requestConfirm(`Apagar o projeto "${p.title}" e todas as tarefas?`, { danger: true })) remove.mutate(); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-red-400 hover:bg-red-500/10"><Trash2 size={13} /> Apagar</button>
          )}
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {stages.map(({ stage, tasks }) => {
          const stDone = tasks.filter((t) => t.doneAt).length;
          return (
            <section key={stage} className="bg-card rounded-2xl p-4 sm:p-5 border border-foreground/[0.06]">
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-sm font-bold text-foreground">{stage}</h2>
                <span className="text-xs tabular-nums text-foreground/45">{stDone}/{tasks.length}</span>
              </div>
              <ul className="space-y-0.5">
                {tasks.map((t) => {
                  const late = !t.doneAt && t.dueDate && t.dueDate < today;
                  const resp = t.responsibleId ? byId.get(t.responsibleId) : null;
                  return (
                    <li key={t.id} className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-foreground/[0.03]">
                      <button onClick={() => toggle.mutate({ id: t.id, done: !t.doneAt })} aria-label={t.doneAt ? "Desmarcar" : "Marcar como feito"}
                        className="h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors"
                        style={t.doneAt ? { backgroundColor: "rgb(var(--lz-brand-rgb))", borderColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" } : { borderColor: "color-mix(in srgb, var(--foreground) 25%, transparent)" }}>
                        {t.doneAt && <Check size={13} strokeWidth={3} />}
                      </button>
                      <button onClick={() => setEditingTask(t)} className="flex-1 min-w-0 text-left">
                        <span className={`text-sm ${t.doneAt ? "text-foreground/40 line-through" : "text-foreground/90"}`}>{t.title}</span>
                      </button>
                      {t.dueDate && (
                        <span className="text-[11px] tabular-nums shrink-0" style={{ color: late ? "#FF6B6B" : "color-mix(in srgb, var(--foreground) 45%, transparent)" }}>
                          {late && <AlertTriangle size={10} className="inline mr-0.5 -mt-0.5" />}{fmtDate(t.dueDate)}
                        </span>
                      )}
                      {resp && <Avatar name={resp.name} color={resp.color} avatarUrl={resp.avatarUrl} size={22} />}
                    </li>
                  );
                })}
              </ul>
              <button onClick={() => setEditingTask({ stage })} className="mt-1 ml-2 inline-flex items-center gap-1 text-xs text-foreground/45 hover:text-foreground"><Plus size={12} /> Tarefa</button>
            </section>
          );
        })}
        <button onClick={() => setEditingTask({ stage: "" })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/50 hover:text-foreground"><Plus size={14} /> Nova etapa</button>
      </div>

      {editingTask && (
        <TaskEditor projectId={p.id} task={editingTask} stages={stages.map((s) => s.stage)}
          onClose={() => setEditingTask(null)}
          onSave={async (v) => { try { await upsertFn({ data: v }); invalidate(); setEditingTask(null); } catch (e: any) { toastFriendlyError(e, "Não consegui salvar a tarefa"); } }}
          onDelete={"id" in editingTask ? async () => { try { await deleteTaskFn({ data: { id: (editingTask as ProjectTask).id } }); invalidate(); setEditingTask(null); } catch (e: any) { toastFriendlyError(e, "Não consegui apagar"); } } : undefined} />
      )}
    </div>
  );
}

function TaskEditor({ projectId, task, stages, onClose, onSave, onDelete }: {
  projectId: string; task: ProjectTask | { stage: string }; stages: string[];
  onClose: () => void;
  onSave: (v: { id?: string; projectId: string; stage: string; title: string; responsibleId: string | null; dueDate: string | null }) => void;
  onDelete?: () => void;
}) {
  const { data: profiles = [] } = useQuery(profilesQO());
  const existing = "id" in task ? task : null;
  const [stage, setStage] = useState(task.stage);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [responsibleId, setResponsibleId] = useState(existing?.responsibleId ?? "");
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? "");
  const newStage = !task.stage;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="w-full md:max-w-md bg-card rounded-t-2xl md:rounded-2xl p-6 border border-foreground/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-foreground">{existing ? "Editar tarefa" : newStage ? "Nova etapa" : "Nova tarefa"}</h3>
          <button onClick={onClose} className="p-1 rounded text-foreground/50 hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-foreground/45 mb-1">Etapa</span>
            {newStage ? (
              <input value={stage} onChange={(e) => setStage(e.target.value)} maxLength={60} className="lz-input w-full" placeholder="ex: Pós-evento" />
            ) : (
              <select value={stage} onChange={(e) => setStage(e.target.value)} className="lz-input w-full">
                {stages.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-foreground/45 mb-1">Tarefa</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} autoFocus className="lz-input w-full" placeholder="O que precisa ser feito" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-foreground/45 mb-1">Prazo</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="lz-input w-full" />
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-foreground/45 mb-1">Responsável</span>
              <select value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)} className="lz-input w-full">
                <option value="">Ninguém</option>
                {profiles.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-6">
          <button onClick={() => onSave({ id: existing?.id, projectId, stage: stage.trim(), title: title.trim(), responsibleId: responsibleId || null, dueDate: dueDate || null })}
            disabled={!title.trim() || !stage.trim()}
            className="flex-1 rounded-md py-3 text-sm font-bold disabled:opacity-40" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
            Salvar
          </button>
          {onDelete && (
            <button onClick={async () => { if (await requestConfirm("Apagar essa tarefa?", { danger: true })) onDelete(); }}
              className="px-4 py-3 rounded-md text-sm font-semibold text-red-400 hover:bg-red-500/10"><Trash2 size={15} /></button>
          )}
        </div>
      </div>
    </div>
  );
}
