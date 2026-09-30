// House (Fase 2) — Checklists recorrentes (entra no lugar da Rotina numa
// House). O gestor cadastra os itens (diário/semanal/mensal, responsável);
// a equipe marca no "Meu dia". Aqui fica também o histórico: o que foi
// feito, por quem, e o que passou do prazo (aviso das 21h).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Check, History, ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { useMe, profilesQO } from "@/lib/luzeria/queries";
import {
  listChecklistItems, upsertChecklistItem, deleteChecklistItem, getChecklistHistory, type ChecklistItem,
} from "@/lib/luzeria/house-day.functions";
import { CADENCE_LABEL, WEEKDAY_LABEL, checklistDueLabel, type ChecklistCadence } from "@/lib/luzeria/house-checklists";
import { Avatar } from "./Avatar";

const ITEMS_KEY = ["house-checklist-items"];
const HISTORY_KEY = ["house-checklist-history"];

export function HouseChecklists() {
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const [tab, setTab] = useState<"itens" | "historico">("itens");
  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-10 max-w-4xl mx-auto pb-28">
      <div className="text-[11px] uppercase font-bold tracking-wider text-foreground/40">Equipe</div>
      <h1 className="text-[28px] md:text-[32px] font-bold text-foreground tracking-tight mt-1">Checklists</h1>
      <p className="text-sm text-foreground/50 mt-1">
        Tarefas recorrentes da função. A equipe marca no <strong className="text-foreground/70">Meu dia</strong>; o que não for feito no prazo vira aviso às 21h.
      </p>
      <div className="flex items-center gap-1 mt-5 mb-4">
        <TabPill active={tab === "itens"} onClick={() => setTab("itens")} icon={<ListChecks size={13} />} label="Itens" />
        <TabPill active={tab === "historico"} onClick={() => setTab("historico")} icon={<History size={13} />} label="Histórico" />
      </div>
      {tab === "itens" ? <ItemsSection canEdit={isAdmin} /> : <HistorySection />}
    </div>
  );
}

