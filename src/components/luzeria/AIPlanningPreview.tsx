import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { estimatePlanSeconds, DEFAULT_PLAN_ITEMS } from "@/lib/luzeria/planning-estimate";
import {
  PLAN_KINDS, PLAN_KIND_LABEL, MAX_PLAN_ITEMS, planTotal, defaultPlanCounts, describePlanCounts, countPlanItems,
  type PlanCounts, type PlanKind,
} from "@/lib/luzeria/planning-counts";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Sparkles, Trash2, FileText, Layers, Image as ImageIcon, Search, Brain, Wand2, Star, BookMarked, Check } from "lucide-react";
import { generateMonthlyPlanPreview, submitAiPlanningFeedback, type MonthlyPlanItem, type MonthlyPlanResult } from "@/lib/luzeria/ai-planning.functions";
import {
  useAiPlanningStore, startAiPlanningJob, resolveAiPlanningJob, failAiPlanningJob,
  minimizeAiPlanningModal, dismissAiPlanningJob, updateAiPlanningJobResult,
} from "@/lib/luzeria/ai-planning-store";
import { useApi, orgKnowledgeQO, clientsQO } from "@/lib/luzeria/queries";
import { formatMonth } from "@/lib/luzeria/utils";
import { Modal } from "./Modals";
import { MonthPickerList } from "./MonthPickerList";

const KIND_ROW_LABEL: Record<PlanKind, { title: string; hint: string }> = {
  reel: { title: "Reels", hint: "vídeos curtos" },
  estatico: { title: "Posts estáticos", hint: "imagem única" },
  carrossel: { title: "Carrosséis", hint: "vários slides" },
};

const MONTH_LABEL = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

// Erro de validação (zod) chega como o array de issues em JSON puro no
// .message — nunca mostra isso pro usuário, cai num texto legível.
function friendlyError(e: any, fallback: string): string {
  const msg = e?.message;
  if (typeof msg === "string" && msg.trim().startsWith("[") && msg.includes('"code"')) return fallback;
  return msg ?? fallback;
}

// Pode demorar bastante (principalmente quando a IA pesquisa concorrentes
// na web e a leva é grande). Em vez de um spinner mudo, mostra uma
// sequência de "etapas" fictícias mas plausíveis. As primeiras rodam uma
// vez só; a partir daí fica ciclando um segundo grupo pra sempre, pra nunca
// "congelar" numa frase só parada mesmo se a geração demorar mais que o
// normal. min-h fixo no texto evita a caixa mudando de tamanho conforme a
// frase quebra em 1 ou 2 linhas.
const LOADING_STEPS: { icon: typeof FileText; text: string }[] = [
  { icon: FileText, text: "Lendo o histórico de posts e reels desse cliente…" },
  { icon: Layers, text: "Conferindo roteiros e planejamentos anteriores…" },
  { icon: ImageIcon, text: "Analisando os arquivos de marca no Drive…" },
  { icon: Search, text: "Pesquisando o que os concorrentes andam postando…" },
  { icon: Brain, text: "Entendendo os padrões que funcionam com esse cliente…" },
];
const LOADING_STEPS_LOOP: { icon: typeof FileText; text: string }[] = [
  { icon: Wand2, text: "Construindo um planejamento incrível pra você…" },
  { icon: Sparkles, text: "Ajustando o tom pra soar como sua agência escreveria…" },
  { icon: Wand2, text: "Ainda trabalhando nisso, quase lá…" },
];

