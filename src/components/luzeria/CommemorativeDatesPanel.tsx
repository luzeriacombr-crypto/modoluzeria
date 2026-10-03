// Datas comemorativas e aniversários: lista por cliente/marca (ficha e
// Configurações), bloco "Datas chegando" e as entradas por catálogo, IA e
// arquivo. Vale pra agência e pra House (a lista é por cliente/marca).
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Bell, BellOff, CalendarHeart, Cake, Copy, FileUp, Loader2, Pencil, Plus, Sparkles, Trash2, Wand2, X } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { clientsQO, useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { isHouse, term } from "@/lib/luzeria/house";
import {
  CATALOG, DATE_RULES, RULE_LABEL, SEGMENT_LABEL, fmtDM, type DateKind, type DateRule, type Segment,
} from "@/lib/luzeria/commemorative";
import {
  listCommemorativeDates, upcomingCommemorativeDates, saveCommemorativeDate, deleteCommemorativeDate,
  addCatalogDates, copyDatesToClients, dismissOccurrence, turnDateIntoPost, suggestDatesForBusiness,
  extractDatesFromFiles, type CommemorativeDate, type DateSuggestion,
} from "@/lib/luzeria/commemorative.functions";

const KEY = ["commemorative-dates"];
const UPCOMING_KEY = ["commemorative-upcoming"];
const inputCls = "w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";
const DEFAULT_NOTIFY = 14;

function when(days: number) {
  return days === 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`;
}

function useRefresh() {
  const qc = useQueryClient();
  return () => { qc.invalidateQueries({ queryKey: KEY }); qc.invalidateQueries({ queryKey: UPCOMING_KEY }); };
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[110] bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className={`w-full ${wide ? "md:max-w-2xl" : "md:max-w-md"} bg-card rounded-t-2xl md:rounded-2xl p-5 border border-foreground/10 max-h-[92vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <button onClick={onClose} aria-label="Fechar" className="p-1 rounded text-foreground/50 hover:text-foreground"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase font-bold tracking-wider text-foreground/45 mb-1">{label}</span>
      {children}
    </label>
  );
}

const btnPrimary = { backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" } as const;

/* ======================= Editar / criar uma data ======================= */

function DateEditModal({ clientId, date, kind: forcedKind, onClose }: {
  clientId: string; date?: CommemorativeDate; kind?: DateKind; onClose: () => void;
}) {
  const refresh = useRefresh();
  const saveFn = useServerFn(saveCommemorativeDate);
  const kind: DateKind = date?.kind ?? forcedKind ?? "personalizada";
  const isBirthday = kind === "aniversario";
  const [title, setTitle] = useState(date?.title ?? "");
  const [rule, setRule] = useState<DateRule | "">(date?.rule ?? "");
  const [day, setDay] = useState(date?.day ? String(date.day) : "");
  const [month, setMonth] = useState(date?.month ? String(date.month) : "");
  const [notify, setNotify] = useState(String(date?.notifyDaysBefore ?? DEFAULT_NOTIFY));
  const [note, setNote] = useState(date?.note ?? "");
  const useRule = !!rule;
  const valid = title.trim().length > 0 && (useRule || (Number(day) >= 1 && Number(day) <= 31 && Number(month) >= 1 && Number(month) <= 12));
  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      id: date?.id, clientId, title: title.trim(), kind: useRule ? "movel" : kind === "movel" ? "personalizada" : kind,
      rule: useRule ? (rule as DateRule) : null, month: useRule ? null : Number(month), day: useRule ? null : Number(day),
      note: note.trim() || null, notifyDaysBefore: Math.max(0, Math.min(365, Math.round(Number(notify) || 0))), active: date?.active ?? true,
      segment: date?.segment ?? null,
    } }),
    onSuccess: () => { refresh(); toast.success("Data salva."); onClose(); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui salvar a data"),
  });
  return (
    <Modal title={date ? "Editar data" : isBirthday ? "Novo aniversário" : "Nova data"} onClose={onClose}>
      <div className="space-y-3">
        <Field label={isBirthday ? "De quem é" : "Nome da data"}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus className={inputCls}
            placeholder={isBirthday ? "ex: Aniversário da Dra. Marina" : "ex: Aniversário da loja, Feira da cidade"} />
        </Field>
        {!isBirthday && (
          <Field label="Quando">
            <select value={rule} onChange={(e) => setRule(e.target.value as DateRule | "")} className={inputCls}>
              <option value="">Data fixa (dia e mês)</option>
              {DATE_RULES.map((r) => <option key={r} value={r}>{RULE_LABEL[r]} (muda de dia todo ano)</option>)}
            </select>
          </Field>
        )}
        {!useRule && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dia"><input type="number" min={1} max={31} value={day} onChange={(e) => setDay(e.target.value)} className={inputCls} /></Field>
            <Field label="Mês"><input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls} /></Field>
          </div>
        )}
        <Field label="Quantos dias antes quer ser lembrado?">
          <input type="number" min={0} max={365} value={notify} onChange={(e) => setNotify(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Observação (opcional)">
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className={inputCls}
            placeholder="ex: oferecer combo, falar do novo serviço" />
        </Field>
      </div>
      <button onClick={() => save.mutate()} disabled={!valid || save.isPending}
        className="mt-5 w-full rounded-md py-3 text-sm font-bold disabled:opacity-40" style={btnPrimary}>
        {save.isPending ? "Salvando…" : "Salvar"}
      </button>
    </Modal>
  );
}

