import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Handshake, MessageCircle, Snowflake, PhoneCall, Check, UserPlus, Users, Phone, CalendarClock, CheckCircle2, XCircle, X, Info } from "lucide-react";
import { leadsQO, leadContactsQO, profilesQO, clientsQO, useApi, useMe } from "@/lib/luzeria/queries";
import { Modal } from "./Modals";
import { PRESET_COLORS } from "@/lib/luzeria/utils";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { hasPermission } from "@/lib/luzeria/types";
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

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
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

const LEAD_PRODUCTS = [
  "Social Media", "Pack Digital", "Avulsos", "Ensaio", "Cobertura Evento",
  "Pack de vídeo", "Imersão VIP", "Educação", "Resgatando Clássicos",
];

const COLUMNS: { key: LeadStatus; label: string; accent: string; icon: typeof UserPlus; help: string }[] = [
  { key: "novo", label: "Novos", accent: "#888780", icon: UserPlus,
    help: "Leads que acabaram de entrar, sem contato ainda. Arraste o card pra 'Responder agora' assim que começar a atender." },
  { key: "responder", label: "Responder agora", accent: "#E76F51", icon: Phone,
    help: "Já teve contato e está esperando um retorno seu — clique em 'Marquei contato' toda vez que falar com a pessoa." },
  { key: "followup", label: "Follow-up", accent: "#4A9EFF", icon: CalendarClock,
    help: "Tem um retorno agendado pra uma data e horário específicos. Arrastar um card pra cá (ou clicar em 'Agendar' dentro dele) pede a data." },
  { key: "fechado", label: "Fechado", accent: "#5BA88A", icon: CheckCircle2,
    help: "Virou cliente de verdade. Arrastar um card pra cá (ou clicar em 'Ganho') cria o cliente automaticamente na lista de Clientes." },
  { key: "perdido", label: "Perdido", accent: "#E24B4A", icon: XCircle,
    help: "Não vai fechar — sai do quadro ativo, mas fica guardado (dá pra conferir marcando 'ver arquivados', se precisar)." },
];

/** Pequeno "i" clicável — abre uma explicação curta embaixo, fecha ao
 * clicar fora. Usado nos botões/áreas que não são autoexplicativas pra
 * quem tá vendo o funil de vendas pela primeira vez. */
