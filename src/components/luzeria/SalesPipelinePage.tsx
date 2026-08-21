import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Check, X, Handshake, Archive, Tag, DollarSign } from "lucide-react";
import { salesStagesQO, leadsQO, profilesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { Modal } from "./Modals";
import { Avatar } from "./Avatar";
import { PRESET_COLORS } from "@/lib/luzeria/utils";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import type { SalesStage, Lead } from "@/lib/luzeria/sales-pipeline.functions";

const formatBRL = (v: number | null) =>
  v == null ? null : (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SalesPipelinePage() {
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const [showArchived, setShowArchived] = useState(false);
  const [editingStages, setEditingStages] = useState(false);
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [wonLead, setWonLead] = useState<Lead | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);

  const { data: stages = [] } = useQuery(salesStagesQO());
  const { data: leads = [] } = useQuery(leadsQO(showArchived));
  const api = useApi();

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.sortOrder - b.sortOrder), [stages]);
  const activeLeads = useMemo(() => leads.filter((l) => !l.archived), [leads]);
  const archivedLeads = useMemo(() => leads.filter((l) => l.archived), [leads]);

  function onDropOnStage(stageId: string) {
    if (dragId) {
      const lead = activeLeads.find((l) => l.id === dragId);
      if (lead && lead.stageId !== stageId) api.moveLeadStage.mutate({ data: { id: dragId, stageId } });
    }
    setDragId(null);
    setOverStageId(null);
  }

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Handshake size={20} className="text-[rgb(var(--lz-brand-rgb))]" />
          <h1 className="text-lg font-bold text-white">Vendas</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 border border-white/10"
          >
            <Archive size={13} /> {showArchived ? "Ver quadro" : "Ver histórico"}
          </button>
          {isAdmin && !showArchived && (
            <button
              onClick={() => setEditingStages(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 border border-white/10"
            >
              <Pencil size={13} /> Editar etapas
            </button>
          )}
          {!showArchived && (
            <button
              onClick={() => setNewLeadOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold"
              style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
            >
              <Plus size={13} /> Nova oportunidade
            </button>
          )}
        </div>
      </div>

      {showArchived ? (
        <ArchivedList leads={archivedLeads} />
      ) : (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-3 h-full min-w-max pb-2">
            {sortedStages.map((stage) => {
              const stageLeads = activeLeads.filter((l) => l.stageId === stage.id);
              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => { e.preventDefault(); if (dragId) setOverStageId(stage.id); }}
                  onDragLeave={() => { if (overStageId === stage.id) setOverStageId(null); }}
                  onDrop={(e) => { e.preventDefault(); onDropOnStage(stage.id); }}
                  className="w-[280px] shrink-0 rounded-lg border transition-colors flex flex-col"
                  style={{
                    backgroundColor: overStageId === stage.id ? "rgba(var(--lz-brand-rgb),0.06)" : "#161616",
                    borderColor: overStageId === stage.id ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                    <span className="text-xs font-bold uppercase tracking-wide text-white/70">{stage.name}</span>
                    <span className="text-[10px] text-white/30 font-semibold">{stageLeads.length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px]">
                    {stageLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        dragging={dragId === lead.id}
                        onDragStart={() => setDragId(lead.id)}
                        onDragEnd={() => { setDragId(null); setOverStageId(null); }}
                        onOpen={() => setEditLead(lead)}
                        onWon={() => setWonLead(lead)}
                        onLost={() => api.markLeadLost.mutate({ data: { id: lead.id } })}
                      />
                    ))}
                    {stageLeads.length === 0 && (
                      <p className="text-[11px] text-white/25 text-center py-4">Sem oportunidades aqui.</p>
                    )}
                  </div>
                </div>
              );
            })}
            {sortedStages.length === 0 && (
              <p className="text-sm text-white/40 py-10">Nenhuma etapa cadastrada ainda.</p>
            )}
          </div>
        </div>
      )}

      <LeadFormModal open={newLeadOpen} onClose={() => setNewLeadOpen(false)} defaultStageId={sortedStages[0]?.id} />
      <LeadFormModal open={!!editLead} onClose={() => setEditLead(null)} lead={editLead ?? undefined} />
      <WonLeadModal lead={wonLead} onClose={() => setWonLead(null)} />
      {editingStages && <StagesModal stages={sortedStages} onClose={() => setEditingStages(false)} />}
    </div>
  );
}