/* ======================= Datas padrão (catálogo) ======================= */

function CatalogModal({ clientId, existing, onClose }: { clientId: string; existing: Set<string>; onClose: () => void }) {
  const refresh = useRefresh();
  const addFn = useServerFn(addCatalogDates);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [notify, setNotify] = useState(String(DEFAULT_NOTIFY));
  const groups = (["geral", "varejo", "saude"] as Segment[]).map((s) => ({ s, items: CATALOG.filter((c) => c.segment === s) }));
  const toggle = (k: string) => setPicked((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const add = useMutation({
    mutationFn: () => addFn({ data: { clientId, keys: [...picked], notifyDaysBefore: Math.max(0, Math.round(Number(notify) || 0)) } }),
    onSuccess: (r) => { refresh(); toast.success(`${r.added} data(s) adicionada(s).`); onClose(); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui adicionar"),
  });
  return (
    <Modal title="Datas padrão" onClose={onClose} wide>
      <p className="text-xs text-foreground/50 mb-3">Marque as que fazem sentido pra essa marca. Dia das Mães, Páscoa, Carnaval, Black Friday e outras que mudam de dia são calculadas sozinhas todo ano.</p>
      <div className="space-y-4">
        {groups.map(({ s, items }) => (
          <div key={s}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/55">{SEGMENT_LABEL[s]}</div>
              <button className="text-[10.5px] text-foreground/45 hover:text-foreground"
                onClick={() => setPicked((p) => { const n = new Set(p); items.filter((i) => !existing.has(i.title.toLowerCase())).forEach((i) => n.add(i.key)); return n; })}>marcar todas</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-1">
              {items.map((c) => {
                const has = existing.has(c.title.toLowerCase());
                return (
                  <label key={c.key} className={`flex items-center gap-2 text-sm rounded-md px-2 py-1.5 ${has ? "opacity-40" : "hover:bg-foreground/[0.04] cursor-pointer"}`}>
                    <input type="checkbox" disabled={has} checked={picked.has(c.key) || has} onChange={() => toggle(c.key)} />
                    <span className="flex-1 truncate">{c.title}</span>
                    <span className="text-[10.5px] text-foreground/40 tabular-nums">{c.rule ? "móvel" : `${String(c.day).padStart(2, "0")}/${String(c.month).padStart(2, "0")}`}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Field label="Lembrar quantos dias antes?">
          <input type="number" min={0} max={365} value={notify} onChange={(e) => setNotify(e.target.value)} className={`${inputCls} w-28`} />
        </Field>
        <p className="text-[11px] text-foreground/45 flex-1 min-w-[180px]">Vale pra todas que você marcar. Depois dá pra ajustar uma por uma.</p>
      </div>
      <button onClick={() => add.mutate()} disabled={picked.size === 0 || add.isPending}
        className="mt-4 w-full rounded-md py-3 text-sm font-bold disabled:opacity-40" style={btnPrimary}>
        {add.isPending ? "Adicionando…" : `Adicionar ${picked.size || ""} data(s)`}
      </button>
    </Modal>
  );
}

/* ======================= Sugestões (ramo / arquivo) ======================= */

function SuggestionsList({ items, clientId, onDone, existing }: { items: DateSuggestion[]; clientId: string; onDone: () => void; existing: Set<string> }) {
  const refresh = useRefresh();
  const saveFn = useServerFn(saveCommemorativeDate);
  const [picked, setPicked] = useState<Set<number>>(() => new Set(items.map((_, i) => i).filter((i) => !existing.has(items[i].title.toLowerCase()))));
  const [notify, setNotify] = useState(String(DEFAULT_NOTIFY));
  const add = useMutation({
    mutationFn: async () => {
      const days = Math.max(0, Math.round(Number(notify) || 0));
      let n = 0;
      for (const i of picked) {
        const s = items[i];
        await saveFn({ data: {
          clientId, title: s.title, kind: s.rule ? "movel" : "personalizada", rule: s.rule ?? null,
          month: s.rule ? null : s.month ?? null, day: s.rule ? null : s.day ?? null, note: s.why ?? null, notifyDaysBefore: days,
        } });
        n++;
      }
      return n;
    },
    onSuccess: (n) => { refresh(); toast.success(`${n} data(s) adicionada(s).`); onDone(); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui adicionar"),
  });
  return (
    <div>
      <ul className="space-y-1 max-h-[46vh] overflow-y-auto">
        {items.map((s, i) => {
          const has = existing.has(s.title.toLowerCase());
          return (
            <li key={i}>
              <label className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${has ? "opacity-40" : "hover:bg-foreground/[0.04] cursor-pointer"}`}>
                <input type="checkbox" className="mt-1" disabled={has} checked={picked.has(i)}
                  onChange={() => setPicked((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; })} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-foreground">{s.title}</span>
                  {s.why && <span className="block text-[11px] text-foreground/45">{s.why}</span>}
                </span>
                <span className="text-[10.5px] text-foreground/40 tabular-nums shrink-0">{s.rule ? RULE_LABEL[s.rule] : `${String(s.day).padStart(2, "0")}/${String(s.month).padStart(2, "0")}`}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-end gap-3">
        <Field label="Lembrar quantos dias antes?">
          <input type="number" min={0} max={365} value={notify} onChange={(e) => setNotify(e.target.value)} className={`${inputCls} w-28`} />
        </Field>
      </div>
      <button onClick={() => add.mutate()} disabled={picked.size === 0 || add.isPending}
        className="mt-4 w-full rounded-md py-3 text-sm font-bold disabled:opacity-40" style={btnPrimary}>
        {add.isPending ? "Adicionando…" : `Adicionar ${picked.size} data(s)`}
      </button>
    </div>
  );
}

function BusinessModal({ clientId, existing, onClose }: { clientId: string; existing: Set<string>; onClose: () => void }) {
  const fn = useServerFn(suggestDatesForBusiness);
  const [business, setBusiness] = useState("");
  const [items, setItems] = useState<DateSuggestion[] | null>(null);
  const run = useMutation({
    mutationFn: () => fn({ data: { clientId, business: business.trim() } }),
    onSuccess: (r) => { if (!r.length) toast.error("A IA não achou datas pra esse ramo. Descreva de outro jeito."); else setItems(r); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui sugerir as datas"),
  });
  return (
    <Modal title="Sugerir datas pelo ramo" onClose={onClose} wide>
      {!items ? (
        <>
          <p className="text-xs text-foreground/50 mb-3">Conte o ramo do negócio e a IA sugere as datas que valem conteúdo (inclusive as específicas, como Dia do Fisioterapeuta). Nada entra sem você marcar.</p>
          <Field label="Qual é o ramo?">
            <input value={business} onChange={(e) => setBusiness(e.target.value)} maxLength={200} autoFocus className={inputCls}
              placeholder="ex: clínica de fisioterapia, loja de brinquedos, escritório de advocacia" />
          </Field>
          <button onClick={() => run.mutate()} disabled={business.trim().length < 3 || run.isPending}
            className="mt-4 w-full rounded-md py-3 text-sm font-bold disabled:opacity-40 inline-flex items-center justify-center gap-2" style={btnPrimary}>
            {run.isPending ? <><Loader2 size={15} className="animate-spin" /> Pensando…</> : <><Wand2 size={15} /> Sugerir datas</>}
          </button>
        </>
      ) : <SuggestionsList items={items} clientId={clientId} existing={existing} onDone={onClose} />}
    </Modal>
  );
}

function FileModal({ clientId, existing, onClose }: { clientId: string; existing: Set<string>; onClose: () => void }) {
  const fn = useServerFn(extractDatesFromFiles);
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<DateSuggestion[] | null>(null);
  const run = useMutation({
    mutationFn: async (files: File[]) => {
      const encoded = await Promise.all(files.map(async (f) => {
        const buf = new Uint8Array(await f.arrayBuffer());
        let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        return { name: f.name, mimeType: f.type || "application/octet-stream", base64: btoa(bin) };
      }));
      return fn({ data: { clientId, files: encoded } });
    },
    onSuccess: (r) => { if (!r.length) toast.error("Não achei datas nesse arquivo."); else setItems(r); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui ler o arquivo"),
  });
  return (
    <Modal title="Importar datas de um arquivo" onClose={onClose} wide>
      {!items ? (
        <>
          <p className="text-xs text-foreground/50 mb-3">Envie uma planilha, um PDF ou a imagem de um calendário. A IA lê, mostra as datas que achou e você confirma quais entram. Até 5 arquivos, 10 MB cada.</p>
          <input ref={input} type="file" multiple accept=".csv,.xlsx,.xls,application/pdf,image/*" className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).slice(0, 5);
              e.target.value = "";
              if (files.some((f) => f.size > 10_000_000)) { toast.error("Cada arquivo pode ter até 10 MB."); return; }
              if (files.length) run.mutate(files);
            }} />
          <button onClick={() => input.current?.click()} disabled={run.isPending}
            className="w-full rounded-md py-3 text-sm font-bold disabled:opacity-40 inline-flex items-center justify-center gap-2" style={btnPrimary}>
            {run.isPending ? <><Loader2 size={15} className="animate-spin" /> Lendo o arquivo…</> : <><FileUp size={15} /> Escolher arquivo</>}
          </button>
        </>
      ) : <SuggestionsList items={items} clientId={clientId} existing={existing} onDone={onClose} />}
    </Modal>
  );
}

/* ======================= Copiar pra outras marcas ======================= */

function CopyModal({ fromClientId, onClose }: { fromClientId: string; onClose: () => void }) {
  const me = useMe().data;
  const refresh = useRefresh();
  const { data: clients = [] } = useQuery(clientsQO());
  const fn = useServerFn(copyDatesToClients);
  const targets = clients.filter((c: any) => !c.archived && c.id !== fromClientId && c.category !== "Ex-clientes");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const copy = useMutation({
    mutationFn: () => fn({ data: { fromClientId, toClientIds: [...picked] } }),
    onSuccess: (r) => { refresh(); toast.success(`${r.added} data(s) copiada(s).`); onClose(); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui copiar"),
  });
  return (
    <Modal title={`Copiar datas para outr${isHouse(me) ? "as marcas" : "os clientes"}`} onClose={onClose}>
      <p className="text-xs text-foreground/50 mb-3">Copia todas as datas desta lista para quem você marcar (as que já existem lá são ignoradas).</p>
      {targets.length === 0 ? <p className="text-sm text-foreground/45">Não há outros para receber.</p> : (
        <ul className="space-y-1 max-h-[46vh] overflow-y-auto">
          {targets.map((c: any) => (
            <li key={c.id}>
              <label className="flex items-center gap-2 text-sm rounded-md px-2 py-1.5 hover:bg-foreground/[0.04] cursor-pointer">
                <input type="checkbox" checked={picked.has(c.id)} onChange={() => setPicked((p) => { const n = new Set(p); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })} />
                {c.name}
              </label>
            </li>
          ))}
        </ul>
      )}
      <button onClick={() => copy.mutate()} disabled={picked.size === 0 || copy.isPending}
        className="mt-4 w-full rounded-md py-3 text-sm font-bold disabled:opacity-40" style={btnPrimary}>
        {copy.isPending ? "Copiando…" : `Copiar para ${picked.size}`}
      </button>
    </Modal>
  );
}

/* ======================= Virar post (usado na lista e no bloco) ======================= */

export function useTurnIntoPost() {
  const refresh = useRefresh();
  const navigate = useNavigate();
  const { selectMonth, openItem } = useUI();
  const fn = useServerFn(turnDateIntoPost);
  return useMutation({
    mutationFn: (v: { d: CommemorativeDate; withAi: boolean }) => fn({ data: { dateId: v.d.id, year: v.d.nextYear, withAi: v.withAi } }),
    onSuccess: (r, v) => {
      refresh();
      const open = () => {
        navigate({ to: "/cliente/$clientId", params: { clientId: r.clientId } });
        selectMonth(r.monthKey);
        setTimeout(() => openItem(r.itemId), 30);
      };
      if (v.withAi && !r.aiUsed) {
        toast.message("Card criado com o briefing padrão.", { description: r.aiError ?? "A IA não respondeu.", action: { label: "Abrir", onClick: open }, duration: 10000 });
      } else {
        toast.success("Virou post! Prazo: " + fmtDM(r.dueDate), { action: { label: "Abrir", onClick: open }, duration: 8000 });
      }
    },
    onError: (e: any) => toastFriendlyError(e, "Não consegui criar o post"),
  });
}

/* ======================= Painel (ficha e Configurações) ======================= */

export function CommemorativeDatesPanel({ clientId }: { clientId: string }) {
  const me = useMe().data;
  const house = isHouse(me);
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const listFn = useServerFn(listCommemorativeDates);
  const delFn = useServerFn(deleteCommemorativeDate);
  const saveFn = useServerFn(saveCommemorativeDate);
  const dismissFn = useServerFn(dismissOccurrence);
  const refresh = useRefresh();
  const turn = useTurnIntoPost();
  const { data: dates = [], isLoading } = useQuery({ queryKey: [...KEY, clientId], queryFn: () => listFn({ data: { clientId } }) });
  const [modal, setModal] = useState<null | { kind: "edit"; date?: CommemorativeDate; type?: DateKind } | { kind: "catalog" | "business" | "file" | "copy" }>(null);
  const existing = useMemo(() => new Set(dates.map((d) => d.title.toLowerCase())), [dates]);

  const toggleActive = useMutation({
    mutationFn: (d: CommemorativeDate) => saveFn({ data: {
      id: d.id, clientId: d.clientId, title: d.title, kind: d.kind, rule: d.rule, month: d.month, day: d.day,
      segment: d.segment, note: d.note, notifyDaysBefore: d.notifyDaysBefore, active: !d.active,
    } }),
    onSuccess: refresh, onError: (e: any) => toastFriendlyError(e, "Não consegui alterar"),
  });
  const remove = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }), onSuccess: refresh, onError: (e: any) => toastFriendlyError(e, "Não consegui apagar") });
  const dismiss = useMutation({
    mutationFn: (v: { d: CommemorativeDate; dismissed: boolean }) => dismissFn({ data: { dateId: v.d.id, year: v.d.nextYear, dismissed: v.dismissed } }),
    onSuccess: refresh, onError: (e: any) => toastFriendlyError(e, "Não consegui alterar"),
  });

  return (
    <div>
      {isAdmin && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setModal({ kind: "edit" })} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold" style={btnPrimary}><Plus size={13} /> Data</button>
          <button onClick={() => setModal({ kind: "edit", type: "aniversario" })} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold border border-foreground/15 text-foreground/80 hover:bg-foreground/5"><Cake size={13} /> Aniversário</button>
          <button onClick={() => setModal({ kind: "catalog" })} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold border border-foreground/15 text-foreground/80 hover:bg-foreground/5"><CalendarHeart size={13} /> Datas padrão</button>
          <button onClick={() => setModal({ kind: "business" })} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold border border-foreground/15 text-foreground/80 hover:bg-foreground/5"><Wand2 size={13} /> Sugerir pelo ramo</button>
          <button onClick={() => setModal({ kind: "file" })} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold border border-foreground/15 text-foreground/80 hover:bg-foreground/5"><FileUp size={13} /> Importar arquivo</button>
          {dates.length > 0 && (
            <button onClick={() => setModal({ kind: "copy" })} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold border border-foreground/15 text-foreground/80 hover:bg-foreground/5"><Copy size={13} /> Copiar pra outr{house ? "as marcas" : "os clientes"}</button>
          )}
        </div>
      )}

      {isLoading ? <div className="text-sm text-foreground/40">Carregando…</div> : dates.length === 0 ? (
        <div className="text-sm text-foreground/50 py-4">
          Nenhuma data ainda. {isAdmin ? "Comece pelas datas padrão ou conte o ramo pra IA sugerir." : "Peça pro gestor cadastrar."}
        </div>
      ) : (
        <ul className="divide-y divide-foreground/[0.06]">
          {dates.map((d) => (
            <li key={d.id} className={`py-3 flex flex-wrap items-center gap-x-4 gap-y-2 ${d.active ? "" : "opacity-45"}`}>
              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  {d.kind === "aniversario" && <Cake size={13} className="text-foreground/50" />}
                  {d.title}
                </div>
                <div className="text-[11.5px] text-foreground/50">
                  {fmtDM(d.nextDate)} · {when(d.daysUntil)} · avisa {d.notifyDaysBefore === 0 ? "no dia" : `${d.notifyDaysBefore} dia${d.notifyDaysBefore === 1 ? "" : "s"} antes`}
                  {d.rule ? ` · ${RULE_LABEL[d.rule]}` : ""}
                </div>
                {d.note && <div className="text-[11px] text-foreground/40 truncate">{d.note}</div>}
              </div>
              <div className="flex items-center gap-1.5">
                {d.itemId ? <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.15)", color: "var(--lz-accent-ink)" }}>Já virou post</span>
                  : d.dismissed ? <button onClick={() => dismiss.mutate({ d, dismissed: false })} className="text-[11px] text-foreground/50 hover:text-foreground underline">Ignorada este ano (desfazer)</button>
                  : d.active && (
                    <>
                      <button onClick={() => turn.mutate({ d, withAi: false })} disabled={turn.isPending}
                        className="px-2.5 py-1.5 rounded-md text-[11px] font-bold disabled:opacity-40" style={btnPrimary}>Virar post</button>
                      <button onClick={() => turn.mutate({ d, withAi: true })} disabled={turn.isPending} title="Cria o post já com ideia, texto da arte e legenda feitos pela IA"
                        className="px-2.5 py-1.5 rounded-md text-[11px] font-bold border border-foreground/15 text-foreground/75 hover:bg-foreground/5 disabled:opacity-40 inline-flex items-center gap-1"><Sparkles size={11} /> com IA</button>
                    </>
                  )}
                {isAdmin && (
                  <>
                    <button onClick={() => toggleActive.mutate(d)} title={d.active ? "Silenciar (não lembrar mais)" : "Voltar a lembrar"} className="p-1.5 rounded text-foreground/45 hover:text-foreground hover:bg-foreground/5">
                      {d.active ? <Bell size={14} /> : <BellOff size={14} />}
                    </button>
                    <button onClick={() => setModal({ kind: "edit", date: d })} title="Editar" className="p-1.5 rounded text-foreground/45 hover:text-foreground hover:bg-foreground/5"><Pencil size={14} /></button>
                    <button onClick={async () => { if (await requestConfirm(`Apagar "${d.title}"?`, { danger: true })) remove.mutate(d.id); }} title="Apagar" className="p-1.5 rounded text-foreground/45 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal?.kind === "edit" && <DateEditModal clientId={clientId} date={modal.date} kind={modal.type} onClose={() => setModal(null)} />}
      {modal?.kind === "catalog" && <CatalogModal clientId={clientId} existing={existing} onClose={() => setModal(null)} />}
      {modal?.kind === "business" && <BusinessModal clientId={clientId} existing={existing} onClose={() => setModal(null)} />}
      {modal?.kind === "file" && <FileModal clientId={clientId} existing={existing} onClose={() => setModal(null)} />}
      {modal?.kind === "copy" && <CopyModal fromClientId={clientId} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ======================= Configurações: escolher a marca/cliente ======================= */

export function CommemorativeSettingsTab() {
  const me = useMe().data;
  const { data: clients = [] } = useQuery(clientsQO());
  const list = clients.filter((c: any) => !c.archived && c.category !== "Ex-clientes").sort((a: any, b: any) => a.name.localeCompare(b.name));
  const [clientId, setClientId] = useState<string>("");
  const current = clientId || list[0]?.id || "";
  return (
    <div className="max-w-3xl">
      <p className="text-sm text-foreground/60 mb-4">
        As datas importantes de cada {term(me, "cliente")}: comemorativas, do ramo e aniversários. Você escolhe com quantos dias de antecedência quer ser lembrado de cada uma.
        Os lembretes chegam nas notificações às 8h, só pra gestores, e as datas próximas aparecem em {isHouse(me) ? "Meu dia" : "Minhas demandas"}.
      </p>
      {list.length === 0 ? <div className="text-sm text-foreground/45">Cadastre {isHouse(me) ? "uma marca" : "um cliente"} primeiro.</div> : (
        <>
          {list.length > 1 && (
            <div className="mb-4 max-w-xs">
              <Field label={term(me, "Cliente")}>
                <select value={current} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
                  {list.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
          )}
          <div className="bg-card rounded-2xl p-5 border border-foreground/[0.06]">
            <CommemorativeDatesPanel clientId={current} />
          </div>
        </>
      )}
    </div>
  );
}

/* ======================= Bloco "Datas chegando" ======================= */

export function UpcomingDatesCard({ brandId, className = "" }: { brandId?: string; className?: string }) {
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const canAct = isAdmin || isHouse(me);
  const fn = useServerFn(upcomingCommemorativeDates);
  const dismissFn = useServerFn(dismissOccurrence);
  const refresh = useRefresh();
  const turn = useTurnIntoPost();
  const { data: dates = [] } = useQuery({ queryKey: [...UPCOMING_KEY, brandId ?? "all"], queryFn: () => fn({ data: { brandId } }), staleTime: 60_000 });
  const dismiss = useMutation({
    mutationFn: (d: CommemorativeDate) => dismissFn({ data: { dateId: d.id, year: d.nextYear, dismissed: true } }),
    onSuccess: refresh, onError: (e: any) => toastFriendlyError(e, "Não consegui ignorar"),
  });
  const multiClient = new Set(dates.map((d) => d.clientId)).size > 1;
  if (dates.length === 0) return null;
  return (
    <section className={`bg-card rounded-2xl p-5 border border-foreground/[0.06] ${className}`} data-tour="upcoming-dates">
      <h2 className="flex items-center gap-2 text-xs uppercase font-bold tracking-wider text-foreground/60 mb-3">
        <span style={{ color: "var(--lz-accent-ink)" }}><CalendarHeart size={14} /></span> Datas chegando
      </h2>
      <ul className="divide-y divide-foreground/[0.06]">
        {dates.slice(0, 8).map((d) => {
          const urgent = d.daysUntil <= d.notifyDaysBefore;
          return (
            <li key={d.id} className="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="flex-1 min-w-[160px]">
                <div className="text-sm font-semibold text-foreground">{d.title}{multiClient ? <span className="font-normal text-foreground/45"> · {d.clientName}</span> : null}</div>
                <div className="text-[11.5px]" style={{ color: urgent && !d.itemId ? "#E7A951" : "color-mix(in srgb, var(--foreground) 50%, transparent)" }}>
                  {fmtDM(d.nextDate)} · {when(d.daysUntil)}
                </div>
              </div>
              {d.itemId ? <span className="text-[11px] font-semibold" style={{ color: "var(--lz-accent-ink)" }}>Já virou post</span>
                : canAct && (
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => turn.mutate({ d, withAi: false })} disabled={turn.isPending} className="px-2.5 py-1.5 rounded-md text-[11px] font-bold disabled:opacity-40" style={btnPrimary}>Virar post</button>
                    <button onClick={() => turn.mutate({ d, withAi: true })} disabled={turn.isPending} title="Com ideia, texto da arte e legenda da IA"
                      className="px-2 py-1.5 rounded-md text-[11px] font-bold border border-foreground/15 text-foreground/75 hover:bg-foreground/5 disabled:opacity-40"><Sparkles size={11} /></button>
                    <button onClick={() => dismiss.mutate(d)} title="Ignorar este ano" className="p-1.5 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5"><X size={13} /></button>
                  </div>
                )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
