import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, ChevronDown, Loader2, Mail, Phone, ExternalLink, Sparkles, Check, Save } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { listInactiveOrgsForReengagement, sendReengagementEmails, getReengagementWhatsappLinks, getMessageTemplateOverrides, saveMessageTemplate } from "@/lib/luzeria/reengagement.functions";
import type { InactiveOrgRow, MessageTemplateKey } from "@/lib/luzeria/reengagement.functions";
import { WhatsappCampaignSender } from "./WhatsappCampaignSender";

function formatDate(iso: string | null) {
  if (!iso) return "Nunca";
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diffDays <= 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 30) return `${diffDays}d atrás`;
  const months = Math.floor(diffDays / 30);
  return `${months}${months === 1 ? " mês" : " meses"} atrás`;
}

const DEFAULT_MESSAGE = `Oi{nome}, tudo bem? Aqui é o Junior, do Modo Criador!

Notei que faz um tempo que você não aparece por aqui e queria saber se ficou alguma dúvida ou travou em alguma parte da configuração — é só me chamar que te ajudo pessoalmente.`;

export type ActivationPresetKey = "noClients" | "fewClients" | "noTeam";

// Campanhas de ativação pra quem está em teste (Junior notou: só 55%
// importaram cliente, 23% têm 2+, e pouquíssimos chamaram a equipe) —
// diferente do filtro "Personalizado" abaixo, que é pra recuperar cadastro
// inativo de qualquer status. `{nome}` e `{clientes}` são substituídos
// automaticamente por agência (ver reengagement.functions.ts).
const ACTIVATION_PRESETS: Record<ActivationPresetKey, {
  label: string;
  subject: string;
  body: string;
  filters: { noClients?: boolean; minClients?: number; maxClients?: number; noTeam?: boolean; onlyTrialing?: boolean; excludeResold?: boolean };
}> = {
  noClients: {
    label: "Sem nenhum cliente",
    subject: "É rápido: importe seus clientes em poucos minutos",
    body: `Oi{nome}!

Notei que você ainda não colocou nenhum cliente no Modo Criador — e isso leva só alguns minutos. Dá pra importar de vários jeitos:

• Tira um print da sua lista de clientes (foto ou planilha) e a nossa IA organiza pra você
• Manda uma planilha ou PDF que você já tenha
• Puxa direto do Trello, ClickUp ou Notion, se for de lá que você organiza hoje

Em poucos minutos seus clientes já aparecem prontos pra você começar a planejar o conteúdo deles.

Entra em modocriador.com.br e experimenta — qualquer dúvida, é só chamar aqui.`,
    filters: { noClients: true, onlyTrialing: true, excludeResold: true },
  },
  fewClients: {
    label: "Só 1 ou 2 clientes",
    subject: "Você já começou — falta só terminar de importar",
    body: `Oi{nome}!

Vi que você já tem {clientes} no Modo Criador — ótimo começo! Mas imagino que sua agência atenda mais gente do que isso.

Vale a pena terminar de cadastrar o resto dos seus clientes agora, pra você aproveitar o teste 100%: planejamento, calendário de posts, aprovação de conteúdo — tudo organizado no mesmo lugar.

Entra em modocriador.com.br e termina de importar.`,
    filters: { minClients: 1, maxClients: 2, onlyTrialing: true, excludeResold: true },
  },
  noTeam: {
    label: "Nunca chamou a equipe",
    subject: "O Modo Criador fica ainda melhor com sua equipe",
    body: `Oi{nome}!

Hoje só você está usando o Modo Criador na sua agência — mas ele foi feito pra equipe toda trabalhar junto. Quando você chama seu time:

• Cada editor recebe as tarefas dele direto no calendário, sem precisar perguntar o que fazer
• Comentários e aprovações ficam no mesmo lugar, sem trocar mensagem por fora
• Você acompanha o que cada pessoa está entregando, sem cobrar um por um

É grátis convidar — não conta como cliente a mais nem custa nada extra até o limite do seu plano.

Entra em Configurações > Equipe e chama seu time.`,
    filters: { noTeam: true, onlyTrialing: true, excludeResold: true },
  },
};

