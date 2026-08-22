import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Handshake, MessageCircle, Snowflake, PhoneCall, Check } from "lucide-react";
import { leadsQO, leadContactsQO, profilesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { Modal } from "./Modals";
import { PRESET_COLORS } from "@/lib/luzeria/utils";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import type { Lead, LeadStatus } from "@/lib/luzeria/sales-pipeline.functions";

const formatBRL = (v: number | null) =>
  v == null ? null : (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function timeSince(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function isCold(lead: Lead): boolean {
  const ref = lead.lastContactAt ?? lead.updatedAt;
  return Date.now() - new Date(ref).getTime() > 3 * 24 * 3600 * 1000;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function waLink(phone: string | null, text?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

const COLUMNS: { key: LeadStatus; label: string; accent: string }[] = [
  { key: "novo", label: "Novos", accent: "#888780" },
  { key: "responder", label: "Responder agora", accent: "#E76F51" },
  { key: "followup", label: "Follow-up", accent: "#4A9EFF" },
  { key: "fechado", label: "Fechado", accent: "#5BA88A" },
  { key: "perdido", label: "Perdido", accent: "#E24B4A" },
];

export function SalesPipelinePage() {
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [followupLead, setFollowupLead] = useState<Lead | null>(null);
  const [wonLead, setWonLead] = useState<Lead | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<LeadStatus | null>(null);

  const { data: leads = [] } = useQuery(leadsQO(true));
  const api = useApi();

  const byStatus = useMemo(() => {
    const map: Record<LeadStatus, Lead[]> = { novo: [], responder: [], followup: [], fechado: [], perdido: [] };
    for (const l of leads) map[l.status]?.push(l);
    return map;
  }, [leads]);

  function onDropOnColumn(status: LeadStatus, lead: Lead) {
    setDragId(null); setOverCol(null);
    if (lead.status === status) return;
    if (status === "novo" || status === "responder") {
      api.moveLeadStatus.mutate({ data: { id: lead.id, status } });
    } else if (status === "followup") {
      setFollowupLead(lead);
    } else if (status === "fechado") {
      setWonLead(lead);
    } else if (status === "perdido") {
      requestConfirm(`Marcar "${lead.name}" como perdido?`, { danger: true }).then((ok) => {
        if (ok) api.markLeadLost.mutate({ data: { id: lead.id } });
      });
    }
  }

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Handshake size={20} className="text-[rgb(var(--lz-brand-rgb))]" />
          <h1 className="text-lg font-bold text-white">Vendas</h1>
        </div>
        <button
          onClick={() => setNewLeadOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          <Plus size={13} /> Nova oportunidade
        </button>
      </div>

      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-3 h-full min-w-max pb-2">
          {COLUMNS.map((col) => {
            const colLeads = byStatus[col.key];
            return (
              <div
                key={col.key}
                onDragOver={(e) => { e.preventDefault(); if (dragId) setOverCol(col.key); }}
                onDragLeave={() => { if (overCol === col.key) setOverCol(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const lead = leads.find((l) => l.id === dragId);
                  if (lead) onDropOnColumn(col.key, lead);
                  else { setDragId(null); setOverCol(null); }
                }}
                className="w-[270px] shrink-0 rounded-lg border transition-colors flex flex-col"
                style={{
                  backgroundColor: overCol === col.key ? "rgba(var(--lz-brand-rgb),0.06)" : "#161616",
                  borderColor: overCol === col.key ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.06)",
                }}
              >
                <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: col.accent }}>{col.label}</span>
                  <span className="text-[10px] text-white/30 font-semibold">{colLeads.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-[80px]">
                  {col.key === "followup"
                    ? <FollowupColumnBody leads={colLeads} dragId={dragId} onDragStart={setDragId} onDragEnd={() => setDragId(null)} onOpen={setEditLead} />
                    : colLeads.length === 0
                    ? <p className="text-[11px] text-white/25 text-center py-6">Nada por aqui.</p>
                    : colLeads.map((l) => (
                        <LeadCard key={l.id} lead={l} draggable={col.key !== "fechado" && col.key !== "perdido"}
                          dragging={dragId === l.id}
                          onDragStart={() => setDragId(l.id)} onDragEnd={() => setDragId(null)}
                          onOpen={() => setEditLead(l)} />
                      ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <LeadFormModal open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />
      <LeadFormModal open={!!editLead} onClose={() => setEditLead(null)} lead={editLead ?? undefined} />
      <FollowupModal lead={followupLead} onClose={() => setFollowupLead(null)} />
      {wonLead && <WonLeadModal open={!!wonLead} lead={wonLead} onClose={() => setWonLead(null)} />}
    </div>
  );
}

function FollowupColumnBody({ leads, dragId, onDragStart, onDragEnd, onOpen }: {
  leads: Lead[]; dragId: string | null; onDragStart: (id: string) => void; onDragEnd: () => void; onOpen: (l: Lead) => void;
}) {
  const endOfToday = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }, []);
  const sorted = useMemo(() => [...leads].sort((a, b) => (a.nextFollowupAt ?? "").localeCompare(b.nextFollowupAt ?? "")), [leads]);
  const hoje = sorted.filter((l) => !l.nextFollowupAt || new Date(l.nextFollowupAt) <= endOfToday);
  const proximos = sorted.filter((l) => l.nextFollowupAt && new Date(l.nextFollowupAt) > endOfToday);

  if (leads.length === 0) return <p className="text-[11px] text-white/25 text-center py-6">Nada por aqui.</p>;

  return (
    <>
      {hoje.map((l) => (
        <LeadCard key={l.id} lead={l} draggable dragging={dragId === l.id}
          onDragStart={() => onDragStart(l.id)} onDragEnd={onDragEnd} onOpen={() => onOpen(l)} />
      ))}
      {proximos.length > 0 && (
        <div className="flex items-center gap-2 py-1">
          <span className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[9px] uppercase font-bold tracking-wide text-white/25">Próximos</span>
          <span className="flex-1 h-px bg-white/[0.06]" />
        </div>
      )}
      {proximos.map((l) => (
        <LeadCard key={l.id} lead={l} draggable dragging={dragId === l.id}
          onDragStart={() => onDragStart(l.id)} onDragEnd={onDragEnd} onOpen={() => onOpen(l)} />
      ))}
    </>
  );
}

function LeadCard({ lead, draggable, dragging, onDragStart, onDragEnd, onOpen }: {
  lead: Lead; draggable: boolean; dragging: boolean;
  onDragStart: () => void; onDragEnd: () => void; onOpen: () => void;
}) {
  const value = formatBRL(lead.valueEstimateCents);
  const wa = waLink(lead.contactPhone, lead.followUpNote ?? undefined);
  const cold = lead.status !== "fechado" && lead.status !== "perdido" && isCold(lead);

  return (
    <div
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onClick={onOpen}
      className="rounded-md border border-white/[0.08] bg-[#1C1C1C] p-2.5 transition-opacity cursor-pointer"
      style={{ opacity: dragging ? 0.4 : 1, cursor: draggable ? "grab" : "pointer" }}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-sm font-semibold text-white truncate">{lead.name}</span>
        <div className="flex items-center gap-1 shrink-0">
          {cold && <Snowflake size={11} className="text-[#7EB3FF]" />}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className="text-white/30 hover:text-[#5BA88A]" title="Abrir WhatsApp">
              <MessageCircle size={13} />
            </a>
          )}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-white/40">
        {lead.contactPhone && <span>{lead.contactPhone}</span>}
        {value && <span>{value}</span>}
      </div>
      {lead.status === "followup" && (
        <div className="mt-1 text-[10.5px] text-[#4A9EFF]">
          {lead.nextFollowupAt ? formatDate(lead.nextFollowupAt) : "sem data"}
          {lead.followUpNote ? ` · ${lead.followUpNote}` : ""}
        </div>
      )}
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-white/25">
        {lead.status !== "followup" && <span>há {timeSince(lead.lastContactAt ?? lead.updatedAt)}</span>}
        {lead.contactCount > 0 && (
          <span className="inline-flex items-center gap-0.5"><PhoneCall size={9} /> {lead.contactCount}</span>
        )}
      </div>
    </div>
  );
}

function FollowupModal({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const api = useApi();
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!lead) return;
    const d = lead.nextFollowupAt ? new Date(lead.nextFollowupAt) : new Date(Date.now() + 24 * 3600 * 1000);
    setDate(d.toISOString().slice(0, 10));
    setNote(lead.followUpNote ?? "");
  }, [lead?.id]);

  if (!lead) return null;

  function save() {
    if (!date) return;
    api.scheduleLeadFollowup.mutateAsync({
      data: { id: lead!.id, followUpAt: new Date(`${date}T09:00:00`).toISOString(), note: note.trim() || null },
    }).then(onClose);
  }

  return (
    <Modal open={!!lead} onClose={onClose} title={`Agendar follow-up · ${lead.name}`}>
      <div className="space-y-3">
        <F label="Data">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} />
        </F>
        <F label="Nota (opcional — vira a mensagem pronta)">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Ex: Confirmar se recebeu a proposta"
            className={inp + " resize-none"} />
        </F>
      </div>
      <div className="flex items-center justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-3 py-2 text-sm text-white/60 hover:text-white">Cancelar</button>
        <button disabled={!date || api.scheduleLeadFollowup.isPending} onClick={save}
          className="px-4 py-2 rounded-md text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          Agendar
        </button>
      </div>
    </Modal>
  );
}

function ContactHistory({ lead }: { lead: Lead }) {
  const api = useApi();
  const [expanded, setExpanded] = useState(false);
  const { data: contacts = [] } = useQuery({ ...leadContactsQO(lead.id), enabled: expanded });

  return (
    <div className="rounded-md border border-white/[0.06] bg-[#161616] p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[11px] text-white/50">
          <span className="font-semibold text-white">{lead.contactCount}</span> contato{lead.contactCount === 1 ? "" : "s"} registrado{lead.contactCount === 1 ? "" : "s"}
          {lead.lastContactAt && <span> · último em {formatDate(lead.lastContactAt)}</span>}
        </div>
        <button
          onClick={() => api.logLeadContact.mutate({ data: { leadId: lead.id } })}
          disabled={api.logLeadContact.isPending}
          className="inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2.5 py-1.5 rounded disabled:opacity-50"
          style={{ backgroundColor: "rgba(91,168,138,0.15)", color: "#5BA88A" }}
        >
          <Check size={12} /> Marquei contato
        </button>
      </div>
      {lead.contactCount > 0 && (
        <button onClick={() => setExpanded((v) => !v)} className="mt-1.5 text-[10.5px] text-white/30 hover:text-white/60">
          {expanded ? "Ocultar histórico" : "Ver histórico"}
        </button>
      )}
      {expanded && (
        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
          {contacts.map((c) => (
            <div key={c.id} className="text-[10.5px] text-white/40 flex items-center gap-1.5">
              <PhoneCall size={10} className="shrink-0" />
              <span>{new Date(c.contactedAt).toLocaleString("pt-BR")}</span>
              {c.byName && <span className="text-white/25">· {c.byName}</span>}
              {c.note && <span className="text-white/25 truncate">· {c.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LeadFormModal({ open, onClose, lead }: { open: boolean; onClose: () => void; lead?: Lead }) {
  const { data: profiles = [] } = useQuery(profilesQO());
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
  const [wonOpen, setWonOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(lead?.name ?? "");
    setContactPhone(lead?.contactPhone ?? "");
    setContactEmail(lead?.contactEmail ?? "");
    setSource(lead?.source ?? "");
    setNotes(lead?.notes ?? "");
    setValueReais(lead?.valueEstimateCents != null ? String(lead.valueEstimateCents / 100) : "");
    setResponsibleId(lead?.responsibleId ?? "");
  }, [open, lead?.id]);

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
      },
    }).then(onClose);
  }

  const isTerminal = lead && (lead.status === "fechado" || lead.status === "perdido");

  return (
    <>
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
          <F label="Responsável">
            <select value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)} className={inp}>
              <option value="">—</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </F>
          <F label="Observações"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inp + " resize-none"} /></F>
          {lead && <ContactHistory lead={lead} />}
        </div>
        <div className="flex items-center justify-between mt-5">
          {lead && !isTerminal ? (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setWonOpen(true)}
                className="text-[11px] font-bold uppercase px-2.5 py-1.5 rounded" style={{ backgroundColor: "rgba(91,168,138,0.15)", color: "#5BA88A" }}>
                Ganho
              </button>
              <button
                onClick={async () => { if (await requestConfirm(`Marcar "${lead.name}" como perdido?`, { danger: true })) { api.markLeadLost.mutate({ data: { id: lead.id } }); onClose(); } }}
                className="text-[11px] font-bold uppercase px-2.5 py-1.5 rounded" style={{ backgroundColor: "rgba(231,111,81,0.15)", color: "#E76F51" }}>
                Perdido
              </button>
            </div>
          ) : lead && isAdmin ? (
            <button
              onClick={async () => { if (await requestConfirm(`Excluir "${lead.name}" pra sempre?`, { danger: true })) { api.deleteLead.mutate({ data: { id: lead.id } }); onClose(); } }}
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
      {lead && <WonLeadModal open={wonOpen} lead={lead} onClose={() => { setWonOpen(false); onClose(); }} />}
    </>
  );
}

const CLIENT_CATEGORIES = ["Social Media", "Pack Digital", "Avulsos"];

function WonLeadModal({ open, lead, onClose }: { open: boolean; lead: Lead; onClose: () => void }) {
  const api = useApi();
  const [clientName, setClientName] = useState("");
  const [category, setCategory] = useState("Social Media");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [icon, setIcon] = useState("");

  useEffect(() => {
    if (!open) return;
    setClientName(lead.name);
    setCategory("Social Media");
    setColor(PRESET_COLORS[0]);
    setIcon("");
  }, [open, lead.id]);

  function save() {
    api.markLeadWon.mutateAsync({
      data: { id: lead.id, clientName: clientName.trim(), category, color, icon: icon.trim() || null },
    }).then(onClose);
  }

  return (
    <Modal open={open} onClose={onClose} title="Marcar como ganho">
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

const inp = "w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))]";
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label className="block"><span className="block text-[10px] uppercase font-semibold tracking-wider text-white/40 mb-1.5">{label}</span>{children}</label>);
}
