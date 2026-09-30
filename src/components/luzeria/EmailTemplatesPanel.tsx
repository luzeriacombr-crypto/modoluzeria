import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, Loader2, Mail, RotateCcw, Save, Send, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import {
  listEmailTemplates, previewEmailTemplate, saveEmailTemplate, resetEmailTemplate,
  sendTestEmailTemplate, getEmailDeliveryStats, checkEmailDns,
} from "@/lib/luzeria/email-admin.functions";
import type { EmailTemplateAdminRow } from "@/lib/luzeria/email-admin.functions";

// Aba "E-mails" (Configurações, só a plataforma) — pedido do Junior: nunca
// tinha visto como os e-mails automáticos chegam pras agências, nem se
// estavam caindo no spam. Mostra a saúde de entrega (DNS + números do
// Resend) e cada e-mail com prévia real e texto editável.

type Fields = EmailTemplateAdminRow["current"];

const FIELD_LABELS: Record<keyof Fields, string> = {
  subject: "Assunto",
  heading: "Título",
  body: "Texto",
  highlight: "Caixa de destaque (deixe vazio pra tirar)",
  buttonLabel: "Texto do botão",
};

export function EmailTemplatesPanel() {
  return (
    <div className="space-y-10">
      <DeliverySection />
      <TemplatesSection />
    </div>
  );
}

function StatusIcon({ status }: { status: "ok" | "warn" | "bad" }) {
  if (status === "ok") return <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />;
  if (status === "warn") return <AlertTriangle size={16} className="text-amber-500 shrink-0" />;
  return <XCircle size={16} className="text-red-500 shrink-0" />;
}

const EVENT_LABEL: Record<string, string> = {
  bounced: "voltou",
  complained: "marcado como spam",
  delivery_delayed: "entrega atrasada",
  failed: "falhou",
};