function LeadCard({ lead, dragging, onDragStart, onDragEnd, onOpen, onWon, onLost }: {
  lead: Lead; dragging: boolean;
  onDragStart: () => void; onDragEnd: () => void;
  onOpen: () => void; onWon: () => void; onLost: () => void;
}) {
  const value = formatBRL(lead.valueEstimateCents);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="rounded-md border border-white/[0.08] bg-[#1C1C1C] p-2.5 cursor-grab active:cursor-grabbing transition-opacity"
      style={{ opacity: dragging ? 0.4 : 1 }}
    >
      <div onClick={onOpen} className="cursor-pointer">
        <div className="text-sm font-semibold text-white truncate">{lead.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-white/40">
          {value && <span className="inline-flex items-center gap-0.5"><DollarSign size={10} /> {value}</span>}
          {lead.source && <span className="inline-flex items-center gap-0.5"><Tag size={10} /> {lead.source}</span>}
        </div>
        {lead.responsibleName && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <Avatar name={lead.responsibleName} color="#5BA88A" size={16} />
            <span className="text-[10.5px] text-white/50 truncate">{lead.responsibleName}</span>
          </div>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <button
          onClick={onWon}
          className="flex-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded"
          style={{ backgroundColor: "rgba(91,168,138,0.15)", color: "#5BA88A" }}
        >
          Ganho
        </button>
        <button
          onClick={onLost}
          className="flex-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded"
          style={{ backgroundColor: "rgba(231,111,81,0.15)", color: "#E76F51" }}
        >
          Perdido
        </button>
      </div>
    </div>
  );
}

function ArchivedList({ leads }: { leads: Lead[] }) {
  const api = useApi();
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const sorted = useMemo(() => [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [leads]);
  return (
    <div className="max-w-2xl space-y-2">
      {sorted.length === 0 && <p className="text-sm text-white/40 py-10 text-center">Nenhum lead arquivado ainda.</p>}
      {sorted.map((lead) => (
        <div key={lead.id} className="bg-[#1C1C1C] border border-white/[0.06] rounded-md px-3 py-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-white truncate">{lead.name}</span>
              <span
                className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
                style={lead.wonClientId
                  ? { backgroundColor: "rgba(91,168,138,0.15)", color: "#5BA88A" }
                  : { backgroundColor: "rgba(231,111,81,0.15)", color: "#E76F51" }}
              >
                {lead.wonClientId ? "Ganho" : "Perdido"}
              </span>
            </div>
            {formatBRL(lead.valueEstimateCents) && (
              <div className="text-[11px] text-white/40 mt-0.5">{formatBRL(lead.valueEstimateCents)}</div>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={async () => { if (await requestConfirm(`Excluir "${lead.name}" pra sempre?`, { danger: true })) api.deleteLead.mutate({ data: { id: lead.id } }); }}
              className="p-1.5 rounded text-white/30 hover:text-red-400 hover:bg-white/5 shrink-0"
              title="Excluir"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function LeadFormModal({ open, onClose, lead, defaultStageId }: {
  open: boolean; onClose: () => void; lead?: Lead; defaultStageId?: string;
}) {
  const { data: profiles = [] } = useQuery(profilesQO());
  const { data: stages = [] } = useQuery(salesStagesQO());
  const api = useApi();
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const [name, setName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [valueReais, setValueReais] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [stageId, setStageId] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(lead?.name ?? "");
    setContactPhone(lead?.contactPhone ?? "");
    setContactEmail(lead?.contactEmail ?? "");
    setSource(lead?.source ?? "");
    setNotes(lead?.notes ?? "");
    setValueReais(lead?.valueEstimateCents != null ? String(lead.valueEstimateCents / 100) : "");
    setResponsibleId(lead?.responsibleId ?? "");
    setStageId(lead?.stageId ?? defaultStageId ?? "");
  }, [open, lead?.id, defaultStageId]);

  function save() {
    const valueEstimateCents = valueReais.trim() ? Math.round(parseFloat(valueReais.replace(",", ".")) * 100) : null;
    api.upsertLead.mutateAsync({
      data: {
        id: lead?.id,
        name: name.trim(),
        contactPhone: contactPhone.trim() || null,
        contactEmail: contactEmail.trim() || null,
        source: source.trim() || null,
        notes: notes.trim() || null,
        valueEstimateCents,
        responsibleId: responsibleId || null,
        stageId: stageId || null,
      },
    }).then(onClose);
  }

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.sortOrder - b.sortOrder), [stages]);

  return (
    <Modal open={open} onClose={onClose} title={lead ? "Editar oportunidade" : "Nova oportunidade"}>
      <div className="space-y-3">
        <F label="Nome"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus className={inp} /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Telefone"><input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inp} /></F>
          <F label="E-mail"><input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inp} /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Origem"><input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Indicação, Instagram..." className={inp} /></F>
          <F label="Valor estimado (R$)"><input value={valueReais} onChange={(e) => setValueReais(e.target.value)} placeholder="0,00" className={inp} /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Responsável">
            <select value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)} className={inp}>
              <option value="">—</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </F>
          <F label="Etapa">
            <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={inp}>
              {sortedStages.map((s: SalesStage) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </F>
        </div>
        <F label="Observações"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inp + " resize-none"} /></F>
      </div>
      <div className="flex items-center justify-between mt-5">
        {lead && isAdmin ? (
          <button
            onClick={async () => { if (await requestConfirm(`Excluir "${lead.name}"?`, { danger: true })) { api.deleteLead.mutate({ data: { id: lead.id } }); onClose(); } }}
            className="text-xs text-white/40 hover:text-red-400 inline-flex items-center gap-1"
          >
            <Trash2 size={12} /> Excluir
          </button>
        ) : <span />}
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-white/60 hover:text-white">Cancelar</button>
          <button
            disabled={!name.trim() || api.upsertLead.isPending}
            onClick={save}
            className="px-4 py-2 rounded-md text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
          >
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}

const CLIENT_CATEGORIES = ["Social Media", "Pack Digital", "Avulsos"];

function WonLeadModal({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const api = useApi();
  const [clientName, setClientName] = useState("");
  const [category, setCategory] = useState("Social Media");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [icon, setIcon] = useState("");

  useEffect(() => {
    if (!lead) return;
    setClientName(lead.name);
    setCategory("Social Media");
    setColor(PRESET_COLORS[0]);
    setIcon("");
  }, [lead?.id]);

  if (!lead) return null;

  function save() {
    api.markLeadWon.mutateAsync({
      data: { id: lead!.id, clientName: clientName.trim(), category, color, icon: icon.trim() || null },
    }).then(onClose);
  }

  return (
    <Modal open={!!lead} onClose={onClose} title="Marcar como ganho">
      <p className="text-xs text-white/50 mb-3">Isso cria um cliente de verdade a partir dessa oportunidade.</p>
      <div className="space-y-3">
        <F label="Nome do cliente"><input value={clientName} onChange={(e) => setClientName(e.target.value)} autoFocus className={inp} /></F>
        <F label="Categoria">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inp}>
            {CLIENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </F>
        <div>
          <div className="text-[10px] uppercase font-semibold tracking-wider text-white/40 mb-1.5">Cor</div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
                style={{ backgroundColor: c, borderColor: color === c ? "rgb(var(--lz-brand-rgb))" : "transparent" }} />
            ))}
          </div>
        </div>
        <F label="Inicial / Emoji (opcional)"><input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={2} className={inp} /></F>
      </div>
      <div className="flex items-center justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-3 py-2 text-sm text-white/60 hover:text-white">Cancelar</button>
        <button
          disabled={!clientName.trim() || api.markLeadWon.isPending}
          onClick={save}
          className="px-4 py-2 rounded-md text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#5BA88A", color: "#0D0D0D" }}
        >
          Criar cliente
        </button>
      </div>
    </Modal>
  );
}

function StagesModal({ stages, onClose }: { stages: SalesStage[]; onClose: () => void }) {
  const api = useApi();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  return (
    <Modal open onClose={onClose} title="Etapas do funil">
      <div className="space-y-2">
        {stages.map((s) => (
          <div key={s.id} className="bg-[#1C1C1C] border border-white/[0.06] rounded-md px-3 py-2 flex items-center gap-2">
            {editingId === s.id ? (
              <>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus
                  className="flex-1 bg-[#0D0D0D] border border-white/10 rounded px-2 py-1 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
                <button onClick={() => { api.upsertSalesStage.mutate({ data: { id: s.id, name: editName.trim() } }); setEditingId(null); }}
                  className="p-1 rounded text-white/40 hover:text-white"><Check size={14} /></button>
                <button onClick={() => setEditingId(null)} className="p-1 rounded text-white/40 hover:text-white"><X size={14} /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-white">{s.name}</span>
                <button onClick={() => { setEditingId(s.id); setEditName(s.name); }} className="p-1 rounded text-white/40 hover:text-white"><Pencil size={13} /></button>
                <button
                  onClick={async () => { if (await requestConfirm(`Excluir a etapa "${s.name}"? Leads nela ficam sem etapa.`, { danger: true })) api.deleteSalesStage.mutate({ data: { id: s.id } }); }}
                  className="p-1 rounded text-white/40 hover:text-red-400"
                ><Trash2 size={13} /></button>
              </>
            )}
          </div>
        ))}
        {adding ? (
          <div className="flex items-center gap-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus placeholder="Nome da etapa"
              className="flex-1 bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
            <button
              onClick={() => { if (newName.trim()) api.upsertSalesStage.mutate({ data: { name: newName.trim() } }); setNewName(""); setAdding(false); }}
              className="p-1.5 rounded text-white/40 hover:text-white"
            ><Check size={14} /></button>
            <button onClick={() => setAdding(false)} className="p-1.5 rounded text-white/40 hover:text-white"><X size={14} /></button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="w-full mt-1 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-white/15 py-2 text-[11px] text-white/50 hover:text-[rgb(var(--lz-brand-rgb))] hover:border-[rgb(var(--lz-brand-rgb))]">
            <Plus size={12} /> Nova etapa
          </button>
        )}
      </div>
    </Modal>
  );
}

const inp = "w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))]";
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label className="block"><span className="block text-[10px] uppercase font-semibold tracking-wider text-white/40 mb-1.5">{label}</span>{children}</label>);
}
