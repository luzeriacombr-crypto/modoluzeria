import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingDown, Info, X, ChevronDown, ChevronRight, Minus, Plus } from "lucide-react";
import { orgCostSettingsQO, clientMarginsQO, clientMarginBreakdownQO, useApi, useMe } from "@/lib/luzeria/queries";
import { isHouse, term } from "@/lib/luzeria/house";
import { useUI } from "@/lib/luzeria/ui-store";
import { CONTENT_TYPE_LABEL, type ContentType } from "@/lib/luzeria/types";
import { InfoTip } from "./InfoTip";

/** Tempo médio por etapa. Post e reels têm duas: planejar (custo dos
 * responsáveis marcados no item) e design/edição (custo do Editor marcado). */
const EFFORT_GROUPS: { title: string; rows: { key: string; label: string; hint?: string }[] }[] = [
  { title: "Post", rows: [
    { key: "post", label: "Planejar post", hint: "responsável" },
    { key: "post_design", label: "Criar design de post", hint: "editor" },
  ] },
  { title: "Reels", rows: [
    { key: "reel", label: "Planejar reels", hint: "responsável" },
    { key: "reel_edit", label: "Editar reels", hint: "editor" },
  ] },
  { title: "Story", rows: [{ key: "story", label: "Story" }] },
  { title: "Gravação", rows: [{ key: "gravacao", label: "Gravação" }] },
  { title: "Outro", rows: [{ key: "outros", label: "Outro" }] },
];
const EFFORT_KEYS = EFFORT_GROUPS.flatMap((g) => g.rows.map((r) => r.key));
const DAYS_OPTIONS = [30, 90, 180] as const;
const SORT_OPTIONS = [
  { id: "margin", label: "Pior margem" },
  { id: "name", label: "Nome" },
  { id: "contract", label: "Valor do contrato" },
] as const;
// House: sem contrato nem margem — só quanto a equipe custa em cada marca.
const HOUSE_SORT_OPTIONS = [
  { id: "cost", label: "Maior custo" },
  { id: "name", label: "Nome" },
] as const;
type SortBy = (typeof SORT_OPTIONS)[number]["id"] | (typeof HOUSE_SORT_OPTIONS)[number]["id"];

const money = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const inp = "w-full bg-card border border-foreground/8 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))] transition-colors";

/** 0,5 → "30 min", 1 → "1h", 1,5 → "1h30". */
function formatHours(h: number): string {
  const total = Math.round((Number.isFinite(h) ? h : 0) * 60);
  if (total <= 0) return "0";
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  if (hh === 0) return `${mm} min`;
  return mm === 0 ? `${hh}h` : `${hh}h${String(mm).padStart(2, "0")}`;
}

const HOURS_STEP = 0.25;

function HoursStepper({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (v: number) => void }) {
  const set = (v: number) => onChange(Math.min(24, Math.max(0, Math.round(v * 4) / 4)));
  const btn = "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-foreground/55 hover:text-foreground hover:bg-foreground/8 disabled:opacity-30 disabled:hover:bg-transparent transition-colors";
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-foreground/85 truncate">{label}</div>
        {hint && <div className="text-[10.5px] text-foreground/35">custo do {hint}</div>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" aria-label={`Diminuir ${label}`} className={btn} disabled={value <= 0} onClick={() => set(value - HOURS_STEP)}><Minus size={14} /></button>
        <div className="w-14 text-center text-base font-extrabold text-foreground tabular-nums">{formatHours(value)}</div>
        <button type="button" aria-label={`Aumentar ${label}`} className={btn} onClick={() => set(value + HOURS_STEP)}><Plus size={14} /></button>
      </div>
    </div>
  );
}

