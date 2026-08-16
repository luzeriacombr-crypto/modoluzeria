import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { journeyStagesQO, useApi } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import type { JourneyStage, JourneyTrack, StageMilestoneType } from "@/lib/luzeria/journey-stages.functions";

const TRACK_LABEL: Record<JourneyTrack, string> = {
  onboarding: "Onboarding — primeiro mês do cliente",
  operational: "Operação — ciclo mensal de quem já está rodando",
};

const MILESTONE_LABEL: Record<StageMilestoneType, string> = {
  gravacao: "Gravação",
  analise: "Análise do mês",
};

export function JourneyStagesTab() {
  const { data: stages = [] } = useQuery(journeyStagesQO());
  const onboarding = stages.filter((s) => s.track === "onboarding").sort((a, b) => a.sortOrder - b.sortOrder);
  const operational = stages.filter((s) => s.track === "operational").sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-8 max-w-2xl">
      <TrackColumn track="onboarding" label={TRACK_LABEL.onboarding} stages={onboarding} />
      <TrackColumn track="operational" label={TRACK_LABEL.operational} stages={operational} />
    </div>
  );
}

function TrackColumn({ track, label, stages }: { track: JourneyTrack; label: string; stages: JourneyStage[] }) {
  const api = useApi();
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="text-sm font-bold text-white mb-1">{label}</div>
      <p className="text-[11px] text-white/40 mb-3">
        {track === "onboarding"
          ? "Etapas que acontecem uma vez, do fechamento do contrato até o cliente estar rodando normal."
          : "Etapas que se repetem todo mês, uma vez que o cliente já está em operação."}
      </p>
      <div className="space-y-2">
        {stages.length === 0 && !adding && (
          <p className="text-xs text-white/40">Nenhuma etapa cadastrada.</p>
        )}
        {stages.map((s) => <StageRow key={s.id} stage={s} />)}
      </div>
      {adding ? (
        <StageEditForm
          onCancel={() => setAdding(false)}
          onSave={(d) => {
            api.upsertJourneyStage.mutate({ data: { track, name: d.name, description: d.description, milestoneType: d.milestoneType } });
            setAdding(false);
          }}
        />
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full mt-2 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-white/15 py-2 text-[11px] text-white/50 hover:text-[rgb(var(--lz-brand-rgb))] hover:border-[rgb(var(--lz-brand-rgb))]">
          <Plus size={12} /> Adicionar etapa
        </button>
      )}
    </div>
  );
}

function StageRow({ stage }: { stage: JourneyStage }) {
  const api = useApi();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <StageEditForm
        initial={{ name: stage.name, description: stage.description, milestoneType: stage.milestoneType }}
        onCancel={() => setEditing(false)}
        onSave={(d) => {
          api.upsertJourneyStage.mutate({ data: { id: stage.id, track: stage.track, name: d.name, description: d.description, milestoneType: d.milestoneType } });
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="bg-[#1C1C1C] border border-white/[0.06] rounded-md px-3 py-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="text-sm font-semibold text-white">{stage.name}</div>
            {stage.milestoneType && (
              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.15)", color: "rgb(var(--lz-brand-rgb))" }}>
                {MILESTONE_LABEL[stage.milestoneType]}
              </span>
            )}
          </div>
          {stage.description && <div className="mt-0.5 text-[11px] text-white/50 leading-relaxed">{stage.description}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setEditing(true)} className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5" title="Editar">
            <Pencil size={13} />
          </button>
          <button
            onClick={async () => { if (await requestConfirm(`Excluir a etapa "${stage.name}"?`, { danger: true })) api.deleteJourneyStage.mutate({ data: { id: stage.id } }); }}
            className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/5" title="Excluir"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function StageEditForm({ initial, onCancel, onSave }: {
  initial?: { name: string; description: string; milestoneType: StageMilestoneType | null };
  onCancel: () => void;
  onSave: (d: { name: string; description: string; milestoneType: StageMilestoneType | null }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [milestoneType, setMilestoneType] = useState<StageMilestoneType | null>(initial?.milestoneType ?? null);

  return (
    <div className="bg-[#1C1C1C] border border-white/[0.08] rounded-md p-3 space-y-2 mt-2">
      <input
        value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da etapa"
        className="w-full bg-[#0D0D0D] border border-white/10 rounded px-2.5 py-1.5 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
      />
      <textarea
        value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Descrição — vira a mensagem sugerida no WhatsApp"
        className="w-full bg-[#0D0D0D] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-none"
      />
      <label className="block">
        <span className="block text-[10px] uppercase font-semibold tracking-wider text-white/40 mb-1">
          Marcar como (aparece na Visão Geral)
        </span>
        <select
          value={milestoneType ?? ""}
          onChange={(e) => setMilestoneType((e.target.value || null) as StageMilestoneType | null)}
          className="w-full bg-[#0D0D0D] border border-white/10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
        >
          <option value="">— Nenhuma</option>
          <option value="gravacao">Gravação</option>
          <option value="analise">Análise do mês</option>
        </select>
      </label>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="inline-flex items-center gap-1 text-[11px] text-white/50 hover:text-white px-2 py-1">
          <X size={12} /> Cancelar
        </button>
        <button
          disabled={!name.trim()}
          onClick={() => onSave({ name: name.trim(), description: description.trim(), milestoneType })}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold disabled:opacity-30"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          <Check size={12} /> Salvar
        </button>
      </div>
    </div>
  );
}
