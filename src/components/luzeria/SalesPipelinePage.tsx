import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Handshake, History, LayoutGrid, MessageCircle, CalendarClock, Check, Inbox, Flame, Snowflake } from "lucide-react";
import { leadsQO, profilesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { Modal } from "./Modals";
import { Avatar } from "./Avatar";
import { PRESET_COLORS } from "@/lib/luzeria/utils";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import type { Lead } from "@/lib/luzeria/sales-pipeline.functions";

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

function waLink(phone: string | null, text?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

type ViewMode = "painel" | "todos" | "historico";

export function SalesPipelinePage() {
  const [view, setView] = useState<ViewMode>("painel");
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [followupLead, setFollowupLead] = useState<Lead | null>(null);

  const { data: leads = [] } = useQuery(leadsQO(true));
  const api = useApi();

  const activeLeads = useMemo(() => leads.filter((l) => !l.archived), [leads]);
  const archivedLeads = useMemo(() => leads.filter((l) => l.archived), [leads]);

  return (
    <div className="p-4 md:p-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Handshake size={20} className="text-[rgb(var(--lz-brand-rgb))]" />
          <h1 className="text-lg font-bold text-white">Vendas</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-white/10 p-0.5">
            <ViewTab active={view === "painel"} onClick={() => setView("painel")} icon={<LayoutGrid size={12} />} label="Painel" />
            <ViewTab active={view === "todos"} onClick={() => setView("todos")} icon={<Inbox size={12} />} label="Todos" />
            <ViewTab active={view === "historico"} onClick={() => setView("historico")} icon={<History size={12} />} label="Histórico" />
          </div>
          <button
            onClick={() => setNewLeadOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
          >
            <Plus size={13} /> Nova oportunidade
          </button>
        </div>
      </div>

      {view === "painel" && (
        <PainelView leads={activeLeads} onOpen={setEditLead} onFollowup={setFollowupLead} />
      )}
      {view === "todos" && (
        <FlatList leads={activeLeads} onOpen={setEditLead} empty="Nenhuma oportunidade em aberto." />
      )}
      {view === "historico" && (
        <FlatList leads={archivedLeads} onOpen={setEditLead} empty="Nenhum lead arquivado ainda." showOutcome />
      )}

      <LeadFormModal open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />
      <LeadFormModal open={!!editLead} onClose={() => setEditLead(null)} lead={editLead ?? undefined} />
      <FollowupModal lead={followupLead} onClose={() => setFollowupLead(null)} />
    </div>
  );
}

function ViewTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-colors"
      style={{ backgroundColor: active ? "rgb(var(--lz-brand-rgb))" : "transparent", color: active ? "#0D0D0D" : "rgba(255,255,255,0.5)" }}
    >
      {icon} {label}
    </button>
  );
}

function PainelView({ leads, onOpen, onFollowup }: {
  leads: Lead[]; onOpen: (l: Lead) => void; onFollowup: (l: Lead) => void;
}) {
  const me = useMe().data;
  const [novosTab, setNovosTab] = useState<"meus" | "fila">("meus");
  const api = useApi();

  const respondendoAgora = useMemo(
    () => leads.filter((l) => l.awaitingReply).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)),
    [leads],
  );
  const followupsHoje = useMemo(() => {
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);
    return leads
      .filter((l) => !l.awaitingReply && l.nextFollowupAt && new Date(l.nextFollowupAt) <= endOfToday)
      .sort((a, b) => (a.nextFollowupAt ?? "").localeCompare(b.nextFollowupAt ?? ""));
  }, [leads]);
  const novos = useMemo(
    () => leads.filter((l) => !l.awaitingReply && !l.lastContactAt && !l.nextFollowupAt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [leads],
  );
  const novosFiltered = novos.filter((l) => (novosTab === "meus" ? l.responsibleId === me?.id : !l.responsibleId));
  const esfriando = useMemo(() => {
    const cutoff = Date.now() - 3 * 24 * 3600 * 1000;
    return leads
      .filter((l) => !l.awaitingReply && !l.nextFollowupAt && l.lastContactAt && new Date(l.lastContactAt).getTime() < cutoff)
      .sort((a, b) => (a.lastContactAt ?? "").localeCompare(b.lastContactAt ?? ""));
  }, [leads]);

  return (
    <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
      <QueueCard
        icon={<MessageCircle size={14} />} title="Responder agora" count={respondendoAgora.length} accent="#E76F51"
        empty="Nenhum lead esperando resposta."
      >
        {respondendoAgora.map((l) => (
          <LeadRow key={l.id} lead={l} onOpen={() => onOpen(l)} subtext={`esperando há ${timeSince(l.updatedAt)}`}
            actions={
              <>
                <RowIconBtn href={waLink(l.contactPhone)} icon={<MessageCircle size={13} />} title="Abrir WhatsApp" />
                <RowIconBtn onClick={() => api.markLeadContacted.mutate({ data: { id: l.id } })} icon={<Check size={13} />} title="Marquei contato" />
              </>
            }
          />
        ))}
      </QueueCard>

      <QueueCard
        icon={<CalendarClock size={14} />} title="Follow-ups do dia" count={followupsHoje.length} accent="#4A9EFF"
        empty="Nenhum follow-up agendado pra hoje."
      >
        {followupsHoje.map((l) => {
          const overdue = l.nextFollowupAt && new Date(l.nextFollowupAt) < new Date(new Date().setHours(0, 0, 0, 0));
          return (
            <LeadRow key={l.id} lead={l} onOpen={() => onOpen(l)}
              subtext={l.followUpNote || (overdue ? "atrasado" : "hoje")}
              actions={
                <>
                  <RowIconBtn href={waLink(l.contactPhone, l.followUpNote ?? undefined)} icon={<MessageCircle size={13} />} title="Mensagem pronta" />
                  <RowIconBtn onClick={() => api.markLeadContacted.mutate({ data: { id: l.id } })} icon={<Check size={13} />} title="Marquei contato" />
                </>
              }
            />
          );
        })}
      </QueueCard>

      <QueueCard
        icon={<Inbox size={14} />} title="Leads novos" count={novosFiltered.length} accent="#5BA88A"
        empty="Sem leads novos aqui."
        tabs={
          <div className="flex items-center gap-1">
            <MiniTab active={novosTab === "meus"} onClick={() => setNovosTab("meus")} label={`Meus (${novos.filter((l) => l.responsibleId === me?.id).length})`} />
            <MiniTab active={novosTab === "fila"} onClick={() => setNovosTab("fila")} label={`Fila (${novos.filter((l) => !l.responsibleId).length})`} />
          </div>
        }
      >
        {novosFiltered.map((l) => (
          <LeadRow key={l.id} lead={l} onOpen={() => onOpen(l)} subtext={`há ${timeSince(l.createdAt)}${l.source ? ` · ${l.source}` : ""}`}
            actions={
              <>
                <RowIconBtn href={waLink(l.contactPhone)} icon={<MessageCircle size={13} />} title="Abrir WhatsApp" />
                <RowIconBtn onClick={() => onFollowup(l)} icon={<CalendarClock size={13} />} title="Agendar follow-up" />
                <RowIconBtn onClick={() => api.markLeadContacted.mutate({ data: { id: l.id } })} icon={<Check size={13} />} title="Marquei contato" />
              </>
            }
          />
        ))}
      </QueueCard>

      <QueueCard
        icon={<Snowflake size={14} />} title="Esfriando" count={esfriando.length} accent="#7EB3FF"
        empty="Nada esfriando por aqui."
      >
        {esfriando.map((l) => (
          <LeadRow key={l.id} lead={l} onOpen={() => onOpen(l)} subtext={`parado há ${timeSince(l.lastContactAt!)}`}
            actions={
              <>
                <RowIconBtn href={waLink(l.contactPhone)} icon={<MessageCircle size={13} />} title="Abrir WhatsApp" />
                <RowIconBtn onClick={() => onFollowup(l)} icon={<CalendarClock size={13} />} title="Agendar follow-up" />
                <RowIconBtn onClick={() => api.markLeadContacted.mutate({ data: { id: l.id } })} icon={<Check size={13} />} title="Marquei contato" />
              </>
            }
          />
        ))}
      </QueueCard>
    </div>
  );
}