export function MessagesPanel({ openPreset, onConsumeOpenPreset }: { openPreset?: ActivationPresetKey | null; onConsumeOpenPreset?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ActivationPresetKey | "custom" | null>(null);
  const [noClients, setNoClients] = useState(true);
  const [minDaysInactive, setMinDaysInactive] = useState("3");
  const [neverVisitedPages, setNeverVisitedPages] = useState(false);
  const [results, setResults] = useState<InactiveOrgRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("Sentimos sua falta no Modo Criador");
  const [body, setBody] = useState(DEFAULT_MESSAGE);
  const [waLinks, setWaLinks] = useState<{ orgId: string; orgName: string; whatsapp: string | null; link: string | null }[] | null>(null);
  // Marca quem já foi aberto — sem isso, numa lista de dezenas de agências
  // sem separação visual nenhuma, era fácil perder a linha e clicar duas
  // vezes na mesma (feedback real do Junior).
  const [openedWaIds, setOpenedWaIds] = useState<Set<string>>(new Set());

  const qc = useQueryClient();
  const { data: templateOverrides = {} } = useQuery({
    queryKey: ["message-template-overrides"],
    queryFn: () => getMessageTemplateOverrides(),
  });

  const search = useMutation({
    mutationFn: useServerFn(listInactiveOrgsForReengagement),
    onSuccess: (rows: any) => { setResults(rows); setSelected(new Set(rows.map((r: InactiveOrgRow) => r.orgId))); setWaLinks(null); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui buscar as agências."),
  });

  const sendEmails = useMutation({
    mutationFn: useServerFn(sendReengagementEmails),
    onSuccess: (r: any) => {
      if (r.failed.length === 0) toast.success(`E-mail enviado pra ${r.sent} agência${r.sent === 1 ? "" : "s"}.`);
      else toast.warning(`${r.sent} enviado(s), ${r.failed.length} falharam (provavelmente sem e-mail de responsável).`);
    },
    onError: (e: any) => toastFriendlyError(e, "Não consegui enviar os e-mails."),
  });

  const genWaLinks = useMutation({
    mutationFn: useServerFn(getReengagementWhatsappLinks),
    onSuccess: (rows: any) => { setWaLinks(rows); setOpenedWaIds(new Set()); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui gerar os links de WhatsApp."),
  });

  const saveTemplate = useMutation({
    mutationFn: useServerFn(saveMessageTemplate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["message-template-overrides"] });
      toast.success("Salvo como padrão — na próxima vez já abre assim.");
    },
    onError: (e: any) => toastFriendlyError(e, "Não consegui salvar como padrão."),
  });

  function selectActivationPreset(key: ActivationPresetKey) {
    setMode(key);
    const tpl = (templateOverrides as Record<string, { subject: string; body: string }>)[key] ?? ACTIVATION_PRESETS[key];
    setSubject(tpl.subject);
    setBody(tpl.body);
    search.mutate({ data: ACTIVATION_PRESETS[key].filters });
  }

  function toggleCustomMode() {
    if (mode === "custom") { setMode(null); return; }
    setMode("custom");
    const tpl = (templateOverrides as Record<string, { subject: string; body: string }>).custom;
    setSubject(tpl?.subject ?? "Sentimos sua falta no Modo Criador");
    setBody(tpl?.body ?? DEFAULT_MESSAGE);
  }

  useEffect(() => {
    if (!openPreset) return;
    setOpen(true);
    selectActivationPreset(openPreset);
    onConsumeOpenPreset?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPreset]);

  function runCustomSearch() {
    setMode("custom");
    search.mutate({
      data: {
        noClients,
        minDaysInactive: minDaysInactive.trim() ? Number(minDaysInactive) : undefined,
        neverVisitedPages,
      },
    });
  }

  function toggleSelected(orgId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId); else next.add(orgId);
      return next;
    });
  }

  const selectedIds = Array.from(selected);

  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-[var(--lz-accent-ink)]" />
          <h3 className="font-bold text-foreground">Mensagens</h3>
          <span className="text-[11px] text-foreground/40">Ativação de teste e recuperar cadastros inativos</span>
        </div>
        <ChevronDown size={16} className={`text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase text-foreground/40 tracking-wider mb-2">Campanhas prontas — agências em teste</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(Object.keys(ACTIVATION_PRESETS) as ActivationPresetKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => selectActivationPreset(key)}
                  className="text-left rounded-lg px-3 py-2.5 border transition-colors"
                  style={mode === key
                    ? { borderColor: "rgb(var(--lz-brand-rgb))", backgroundColor: "rgba(var(--lz-brand-rgb),0.08)" }
                    : { borderColor: "var(--border)", backgroundColor: "transparent" }}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Sparkles size={12} className="text-[var(--lz-accent-ink)]" /> {ACTIVATION_PRESETS[key].label}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={toggleCustomMode}
              className="mt-2 text-[11px] text-foreground/50 hover:text-foreground underline underline-offset-2"
            >
              {mode === "custom" ? "Esconder filtro personalizado" : "ou personalize o filtro"}
            </button>
          </div>

          {mode === "custom" && (
            <div>
              <p className="text-[11px] font-bold uppercase text-foreground/40 tracking-wider mb-2">Segmentar agências</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-foreground/80">
                  <input type="checkbox" checked={noClients} onChange={(e) => setNoClients(e.target.checked)} className="accent-[rgb(var(--lz-brand-rgb))]" />
                  Menos de 1 cliente cadastrado
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground/80">
                  <input
                    type="checkbox"
                    checked={minDaysInactive.trim() !== ""}
                    onChange={(e) => setMinDaysInactive(e.target.checked ? "3" : "")}
                    className="accent-[rgb(var(--lz-brand-rgb))]"
                  />
                  Sem acesso há pelo menos
                  <input
                    type="number" min={1} value={minDaysInactive} onChange={(e) => setMinDaysInactive(e.target.value)}
                    disabled={minDaysInactive.trim() === ""}
                    className="w-14 px-2 py-1 bg-foreground/[0.08] border border-foreground/15 rounded-md text-foreground text-sm disabled:opacity-40"
                  />
                  dias
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground/80">
                  <input type="checkbox" checked={neverVisitedPages} onChange={(e) => setNeverVisitedPages(e.target.checked)} className="accent-[rgb(var(--lz-brand-rgb))]" />
                  Nunca acessou nenhuma página
                </label>
                <p className="text-[10.5px] text-foreground/35 pl-6">
                  Esse último filtro só é confiável pra agências cadastradas a partir de 19/09/2026 — mais antigas que isso ficam de fora dele (não temos como saber).
                </p>
              </div>
              <button
                onClick={runCustomSearch}
                disabled={search.isPending}
                className="mt-3 text-xs font-bold px-3 py-1.5 rounded-md disabled:opacity-50"
                style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
              >
                {search.isPending ? "Buscando…" : "Buscar"}
              </button>
            </div>
          )}

          {search.isPending && !results && (
            <p className="text-foreground/40 text-[13px] flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Buscando agências…</p>
          )}

          {results && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-bold uppercase text-foreground/40 tracking-wider">
                  {results.length} agência{results.length === 1 ? "" : "s"} encontrada{results.length === 1 ? "" : "s"} · {selected.size} selecionada{selected.size === 1 ? "" : "s"}
                </p>
                {results.length > 0 && (
                  <button
                    onClick={() => setSelected(selected.size === results.length ? new Set() : new Set(results.map((r) => r.orgId)))}
                    className="text-[11px] text-foreground/50 hover:text-foreground underline underline-offset-2"
                  >
                    {selected.size === results.length ? "Desmarcar todas" : "Selecionar todas"}
                  </button>
                )}
              </div>

              {results.length === 0 ? (
                <p className="text-foreground/30 text-[13px]">Nenhuma agência bate com esses filtros.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto border border-foreground/10 rounded-lg divide-y divide-foreground/5">
                  {results.map((r) => (
                    <label key={r.orgId} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-foreground/[0.03] cursor-pointer">
                      <input type="checkbox" checked={selected.has(r.orgId)} onChange={() => toggleSelected(r.orgId)} className="accent-[rgb(var(--lz-brand-rgb))] shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate">{r.orgName}</p>
                        <p className="text-[11px] text-foreground/40 truncate">{r.ownerEmail ?? "sem e-mail"} · {r.clientCount} cliente{r.clientCount === 1 ? "" : "s"} · {r.teamCount === 1 ? "só o dono" : `${r.teamCount} na equipe`} · último acesso: {formatDate(r.lastActiveAt)}</p>
                      </div>
                      {r.lastMessageSentAt && (
                        <span className="text-[10px] text-foreground/30 shrink-0 whitespace-nowrap">msg. {formatDate(r.lastMessageSentAt)}</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {results && results.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase text-foreground/40 tracking-wider mb-2">Mensagem</p>
              <input
                value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="Assunto do e-mail"
                className="w-full mb-2 px-3 py-2 bg-foreground/[0.08] border border-foreground/15 rounded-lg text-foreground text-sm placeholder:text-foreground/30 focus:outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition"
              />
              <textarea
                value={body} onChange={(e) => setBody(e.target.value)}
                rows={7}
                className="w-full px-3 py-2 bg-foreground/[0.08] border border-foreground/15 rounded-lg text-foreground text-sm placeholder:text-foreground/30 focus:outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition resize-y"
              />
              <p className="text-[10.5px] text-foreground/35 mt-1">
                Use <code className="text-foreground/60">{"{nome}"}</code> pro primeiro nome do responsável, e <code className="text-foreground/60">{"{clientes}"}</code> pra quantidade de clientes da agência (ex.: "2 clientes") — os dois são preenchidos sozinhos por agência.
              </p>
              {mode && (
                <button
                  onClick={() => saveTemplate.mutate({ data: { key: mode, subject, body } })}
                  disabled={saveTemplate.isPending || !body.trim()}
                  className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/50 hover:text-foreground disabled:opacity-40 transition"
                >
                  {saveTemplate.isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                  Salvar como padrão desse preset
                </button>
              )}

              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  onClick={() => sendEmails.mutate({ data: { orgIds: selectedIds, subject, body } })}
                  disabled={selectedIds.length === 0 || sendEmails.isPending || !subject.trim() || !body.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-40"
                  style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
                >
                  {sendEmails.isPending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  Enviar e-mail agora ({selectedIds.length})
                </button>
                <button
                  onClick={() => genWaLinks.mutate({ data: { orgIds: selectedIds, message: body } })}
                  disabled={selectedIds.length === 0 || genWaLinks.isPending || !body.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-black transition border-2 disabled:opacity-40"
                  style={{ backgroundColor: "transparent", borderColor: "#25D366", color: "#25D366" }}
                >
                  {genWaLinks.isPending ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
                  Gerar links de WhatsApp ({selectedIds.length})
                </button>
              </div>

              <div className="mt-3">
                <WhatsappCampaignSender selectedIds={selectedIds} defaultText={body.replace(/^Oi[^\n]*\n+/, "").replaceAll("{nome}", "").replaceAll("{clientes}", "seus clientes")} />
              </div>
            </div>
          )}

          {waLinks && (
            <div>
              <p className="text-[11px] font-bold uppercase text-foreground/40 tracking-wider mb-2">
                Links de WhatsApp — clique um por um pra mandar
                {openedWaIds.size > 0 && <span className="normal-case font-normal text-foreground/30"> · {openedWaIds.size} já aberto{openedWaIds.size === 1 ? "" : "s"}</span>}
              </p>
              <div className="max-h-64 overflow-y-auto pr-1 divide-y divide-foreground/8 border border-foreground/8 rounded-lg">
                {waLinks.map((r) => {
                  const opened = openedWaIds.has(r.orgId);
                  function toggleOpened() {
                    setOpenedWaIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(r.orgId)) next.delete(r.orgId); else next.add(r.orgId);
                      return next;
                    });
                  }
                  return (
                    <div key={r.orgId} className="flex items-center gap-2 text-sm px-2.5 py-2" style={opened ? { opacity: 0.45 } : undefined}>
                      <input
                        type="checkbox" checked={opened} onChange={toggleOpened}
                        title="Marcar como já aberto/enviado"
                        className="shrink-0 accent-[#25D366]"
                      />
                      <span className="text-foreground/80 truncate min-w-0 flex-1">{r.orgName}</span>
                      {r.link ? (
                        <a
                          href={r.link} target="_blank" rel="noopener noreferrer"
                          onClick={() => setOpenedWaIds((prev) => new Set(prev).add(r.orgId))}
                          className="inline-flex items-center gap-1 text-[12px] font-semibold shrink-0"
                          style={{ color: opened ? "color-mix(in srgb, var(--foreground) 50%, transparent)" : "#25D366" }}
                        >
                          {opened ? <>Aberto <Check size={11} /></> : <>Abrir <ExternalLink size={11} /></>}
                        </a>
                      ) : (
                        <span className="text-[11px] text-foreground/30 shrink-0">sem WhatsApp</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
