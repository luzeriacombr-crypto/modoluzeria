// House (Fase 2) — leads do Instagram: botão fixo "+ Lead" (lançar em
// poucos segundos, pensado pro celular) e a página /leads com kanban de
// status e filtros por período e origem.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { useMe, profilesQO } from "@/lib/luzeria/queries";
import {
  createInstagramLead, listInstagramLeads, updateInstagramLead, deleteInstagramLead, type InstagramLead,
} from "@/lib/luzeria/house-day.functions";
import {
  LEAD_ORIGINS, LEAD_ORIGIN_LABEL, LEAD_STATUSES, LEAD_STATUS_META, houseDateKey,
  type LeadOrigin, type LeadStatus,
} from "@/lib/luzeria/house-checklists";

const LEADS_KEY = ["instagram-leads"];

/* ============== Botão fixo + lançamento rápido ============== */

export function QuickLeadButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Novo lead"
        className="fixed z-[45] right-[80px] bottom-[90px] md:bottom-6 md:right-24 inline-flex items-center gap-1.5 rounded-full pl-4 pr-5 h-12 text-sm font-bold shadow-lg transition-transform active:scale-95 hover:scale-[1.03]"
        style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D", boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
        <Plus size={18} strokeWidth={2.5} /> Lead
      </button>
      {open && <QuickLeadModal onClose={() => setOpen(false)} />}
    </>
  );
}

function QuickLeadModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createInstagramLead);
  const [name, setName] = useState("");
  const [origin, setOrigin] = useState<LeadOrigin | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const create = useMutation({
    mutationFn: () => createFn({ data: { name: name.trim(), origin: origin!, note: note.trim() || undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: LEADS_KEY });
      toast.success("Lead registrado!");
      onClose();
    },
    onError: (e: any) => toastFriendlyError(e, "Não consegui salvar o lead"),
  });
  const canSave = name.trim().length > 0 && !!origin && !create.isPending;

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/60 flex items-end md:items-center justify-center" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (canSave) create.mutate(); }}
        className="w-full md:max-w-sm bg-card rounded-t-2xl md:rounded-2xl p-5 pb-7 border border-foreground/10 lz-modal-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-foreground">Novo lead</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded text-foreground/50 hover:text-foreground"><X size={18} /></button>
        </div>
        <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome ou @"
          autoCapitalize="none" autoCorrect="off" maxLength={120}
          className="lz-input w-full text-base" />
        <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/40 mt-4 mb-2">Origem</div>
        <div className="flex flex-wrap gap-2">
          {LEAD_ORIGINS.map((o) => (
            <button type="button" key={o} onClick={() => setOrigin(o)}
              className="px-3 py-2 rounded-full text-sm font-semibold border transition-colors"
              style={origin === o
                ? { backgroundColor: "rgb(var(--lz-brand-rgb))", borderColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }
                : { borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)", color: "color-mix(in srgb, var(--foreground) 75%, transparent)" }}>
              {LEAD_ORIGIN_LABEL[o]}
            </button>
          ))}
        </div>
        {showNote ? (
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observação (opcional)" rows={2} maxLength={1000}
            className="lz-input w-full mt-4 resize-none" />
        ) : (
          <button type="button" onClick={() => setShowNote(true)} className="mt-3 text-xs text-foreground/50 hover:text-foreground">+ observação</button>
        )}
        <button type="submit" disabled={!canSave}
          className="mt-5 w-full rounded-md py-3 text-sm font-bold transition-opacity disabled:opacity-40"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          {create.isPending ? "Salvando…" : "Salvar lead"}
        </button>
      </form>
    </div>,
    document.body,
  );
}

/* ============== Página de leads ============== */

type Period = "hoje" | "7d" | "mes" | "30d" | "tudo";
const PERIODS: { id: Period; label: string }[] = [
  { id: "hoje", label: "Hoje" }, { id: "7d", label: "7 dias" }, { id: "mes", label: "Este mês" },
  { id: "30d", label: "30 dias" }, { id: "tudo", label: "Tudo" },
];

function periodFrom(p: Period): string | undefined {
  const today = houseDateKey();
  const spMidnight = (key: string) => new Date(`${key}T03:00:00.000Z`);
  if (p === "hoje") return spMidnight(today).toISOString();
  if (p === "mes") return spMidnight(`${today.slice(0, 7)}-01`).toISOString();
  if (p === "7d") return new Date(Date.now() - 7 * 86_400_000).toISOString();
  if (p === "30d") return new Date(Date.now() - 30 * 86_400_000).toISOString();
  return undefined;
}

