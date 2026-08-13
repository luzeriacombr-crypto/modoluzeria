import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Save, Check, X, Pencil, Trash2, Plus } from "lucide-react";
import { cleaningQO, profilesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { AssigneePicker, colorForLabel } from "./AssigneePicker";
import { Avatar } from "./Avatar";
import { toast } from "sonner";
import { requestConfirm } from "@/lib/luzeria/confirm-store";

export const CLEANING_DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function CleaningView() {
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const isMaster = me?.role === "master";
  const { data } = useQuery(cleaningQO());
  const { data: profiles = [] } = useQuery(profilesQO());
  const { upsertCleaningCell, updateCleaningNote, setCleaningDone, addCleaningTask, renameCleaningTask, deleteCleaningTask } = useApi();
  const [picker, setPicker] = useState<{ rect: DOMRect; taskId: string; weekday: number } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteDirty, setNoteDirty] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [newTaskName, setNewTaskName] = useState("");

  useEffect(() => { if (data && !noteDirty) setNoteDraft(data.note); }, [data, noteDirty]);

  const tasks = data?.tasks ?? [];

  const cellMap = useMemo(() => {
    const m = new Map<string, { userId: string | null; label: string | null }>();
    (data?.cells ?? []).forEach((c) => m.set(`${c.taskId}-${c.weekday}`, { userId: c.userId, label: c.label }));
    return m;
  }, [data]);

  const logMap = useMemo(() => {
    const m = new Map<string, { status: "done" | "missed"; occurrenceDate: string }>();
    (data?.weekLog ?? []).forEach((l) => m.set(`${l.taskId}-${l.weekday}`, { status: l.status, occurrenceDate: l.occurrenceDate }));
    return m;
  }, [data]);

  // Compute current week's occurrence date for each weekday (Monday=0..Saturday=5)
  const weekDates = useMemo(() => {
    const base = data?.weekStart ? new Date(`${data.weekStart}T00:00:00`) : (() => {
      const n = new Date();
      const dow = n.getDay(); const diff = (dow + 6) % 7;
      n.setDate(n.getDate() - diff); n.setHours(0, 0, 0, 0); return n;
    })();
    const out: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(base); d.setDate(base.getDate() + i);
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    return out;
  }, [data]);

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  function info(entry?: { userId: string | null; label: string | null }) {
    if (!entry) return null;
    if (entry.userId) {
      const p = profiles.find((x) => x.id === entry.userId);
      if (p) return { name: p.name, color: p.color, profile: p };
    }
    if (entry.label) return { name: entry.label, color: colorForLabel(entry.label), profile: null };
    return null;
  }

  function startEdit(id: string, name: string) {
    setEditingTaskId(id);
    setEditName(name);
  }

  function saveEdit() {
    if (!editingTaskId) return;
    const value = editName.trim();
    if (value) renameCleaningTask.mutate({ data: { id: editingTaskId, name: value } });
    setEditingTaskId(null);
  }

  function submitNewTask() {
    const value = newTaskName.trim();
    if (!value) return;
    addCleaningTask.mutate({ data: { name: value } });
    setNewTaskName("");
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-wider mb-2">
            <Sparkles size={13} /> <span>Escala</span>
          </div>
          <h1 className="text-[32px] font-bold text-white leading-none tracking-tight">Rotina</h1>
          <p className="text-sm text-white/50 mt-2">Tabela semanal de tarefas recorrentes da equipe.</p>
        </div>
      </div>

      <div className="bg-[#1C1C1C] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[10px] uppercase font-bold tracking-wider text-white/40 px-4 py-3 w-[280px]">Tarefa</th>
                {CLEANING_DAYS.map((d) => (
                  <th key={d} className="text-left text-[10px] uppercase font-bold tracking-wider text-white/40 px-3 py-3">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 && (
                <tr>
                  <td colSpan={CLEANING_DAYS.length + 1} className="px-4 py-8 text-center text-white/40 text-xs">
                    Nenhuma tarefa cadastrada{isMaster ? " — adicione uma abaixo." : "."}
                  </td>
                </tr>
              )}
              {tasks.map((task, ti) => (
                <tr key={task.id} className="border-b border-white/[0.04] last:border-b-0 group">
                  <td className="px-4 py-3 text-white/90 align-top">
                    {editingTaskId === task.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditingTaskId(null); }}
                          className="flex-1 min-w-0 bg-[#0D0D0D] border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
                        />
                        <button onClick={saveEdit} className="p-1 rounded text-[rgb(var(--lz-brand-rgb))] hover:bg-white/5 shrink-0"><Save size={13} /></button>
                        <button onClick={() => setEditingTaskId(null)} className="p-1 rounded text-white/40 hover:bg-white/5 shrink-0"><X size={13} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-white/40 text-[11px] mr-1 shrink-0">{String(ti + 1).padStart(2, "0")}</span>
                        <span className="flex-1 min-w-0">{task.name}</span>
                        {isMaster && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button onClick={() => startEdit(task.id, task.name)} title="Editar tarefa"
                              className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5"><Pencil size={12} /></button>
                            <button
                              onClick={async () => { if (await requestConfirm(`Excluir a tarefa "${task.name}"? Isso também remove as atribuições e o histórico dela.`, { danger: true })) deleteCleaningTask.mutate({ data: { id: task.id } }); }}
                              title="Excluir tarefa"
                              className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/5"><Trash2 size={12} /></button>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  {CLEANING_DAYS.map((_, wi) => {
                    const entry = cellMap.get(`${task.id}-${wi}`);
                    const i = info(entry);
                    const isMine = !!entry?.userId && entry.userId === me?.id;
                    const occ = weekDates[wi];
                    const log = logMap.get(`${task.id}-${wi}`);
                    const status: "pending" | "done" | "missed" = log?.status ?? "pending";
                    const canToggle = !!entry?.userId && (isMine || isAdmin);
                    return (
                      <td key={wi} className="p-1.5 align-top">
                        <div className="relative">
                        <button
                          disabled={!isAdmin}
                          onClick={(e) => isAdmin && setPicker({ rect: (e.currentTarget as HTMLElement).getBoundingClientRect(), taskId: task.id, weekday: wi })}
                          className="w-full min-h-[42px] rounded-md px-2 py-1.5 flex items-center gap-1.5 transition-colors text-left"
                          style={{
                            backgroundColor: isMine ? "rgba(var(--lz-brand-light-rgb),0.1)" : i ? "rgba(255,255,255,0.03)" : "transparent",
                            border: isMine ? "1px solid rgb(var(--lz-brand-rgb))" : "1px solid rgba(255,255,255,0.05)",
                            cursor: isAdmin ? "pointer" : "default",
                          }}
                        >
                          {i ? (
                            <>
                              {i.profile
                                ? <Avatar profile={i.profile} size={20} />
                                : <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: i.color }} />}
                              <span className="text-xs font-medium truncate flex-1" style={{ color: i.color === "#FFFFFF" ? "#FFFFFF" : i.color }}>{i.name}</span>
                            </>
                          ) : (
                            <span className="text-white/20 text-xs">—</span>
                          )}
                        </button>
                        {entry?.userId && (
                          <button
                            type="button"
                            disabled={!canToggle || (status === "missed" && !isAdmin)}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!canToggle) return;
                              if (status === "missed" && !isAdmin) return;
                              setCleaningDone.mutate({ data: { taskId: task.id, weekday: wi, occurrenceDate: occ, done: status !== "done" } });
                            }}
                            title={
                              status === "done" ? `Feito (${occ === todayStr ? "hoje" : occ}) — clique para desfazer`
                              : status === "missed" ? "Não feito"
                              : occ === todayStr ? "Pendente — marcar como feito"
                              : occ < todayStr ? "Pendente" : "Aguardando o dia"
                            }
                            className="absolute top-1 right-1 h-4 w-4 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor:
                                status === "done" ? "rgb(var(--lz-brand-rgb))"
                                : status === "missed" ? "#FF4444"
                                : "rgba(255,255,255,0.15)",
                              color: status === "missed" ? "#FFFFFF" : "#0D0D0D",
                              cursor: canToggle ? "pointer" : "default",
                              border: status === "pending" ? "1px solid rgba(255,255,255,0.25)" : "none",
                            }}
                          >
                            {status === "done" ? <Check size={10} strokeWidth={3} />
                              : status === "missed" ? <X size={10} strokeWidth={3} />
                              : null}
                          </button>
                        )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {isMaster && (
                <tr>
                  <td colSpan={CLEANING_DAYS.length + 1} className="px-4 py-3">
                    <div className="flex items-center gap-2 max-w-sm">
                      <input
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") submitNewTask(); }}
                        placeholder="Nova tarefa…"
                        className="flex-1 bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-1.5 text-xs text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] placeholder:text-white/30"
                      />
                      <button
                        disabled={!newTaskName.trim()}
                        onClick={submitNewTask}
                        className="px-2.5 py-1.5 rounded-md text-xs font-bold disabled:opacity-30 transition-opacity inline-flex items-center gap-1"
                        style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
                      ><Plus size={13} /> Adicionar</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-white/[0.06] p-5">
          <div className="text-[10px] uppercase font-bold tracking-wider text-white/40 mb-2">Nota</div>
          {isAdmin ? (
            <div className="space-y-2">
              <textarea
                value={noteDraft}
                onChange={(e) => { setNoteDraft(e.target.value); setNoteDirty(true); }}
                rows={3}
                className="w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-xs text-white/90 outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-none"
              />
              {noteDirty && (
                <button
                  onClick={() => updateCleaningNote.mutate(
                    { data: { note: noteDraft } },
                    { onSuccess: () => { setNoteDirty(false); toast.success("Nota salva"); } },
                  )}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md"
                  style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
                >
                  <Save size={12} /> Salvar nota
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-white/60 italic leading-relaxed">{noteDraft}</p>
          )}
        </div>
      </div>

      {picker && createPortal(
        <AssigneePicker
          anchorRect={picker.rect}
          onClose={() => setPicker(null)}
          onPick={(p) => upsertCleaningCell.mutate({ data: { taskId: picker.taskId, weekday: picker.weekday, userId: p.userId, label: p.label } })}
        />,
        document.body,
      )}
    </div>
  );
}