function TabPill({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${active ? "bg-[rgb(var(--lz-brand-rgb))] text-black" : "text-foreground/55 hover:text-foreground hover:bg-foreground/5"}`}>
      {icon}{label}
    </button>
  );
}

function ItemsSection({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listChecklistItems);
  const deleteFn = useServerFn(deleteChecklistItem);
  const upsertFn = useServerFn(upsertChecklistItem);
  const { data: items = [], isLoading } = useQuery({ queryKey: ITEMS_KEY, queryFn: () => listFn() });
  const { data: profiles = [] } = useQuery(profilesQO());
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const [editing, setEditing] = useState<ChecklistItem | "new" | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ITEMS_KEY }); qc.invalidateQueries({ queryKey: ["house-my-day"] }); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui apagar"),
  });
  const toggleActive = useMutation({
    mutationFn: (i: ChecklistItem) => upsertFn({ data: { ...i, active: !i.active } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ITEMS_KEY }); qc.invalidateQueries({ queryKey: ["house-my-day"] }); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui salvar"),
  });

  const groups: ChecklistCadence[] = ["daily", "weekly", "monthly"];

  return (
    <div className="space-y-5">
      {canEdit && (
        <button onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-bold"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          <Plus size={15} /> Novo item
        </button>
      )}
      {isLoading && <div className="text-sm text-foreground/40">Carregando…</div>}
      {!isLoading && items.length === 0 && (
        <div className="border border-dashed border-foreground/10 rounded-xl p-8 text-center text-sm text-foreground/40">
          Nenhum checklist ainda. {canEdit ? "Comece pelos stories do dia, a revisão da semana e o relatório do mês." : "O gestor ainda não cadastrou."}
        </div>
      )}
      {groups.map((cad) => {
        const list = items.filter((i) => i.cadence === cad);
        if (list.length === 0) return null;
        return (
          <section key={cad}>
            <h2 className="text-xs uppercase font-bold tracking-wider text-foreground/50 mb-2">{CADENCE_LABEL[cad]}</h2>
            <ul className="bg-card rounded-xl border border-foreground/[0.06] divide-y divide-foreground/[0.06]">
              {list.map((i) => {
                const resp = i.responsibleId ? byId.get(i.responsibleId) : null;
                return (
                  <li key={i.id} className={`flex items-center gap-3 px-4 py-3 ${i.active ? "" : "opacity-45"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-foreground">{i.title}</div>
                      <div className="text-[11px] text-foreground/45 mt-0.5">
                        {checklistDueLabel(i)} · {resp ? resp.name : "qualquer pessoa da equipe"}{!i.active && " · pausado"}
                      </div>
                    </div>
                    {resp && <Avatar name={resp.name} color={resp.color} avatarUrl={resp.avatarUrl} size={24} />}
                    {canEdit && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => toggleActive.mutate(i)} title={i.active ? "Pausar" : "Reativar"}
                          className="text-[11px] font-semibold px-2 py-1 rounded text-foreground/50 hover:text-foreground hover:bg-foreground/5">
                          {i.active ? "Pausar" : "Reativar"}
                        </button>
                        <button onClick={() => setEditing(i)} title="Editar" className="p-1.5 rounded text-foreground/45 hover:text-foreground hover:bg-foreground/5"><Pencil size={13} /></button>
                        <button onClick={async () => { if (await requestConfirm(`Apagar "${i.title}" e o histórico dele?`, { danger: true })) remove.mutate(i.id); }}
                          title="Apagar" className="p-1.5 rounded text-foreground/45 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {editing && <ItemEditor item={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ItemEditor({ item, onClose }: { item: ChecklistItem | null; onClose: () => void }) {
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertChecklistItem);
  const { data: profiles = [] } = useQuery(profilesQO());
  const [title, setTitle] = useState(item?.title ?? "");
  const [cadence, setCadence] = useState<ChecklistCadence>(item?.cadence ?? "daily");
  const [dueWeekday, setDueWeekday] = useState(item?.dueWeekday ?? 5);
  const [dueDay, setDueDay] = useState(item?.dueDay ?? 31);
  const [responsibleId, setResponsibleId] = useState<string>(item?.responsibleId ?? "");
  const save = useMutation({
    mutationFn: () => upsertFn({ data: {
      id: item?.id, title: title.trim(), cadence, dueWeekday, dueDay, responsibleId: responsibleId || null,
    } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ITEMS_KEY });
      qc.invalidateQueries({ queryKey: ["house-my-day"] });
      toast.success("Checklist salvo.");
      onClose();
    },
    onError: (e: any) => toastFriendlyError(e, "Não consegui salvar"),
  });

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="w-full md:max-w-md bg-card rounded-t-2xl md:rounded-2xl p-6 border border-foreground/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-foreground">{item ? "Editar item" : "Novo item"}</h3>
          <button onClick={onClose} className="p-1 rounded text-foreground/50 hover:text-foreground"><X size={16} /></button>
        </div>
        <label className="block text-[10px] uppercase font-bold tracking-wider text-foreground/40 mb-1">O que precisa ser feito</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={200}
          placeholder="ex: Postar 3 stories de bastidores" className="lz-input w-full" />

        <label className="block text-[10px] uppercase font-bold tracking-wider text-foreground/40 mt-4 mb-1">Frequência</label>
        <div className="grid grid-cols-3 gap-2">
          {(["daily", "weekly", "monthly"] as ChecklistCadence[]).map((c) => (
            <button key={c} onClick={() => setCadence(c)}
              className="py-2 rounded-md text-sm font-semibold border transition-colors"
              style={cadence === c
                ? { backgroundColor: "rgb(var(--lz-brand-rgb))", borderColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }
                : { borderColor: "color-mix(in srgb, var(--foreground) 15%, transparent)", color: "color-mix(in srgb, var(--foreground) 70%, transparent)" }}>
              {CADENCE_LABEL[c]}
            </button>
          ))}
        </div>
        {cadence === "daily" && <p className="text-[11px] text-foreground/45 mt-1.5">Aparece de segunda a sexta.</p>}
        {cadence === "weekly" && (
          <div className="mt-3 flex items-center gap-2 text-sm text-foreground/70">
            Até
            <select value={dueWeekday} onChange={(e) => setDueWeekday(Number(e.target.value))} className="lz-input">
              {[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>{WEEKDAY_LABEL[d]}</option>)}
            </select>
          </div>
        )}
        {cadence === "monthly" && (
          <div className="mt-3 flex items-center gap-2 text-sm text-foreground/70">
            Até o dia
            <select value={dueDay} onChange={(e) => setDueDay(Number(e.target.value))} className="lz-input">
              {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
              <option value={31}>último dia do mês</option>
            </select>
          </div>
        )}

        <label className="block text-[10px] uppercase font-bold tracking-wider text-foreground/40 mt-4 mb-1">Responsável</label>
        <select value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)} className="lz-input w-full">
          <option value="">Qualquer pessoa da equipe</option>
          {profiles.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        <button onClick={() => save.mutate()} disabled={!title.trim() || save.isPending}
          className="mt-6 w-full rounded-md py-3 text-sm font-bold disabled:opacity-40"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          {save.isPending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}

function HistorySection() {
  const listFn = useServerFn(listChecklistItems);
  const historyFn = useServerFn(getChecklistHistory);
  const { data: items = [] } = useQuery({ queryKey: ITEMS_KEY, queryFn: () => listFn() });
  const { data: history, isLoading } = useQuery({ queryKey: HISTORY_KEY, queryFn: () => historyFn({ data: { days: 30 } }) });
  const { data: profiles = [] } = useQuery(profilesQO());
  const itemById = new Map(items.map((i) => [i.id, i]));
  const nameById = new Map(profiles.map((p) => [p.id, p.name]));

  if (isLoading || !history) return <div className="text-sm text-foreground/40">Carregando…</div>;
  const events = [
    ...history.completions.map((c) => ({ kind: "done" as const, at: c.doneAt, itemId: c.itemId, who: c.doneBy })),
    ...history.missed.map((m) => ({ kind: "missed" as const, at: m.at, itemId: m.itemId, who: null as string | null })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  // Taxa de conclusão por item nos últimos 30 dias.
  const perItem = items.filter((i) => i.active).map((i) => {
    const done = history.completions.filter((c) => c.itemId === i.id).length;
    const missed = history.missed.filter((m) => m.itemId === i.id).length;
    return { item: i, done, missed };
  });

  return (
    <div className="space-y-6">
      {perItem.length > 0 && (
        <section>
          <h2 className="text-xs uppercase font-bold tracking-wider text-foreground/50 mb-2">Últimos 30 dias</h2>
          <ul className="bg-card rounded-xl border border-foreground/[0.06] divide-y divide-foreground/[0.06]">
            {perItem.map(({ item, done, missed }) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground truncate">{item.title}</div>
                  <div className="text-[11px] text-foreground/45">{CADENCE_LABEL[item.cadence]}</div>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums" style={{ color: "var(--lz-accent-ink)" }}><Check size={12} />{done}</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold tabular-nums" style={{ color: missed ? "#FF6B6B" : "color-mix(in srgb, var(--foreground) 30%, transparent)" }}><AlertTriangle size={12} />{missed}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="text-xs uppercase font-bold tracking-wider text-foreground/50 mb-2">Linha do tempo</h2>
        {events.length === 0 ? (
          <div className="text-sm text-foreground/40">Nada registrado nos últimos 30 dias.</div>
        ) : (
          <ul className="space-y-1">
            {events.slice(0, 100).map((e, idx) => (
              <li key={idx} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-foreground/[0.03]">
                <span className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                  style={e.kind === "done" ? { backgroundColor: "rgba(var(--lz-brand-rgb),0.15)", color: "var(--lz-accent-ink)" } : { backgroundColor: "rgba(255,107,107,0.12)", color: "#FF6B6B" }}>
                  {e.kind === "done" ? <Check size={13} /> : <AlertTriangle size={12} />}
                </span>
                <div className="flex-1 min-w-0 text-sm text-foreground/85 truncate">
                  {itemById.get(e.itemId)?.title ?? "Item apagado"}
                  <span className="text-foreground/45"> · {e.kind === "done" ? `feito${e.who && nameById.get(e.who) ? ` por ${nameById.get(e.who)!.split(" ")[0]}` : ""}` : "não concluído no prazo"}</span>
                </div>
                <span className="text-[11px] text-foreground/40 tabular-nums shrink-0">
                  {new Date(e.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