function DeliverySection() {
  const { data: dns, isLoading: dnsLoading } = useQuery({ queryKey: ["email-dns"], queryFn: () => checkEmailDns(), staleTime: 5 * 60 * 1000 });
  const { data: stats, isLoading: statsLoading } = useQuery({ queryKey: ["email-delivery-stats"], queryFn: () => getEmailDeliveryStats(), staleTime: 5 * 60 * 1000 });

  const pct = (n: number) => (stats && stats.total > 0 ? `${Math.round((n / stats.total) * 100)}%` : "—");

  return (
    <section>
      <h2 className="text-lg font-bold text-foreground">Entrega dos e-mails</h2>
      <p className="text-sm text-foreground/50 mt-1">
        Nenhum serviço consegue saber se um e-mail caiu na pasta de spam da pessoa. O que dá pra medir é a configuração do domínio
        (o que mais pesa pros filtros) e, pelo Resend, quantos foram entregues, quantos voltaram e quantos alguém marcou como spam.
      </p>

      <div className="mt-4 rounded-xl border border-foreground/10 divide-y divide-foreground/10">
        {dnsLoading && <div className="p-4 text-sm text-foreground/50 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Conferindo o domínio…</div>}
        {(dns ?? []).map((c) => (
          <div key={c.id} className="p-4 flex gap-3">
            <StatusIcon status={c.status} />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-foreground">{c.label}</div>
              <p className="text-xs text-foreground/60 mt-0.5 leading-relaxed">{c.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        {statsLoading ? (
          <div className="text-sm text-foreground/50 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Buscando números no Resend…</div>
        ) : stats?.error ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-600 dark:text-amber-400 leading-relaxed">{stats.error}</div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: `Enviados (${stats.days} dias)`, value: String(stats.total), hint: null },
                { label: "Entregues", value: String(stats.delivered), hint: pct(stats.delivered) },
                { label: "Voltaram", value: String(stats.bounced), hint: pct(stats.bounced) },
                { label: "Marcados como spam", value: String(stats.complained), hint: pct(stats.complained) },
              ].map((t) => (
                <div key={t.label} className="rounded-xl border border-foreground/10 px-4 py-3">
                  <div className="text-[11px] text-foreground/50">{t.label}</div>
                  <div className="text-xl font-bold text-foreground mt-0.5">{t.value}{t.hint && <span className="text-xs font-medium text-foreground/40 ml-1.5">{t.hint}</span>}</div>
                </div>
              ))}
            </div>
            {stats.problems.length > 0 && (
              <details className="mt-3">
                <summary className="text-xs font-semibold text-foreground/60 cursor-pointer">Ver os {stats.problems.length} e-mails com problema</summary>
                <div className="mt-2 rounded-lg border border-foreground/10 divide-y divide-foreground/10">
                  {stats.problems.map((p, i) => (
                    <div key={i} className="px-3 py-2 text-xs flex flex-wrap gap-x-3 gap-y-0.5">
                      <span className="font-semibold text-red-400">{EVENT_LABEL[p.event] ?? p.event}</span>
                      <span className="text-foreground/80 break-all">{p.to}</span>
                      <span className="text-foreground/50 truncate">{p.subject}</span>
                      <span className="text-foreground/40">{new Date(p.createdAt).toLocaleDateString("pt-BR")}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}

function TemplatesSection() {
  const { data: templates, isLoading } = useQuery({ queryKey: ["email-templates"], queryFn: () => listEmailTemplates() });
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <section>
      <h2 className="text-lg font-bold text-foreground">E-mails automáticos</h2>
      <p className="text-sm text-foreground/50 mt-1">
        Tudo que as agências recebem sozinhas do Modo Criador. Abra um pra ver como chega e editar o texto. Os e-mails de reativação
        que você manda em lote continuam na seção "Mensagens", em Plataforma.
      </p>
      <div className="mt-4 space-y-2">
        {isLoading && <div className="text-sm text-foreground/50 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Carregando…</div>}
        {(templates ?? []).map((t) => (
          <div key={t.key} className="rounded-xl border border-foreground/10">
            <button type="button" onClick={() => setOpenKey(openKey === t.key ? null : t.key)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left">
              <Mail size={16} className="text-foreground/40 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground flex items-center gap-2 flex-wrap">
                  {t.label}
                  {t.edited && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[rgb(var(--lz-brand-rgb))]/20 text-foreground/70">editado</span>}
                </div>
                <p className="text-xs text-foreground/50 mt-0.5">{t.when}</p>
              </div>
              <ChevronDown size={16} className={`text-foreground/40 shrink-0 transition-transform ${openKey === t.key ? "rotate-180" : ""}`} />
            </button>
            {openKey === t.key && <TemplateEditor template={t} />}
          </div>
        ))}
      </div>
    </section>
  );
}

function TemplateEditor({ template }: { template: EmailTemplateAdminRow }) {
  const qc = useQueryClient();
  const [fields, setFields] = useState<Fields>(template.current);
  const [debounced, setDebounced] = useState<Fields>(template.current);
  useEffect(() => { const id = setTimeout(() => setDebounced(fields), 400); return () => clearTimeout(id); }, [fields]);

  const preview = useServerFn(previewEmailTemplate);
  const { data: rendered, isFetching } = useQuery({
    queryKey: ["email-template-preview", template.key, debounced],
    queryFn: () => preview({ data: { key: template.key, fields: debounced } }),
    placeholderData: (prev) => prev,
  });

  const dirty = useMemo(() => JSON.stringify(fields) !== JSON.stringify(template.current), [fields, template.current]);

  const save = useMutation({
    mutationFn: useServerFn(saveEmailTemplate),
    onSuccess: () => { toast.success("Texto salvo. Os próximos e-mails já saem assim."); qc.invalidateQueries({ queryKey: ["email-templates"] }); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui salvar."),
  });
  const reset = useMutation({
    mutationFn: useServerFn(resetEmailTemplate),
    onSuccess: () => {
      setFields(template.defaults);
      toast.success("Voltou ao texto original.");
      qc.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (e: any) => toastFriendlyError(e, "Não consegui voltar ao original."),
  });
  const sendTest = useMutation({
    mutationFn: useServerFn(sendTestEmailTemplate),
    onSuccess: (r: any) => toast.success(`Teste enviado pra ${r.email}. Confira a caixa de entrada (e o spam).`),
    onError: (e: any) => toastFriendlyError(e, "Não consegui enviar o teste."),
  });

  const visibleFields = (Object.keys(FIELD_LABELS) as (keyof Fields)[]).filter((f) => !template.hiddenFields.includes(f));
  const variables = Object.keys(template.variables);

  return (
    <div className="border-t border-foreground/10 p-4 grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 min-w-0">
        {variables.length > 0 && (
          <p className="text-[11px] text-foreground/50 leading-relaxed">
            Variáveis (trocadas sozinhas em cada envio):{" "}
            {variables.map((v) => <code key={v} className="mx-0.5 px-1.5 py-0.5 rounded bg-foreground/5 text-foreground/70">{`{${v}}`}</code>)}
          </p>
        )}
        {template.automaticPart && (
          <p className="text-[11px] text-foreground/50 leading-relaxed">Parte automática, não editável: {template.automaticPart}</p>
        )}
        {visibleFields.map((f) => (
          <label key={f} className="block">
            <span className="text-xs font-semibold text-foreground/70">{FIELD_LABELS[f]}</span>
            {f === "body" || f === "highlight" ? (
              <textarea value={fields[f]} onChange={(e) => setFields({ ...fields, [f]: e.target.value })} rows={f === "body" ? 5 : 3}
                className="mt-1 w-full bg-card border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-y" />
            ) : (
              <input value={fields[f]} onChange={(e) => setFields({ ...fields, [f]: e.target.value })}
                className="mt-1 w-full bg-card border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
            )}
          </label>
        ))}
        <p className="text-[11px] text-foreground/40">Deixe uma linha em branco entre parágrafos. Use **assim** pra negrito.</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" disabled={!dirty || save.isPending}
            onClick={() => save.mutate({ data: { key: template.key, fields } })}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold disabled:opacity-40"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
            {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
          </button>
          <button type="button" disabled={sendTest.isPending}
            onClick={() => sendTest.mutate({ data: { key: template.key, fields } })}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold border border-foreground/10 text-foreground/70 hover:text-foreground disabled:opacity-40">
            {sendTest.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar teste pra mim
          </button>
          {template.edited && (
            <button type="button" disabled={reset.isPending}
              onClick={() => reset.mutate({ data: { key: template.key } })}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-bold text-foreground/50 hover:text-foreground disabled:opacity-40">
              <RotateCcw size={14} /> Voltar ao original
            </button>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground/70">Prévia (com dados de exemplo)</span>
          {isFetching && <Loader2 size={12} className="animate-spin text-foreground/40" />}
        </div>
        {rendered && (
          <>
            <div className="mt-1 text-xs text-foreground/60 truncate"><span className="text-foreground/40">Assunto:</span> {rendered.subject}</div>
            <iframe title={`Prévia: ${template.label}`} srcDoc={rendered.html} sandbox=""
              className="mt-2 w-full h-[560px] rounded-lg border border-foreground/10 bg-[#F2F2ED]" />
          </>
        )}
      </div>
    </div>
  );
}