// A contagem regressiva usa a estimativa calculada na hora de gerar (cresce
// com a quantidade de conteúdos e com a pesquisa de concorrentes — ver
// planning-estimate.ts) e parte do início REAL da geração, então minimizar e
// reabrir a tela não zera o relógio. Se passar do previsto, em vez de ficar
// em "0s" parecendo travado, avisa que continua trabalhando.
function AILoadingState({ startedAt, estimatedSeconds, itemCount }: { startedAt?: number; estimatedSeconds: number; itemCount?: number }) {
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const startRef = useRef(startedAt ?? Date.now());
  useEffect(() => {
    const stepId = setInterval(() => setTick((t) => t + 1), 2200);
    const secondId = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(stepId); clearInterval(secondId); };
  }, []);
  const elapsed = Math.max(0, Math.floor((now - startRef.current) / 1000));
  const inFirstPass = tick < LOADING_STEPS.length;
  const current = inFirstPass ? LOADING_STEPS[tick] : LOADING_STEPS_LOOP[(tick - LOADING_STEPS.length) % LOADING_STEPS_LOOP.length];
  const Current = current.icon;
  const remaining = estimatedSeconds - elapsed;
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16">
      <div className="relative w-14 h-14 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(var(--lz-brand-rgb),0.25)" }} />
        <div className="relative w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(var(--lz-brand-rgb),0.15)" }}>
          <Current size={22} style={{ color: "var(--lz-accent-ink)" }} />
        </div>
      </div>
      <p key={tick} className="text-sm text-foreground/60 text-center max-w-[280px] leading-relaxed flex items-center justify-center min-h-[46px]" style={{ animation: "lzKnowledgeFadeIn 0.4s ease" }}>
        {current.text}
      </p>
      <p className="text-xs text-foreground/35 -mt-3">
        {remaining > 0
          ? `Tempo estimado: ~${remaining}s${itemCount ? ` · ${itemCount} conteúdos` : ""}`
          : `Está demorando mais que o previsto (${elapsed}s), mas continua gerando. Pode minimizar.`}
      </p>
      <div className="flex items-center gap-1.5">
        {LOADING_STEPS.map((_, i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full transition-colors duration-500"
            style={{ backgroundColor: i <= Math.min(tick, LOADING_STEPS.length - 1) ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 15%, transparent)" }}
          />
        ))}
        {!inFirstPass && (
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }} />
        )}
      </div>
      <style>{`@keyframes lzKnowledgeFadeIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

function buildMarkdown(result: MonthlyPlanResult): string {
  const parts: string[] = [`# Planejamento de ${MONTH_LABEL}`];
  parts.push(`## Resumo da estratégia\n${result.summary}`);
  if (result.items.length) {
    // Cada publicação vira sua própria subseção (### ), não um item de
    // bullet — assim o captionDraft começa numa linha limpa e, se for um
    // carrossel com "SLIDE N:", o parser reconhece e renderiza em caixinhas
    // em vez de virar um blocão emendado atrás de "Roteiro/texto: ".
    const sections = result.items.map((it, i) => {
      const heading = `### ${i + 1}. ${it.title} (${it.type === "reel" ? "Reel" : "Post"}${it.format ? `: ${it.format}` : ""})`;
      // Pilar e rationale são anotação estratégica INTERNA (referencia "a
      // reunião", "o briefing" etc) — nunca embutir no content, que é o
      // mesmo texto mostrado no link público pro cliente. Ficam só em
      // plan_items (estruturado), fora da vista do cliente.
      const bodyParts = [
        it.captionDraft || null,
        it.publishCaption ? `Legenda: ${it.publishCaption}` : null,
      ].filter(Boolean);
      return `${heading}\n${bodyParts.join("\n\n")}`;
    });
    parts.push(`## Publicações sugeridas\n${sections.join("\n\n")}`);
  }
  if (result.competitorNotes?.trim()) {
    parts.push(`## O que vimos dos concorrentes\n${result.competitorNotes.trim()}`);
  }
  return parts.join("\n\n");
}

/** Montada global no App.tsx (igual DetailPanel/ClientFichaPanel) — a
 * própria geração roda em segundo plano no ai-planning-store, então
 * fechar/minimizar essa tela nunca cancela nada. A bolha flutuante
 * (AiPlanningJobsTray) mostra o progresso e reabre daqui. */
