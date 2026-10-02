// House (Fase 4) — Relatório mensal: números do mês gerados sozinhos +
// três campos que a equipe preenche (o que funcionou / aprendemos / muda).
// "Enviar pro gestor" congela os números e avisa o dono; exporta em PDF.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Lightbulb, Loader2, RotateCcw, Send, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { useMe } from "@/lib/luzeria/queries";
import { getMonthlyReport, saveMonthlyReport, exportMonthlyReportPdf, type MonthlyReport } from "@/lib/luzeria/house-owner.functions";
import { houseDateKey, LEAD_ORIGINS, LEAD_ORIGIN_LABEL } from "@/lib/luzeria/house-checklists";
import { monthLabel } from "@/lib/luzeria/house-projects";
import { MonthSwitcher } from "./HouseOwnerPanel";

const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const money = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function HouseReport({ initialMonth }: { initialMonth?: string }) {
  const me = useMe().data;
  const qc = useQueryClient();
  // Por padrão abre o mês passado nos primeiros dias do mês (é quando o
  // relatório é feito); depois disso, o mês corrente.
  const [monthKey, setMonthKey] = useState(() => {
    if (initialMonth) return initialMonth;
    const today = houseDateKey();
    const [y, m] = today.split("-").map(Number);
    if (Number(today.slice(8, 10)) <= 10) return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    return today.slice(0, 7);
  });
  const fetchReport = useServerFn(getMonthlyReport);
  const saveFn = useServerFn(saveMonthlyReport);
  const pdfFn = useServerFn(exportMonthlyReportPdf);
  const queryKey = ["house-report", monthKey];
  const { data: report, isLoading } = useQuery({ queryKey, queryFn: () => fetchReport({ data: { monthKey } }) });

  const [whatWorked, setWhatWorked] = useState("");
  const [learned, setLearned] = useState("");
  const [nextChanges, setNextChanges] = useState("");
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!report) return;
    setWhatWorked(report.whatWorked); setLearned(report.learned); setNextChanges(report.nextChanges); setDirty(false);
  }, [report?.monthKey, report?.updatedAt]);

  const save = useMutation({
    mutationFn: (opts: { submit?: boolean; reopen?: boolean }) => saveFn({ data: { monthKey, whatWorked, learned, nextChanges, ...opts } }),
    onSuccess: (_r, opts) => {
      setDirty(false);
      qc.invalidateQueries({ queryKey });
      toast.success(opts.submit ? "Relatório enviado pro gestor!" : opts.reopen ? "Relatório reaberto pra edição." : "Salvo.");
    },
    onError: (e: any) => toastFriendlyError(e, "Não consegui salvar o relatório"),
  });
  const pdf = useMutation({
    mutationFn: () => pdfFn({ data: { monthKey } }),
    onSuccess: (r) => {
      const bin = atob(r.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = r.filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    },
    onError: (e: any) => toastFriendlyError(e, "Não consegui gerar o PDF"),
  });

  const sent = report?.status === "enviado";
  const isMaster = me?.role === "master";

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-10 max-w-4xl mx-auto pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase font-bold tracking-wider text-foreground/40">Relatório do mês</div>
          <h1 className="text-[28px] md:text-[32px] font-bold text-foreground tracking-tight mt-0.5 first-letter:uppercase">{monthLabel(monthKey)}</h1>
        </div>
        <MonthSwitcher monthKey={monthKey} onChange={async (k) => { if (!dirty || await requestConfirm("Descartar o que não foi salvo?")) setMonthKey(k); }} />
      </div>

      {isLoading || !report ? (
        <div className="mt-8 text-sm text-foreground/40">Calculando os números…</div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full"
              style={sent ? { backgroundColor: "rgba(var(--lz-brand-rgb),0.15)", color: "var(--lz-accent-ink)" } : { backgroundColor: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}>
              {sent ? `Enviado em ${new Date(report.submittedAt!).toLocaleDateString("pt-BR")}` : "Rascunho · números ao vivo"}
            </span>
            <span className="flex-1" />
            <button onClick={() => pdf.mutate()} disabled={pdf.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-bold border border-foreground/15 text-foreground/75 hover:text-foreground hover:bg-foreground/5 disabled:opacity-50">
              {pdf.isPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Exportar PDF
            </button>
          </div>

          <NumbersSection report={report} />

          <section className="bg-card rounded-2xl p-5 border border-foreground/[0.06] space-y-5">
            <TextField icon={<TrendingUp size={14} />} label="O que funcionou?" value={whatWorked} disabled={sent}
              placeholder="ex: Reels com a equipe tiveram o dobro de alcance; caixinha de dúvidas gerou 6 leads."
              onChange={(v) => { setWhatWorked(v); setDirty(true); }} />
            <TextField icon={<Lightbulb size={14} />} label="O que aprendemos?" value={learned} disabled={sent}
              placeholder="ex: Post de preço sem contexto gera pergunta, mas não agendamento."
              onChange={(v) => { setLearned(v); setDirty(true); }} />
            <TextField icon={<Sparkles size={14} />} label="O que muda no próximo mês?" value={nextChanges} disabled={sent}
              placeholder="ex: 2 Reels por semana com a equipe; responder direct em até 1h."
              onChange={(v) => { setNextChanges(v); setDirty(true); }} />
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {!sent ? (
                <>
                  <button onClick={() => save.mutate({})} disabled={save.isPending || !dirty}
                    className="px-4 py-2.5 rounded-md text-sm font-bold border border-foreground/15 text-foreground/80 hover:bg-foreground/5 disabled:opacity-40">
                    Salvar rascunho
                  </button>
                  <button onClick={async () => { if (await requestConfirm("Enviar o relatório pro gestor? Os números do mês ficam congelados no envio.")) save.mutate({ submit: true }); }}
                    disabled={save.isPending || !(whatWorked.trim() && learned.trim() && nextChanges.trim())}
                    title={whatWorked.trim() && learned.trim() && nextChanges.trim() ? undefined : "Preencha as três perguntas pra enviar"}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-bold disabled:opacity-40"
                    style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
                    <Send size={14} /> Enviar pro gestor
                  </button>
                </>
              ) : isMaster ? (
                <button onClick={() => save.mutate({ reopen: true })} disabled={save.isPending}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-bold border border-foreground/15 text-foreground/80 hover:bg-foreground/5">
                  <RotateCcw size={14} /> Reabrir pra edição
                </button>
              ) : (
                <span className="text-xs text-foreground/45">Enviado. Só o gestor pode reabrir.</span>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function TextField({ icon, label, value, onChange, placeholder, disabled }: {
  icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; placeholder: string; disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2"><span style={{ color: "var(--lz-accent-ink)" }}>{icon}</span>{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={4} maxLength={5000} disabled={disabled}
        className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[14px] leading-relaxed text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-y disabled:opacity-75" />
    </label>
  );
}

function NumbersSection({ report }: { report: MonthlyReport }) {
  const n = report.numbers;
  const p = n.planning;
  const rows: { label: string; value: string; note?: string }[] = [
    { label: "Execução das metas", value: pct(n.goalsPct) },
    { label: "Stories publicados", value: `${n.stories.done} de ${n.stories.goal}`, note: n.stories.source === "instagram" ? `Instagram · ${n.stories.trackedDays} dia(s) registrados` : "pelo Modo Criador" },
    { label: "Posts no feed", value: `${n.posts.done} de ${n.posts.goal}`, note: n.posts.source === "instagram" ? "direto do Instagram" : "pelo Modo Criador" },
    { label: `Planejamento de ${monthLabel(p.targetMonth)}`, value: p.delivered ? (p.onTime ? "Entregue no prazo" : "Entregue com atraso") : p.onTime === false ? "Não entregue" : p.applies === false ? "Não se aplica (conta nova)" : "Pendente" },
    { label: "Checklists", value: n.checklists.pct == null ? "—" : `${n.checklists.done} feitos · ${n.checklists.missed} atrasados` },
    { label: "Leads registrados", value: `${n.leads.total}${n.leads.goal ? ` de ${n.leads.goal}` : ""}` },
    { label: "Agendaram", value: `${n.leads.scheduled} · ${pct(n.leads.scheduleRate)}` },
    { label: "Compareceram", value: `${n.leads.attended} · ${pct(n.leads.attendRate)} dos agendados` },
  ];
  const origins = LEAD_ORIGINS.filter((o) => n.leads.byOrigin[o]);
  return (
    <section className="bg-card rounded-2xl p-5 border border-foreground/[0.06]">
      <div className="text-xs uppercase font-bold tracking-wider text-foreground/60 mb-3">Números do mês</div>
      <dl className="grid sm:grid-cols-2 gap-x-8">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 py-2.5 border-b border-foreground/[0.06]">
            <dt className="text-sm text-foreground/70">{r.label}{r.note && <span className="block text-[10.5px] text-foreground/40">{r.note}</span>}</dt>
            <dd className="text-sm font-bold text-foreground tabular-nums text-right">{r.value}</dd>
          </div>
        ))}
      </dl>
      {origins.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {origins.map((o) => (
            <span key={o} className="text-[11px] px-2.5 py-1 rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
              {LEAD_ORIGIN_LABEL[o]}: <strong>{n.leads.byOrigin[o]}</strong>
            </span>
          ))}
        </div>
      )}
      {n.byBrand && n.byBrand.length > 1 && (
        <div className="mt-5">
          <div className="text-[11px] uppercase font-bold tracking-wider text-foreground/50 mb-2">Por marca</div>
          <ul className="space-y-1">
            {n.byBrand.map((b) => (
              <li key={b.brandId} className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm py-1.5 border-b border-foreground/[0.06]">
                <span className="font-semibold text-foreground">{b.name}</span>
                <span className="text-xs text-foreground/65 tabular-nums">stories {b.stories.done}/{b.stories.goal} · posts {b.posts.done}/{b.posts.goal} · {b.leads} leads · {b.scheduled} agendados</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {n.reach && n.reach.some((r) => r.connected || r.followers != null) && (
        <div className="mt-5">
          <div className="text-[11px] uppercase font-bold tracking-wider text-foreground/50 mb-2">Alcance e seguidores</div>
          <ul className="space-y-1">
            {n.reach.map((r) => (
              <li key={r.brandId} className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm py-1.5 border-b border-foreground/[0.06]">
                <span className="font-semibold text-foreground">{r.name}</span>
                <span className="text-xs text-foreground/65 tabular-nums">
                  {r.followers ?? "—"} seguidores{r.followersChange != null ? ` (${r.followersChange >= 0 ? "+" : ""}${r.followersChange} no mês)` : ""}
                  {r.reach30 != null ? ` · alcance 30d ${r.reach30} · visitas ${r.profileViews30 ?? "—"}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {n.ads && (n.ads.spendCents > 0 || n.ads.leads > 0) && (
        <div className="mt-5">
          <div className="text-[11px] uppercase font-bold tracking-wider text-foreground/50 mb-2">Tráfego pago</div>
          <div className="text-sm text-foreground/80 tabular-nums">
            Investido <strong>{money(n.ads.spendCents)}</strong> · {n.ads.leads} lead(s) de anúncio · {n.ads.scheduled} agendamento(s)
            {n.ads.costPerLeadCents != null && <> · custo por lead <strong>{money(n.ads.costPerLeadCents)}</strong></>}
            {n.ads.costPerScheduledCents != null && <> · por agendamento <strong>{money(n.ads.costPerScheduledCents)}</strong></>}
          </div>
        </div>
      )}
      {n.variable && (
        <div className="mt-5 rounded-xl p-4 flex flex-wrap items-center gap-x-6 gap-y-2" style={{ background: "rgba(var(--lz-brand-rgb),0.08)", border: "1px solid rgba(var(--lz-brand-rgb),0.25)" }}>
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><Wallet size={15} style={{ color: "var(--lz-accent-ink)" }} /> Variável</span>
          <span className="text-xs text-foreground/65">Metas {pct(n.variable.scores.goals)} × {n.variable.weights.goals}%</span>
          <span className="text-xs text-foreground/65">Leads {pct(n.variable.scores.leads)} × {n.variable.weights.leads}%</span>
          <span className="text-xs text-foreground/65">Agendados {pct(n.variable.scores.scheduled)} × {n.variable.weights.scheduled}%</span>
          <span className="ml-auto text-sm font-bold text-foreground tabular-nums">{money(n.variable.valueCents)} <span className="text-xs font-normal text-foreground/45">({pct(n.variable.totalPct)} de {money(n.variable.maxCents)})</span></span>
        </div>
      )}
    </section>
  );
}