function CostSettingsForm() {
  const { data: settings, isLoading } = useQuery(orgCostSettingsQO());
  const api = useApi();
  const [hourlyCost, setHourlyCost] = useState<string | number>("");
  const [avgHours, setAvgHours] = useState<Record<string, string | number>>({});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setHourlyCost(settings.hourlyCost ?? "");
    setAvgHours(settings.avgHoursByType ?? {});
  }, [settings]);

  if (isLoading || !settings) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-foreground/40" size={24} /></div>;
  }

  function save() {
    api.setOrgCostSettings.mutate({
      data: {
        hourlyCost: hourlyCost === "" ? null : Number(hourlyCost),
        avgHoursByType: Object.fromEntries(
          EFFORT_KEYS.map((k) => [k, Number(avgHours[k]) || 0]),
        ),
      },
    });
  }

  const summary = [
    hourlyCost === "" ? "Custo-hora não definido" : `${money(Number(hourlyCost))}/h`,
    ...EFFORT_GROUPS.flatMap((g) => g.rows.map((r) => `${r.label} ${formatHours(Number(avgHours[r.key]) || 0)}`)),
  ].join(" · ");

  return (
    <div className="bg-card border border-foreground/7 rounded-xl p-4">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2.5 text-left">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">Alterar custo por hora</div>
          <div className="text-[11px] text-foreground/45 truncate">{summary}</div>
        </div>
        {open ? <ChevronDown size={14} className="text-foreground/40 shrink-0" /> : <ChevronRight size={14} className="text-foreground/40 shrink-0" />}
      </button>
      {open && (
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-foreground/50 mb-1 inline-flex items-center gap-1">
                Custo-hora (R$)
                <InfoTip text="Cada colaborador pode ter seu próprio custo-hora, calculado a partir do salário e da escala cadastrados em Configurações → Equipe (clique no card da pessoa). Esse valor aqui é só a reserva: usado quando alguém ainda não tem remuneração cadastrada." />
              </label>
              <input type="number" min="0" step="0.01" value={hourlyCost}
                onChange={(e) => setHourlyCost(e.target.value)} placeholder="Não definido" className={inp} />
            </div>
          </div>
          <div>
            <label className="text-xs text-foreground/50 mb-2 inline-flex items-center gap-1">
              Tempo médio por tipo de conteúdo
              <InfoTip text="Quanto tempo, em média, sua equipe leva pra produzir cada tipo de item (ajuste de 15 em 15 minutos). Em posts e reels são duas etapas: planejar (custo de quem está como responsável) e design/edição (custo de quem está marcado como Editor). Usado junto com os itens finalizados pra estimar quantas horas cada cliente consumiu." />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {EFFORT_GROUPS.map((g) => (
                <div key={g.title} className="rounded-xl border border-foreground/8 bg-foreground/[0.02] px-4 py-3 space-y-2.5">
                  {g.rows.length > 1 && <div className="text-[10px] uppercase font-semibold tracking-wider text-foreground/40">{g.title}</div>}
                  {g.rows.map((r) => (
                    <HoursStepper key={r.key} label={r.label} hint={r.hint} value={Number(avgHours[r.key]) || 0}
                      onChange={(v) => setAvgHours((prev) => ({ ...prev, [r.key]: v }))} />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <button onClick={save} disabled={api.setOrgCostSettings.isPending}
            className="rounded-md px-4 py-2 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
            {api.setOrgCostSettings.isPending ? "Salvando…" : "Salvar custo-hora"}
          </button>
        </div>
      )}
    </div>
  );
}

export function ClientMarginPanel() {
  const [days, setDays] = useState<30 | 90 | 180>(30);
  const { data, isLoading } = useQuery(clientMarginsQO(days));
  const { openFicha } = useUI();
  const [breakdownFor, setBreakdownFor] = useState<{ clientId: string; clientName: string } | null>(null);
  const me = useMe().data;
  const house = isHouse(me);
  const [sortBy, setSortBy] = useState<SortBy>(house ? "cost" : "margin");

  // O server já devolve ordenado por margem (pior primeiro) — os outros
  // modos só reordenam no cliente, sem re-buscar nada.
  const sortedRows = useMemo(() => {
    if (!data) return [];
    const rows = [...data.rows];
    if (sortBy === "name") rows.sort((a, b) => a.clientName.localeCompare(b.clientName, "pt-BR"));
    else if (sortBy === "cost") rows.sort((a, b) => (b.estimatedCost ?? -1) - (a.estimatedCost ?? -1));
    else if (sortBy === "contract") rows.sort((a, b) => (b.contractValue ?? -1) - (a.contractValue ?? -1));
    else return data.rows;
    return rows;
  }, [data, sortBy]);
  const totals = useMemo(() => ({
    delivered: sortedRows.reduce((n, r) => n + r.deliveredCount, 0),
    hours: Math.round(sortedRows.reduce((n, r) => n + r.estimatedHours, 0) * 10) / 10,
    cost: sortedRows.some((r) => r.estimatedCost != null) ? sortedRows.reduce((n, r) => n + (r.estimatedCost ?? 0), 0) : null,
  }), [sortedRows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingDown size={16} className="text-[var(--lz-accent-ink)]" />
        <h2 className="text-foreground font-semibold">{house ? "Custo da equipe por marca" : "Margem por cliente"}</h2>
      </div>

      <CostSettingsForm />

      <div className="flex items-center gap-2 text-foreground/60 text-xs bg-foreground/[0.03] border border-foreground/10 rounded-lg px-3 py-2">
        <Info size={14} className="shrink-0" />
        Custo é uma estimativa (itens finalizados × horas médias × custo-hora de quem executou, ou o padrão acima quando a pessoa não tem remuneração cadastrada) — não é apontamento real de horas nem contabilidade oficial.
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          {DAYS_OPTIONS.map((d) => (
            <button key={d} onClick={() => setDays(d)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${days === d ? "text-[#0D0D0D]" : "text-foreground/60 hover:text-foreground bg-foreground/[0.05]"}`}
              style={days === d ? { backgroundColor: "rgb(var(--lz-brand-rgb))" } : undefined}>
              {d} dias
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-foreground/40">
          Ordenar por
          <div className="flex items-center gap-1 bg-foreground/[0.05] rounded-md p-1">
            {(house ? HOUSE_SORT_OPTIONS : SORT_OPTIONS).map((opt) => (
              <button key={opt.id} onClick={() => setSortBy(opt.id)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${sortBy === opt.id ? "text-[#0D0D0D]" : "text-foreground/60 hover:text-foreground"}`}
                style={sortBy === opt.id ? { backgroundColor: "rgb(var(--lz-brand-rgb))" } : undefined}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-foreground/40" size={32} /></div>
      ) : !data || data.rows.length === 0 ? (
        <div className="text-center py-12 px-6 bg-foreground/[0.03] border border-foreground/10 rounded-2xl">
          <p className="text-foreground/50 text-sm">{house ? "Nenhuma marca ativa encontrada." : "Nenhum cliente ativo encontrado."}</p>
        </div>
      ) : (
        <div className="bg-card border border-foreground/7 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-foreground/7">
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/60">
                  <span className="inline-flex items-center gap-1">
                    {house ? "Marca" : "Cliente"}
                    <InfoTip text={house ? "Nome da marca. Clique pra abrir a ficha completa." : "Nome do cliente. Clique pra abrir a ficha completa e preencher o valor do contrato, por exemplo."} />
                  </span>
                </th>
                {!house && <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/60">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <InfoTip text="Quanto o cliente paga no período escolhido: valor mensal do contrato × meses do período (em Avulsos, o valor fechado do trabalho). Aparece '—' quando ainda não foi preenchido." />
                    Receita no período
                  </span>
                </th>}
                <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/60">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <InfoTip text="Quantidade de itens finalizados desse cliente no período escolhido (30/90/180 dias) — mesma contagem usada no ranking da equipe." />
                    Entregues
                  </span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/60">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <InfoTip text="Horas estimadas gastas com esse cliente no período: itens entregues × média de horas por tipo de conteúdo (configurada acima)." />
                    Horas est.
                  </span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/60">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <InfoTip text="Horas estimadas × custo-hora da equipe. É uma estimativa, não um apontamento real." />
                    Custo est.
                  </span>
                </th>
                {house ? (
                  <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/60">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <InfoTip text="Quanto do custo total da house está nessa marca." />
                      % do total
                    </span>
                  </th>
                ) : (
                  <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/60">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <InfoTip text="Receita no período menos o custo estimado. Vermelho quando negativo, verde quando positivo. Aparece '—' quando o contrato não está preenchido." />
                      Margem
                    </span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr key={r.clientId} className="border-b border-foreground/4 last:border-0">
                  <td className="px-4 py-3 text-sm text-foreground">
                    <button onClick={() => openFicha(r.clientId)} className="flex items-center gap-2 hover:underline">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: r.clientColor }} />
                      {r.clientName}
                    </button>
                  </td>
                  {!house && <td className="px-4 py-3 text-sm text-foreground/70 text-right">
                    {money(r.periodRevenue)}
                    {r.periodRevenue != null && r.contractValue != null && r.periodRevenue !== r.contractValue && (
                      <div className="text-[10px] text-foreground/35">{money(r.contractValue)}/mês</div>
                    )}
                  </td>}
                  <td className="px-4 py-3 text-sm text-right">
                    <button onClick={() => setBreakdownFor({ clientId: r.clientId, clientName: r.clientName })}
                      className="text-foreground/70 hover:text-[var(--lz-accent-ink)] hover:underline transition">
                      {r.deliveredCount}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <button onClick={() => setBreakdownFor({ clientId: r.clientId, clientName: r.clientName })}
                      className="text-foreground/70 hover:text-[var(--lz-accent-ink)] hover:underline transition">
                      {r.estimatedHours}h
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground/70 text-right">{money(r.estimatedCost)}</td>
                  {house ? (
                    <td className="px-4 py-3 text-sm text-right font-semibold text-foreground/80 tabular-nums">
                      {totals.cost && r.estimatedCost != null ? `${Math.round((r.estimatedCost / totals.cost) * 100)}%` : "—"}
                    </td>
                  ) : (
                    <td className="px-4 py-3 text-sm text-right font-semibold"
                      style={{ color: r.margin == null ? "color-mix(in srgb, var(--foreground) 40%, transparent)" : r.margin < 0 ? "#FF6B6B" : "#4ADE80" }}>
                      {money(r.margin)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {house && (
              <tfoot>
                <tr className="border-t border-foreground/10 bg-foreground/[0.03]">
                  <td className="px-4 py-3 text-sm font-bold text-foreground">Total da house</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-foreground/80">{totals.delivered}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-foreground/80">{totals.hours}h</td>
                  <td className="px-4 py-3 text-sm text-right font-bold" style={{ color: "var(--lz-accent-ink)" }}>{money(totals.cost)}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-foreground/80">{totals.cost ? "100%" : "—"}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {breakdownFor && (
        <MarginBreakdownModal
          clientId={breakdownFor.clientId}
          clientName={breakdownFor.clientName}
          days={days}
          onClose={() => setBreakdownFor(null)}
        />
      )}
    </div>
  );
}

function MarginBreakdownModal({ clientId, clientName, days, onClose }: {
  clientId: string; clientName: string; days: 30 | 90 | 180; onClose: () => void;
}) {
  const { data, isLoading } = useQuery(clientMarginBreakdownQO(clientId, days));
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[80vh] flex flex-col bg-card border border-foreground/10 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/8 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-foreground">{clientName}</h3>
            <p className="text-[11px] text-foreground/40">Detalhe dos últimos {days} dias</p>
          </div>
          <button onClick={onClose} className="text-foreground/50 hover:text-foreground p-1 rounded hover:bg-foreground/5 transition shrink-0">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-foreground/40" size={24} /></div>
          ) : !data || data.length === 0 ? (
            <div className="text-center py-10 px-6 text-foreground/40 text-sm">Nada finalizado nesse período.</div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {data.map((row) => (
                <div key={row.itemId} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 bg-foreground/5 text-foreground/50">
                    {CONTENT_TYPE_LABEL[row.itemType as ContentType] ?? row.itemType}
                  </span>
                  <span className="text-sm text-foreground truncate flex-1">{row.itemTitle}</span>
                  <span className="text-xs text-foreground/60 shrink-0">{row.userName}</span>
                  <span className="text-xs font-semibold text-foreground/80 tabular-nums shrink-0 w-10 text-right">{row.hours}h</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