function QueueCard({ icon, title, count, accent, empty, tabs, children }: {
  icon: React.ReactNode; title: string; count: number; accent: string; empty: string;
  tabs?: React.ReactNode; children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="rounded-lg border border-white/[0.06] bg-[#161616] flex flex-col min-h-[200px] max-h-[420px]">
      <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-1.5">
          <span style={{ color: accent }}>{icon}</span>
          <span className="text-xs font-bold uppercase tracking-wide text-white/70">{title}</span>
          <span className="text-[10px] text-white/30 font-semibold">{count}</span>
        </div>
        {tabs}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {hasChildren ? children : <p className="text-[11px] text-white/25 text-center py-6">{empty}</p>}
      </div>
    </div>
  );
}

function MiniTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="text-[10px] font-semibold px-2 py-0.5 rounded transition-colors"
      style={{ backgroundColor: active ? "rgba(255,255,255,0.1)" : "transparent", color: active ? "#fff" : "rgba(255,255,255,0.4)" }}>
      {label}
    </button>
  );
}

function LeadRow({ lead, onOpen, subtext, actions }: { lead: Lead; onOpen: () => void; subtext: string; actions: React.ReactNode }) {
  const value = formatBRL(lead.valueEstimateCents);
  return (
    <div className="rounded-md border border-white/[0.06] bg-[#1C1C1C] px-2.5 py-2 flex items-center gap-2">
      <div onClick={onOpen} className="flex-1 min-w-0 cursor-pointer">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white truncate">{lead.name}</span>
          {value && <span className="text-[10px] text-white/30 shrink-0">{value}</span>}
        </div>
        <div className="flex items-center gap-1.5 text-[10.5px] text-white/40 mt-0.5">
          {lead.contactPhone && <span className="truncate">{lead.contactPhone}</span>}
          <span className="shrink-0">· {subtext}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">{actions}</div>
    </div>
  );
}