function InfoTip({ text, align = "left" }: { text: string; align?: "left" | "right" | "center" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const alignClass = align === "right" ? "right-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "left-0";

  return (
    <div ref={ref} className="relative inline-flex shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center h-4 w-4 rounded-full shrink-0 transition-colors hover:opacity-80"
        style={{ backgroundColor: "color-mix(in srgb, var(--foreground) 12%, transparent)", color: "color-mix(in srgb, var(--foreground) 55%, transparent)" }}
      >
        <Info size={11} />
      </button>
      {open && (
        <div className={`absolute z-50 top-full ${alignClass} mt-1.5 w-56 rounded-md border border-foreground/10 bg-card p-2.5 text-[11px] leading-snug text-foreground/70 shadow-xl`}>
          {text}
        </div>
      )}
    </div>
  );
}

function PillButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 rounded-full text-xs font-medium border transition-colors"
      style={active
        ? { backgroundColor: "rgba(var(--lz-brand-rgb),0.15)", borderColor: "rgb(var(--lz-brand-rgb))", color: "var(--foreground)" }
        : { backgroundColor: "transparent", borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
    >
      {label}
    </button>
  );
}

export function SalesPipelinePage() {
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [followupLead, setFollowupLead] = useState<Lead | null>(null);
  const [wonLead, setWonLead] = useState<Lead | null>(null);
  const [lostLead, setLostLead] = useState<Lead | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<LeadStatus | null>(null);
  const [expanded, setExpanded] = useState<LeadStatus | null>(null);

  // Igual à Lixeira: o item some do menu, mas a rota abria por link direto.
  const me = useMe().data;
  const canSales = !new Set(me?.disabledFeatures ?? []).has("sales_pipeline")
    && hasPermission(me, "sales_pipeline");
  const { data: leads = [] } = useQuery({ ...leadsQO(true), enabled: canSales });
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
      setLostLead(lead);
    }
  }

  function dropProps(status: LeadStatus) {
    return {
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); if (dragId) setOverCol(status); },
      onDragLeave: () => { if (overCol === status) setOverCol(null); },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        const lead = leads.find((l) => l.id === dragId);
        if (lead) onDropOnColumn(status, lead);
        else { setDragId(null); setOverCol(null); }
      },
    };
  }

  if (me && !canSales) {
    return <div className="px-4 sm:px-6 md:px-10 py-10 text-foreground/60 text-sm">Você não tem acesso à área de Vendas.</div>;
  }

  return (
    <div className="p-4 md:p-6 min-h-[70vh] flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Handshake size={20} className="text-[var(--lz-accent-ink)]" />
          <h1 className="text-lg font-bold text-foreground">Vendas</h1>
          <InfoTip text="Cada bloco é uma etapa do funil. Arraste os cards entre eles pra mudar o estágio de um lead, ou clique num card pra ver/editar os detalhes." />
        </div>
        <button
          onClick={() => setNewLeadOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          <Plus size={13} /> Nova oportunidade
        </button>
      </div>

      {!expanded ? (
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 flex-1 min-h-0">
            {COLUMNS.slice(0, 3).map((col) => (
              <FolderBlock key={col.key} col={col} leads={byStatus[col.key]} {...dropProps(col.key)}
                isOver={overCol === col.key} dragId={dragId}
                onDragStartLead={setDragId} onDragEndLead={() => setDragId(null)}
                onExpand={() => setExpanded(col.key)} onOpenLead={setEditLead} />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-h-0">
            {COLUMNS.slice(3, 5).map((col) => (
              <FolderBlock key={col.key} col={col} leads={byStatus[col.key]} {...dropProps(col.key)}
                isOver={overCol === col.key} dragId={dragId}
                onDragStartLead={setDragId} onDragEndLead={() => setDragId(null)}
                onExpand={() => setExpanded(col.key)} onOpenLead={setEditLead} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-3">
            {COLUMNS.map((col) => (
              <CompactChip key={col.key} col={col} count={byStatus[col.key].length}
                active={col.key === expanded} isOver={overCol === col.key}
                onClick={() => setExpanded(col.key)} {...dropProps(col.key)} />
            ))}
            <button onClick={() => setExpanded(null)} className="ml-1 p-2 rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/5 shrink-0" title="Voltar aos blocos">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto rounded-lg border border-foreground/6 bg-card p-3 space-y-1.5">
            {expanded === "followup"
              ? <FollowupColumnBody leads={byStatus.followup} dragId={dragId} onDragStart={setDragId} onDragEnd={() => setDragId(null)} onOpen={setEditLead} />
              : byStatus[expanded].length === 0
              ? <p className="text-[11px] text-foreground/25 text-center py-10">Nenhuma oportunidade aqui ainda.</p>
              : byStatus[expanded].map((l) => (
                  <LeadCard key={l.id} lead={l} draggable={expanded !== "fechado" && expanded !== "perdido"}
                    dragging={dragId === l.id}
                    onDragStart={() => setDragId(l.id)} onDragEnd={() => setDragId(null)}
                    onOpen={() => setEditLead(l)} />
                ))}
          </div>
        </div>
      )}

      <LeadFormModal open={newLeadOpen} onClose={() => setNewLeadOpen(false)} />
      <LeadFormModal open={!!editLead} onClose={() => setEditLead(null)} lead={editLead ?? undefined} />
      <FollowupModal lead={followupLead} onClose={() => setFollowupLead(null)} />
      {wonLead && <WonLeadModal open={!!wonLead} lead={wonLead} onClose={() => setWonLead(null)} />}
      {lostLead && <LostLeadModal open={!!lostLead} lead={lostLead} onClose={() => setLostLead(null)} />}
    </div>
  );
}

function leadPreviewSubtitle(col: LeadStatus, lead: Lead): string {
  const base = col === "followup" ? (lead.nextFollowupAt ? formatDate(lead.nextFollowupAt) : "sem data")
    : col === "novo" ? `há ${timeSince(lead.createdAt)}`
    : `há ${timeSince(lead.lastContactAt ?? lead.updatedAt)}`;
  return lead.product ? `${base} · ${lead.product}` : base;
}

function FolderBlock({ col, leads, isOver, dragId, onDragStartLead, onDragEndLead, onExpand, onOpenLead, onDragOver, onDragLeave, onDrop }: {
  col: { key: LeadStatus; label: string; accent: string; icon: typeof UserPlus; help: string };
  leads: Lead[]; isOver: boolean; dragId: string | null;
  onDragStartLead: (id: string) => void; onDragEndLead: () => void;
  onExpand: () => void; onOpenLead: (l: Lead) => void;
  onDragOver: (e: React.DragEvent) => void; onDragLeave: () => void; onDrop: (e: React.DragEvent) => void;
}) {
  const Icon = col.icon;
  const draggableRows = col.key !== "fechado" && col.key !== "perdido";
  const recent = useMemo(() => {
    const sorted = col.key === "followup"
      ? [...leads].sort((a, b) => (a.nextFollowupAt ?? "").localeCompare(b.nextFollowupAt ?? ""))
      : [...leads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return sorted.slice(0, 6);
  }, [leads, col.key]);
  const extra = leads.length - recent.length;

  return (
    <div
      onClick={onExpand}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      className="h-full flex flex-col text-left rounded-xl p-4 transition-colors border cursor-pointer"
      style={{
        backgroundColor: isOver ? "rgba(var(--lz-brand-rgb),0.08)" : "var(--card)",
        borderColor: isOver ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 6%, transparent)",
        borderTopColor: isOver ? "rgb(var(--lz-brand-rgb))" : col.accent,
        borderTopWidth: "2px",
      }}
    >
      <div className="flex items-center justify-between shrink-0">
        <Icon size={18} style={{ color: col.accent }} />
        <span className="text-2xl font-bold text-foreground">{leads.length}</span>
      </div>
      <div className="flex items-center gap-1 mt-1 mb-2 shrink-0">
        <span className="text-xs text-foreground/50">{col.label}</span>
        <InfoTip text={col.help} />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 -mx-1.5 space-y-0.5">
        {recent.length === 0 && <p className="text-[11px] text-foreground/20 px-1.5 py-2">Nada por aqui.</p>}
        {recent.map((l) => (
          <div
            key={l.id}
            draggable={draggableRows}
            onDragStart={draggableRows ? (e) => { e.stopPropagation(); onDragStartLead(l.id); } : undefined}
            onDragEnd={draggableRows ? (e) => { e.stopPropagation(); onDragEndLead(); } : undefined}
            onClick={(e) => { e.stopPropagation(); onOpenLead(l); }}
            className="px-1.5 py-1 rounded hover:bg-foreground/[0.06] transition-colors"
            style={{ opacity: dragId === l.id ? 0.4 : 1, cursor: draggableRows ? "grab" : "pointer" }}
          >
            <div className="text-xs text-foreground font-medium truncate">{l.name}</div>
            <div className="text-[10px] text-foreground/35 truncate">{leadPreviewSubtitle(col.key, l)}</div>
          </div>
        ))}
        {extra > 0 && (
          <div className="px-1.5 py-1 text-[10.5px] text-foreground/30 hover:text-foreground/50">+{extra} mais — ver todos</div>
        )}
      </div>
    </div>
  );
}

function CompactChip({ col, count, active, isOver, onClick, onDragOver, onDragLeave, onDrop }: {
  col: { key: LeadStatus; label: string; accent: string; icon: typeof UserPlus };
  count: number; active: boolean; isOver: boolean; onClick: () => void;
  onDragOver: (e: React.DragEvent) => void; onDragLeave: () => void; onDrop: (e: React.DragEvent) => void;
}) {
  const Icon = col.icon;
  return (
    <button
      onClick={onClick}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border shrink-0 transition-colors"
      style={{
        backgroundColor: active ? "rgba(var(--lz-brand-rgb),0.1)" : isOver ? "color-mix(in srgb, var(--foreground) 6%, transparent)" : "var(--card)",
        borderColor: active ? "rgb(var(--lz-brand-rgb))" : isOver ? col.accent : "color-mix(in srgb, var(--foreground) 6%, transparent)",
      }}
    >
      <Icon size={14} style={{ color: col.accent }} />
      <span className="text-xs font-semibold text-foreground/80 whitespace-nowrap">{col.label}</span>
      <span className="text-[10px] text-foreground/30">{count}</span>
    </button>
  );
}

function FollowupColumnBody({ leads, dragId, onDragStart, onDragEnd, onOpen }: {
  leads: Lead[]; dragId: string | null; onDragStart: (id: string) => void; onDragEnd: () => void; onOpen: (l: Lead) => void;
}) {
  const endOfToday = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }, []);
  const sorted = useMemo(() => [...leads].sort((a, b) => (a.nextFollowupAt ?? "").localeCompare(b.nextFollowupAt ?? "")), [leads]);
  const hoje = sorted.filter((l) => !l.nextFollowupAt || new Date(l.nextFollowupAt) <= endOfToday);
  const proximos = sorted.filter((l) => l.nextFollowupAt && new Date(l.nextFollowupAt) > endOfToday);

  if (leads.length === 0) return <p className="text-[11px] text-foreground/25 text-center py-6">Nada por aqui.</p>;

  return (
    <>
      {hoje.map((l) => (
        <LeadCard key={l.id} lead={l} draggable dragging={dragId === l.id}
          onDragStart={() => onDragStart(l.id)} onDragEnd={onDragEnd} onOpen={() => onOpen(l)} />
      ))}
      {proximos.length > 0 && (
        <div className="flex items-center gap-2 py-1">
          <span className="flex-1 h-px bg-foreground/[0.06]" />
          <span className="text-[9px] uppercase font-bold tracking-wide text-foreground/25">Próximos</span>
          <span className="flex-1 h-px bg-foreground/[0.06]" />
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
      className="rounded-md border border-foreground/8 bg-card p-2.5 transition-opacity cursor-pointer"
      style={{ opacity: dragging ? 0.4 : 1, cursor: draggable ? "grab" : "pointer" }}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span className="text-sm font-semibold text-foreground truncate">{lead.name}</span>
        <div className="flex items-center gap-1 shrink-0">
          {cold && <span title="Sem contato registrado há mais de 3 dias"><Snowflake size={11} className="text-[#7EB3FF]" /></span>}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className="text-foreground/30 hover:text-[#5BA88A]" title="Abrir WhatsApp">
              <MessageCircle size={13} />
            </a>
          )}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-foreground/40">
        {lead.product && <span className="text-foreground/50">{lead.product}</span>}
        {value && <span>{value}</span>}
      </div>
      {lead.status === "followup" && (
        <div className="mt-1 text-[10.5px] text-[#4A9EFF]">
          {lead.nextFollowupAt ? formatDate(lead.nextFollowupAt) : "sem data"}
          {lead.followUpNote ? ` · ${lead.followUpNote}` : ""}
        </div>
      )}
      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-foreground/25">
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
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!lead) return;
    const d = lead.nextFollowupAt ? new Date(lead.nextFollowupAt) : new Date(Date.now() + 24 * 3600 * 1000);
    setDate(d.toISOString().slice(0, 10));
    setTime(lead.nextFollowupAt ? d.toTimeString().slice(0, 5) : "09:00");
    setNote(lead.followUpNote ?? "");
  }, [lead?.id]);

  if (!lead) return null;

  function save() {
    if (!date) return;
    api.scheduleLeadFollowup.mutateAsync({
      data: { id: lead!.id, followUpAt: new Date(`${date}T${time || "09:00"}:00`).toISOString(), note: note.trim() || null },
    }).then(onClose);
  }

  return (
    <Modal open={!!lead} onClose={onClose} title={`Agendar follow-up · ${lead.name}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <F label="Data">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp} />
          </F>
          <F label="Horário">
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inp} />
          </F>
        </div>
        <F label="Nota (opcional — vira a mensagem pronta)">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Ex: Confirmar se recebeu a proposta"
            className={inp + " resize-none"} />
        </F>
      </div>
      <div className="flex items-center justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-3 py-2 text-sm text-foreground/60 hover:text-foreground">Cancelar</button>
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
    <div className="rounded-md border border-foreground/6 bg-card p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-[11px] text-foreground/50 inline-flex items-center gap-1">
          <span><span className="font-semibold text-foreground">{lead.contactCount}</span> contato{lead.contactCount === 1 ? "" : "s"} registrado{lead.contactCount === 1 ? "" : "s"}
          {lead.lastContactAt && <span> · último em {formatDate(lead.lastContactAt)}</span>}</span>
          <InfoTip text="Cada clique em 'Marquei contato' vira uma linha no histórico abaixo, com data e hora — é o que conta os dias e marca o lead como 'frio' (ícone de floco de neve) depois de 3 dias sem nenhum." />
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
        <button onClick={() => setExpanded((v) => !v)} className="mt-1.5 text-[10.5px] text-foreground/30 hover:text-foreground/60">
          {expanded ? "Ocultar histórico" : "Ver histórico"}
        </button>
      )}
      {expanded && (
        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
          {contacts.map((c) => (
            <div key={c.id} className="text-[10.5px] text-foreground/40 flex items-center gap-1.5">
              <PhoneCall size={10} className="shrink-0" />
              <span>{new Date(c.contactedAt).toLocaleString("pt-BR")}</span>
              {c.byName && <span className="text-foreground/25">· {c.byName}</span>}
              {c.note && <span className="text-foreground/25 truncate">· {c.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, accent, info }: { label: string; value: string; accent?: string; info?: string }) {
  return (
    <div className="rounded-md border border-foreground/6 bg-card px-3 py-2">
      <div className="text-[9.5px] uppercase font-semibold tracking-wider text-foreground/40 flex items-center gap-1">
        {label}
        {info && <InfoTip text={info} />}
      </div>
      <div className="text-sm font-bold mt-0.5 truncate" style={accent ? { color: accent } : undefined}>{value}</div>
    </div>
  );
}

function FollowupScheduler({ lead }: { lead: Lead }) {
  const api = useApi();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [note, setNote] = useState("");

  useEffect(() => {
    const d = lead.nextFollowupAt ? new Date(lead.nextFollowupAt) : new Date(Date.now() + 24 * 3600 * 1000);
    setDate(d.toISOString().slice(0, 10));
    setTime(lead.nextFollowupAt ? d.toTimeString().slice(0, 5) : "09:00");
    setNote(lead.followUpNote ?? "");
  }, [lead.id]);

  function save() {
    if (!date) return;
    api.scheduleLeadFollowup.mutate({
      data: { id: lead.id, followUpAt: new Date(`${date}T${time || "09:00"}:00`).toISOString(), note: note.trim() || null },
    });
  }

  return (
    <div className="rounded-md border border-foreground/6 bg-card p-3 space-y-2">
      <div className="text-[10px] uppercase font-semibold tracking-wider text-foreground/40 flex items-center gap-1.5">
        <CalendarClock size={12} /> Próximo follow-up
        <InfoTip text="Ao agendar, esse lead muda pra coluna 'Follow-up' e some das outras — volta a aparecer no seu radar na data e horário marcados." />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inp + " text-xs"} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inp + " text-xs"} />
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (ex: confirmar proposta)" className={inp + " text-xs"} />
      <button onClick={save} disabled={!date || api.scheduleLeadFollowup.isPending}
        className="w-full text-[11px] font-bold uppercase px-2.5 py-1.5 rounded disabled:opacity-50"
        style={{ backgroundColor: "rgba(74,158,255,0.15)", color: "#4A9EFF" }}>
        {lead.nextFollowupAt ? "Reagendar" : "Agendar"}
      </button>
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
  const [responsibleIds, setResponsibleIds] = useState<string[]>([]);
  const [product, setProduct] = useState("");
  const [customProduct, setCustomProduct] = useState("");
  const [wonOpen, setWonOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(lead?.name ?? "");
    setContactPhone(lead?.contactPhone ?? "");
    setContactEmail(lead?.contactEmail ?? "");
    setSource(lead?.source ?? "");
    setNotes(lead?.notes ?? "");
    setValueReais(lead?.valueEstimateCents != null ? String(lead.valueEstimateCents / 100) : "");
    setResponsibleIds(lead?.responsibleIds ?? []);
    if (lead?.product && !LEAD_PRODUCTS.includes(lead.product)) {
      setProduct("outros");
      setCustomProduct(lead.product);
    } else {
      setProduct(lead?.product ?? "");
      setCustomProduct("");
    }
  }, [open, lead?.id]);

  function toggleResponsible(id: string) {
    setResponsibleIds((prev) => prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]);
  }

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
        responsibleIds,
        product: product === "outros" ? (customProduct.trim() || null) : (product || null),
      },
    }).then(onClose);
  }

  const isTerminal = lead && (lead.status === "fechado" || lead.status === "perdido");
  const wa = waLink(contactPhone, lead?.followUpNote ?? undefined);

  return (
    <>
      <Modal open={open} onClose={onClose} title={lead ? "Editar oportunidade" : "Nova oportunidade"} maxWidthClass="max-w-3xl">
        <div className={lead ? "grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-5" : ""}>
          <div className="space-y-3 min-w-0">
            <F label="Nome"><input value={name} onChange={(e) => setName(e.target.value)} autoFocus className={inp} /></F>
            <div className="grid grid-cols-2 gap-3">
              <F label="Telefone">
                <div className="flex items-center gap-1.5">
                  <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inp} />
                  {wa && (
                    <a href={wa} target="_blank" rel="noopener noreferrer" title="Abrir WhatsApp"
                      className="shrink-0 grid place-items-center h-[34px] w-[34px] rounded-md transition-opacity hover:opacity-80"
                      style={{ backgroundColor: "rgba(91,168,138,0.15)", color: "#5BA88A" }}>
                      <MessageCircle size={15} />
                    </a>
                  )}
                </div>
              </F>
              <F label="E-mail"><input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inp} /></F>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Origem"><input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Indicação, Instagram..." className={inp} /></F>
              <F label="Valor estimado (R$)"><input value={valueReais} onChange={(e) => setValueReais(e.target.value)} placeholder="0,00" className={inp} /></F>
            </div>
            <F label="Responsáveis">
              <div className="flex flex-wrap gap-1.5">
                {profiles.length === 0 && <span className="text-xs text-foreground/30">Nenhum membro na equipe ainda.</span>}
                {profiles.map((p) => (
                  <PillButton key={p.id} label={p.name} active={responsibleIds.includes(p.id)} onClick={() => toggleResponsible(p.id)} />
                ))}
              </div>
            </F>
            <F label="Produto de interesse">
              <div className="flex flex-wrap gap-1.5">
                {LEAD_PRODUCTS.map((c) => (
                  <PillButton key={c} label={c} active={product === c} onClick={() => setProduct((p) => p === c ? "" : c)} />
                ))}
                <PillButton label="Outros" active={product === "outros"} onClick={() => setProduct((p) => p === "outros" ? "" : "outros")} />
              </div>
              {product === "outros" && (
                <input value={customProduct} onChange={(e) => setCustomProduct(e.target.value)} autoFocus
                  placeholder="Qual?" className={inp + " mt-1.5"} />
              )}
            </F>
            <F label="Observações"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inp + " resize-none"} /></F>
          </div>
          {lead && (
            <div className="space-y-3 min-w-0">
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Dias no funil" value={`${daysSince(lead.createdAt)}d`}
                  info="Conta sozinho, um dia a mais a cada dia que o lead fica sem virar cliente ou ser marcado como perdido — desde a data em que foi criado." />
                <StatTile label="Primeiro contato" value={lead.firstContactAt ? formatDate(lead.firstContactAt) : "ainda não"} />
              </div>
              {/* Mover de etapa só existia arrastando o card, e arrastar não
               * funciona no toque — no celular era impossível tirar um lead
               * de "Novo". Aqui dá pra mudar em qualquer aparelho. */}
              {!isTerminal && (
                <F label="Etapa">
                  <div className="flex flex-wrap gap-1.5">
                    {(["novo", "responder"] as const).map((s) => {
                      const col = COLUMNS.find((c) => c.key === s)!;
                      return (
                        <PillButton
                          key={s}
                          label={col.label}
                          active={lead.status === s}
                          onClick={() => { if (lead.status !== s) api.moveLeadStatus.mutate({ data: { id: lead.id, status: s } }); }}
                        />
                      );
                    })}
                    {lead.status === "followup" && (
                      <PillButton label="Follow-up" active onClick={() => { /* já está — reagende abaixo */ }} />
                    )}
                  </div>
                  <p className="text-[10.5px] text-foreground/35 mt-1.5">
                    Pra mandar pro Follow-up, agende o retorno logo abaixo.
                  </p>
                </F>
              )}
              <FollowupScheduler lead={lead} />
              <ContactHistory lead={lead} />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-5">
          {lead && !isTerminal ? (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setWonOpen(true)}
                className="text-[11px] font-bold uppercase px-2.5 py-1.5 rounded" style={{ backgroundColor: "rgba(91,168,138,0.15)", color: "#5BA88A" }}>
                Ganho
              </button>
              <button
                onClick={() => setLostOpen(true)}
                className="text-[11px] font-bold uppercase px-2.5 py-1.5 rounded" style={{ backgroundColor: "rgba(231,111,81,0.15)", color: "#E76F51" }}>
                Perdido
              </button>
              <InfoTip align="right" text="Ganho cria um cliente de verdade (pede nome, categoria e cor) e move essa oportunidade pra 'Fechado'. Perdido arquiva e pede o motivo — sai do quadro ativo, sem criar nada." />
            </div>
          ) : lead && isAdmin ? (
            <button
              onClick={async () => { if (await requestConfirm(`Excluir "${lead.name}" pra sempre?`, { danger: true })) { api.deleteLead.mutate({ data: { id: lead.id } }); onClose(); } }}
              className="text-xs text-foreground/40 hover:text-red-400 inline-flex items-center gap-1"
            >
              <Trash2 size={12} /> Excluir
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 text-sm text-foreground/60 hover:text-foreground">Cancelar</button>
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
      {lead && <LostLeadModal open={lostOpen} lead={lead} onClose={() => { setLostOpen(false); onClose(); }} />}
    </>
  );
}

const CLIENT_CATEGORIES = ["Social Media", "Pack Digital", "Avulsos"];
type WonStep = "choice" | "new" | "existing";

function WonLeadModal({ open, lead, onClose }: { open: boolean; lead: Lead; onClose: () => void }) {
  const api = useApi();
  const { data: clients = [] } = useQuery({ ...clientsQO(), enabled: open });
  const [step, setStep] = useState<WonStep>("choice");
  const [clientName, setClientName] = useState("");
  const [category, setCategory] = useState("Avulsos");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [icon, setIcon] = useState("");
  const [existingClientId, setExistingClientId] = useState("");

  const activeClients = useMemo(
    () => clients.filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [clients],
  );

  useEffect(() => {
    if (!open) return;
    setStep("choice");
    setClientName(lead.name);
    setCategory(lead.product && CLIENT_CATEGORIES.includes(lead.product) ? lead.product : "Avulsos");
    setColor(PRESET_COLORS[0]);
    setIcon("");
    setExistingClientId("");
  }, [open, lead.id]);

  function saveNew() {
    api.markLeadWon.mutateAsync({
      data: { id: lead.id, clientName: clientName.trim(), category, color, icon: icon.trim() || null },
    }).then(onClose);
  }

  function saveExisting() {
    if (!existingClientId) return;
    api.linkLeadToClient.mutateAsync({ data: { id: lead.id, clientId: existingClientId } }).then(onClose);
  }

  function saveNoClient() {
    api.markLeadWonNoClient.mutateAsync({ data: { id: lead.id } }).then(onClose);
  }

  if (step === "choice") {
    return (
      <Modal open={open} onClose={onClose} title="Marcar como ganho">
        <p className="text-xs text-foreground/50 mb-4">O que você quer fazer com "{lead.name}"?</p>
        <div className="space-y-2">
          <button
            onClick={() => setStep("new")}
            className="w-full flex items-center gap-3 rounded-lg border border-foreground/10 px-3 py-3 text-left hover:border-[rgb(var(--lz-brand-rgb))] transition-colors"
          >
            <UserPlus size={16} className="text-[var(--lz-accent-ink)] shrink-0" />
            <span>
              <span className="block text-sm font-semibold text-foreground">Criar novo cliente avulso</span>
              <span className="block text-xs text-foreground/50">Vira um cliente de verdade no sistema.</span>
            </span>
          </button>
          <button
            onClick={() => setStep("existing")}
            disabled={activeClients.length === 0}
            className="w-full flex items-center gap-3 rounded-lg border border-foreground/10 px-3 py-3 text-left hover:border-[rgb(var(--lz-brand-rgb))] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Users size={16} className="text-[var(--lz-accent-ink)] shrink-0" />
            <span>
              <span className="block text-sm font-semibold text-foreground">Atribuir a um cliente já existente</span>
              <span className="block text-xs text-foreground/50">Vincula essa oportunidade a um cliente que já tem.</span>
            </span>
          </button>
          <button
            disabled={api.markLeadWonNoClient.isPending}
            onClick={saveNoClient}
            className="w-full flex items-center gap-3 rounded-lg border border-foreground/10 px-3 py-3 text-left hover:border-foreground/25 transition-colors disabled:opacity-50"
          >
            <X size={16} className="text-foreground/40 shrink-0" />
            <span>
              <span className="block text-sm font-semibold text-foreground">Não fazer nada</span>
              <span className="block text-xs text-foreground/50">Só marca como ganho, sem criar ou vincular cliente.</span>
            </span>
          </button>
        </div>
        <div className="flex items-center justify-end mt-5">
          <button onClick={onClose} className="px-3 py-2 text-sm text-foreground/60 hover:text-foreground">Cancelar</button>
        </div>
      </Modal>
    );
  }

  if (step === "existing") {
    return (
      <Modal open={open} onClose={onClose} title="Marcar como ganho">
        <p className="text-xs text-foreground/50 mb-3">Qual cliente já existente é esse lead?</p>
        <F label="Cliente">
          <select value={existingClientId} onChange={(e) => setExistingClientId(e.target.value)} autoFocus className={inp}>
            <option value="">Selecione...</option>
            {activeClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </F>
        <div className="flex items-center justify-between mt-5">
          <button onClick={() => setStep("choice")} className="px-3 py-2 text-sm text-foreground/60 hover:text-foreground">Voltar</button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 text-sm text-foreground/60 hover:text-foreground">Cancelar</button>
            <button
              disabled={!existingClientId || api.linkLeadToClient.isPending}
              onClick={saveExisting}
              className="px-4 py-2 rounded-md text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#5BA88A", color: "#0D0D0D" }}
            >
              Vincular
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Marcar como ganho">
      <p className="text-xs text-foreground/50 mb-3">Isso cria um cliente de verdade a partir dessa oportunidade.</p>
      <div className="space-y-3">
        <F label="Nome do cliente"><input value={clientName} onChange={(e) => setClientName(e.target.value)} autoFocus className={inp} /></F>
        <F label="Categoria">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inp}>
            {CLIENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </F>
        <div>
          <div className="text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Cor</div>
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
      <div className="flex items-center justify-between mt-5">
        <button onClick={() => setStep("choice")} className="px-3 py-2 text-sm text-foreground/60 hover:text-foreground">Voltar</button>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-foreground/60 hover:text-foreground">Cancelar</button>
          <button
            disabled={!clientName.trim() || api.markLeadWon.isPending}
            onClick={saveNew}
            className="px-4 py-2 rounded-md text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#5BA88A", color: "#0D0D0D" }}
          >
            Criar cliente
          </button>
        </div>
      </div>
    </Modal>
  );
}

function LostLeadModal({ open, lead, onClose }: { open: boolean; lead: Lead; onClose: () => void }) {
  const api = useApi();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setReason("");
  }, [open, lead.id]);

  function save() {
    api.markLeadLost.mutateAsync({ data: { id: lead.id, reason: reason.trim() || null } }).then(onClose);
  }

  return (
    <Modal open={open} onClose={onClose} title="Marcar como perdido">
      <F label="Motivo (opcional)">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
          rows={3}
          placeholder="Preço, timing, escolheu concorrente..."
          className={inp + " resize-none"}
        />
      </F>
      <div className="flex items-center justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-3 py-2 text-sm text-foreground/60 hover:text-foreground">Cancelar</button>
        <button
          disabled={api.markLeadLost.isPending}
          onClick={save}
          className="px-4 py-2 rounded-md text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#E76F51", color: "#0D0D0D" }}
        >
          Marcar como perdido
        </button>
      </div>
    </Modal>
  );
}

const inp = "w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))]";
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label className="block"><span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">{label}</span>{children}</label>);
}
