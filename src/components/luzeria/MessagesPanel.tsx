import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, ChevronDown, Loader2, Mail, Phone, ExternalLink } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { listInactiveOrgsForReengagement, sendReengagementEmails, getReengagementWhatsappLinks } from "@/lib/luzeria/reengagement.functions";
import type { InactiveOrgRow } from "@/lib/luzeria/reengagement.functions";

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

export function MessagesPanel() {
  const [open, setOpen] = useState(false);
  const [noClients, setNoClients] = useState(true);
  const [minDaysInactive, setMinDaysInactive] = useState("3");
  const [neverVisitedPages, setNeverVisitedPages] = useState(false);
  const [results, setResults] = useState<InactiveOrgRow[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("Sentimos sua falta no Modo Criador");
  const [body, setBody] = useState(DEFAULT_MESSAGE);
  const [waLinks, setWaLinks] = useState<{ orgId: string; orgName: string; whatsapp: string | null; link: string | null }[] | null>(null);

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
    onSuccess: (rows: any) => setWaLinks(rows),
    onError: (e: any) => toastFriendlyError(e, "Não consegui gerar os links de WhatsApp."),
  });

  function runSearch() {
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
          <span className="text-[11px] text-foreground/40">Recuperar cadastros inativos</span>
        </div>
        <ChevronDown size={16} className={`text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-4 space-y-5">
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
              onClick={runSearch}
              disabled={search.isPending}
              className="mt-3 text-xs font-bold px-3 py-1.5 rounded-md disabled:opacity-50"
              style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
            >
              {search.isPending ? "Buscando…" : "Buscar"}
            </button>
          </div>

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
                        <p className="text-[11px] text-foreground/40 truncate">{r.ownerEmail ?? "sem e-mail"} · {r.clientCount} cliente{r.clientCount === 1 ? "" : "s"} · último acesso: {formatDate(r.lastActiveAt)}</p>
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
                rows={5}
                className="w-full px-3 py-2 bg-foreground/[0.08] border border-foreground/15 rounded-lg text-foreground text-sm placeholder:text-foreground/30 focus:outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition resize-y"
              />
              <p className="text-[10.5px] text-foreground/35 mt-1">
                Use <code className="text-foreground/60">{"{nome}"}</code> onde quiser o primeiro nome do responsável (fica vazio se não tiver).
              </p>

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
            </div>
          )}

          {waLinks && (
            <div>
              <p className="text-[11px] font-bold uppercase text-foreground/40 tracking-wider mb-2">Links de WhatsApp — clique um por um pra mandar</p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {waLinks.map((r) => (
                  <div key={r.orgId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-foreground/80 truncate">{r.orgName}</span>
                    {r.link ? (
                      <a href={r.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold shrink-0" style={{ color: "#25D366" }}>
                        Abrir <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span className="text-[11px] text-foreground/30 shrink-0">sem WhatsApp</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