export function AIPlanningPreview() {
  const openClientId = useAiPlanningStore((s) => s.openClientId);
  const job = useAiPlanningStore((s) => (s.openClientId ? s.jobs[s.openClientId] : null));
  const generate = useServerFn(generateMonthlyPlanPreview);
  const submitFeedback = useServerFn(submitAiPlanningFeedback);
  const navigate = useNavigate();
  const api = useApi();
  // Auditoria de UX (3.1): antes disso o aviso de "base vazia" só aparecia
  // DEPOIS de gerar a prévia (gastando a geração à toa) — agora mostra
  // antes, na tela de configurar, pra pessoa poder preencher primeiro se
  // quiser.
  const { data: knowledge = [] } = useQuery(orgKnowledgeQO());
  const { data: clients = [] } = useQuery(clientsQO());
  const [extraContext, setExtraContext] = useState("");
  const [counts, setCounts] = useState<PlanCounts>({ reel: 3, estatico: 2, carrossel: 1 });
  const [pickingMonth, setPickingMonth] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [reasonDraft, setReasonDraft] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [sendingFeedback, setSendingFeedback] = useState(false);

  // Reseta os campos locais (briefing, avaliação etc) toda vez que troca de
  // cliente ou reabre um job novo — sem isso, dado de uma prévia vazava
  // visualmente pra outra.
  useEffect(() => {
    setExtraContext("");
    // Padrão = metas da marca (posts e reels por mês); sem metas, 3 reels, 2 estáticos e 1 carrossel.
    const c = clients.find((x) => x.id === openClientId);
    setCounts(defaultPlanCounts(c?.customFields?.postsPerWeek ?? 0, c?.customFields?.reelsPerWeek ?? 0));
    setPickingMonth(false);
    setRating(null);
    setReasonDraft("");
    setFeedbackSent(false);
  }, [openClientId]);

  if (!openClientId || !job) return null;
  const clientId = openClientId;

  function generateNow() {
    if (!job) return;
    const trimmedContext = extraContext.trim().slice(0, 60000);
    // Quantos conteúdos vão ser pedidos: metas da marca (posts + reels), ou o padrão.
    const c = clients.find((x) => x.id === clientId);
    const items = planTotal(counts) || DEFAULT_PLAN_ITEMS;
    startAiPlanningJob(clientId, job.clientName, {
      itemCount: items,
      estimatedSeconds: estimatePlanSeconds({ items, researchCompetitors: !!c?.customFields?.competitors?.trim(), extraContextChars: trimmedContext.length }),
    });
    generate({ data: { clientId, extraContext: trimmedContext || undefined, counts } })
      .then((r) => resolveAiPlanningJob(clientId, r))
      .catch((e: any) => failAiPlanningJob(clientId, friendlyError(e, "Não consegui gerar a prévia. Tenta de novo em instantes.")));
  }

  async function sendFeedback() {
    if (rating === null) return;
    setSendingFeedback(true);
    try {
      await submitFeedback({ data: { clientId, rating, reason: reasonDraft.trim() || undefined } });
      setFeedbackSent(true);
      toast.success("Valeu pela avaliação!");
    } catch (e: any) {
      toast.error(friendlyError(e, "Não consegui enviar a avaliação."));
    } finally {
      setSendingFeedback(false);
    }
  }

  function updateItem(idx: number, patch: Partial<MonthlyPlanItem>) {
    updateAiPlanningJobResult(clientId, (r) => ({ ...r, items: r.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
  }

  function removeItem(idx: number) {
    updateAiPlanningJobResult(clientId, (r) => ({ ...r, items: r.items.filter((_, i) => i !== idx) }));
  }

  /** Mexe num contador respeitando o teto de MAX_PLAN_ITEMS no total. */
  function bump(kind: PlanKind, delta: number) {
    setCounts((prev) => {
      const next = { ...prev, [kind]: Math.max(0, prev[kind] + delta) };
      if (planTotal(next) > MAX_PLAN_ITEMS) return prev;
      return next;
    });
  }

  function save() {
    const currentResult = job!.result;
    if (!currentResult) return;
    api.upsertClientDoc.mutate(
      {
        data: {
          clientId, type: "planejamento", title: `Planejamento (IA) — ${MONTH_LABEL}`,
          content: buildMarkdown(currentResult), planItems: currentResult.items,
        },
      },
      { onSuccess: () => { toast.success("Prévia salva como Planejamento — pode aprovar depois quando quiser."); dismissAiPlanningJob(clientId); } },
    );
  }

  function approveToRoteiros(targetMonthKey: string) {
    const currentResult = job!.result;
    if (!currentResult) return;
    api.createRoteirosFromPlan.mutate(
      {
        data: {
          clientId, targetMonthKey,
          items: currentResult.items.map((it) => ({
            title: it.title, type: it.type, captionDraft: it.captionDraft,
            publishCaption: it.publishCaption, postFormat: it.postFormat,
            pillar: it.pillar, rationale: it.rationale,
          })),
        },
      },
      {
        onSuccess: () => {
          toast.success(`Roteiros criados! Aprovar cada um já cria a publicação em ${formatMonth(targetMonthKey)}.`);
          dismissAiPlanningJob(clientId);
        },
      },
    );
  }

  // Fechar durante a geração só minimiza (a bolha flutuante continua) —
  // fechar antes de começar, ou depois de pronto/erro, descarta de vez.
  function handleClose() {
    if (job!.status === "loading") minimizeAiPlanningModal();
    else dismissAiPlanningJob(clientId);
  }

  const inp = "w-full bg-background border border-foreground/8 rounded-md px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";
  const result = job.result;

  return (
    <Modal open onClose={handleClose} title={`Prévia de planejamento com IA — ${job.clientName}`} maxWidthClass="max-w-xl">
      {job.status === "configuring" && (
        <div className="space-y-3">
          {knowledge.length === 0 && (
            <button
              type="button"
              onClick={() => { dismissAiPlanningJob(clientId); navigate({ to: "/configuracoes", search: { tab: "knowledge" } }); }}
              className="w-full flex items-center gap-2.5 rounded-lg p-3 text-left transition hover:opacity-90"
              style={{ background: "rgba(var(--lz-brand-rgb),0.08)", border: "1px solid rgba(var(--lz-brand-rgb),0.2)" }}
            >
              <BookMarked size={15} className="shrink-0" style={{ color: "var(--lz-accent-ink)" }} />
              <div className="text-[12px] text-foreground/70 leading-relaxed">
                <span className="font-semibold text-foreground">Sua Base de Conhecimento está vazia.</span> A prévia fica melhor com contexto de como sua agência cria conteúdo — clique pra preencher antes de gerar (ou continue sem, se preferir).
              </div>
            </button>
          )}
          <p className="text-sm text-foreground/70">
            Pra esse próximo planejamento, teve alguma reunião com o cliente? Você tem algum briefing específico do mês ou transcrição? Cola aqui embaixo — isso conta mais do que o histórico antigo.
          </p>
          <textarea
            value={extraContext}
            onChange={(e) => setExtraContext(e.target.value.slice(0, 60000))}
            placeholder="Cole aqui o que foi combinado na reunião, transcrição ou briefing desse mês (opcional)…"
            rows={7}
            autoFocus
            className={inp + " resize-none"}
          />
          {extraContext.length > 50000 && (
            <p className="text-[11px] text-foreground/40 text-right -mt-1.5">{extraContext.length.toLocaleString("pt-BR")} / 60.000 caracteres</p>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wide text-foreground/40 mb-2 block">Quantos conteúdos de cada tipo você quer nessa leva?</label>
            <div className="rounded-lg divide-y divide-foreground/[0.06]" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
              {PLAN_KINDS.map((kind) => (
                <div key={kind} className="flex items-center gap-3 px-3.5 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">{KIND_ROW_LABEL[kind].title}</div>
                    <div className="text-[11px] text-foreground/45">{KIND_ROW_LABEL[kind].hint}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => bump(kind, -1)} disabled={counts[kind] <= 0} aria-label={`Menos ${KIND_ROW_LABEL[kind].title}`}
                      className="h-8 w-8 rounded-md border border-foreground/15 text-foreground/70 hover:bg-foreground/5 disabled:opacity-30 text-base leading-none">−</button>
                    <span className="w-8 text-center text-base font-bold tabular-nums text-foreground">{counts[kind]}</span>
                    <button type="button" onClick={() => bump(kind, 1)} disabled={planTotal(counts) >= MAX_PLAN_ITEMS} aria-label={`Mais ${KIND_ROW_LABEL[kind].title}`}
                      className="h-8 w-8 rounded-md border border-foreground/15 text-foreground/70 hover:bg-foreground/5 disabled:opacity-30 text-base leading-none">+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px]">
              <span className="text-foreground/50 tabular-nums">
                Total: <strong className="text-foreground">{planTotal(counts)}</strong> de {MAX_PLAN_ITEMS}
                {planTotal(counts) > 0 && <> · ~{estimatePlanSeconds({ items: planTotal(counts), researchCompetitors: !!clients.find((x) => x.id === clientId)?.customFields?.competitors?.trim(), extraContextChars: extraContext.length })}s pra gerar</>}
              </span>
              {planTotal(counts) >= MAX_PLAN_ITEMS && <span className="text-foreground/40">limite por geração</span>}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={() => dismissAiPlanningJob(clientId)} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Cancelar</button>
            <button onClick={generateNow} disabled={planTotal(counts) < 1} className="lz-btn-primary text-xs px-5 py-2.5 rounded-md disabled:opacity-40">
              {extraContext.trim() ? "Gerar prévia com esse contexto" : "Gerar prévia sem contexto extra"}
            </button>
          </div>
        </div>
      )}

      {job.status === "loading" && (
        <>
          <AILoadingState startedAt={job.startedAt} estimatedSeconds={job.estimatedSeconds ?? estimatePlanSeconds({ items: DEFAULT_PLAN_ITEMS })} itemCount={job.itemCount} />
          <div className="flex items-center justify-center -mt-4">
            <button onClick={minimizeAiPlanningModal} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">
              Minimizar e continuar usando o app
            </button>
          </div>
        </>
      )}

      {job.status === "error" && (
        <div className="py-8 text-center">
          <p className="text-sm text-red-400 mb-4">{job.error}</p>
          <button onClick={() => dismissAiPlanningJob(clientId)} className="text-xs text-foreground/50 hover:text-foreground">Fechar</button>
        </div>
      )}

      {job.status === "done" && result && pickingMonth && (
        <div>
          <p className="text-sm text-foreground/60 mb-3">Pra qual mês são essas publicações?</p>
          <div className="mb-3">
            <MonthPickerList clientId={clientId} onSelect={approveToRoteiros} pending={api.createRoteirosFromPlan.isPending} />
          </div>
          <button onClick={() => setPickingMonth(false)} className="text-xs text-foreground/50 hover:text-foreground px-1 py-1">
            {api.createRoteirosFromPlan.isPending ? "Gerando roteiros…" : "Voltar"}
          </button>
        </div>
      )}

      {job.status === "done" && result && !pickingMonth && (
        <div className="space-y-4">
          {result.knowledgeItemsCount === 0 && (
            <button
              onClick={() => { dismissAiPlanningJob(clientId); navigate({ to: "/configuracoes", search: { tab: "knowledge" } }); }}
              className="w-full flex items-center gap-2.5 rounded-lg p-3 text-left transition hover:opacity-90"
              style={{ background: "rgba(var(--lz-brand-rgb),0.08)", border: "1px solid rgba(var(--lz-brand-rgb),0.2)" }}
            >
              <BookMarked size={15} className="shrink-0" style={{ color: "var(--lz-accent-ink)" }} />
              <div className="text-[12px] text-foreground/70 leading-relaxed">
                <span className="font-semibold text-foreground">Sua Base de Conhecimento está vazia.</span> A prévia fica melhor com contexto de como sua agência cria conteúdo — clique pra preencher.
              </div>
            </button>
          )}

          {result.shortfallNote && (
            <div className="rounded-lg p-3.5 text-[12.5px] leading-relaxed" style={{ background: "rgba(231,169,81,0.1)", border: "1px solid rgba(231,169,81,0.35)", color: "var(--foreground)" }}>
              <strong>Faltou conteúdo.</strong> {result.shortfallNote}
            </div>
          )}
          {result.requested && !result.shortfallNote && (
            <div className="text-[11.5px] text-foreground/50">
              Entregue como pedido: {describePlanCounts(result.delivered ?? countPlanItems(result.items))}.
            </div>
          )}

          <div className="rounded-lg p-3.5 text-[13px] text-foreground/80 leading-relaxed" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
            {result.summary}
          </div>

          <div className="space-y-2.5">
            {result.items.map((it, idx) => (
              <div key={idx} className="rounded-lg p-3 space-y-2" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
                    {it.type === "reel" ? "Reel" : "Post"}
                  </span>
                  <input value={it.title} onChange={(e) => updateItem(idx, { title: e.target.value })} className={inp + " flex-1 font-medium"} />
                  <button onClick={() => removeItem(idx)} className="p-1.5 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5 transition shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
                {(it.pillar || it.format) && (
                  <p className="text-[11px] text-foreground/40">{[it.pillar, it.format].filter(Boolean).join(" · ")}</p>
                )}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-foreground/30 mb-1 block">Texto de produção (Briefing)</label>
                  <textarea
                    value={it.captionDraft}
                    onChange={(e) => updateItem(idx, { captionDraft: e.target.value })}
                    rows={3}
                    className={inp + " resize-none font-mono"}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-foreground/30 mb-1 block">Legenda a publicar</label>
                  <textarea
                    value={it.publishCaption ?? ""}
                    onChange={(e) => updateItem(idx, { publishCaption: e.target.value })}
                    rows={2}
                    className={inp + " resize-none"}
                  />
                </div>
                {it.rationale && <p className="text-[11px] text-foreground/35 italic">{it.rationale}</p>}
              </div>
            ))}
            {result.items.length === 0 && (
              <p className="text-sm text-foreground/40 text-center py-6">Nenhum item sugerido — descarte e tente de novo.</p>
            )}
          </div>

          {result.competitorNotes?.trim() && (
            <div className="rounded-lg p-3.5 text-[12px] text-foreground/60 leading-relaxed" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)" }}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-foreground/35 mb-1.5">
                <Sparkles size={11} /> O que vimos dos concorrentes
              </div>
              {result.competitorNotes}
            </div>
          )}

          <div className="rounded-lg p-3.5" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)" }}>
            {feedbackSent ? (
              <p className="text-[12.5px] text-foreground/60">Valeu pela avaliação — isso ajuda a gente a melhorar essa feature em beta. 🙌</p>
            ) : (
              <>
                <p className="text-[12.5px] font-semibold text-foreground mb-2">Avise-nos sua satisfação com o resultado</p>
                <div className="flex items-center gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setRating(n)} className="p-0.5">
                      <Star
                        size={20}
                        fill={rating !== null && n <= rating ? "rgb(var(--lz-brand-rgb))" : "none"}
                        color={rating !== null && n <= rating ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 30%, transparent)"}
                      />
                    </button>
                  ))}
                </div>
                {rating !== null && (
                  <div className="space-y-2">
                    <textarea
                      value={reasonDraft}
                      onChange={(e) => setReasonDraft(e.target.value)}
                      placeholder="Por quê? (opcional)"
                      rows={2}
                      className={inp + " resize-none"}
                    />
                    <button
                      onClick={sendFeedback}
                      disabled={sendingFeedback}
                      className="lz-btn-primary text-xs px-4 py-1.5 rounded-md disabled:opacity-50"
                    >
                      {sendingFeedback ? "Enviando…" : "Enviar avaliação"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={() => dismissAiPlanningJob(clientId)} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Descartar</button>
            <button
              onClick={save}
              disabled={api.upsertClientDoc.isPending || result.items.length === 0}
              className="text-xs px-4 py-2.5 rounded-md border border-foreground/10 text-foreground/70 hover:text-foreground hover:border-foreground/25 transition disabled:opacity-50"
            >
              {api.upsertClientDoc.isPending ? "Salvando…" : "Salvar como Planejamento"}
            </button>
            <button
              onClick={() => setPickingMonth(true)}
              disabled={result.items.length === 0}
              className="lz-btn-primary text-xs px-5 py-2.5 rounded-md disabled:opacity-50"
            >
              Aprovar e enviar pros Roteiros
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