export function HouseLeadsPage() {
  const qc = useQueryClient();
  const me = useMe().data;
  const listFn = useServerFn(listInstagramLeads);
  const updateFn = useServerFn(updateInstagramLead);
  const deleteFn = useServerFn(deleteInstagramLead);
  const [period, setPeriod] = useState<Period>("mes");
  const [origin, setOrigin] = useState<LeadOrigin | "todas">("todas");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<LeadStatus | null>(null);
  const { data: profiles = [] } = useQuery(profilesQO());
  const nameById = new Map(profiles.map((p) => [p.id, p.name.split(" ")[0]]));

  const from = periodFrom(period);
  const queryKey = [...LEADS_KEY, period, origin];
  const { data: leads = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { from, origin: origin === "todas" ? undefined : origin } }),
  });

  const move = useMutation({
    mutationFn: (v: { id: string; status: LeadStatus }) => updateFn({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<InstagramLead[]>(queryKey);
      if (prev) qc.setQueryData<InstagramLead[]>(queryKey, prev.map((l) => l.id === v.id ? { ...l, status: v.status } : l));
      return { prev };
    },
    onError: (e: any, _v, ctx) => { if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev); toastFriendlyError(e, "Não consegui mover o lead"); },
    onSettled: () => qc.invalidateQueries({ queryKey: LEADS_KEY }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LEADS_KEY }),
    onError: (e: any) => toastFriendlyError(e, "Não consegui apagar"),
  });

  const byStatus = useMemo(() => {
    const m = new Map<LeadStatus, InstagramLead[]>(LEAD_STATUSES.map((s) => [s, []]));
    for (const l of leads) m.get(l.status)?.push(l);
    return m;
  }, [leads]);

  const total = leads.length;
  const agendou = leads.filter((l) => l.status === "agendou" || l.status === "compareceu").length;
  const compareceu = leads.filter((l) => l.status === "compareceu").length;
  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : "—");

  async function handleDelete(l: InstagramLead) {
    if (!(await requestConfirm(`Apagar o lead "${l.name}"?`, { danger: true }))) return;
    remove.mutate(l.id);
  }

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-10 max-w-7xl mx-auto pb-28">
      <div className="text-[11px] uppercase font-bold tracking-wider text-foreground/40">Instagram</div>
      <h1 className="text-[28px] md:text-[32px] font-bold text-foreground tracking-tight mt-1">Leads</h1>

      <div className="mt-5 grid grid-cols-3 gap-2 md:gap-3 max-w-xl">
        <Stat label="Leads" value={String(total)} />
        <Stat label="Agendaram" value={pct(agendou, total)} sub={`${agendou}`} />
        <Stat label="Compareceram" value={pct(compareceu, agendou)} sub={`${compareceu} de ${agendou}`} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1 bg-card rounded-md p-1 text-xs border border-foreground/[0.06]">
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => setPeriod(p.id)}
              className={`px-2.5 py-1.5 rounded font-semibold transition ${period === p.id ? "bg-foreground/10 text-foreground" : "text-foreground/45 hover:text-foreground/75"}`}>
              {p.label}
            </button>
          ))}
        </div>
        <select value={origin} onChange={(e) => setOrigin(e.target.value as any)}
          className="bg-card border border-foreground/[0.08] rounded-md px-3 py-2 text-xs text-foreground">
          <option value="todas">Todas as origens</option>
          {LEAD_ORIGINS.map((o) => <option key={o} value={o}>{LEAD_ORIGIN_LABEL[o]}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="mt-8 text-sm text-foreground/40">Carregando…</div>
      ) : (
        <div className="mt-5 grid grid-flow-col auto-cols-[82%] sm:auto-cols-[46%] lg:grid-flow-row lg:grid-cols-4 gap-3 overflow-x-auto lg:overflow-visible snap-x snap-mandatory pb-2">
          {LEAD_STATUSES.map((s) => {
            const meta = LEAD_STATUS_META[s];
            const list = byStatus.get(s) ?? [];
            return (
              <div key={s}
                onDragOver={(e) => { e.preventDefault(); setOverCol(s); }}
                onDragLeave={() => setOverCol((c) => (c === s ? null : c))}
                onDrop={() => { if (dragId) move.mutate({ id: dragId, status: s }); setDragId(null); setOverCol(null); }}
                className="snap-start rounded-2xl p-3 min-h-[240px] transition-colors"
                style={{ background: overCol === s ? `${meta.color}14` : "color-mix(in srgb, var(--foreground) 3%, transparent)", border: `1px solid ${overCol === s ? meta.color : "transparent"}` }}>
                <div className="flex items-center justify-between px-1 mb-2.5">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide" style={{ color: meta.color }}>
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: meta.color }} />{meta.label}
                  </span>
                  <span className="text-xs text-foreground/40 tabular-nums">{list.length}</span>
                </div>
                <div className="space-y-2">
                  {list.map((l) => (
                    <div key={l.id} draggable onDragStart={() => setDragId(l.id)} onDragEnd={() => setDragId(null)}
                      className="group bg-card rounded-xl p-3 border border-foreground/[0.06] cursor-grab active:cursor-grabbing">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold text-foreground break-words min-w-0">{l.name}</div>
                        {(me?.role === "master" || me?.role === "setor" || l.createdBy === me?.id) && (
                          <button onClick={() => handleDelete(l)} title="Apagar"
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-foreground/40 hover:text-red-400 transition shrink-0">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                      <div className="text-[11px] text-foreground/45 mt-1">
                        {LEAD_ORIGIN_LABEL[l.origin]} · {new Date(l.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                        {l.createdBy && nameById.get(l.createdBy) ? ` · ${nameById.get(l.createdBy)}` : ""}
                      </div>
                      {l.note && <div className="text-xs text-foreground/65 mt-1.5 whitespace-pre-wrap">{l.note}</div>}
                      {/* No celular não tem arrastar — troca a etapa por aqui. */}
                      <select value={l.status} onChange={(e) => move.mutate({ id: l.id, status: e.target.value as LeadStatus })}
                        className="lg:hidden mt-2 w-full bg-background border border-foreground/10 rounded-md px-2 py-1.5 text-xs text-foreground">
                        {LEAD_STATUSES.map((st) => <option key={st} value={st}>{LEAD_STATUS_META[st].label}</option>)}
                      </select>
                    </div>
                  ))}
                  {list.length === 0 && <div className="text-xs text-foreground/30 px-1 py-4 text-center">Nenhum lead aqui.</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card rounded-xl px-3.5 py-3 border border-foreground/[0.06]">
      <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/40">{label}</div>
      <div className="text-xl font-extrabold text-foreground tabular-nums mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-foreground/40 tabular-nums">{sub}</div>}
    </div>
  );
}
