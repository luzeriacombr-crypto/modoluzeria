// House — demandas avulsas do dia a dia (banner, jingle, folder, convite…).
// Cada demanda é um item do fluxo de produção da marca: abre no painel de
// item de sempre (briefing, anexos, comentários, status, prazo).
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Check, ClipboardList, Plus, X } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { useMe, profilesQO, contentStatusesQO } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { listDemands, createDemand, type Demand } from "@/lib/luzeria/house-team.functions";
import { DEMAND_KINDS, DEMAND_KIND_META, type DemandKind } from "@/lib/luzeria/house-projects";
import { houseDateKey } from "@/lib/luzeria/house-checklists";
import { statusLabel } from "@/lib/luzeria/types";
import { Avatar } from "./Avatar";

const KEY = ["house-demands"];
const DONE = new Set(["CONCLUIDO", "FINALIZADO"]);

export function HouseDemands() {
  const listFn = useServerFn(listDemands);
  const { data: demands = [], isLoading } = useQuery({ queryKey: KEY, queryFn: () => listFn() });
  const { data: profiles = [] } = useQuery(profilesQO());
  const { data: contentStatuses = [] } = useQuery(contentStatusesQO());
  const labelOverrides = new Map(contentStatuses.map((r) => [r.key, r.label]));
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const { selectClient, selectMonth, openItem } = useUI();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<DemandKind | "todas">("todas");
  const [showDone, setShowDone] = useState(false);
  const today = houseDateKey();

  const filtered = demands.filter((d) => filter === "todas" || d.kind === filter);
  const open = filtered.filter((d) => !DONE.has(d.status));
  const done = filtered.filter((d) => DONE.has(d.status));
  const kindsInUse = useMemo(() => DEMAND_KINDS.filter((k) => demands.some((d) => d.kind === k)), [demands]);

  function openDemand(d: Demand) {
    // Abre o painel do item por cima da tela atual (é global, no App).
    selectClient(d.clientId);
    selectMonth(d.monthKey);
    setTimeout(() => openItem(d.id), 30);
  }

  const row = (d: Demand) => {
    const late = !DONE.has(d.status) && d.dueDate && d.dueDate < today;
    return (
      <button key={d.id} onClick={() => openDemand(d)}
        className="w-full text-left bg-card rounded-xl px-4 py-3.5 border border-foreground/[0.06] hover:border-foreground/15 transition flex items-center gap-3">
        <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-md shrink-0" style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.12)", color: "var(--lz-accent-ink)" }}>
          {DEMAND_KIND_META[d.kind]?.label ?? d.kind}
        </span>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold truncate ${DONE.has(d.status) ? "text-foreground/45 line-through" : "text-foreground"}`}>{d.title}</div>
          <div className="text-[11px] text-foreground/45 truncate">
            {statusLabel(d.status, false, labelOverrides)}{d.briefing ? ` · ${d.briefing.replace(/\s+/g, " ").slice(0, 80)}` : ""}
          </div>
        </div>
        {d.dueDate && (
          <span className="text-xs tabular-nums shrink-0" style={{ color: late ? "#FF6B6B" : "color-mix(in srgb, var(--foreground) 50%, transparent)" }}>
            {late && <AlertTriangle size={11} className="inline mr-0.5 -mt-0.5" />}{d.dueDate.slice(8, 10)}/{d.dueDate.slice(5, 7)}
          </span>
        )}
        <div className="flex -space-x-1.5 shrink-0">
          {d.assigneeIds.slice(0, 2).map((id) => { const p = byId.get(id); return p ? <Avatar key={id} name={p.name} color={p.color} avatarUrl={p.avatarUrl} size={22} /> : null; })}
        </div>
      </button>
    );
  };

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-10 max-w-4xl mx-auto pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase font-bold tracking-wider text-foreground/40">Dia a dia</div>
          <h1 className="text-[28px] md:text-[32px] font-bold text-foreground tracking-tight mt-0.5">Demandas avulsas</h1>
          <p className="text-sm text-foreground/50 mt-1">Banner, jingle, folder, convite: o que é pontual e não é post.</p>
        </div>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-bold"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          <Plus size={15} /> Nova demanda
        </button>
      </div>

      {kindsInUse.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mt-5">
          {(["todas", ...kindsInUse] as const).map((k) => (
            <button key={k} onClick={() => setFilter(k)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors"
              style={filter === k
                ? { backgroundColor: "rgb(var(--lz-brand-rgb))", borderColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }
                : { borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)", color: "color-mix(in srgb, var(--foreground) 65%, transparent)" }}>
              {k === "todas" ? "Todas" : DEMAND_KIND_META[k].label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? <div className="mt-8 text-sm text-foreground/40">Carregando…</div> : (
        <div className="mt-5 space-y-2">
          {open.length === 0 && (
            <div className="border border-dashed border-foreground/10 rounded-2xl p-10 text-center">
              <ClipboardList size={28} className="mx-auto text-foreground/25" />
              <p className="text-sm text-foreground/50 mt-3">Nenhuma demanda em aberto.</p>
            </div>
          )}
          {open.map(row)}
          {done.length > 0 && (
            <>
              <button onClick={() => setShowDone((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-foreground/50 hover:text-foreground pt-3">
                <Check size={12} /> {showDone ? "Esconder" : "Ver"} concluídas ({done.length})
              </button>
              {showDone && done.map(row)}
            </>
          )}
        </div>
      )}
      {creating && <NewDemandModal onClose={() => setCreating(false)} onCreated={(d) => { setCreating(false); selectClient(d.clientId); selectMonth(d.monthKey); setTimeout(() => openItem(d.id), 30); }} />}
    </div>
  );
}

function NewDemandModal({ onClose, onCreated }: { onClose: () => void; onCreated: (d: { id: string; clientId: string; monthKey: string }) => void }) {
  const qc = useQueryClient();
  const me = useMe().data;
  const createFn = useServerFn(createDemand);
  const { data: profiles = [] } = useQuery(profilesQO());
  const [kind, setKind] = useState<DemandKind>("banner");
  const [title, setTitle] = useState("");
  const [briefing, setBriefing] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [responsibleId, setResponsibleId] = useState(me?.id ?? "");
  const create = useMutation({
    mutationFn: () => createFn({ data: { kind, title: title.trim(), briefing: briefing.trim() || undefined, dueDate: dueDate || null, responsibleId: responsibleId || null } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["house-my-day"] });
      toast.success("Demanda criada. Anexe referências no painel que abriu.");
      onCreated(r);
    },
    onError: (e: any) => toastFriendlyError(e, "Não consegui criar a demanda"),
  });

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="w-full md:max-w-lg bg-card rounded-t-2xl md:rounded-2xl p-6 border border-foreground/10 max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-foreground">Nova demanda</h3>
          <button onClick={onClose} className="p-1 rounded text-foreground/50 hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DEMAND_KINDS.map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className="px-3 py-2 rounded-full text-sm font-semibold border transition-colors"
              style={kind === k
                ? { backgroundColor: "rgb(var(--lz-brand-rgb))", borderColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }
                : { borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)", color: "color-mix(in srgb, var(--foreground) 70%, transparent)" }}>
              {DEMAND_KIND_META[k].label}
            </button>
          ))}
        </div>
        <div className="space-y-3 mt-5">
          <label className="block">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-foreground/45 mb-1">O que é</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus className="lz-input w-full"
              placeholder={kind === "jingle" ? "ex: Jingle de 30s pra campanha de novembro" : kind === "convite" ? "ex: Convite do aniversário da clínica" : "ex: Banner da recepção"} />
          </label>
          <label className="block">
            <span className="block text-[10px] uppercase font-bold tracking-wider text-foreground/45 mb-1">Briefing</span>
            <textarea value={briefing} onChange={(e) => setBriefing(e.target.value)} rows={5} maxLength={4000}
              className="w-full bg-background border border-foreground/10 rounded-xl px-3.5 py-3 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-y"
              placeholder={DEMAND_KIND_META[kind].hint} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-foreground/45 mb-1">Prazo</span>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="lz-input w-full" />
            </label>
            <label className="block">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-foreground/45 mb-1">Responsável</span>
              <select value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)} className="lz-input w-full">
                {profiles.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
          <p className="text-[11px] text-foreground/45">Depois de criar, o painel da demanda abre pra anexar referências, logos e arquivos.</p>
        </div>
        <button onClick={() => create.mutate()} disabled={!title.trim() || create.isPending}
          className="mt-5 w-full rounded-md py-3 text-sm font-bold disabled:opacity-40"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          {create.isPending ? "Criando…" : "Criar demanda"}
        </button>
      </div>
    </div>
  );
}