function RowIconBtn({ icon, title, onClick, href }: { icon: React.ReactNode; title: string; onClick?: () => void; href?: string | null }) {
  const cls = "p-1.5 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-20 disabled:pointer-events-none";
  if (href !== undefined) {
    return href ? (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={cls} onClick={(e) => e.stopPropagation()}>{icon}</a>
    ) : (
      <span title="Sem telefone" className={cls} style={{ opacity: 0.2 }}>{icon}</span>
    );
  }
  return <button onClick={(e) => { e.stopPropagation(); onClick?.(); }} title={title} className={cls}>{icon}</button>;
}

function FlatList({ leads, onOpen, empty, showOutcome }: { leads: Lead[]; onOpen: (l: Lead) => void; empty: string; showOutcome?: boolean }) {
  const sorted = useMemo(() => [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [leads]);
  return (
    <div className="flex-1 overflow-y-auto max-w-2xl space-y-2">
      {sorted.length === 0 && <p className="text-sm text-white/40 py-10 text-center">{empty}</p>}
      {sorted.map((lead) => (
        <div key={lead.id} onClick={() => onOpen(lead)} className="cursor-pointer bg-[#1C1C1C] border border-white/[0.06] rounded-md px-3 py-2.5 flex items-center gap-2">
          <Avatar name={lead.name} color="#5BA88A" size={28} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-white truncate">{lead.name}</span>
              {showOutcome && (
                <span
                  className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
                  style={lead.wonClientId
                    ? { backgroundColor: "rgba(91,168,138,0.15)", color: "#5BA88A" }
                    : { backgroundColor: "rgba(231,111,81,0.15)", color: "#E76F51" }}
                >
                  {lead.wonClientId ? "Ganho" : "Perdido"}
                </span>
              )}
            </div>
            <div className="text-[11px] text-white/40 mt-0.5">{lead.contactPhone ?? "sem telefone"}{formatBRL(lead.valueEstimateCents) ? ` · ${formatBRL(lead.valueEstimateCents)}` : ""}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FollowupModal({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const api = useApi();
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!lead) return;
    const d = new Date(); d.setDate(d.getDate() + 1);
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
          {lead && !lead.archived && (
            <div className="flex items-center gap-1.5 pt-1">
              <button
                onClick={() => api.setLeadAwaitingReply.mutate({ data: { id: lead.id, awaitingReply: !lead.awaitingReply } })}
                className="flex-1 text-[11px] font-bold uppercase tracking-wide px-2 py-1.5 rounded inline-flex items-center justify-center gap-1"
                style={lead.awaitingReply
                  ? { backgroundColor: "rgba(231,111,81,0.2)", color: "#E76F51" }
                  : { backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
              >
                <Flame size={12} /> {lead.awaitingReply ? "Aguardando resposta" : "Marcar: preciso responder"}
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-5">
          {lead && !lead.archived ? (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setWonOpen(true)}
                className="text-[11px] font-bold uppercase px-2.5 py-1.5 rounded" style={{ backgroundColor: "rgba(91,168,138,0.15)", color: "#5BA88A" }}>
                Ganho
              </button>
              <button onClick={() => { api.markLeadLost.mutate({ data: { id: lead.id } }); onClose(); }}
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
