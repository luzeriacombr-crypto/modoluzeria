import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2, Plus, ListChecks } from "lucide-react";
import { cleaningTasksQO, useApi } from "@/lib/luzeria/queries";

export function CleaningTasksTab() {
  const { data: tasks = [] } = useQuery(cleaningTasksQO());
  const { addCleaningTask, deleteCleaningTask } = useApi();
  const [name, setName] = useState("");

  function submit() {
    const value = name.trim();
    if (!value) return;
    addCleaningTask.mutate({ data: { name: value } });
    setName("");
  }

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2 text-white/60 text-[11px] uppercase tracking-wider font-bold mb-3">
        <ListChecks size={12} /> Tarefas da Rotina
      </div>
      <p className="text-xs text-white/50 mb-4 leading-relaxed">
        Essa lista aparece na tela "Rotina", numa tabela semanal onde você atribui um responsável por tarefa e dia.
      </p>
      <div className="space-y-2">
        {tasks.length === 0 && (
          <p className="text-xs text-white/40">Nenhuma tarefa cadastrada.</p>
        )}
        {tasks.map((t) => (
          <div key={t.id} className="flex items-center gap-2 bg-[#1C1C1C] border border-white/[0.06] rounded-md px-3 py-2">
            <span className="text-xs text-white flex-1 min-w-0 truncate">{t.name}</span>
            <button
              onClick={() => {
                if (confirm(`Excluir a tarefa "${t.name}"? Isso também remove as atribuições e o histórico dela na Rotina.`))
                  deleteCleaningTask.mutate({ data: { id: t.id } });
              }}
              className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/5"
            ><Trash2 size={13} /></button>
          </div>
        ))}
        <div className="flex gap-2 mt-1">
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder="Nova tarefa (ex.: Revisar métricas da semana)"
            className="flex-1 bg-[#1C1C1C] border border-white/[0.08] rounded-md px-3 py-2 text-xs text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] placeholder:text-white/30"
          />
          <button
            disabled={!name.trim()}
            onClick={submit}
            className="px-3 rounded-md text-xs font-bold disabled:opacity-30 transition-opacity"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
          ><Plus size={13} /></button>
        </div>
      </div>
    </div>
  );
}
