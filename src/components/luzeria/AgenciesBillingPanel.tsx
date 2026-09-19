import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Receipt, Building2, Trash2, X, AlertTriangle, Mail, Phone, MessageCircle, Pencil, Check, RefreshCw, Crown, Plus, PartyPopper, Instagram, HardDrive } from "lucide-react";
import { orgsBillingQO, plansQO, agencyWelcomeMessageQO, useApi } from "@/lib/luzeria/queries";
import { getOrgNextInvoice, deleteOrg, updateOrgWhatsapp, resetOrgTrial, LUZERIA_ORG_ID } from "@/lib/luzeria/api.functions";
import { approveReseller, createResellerOrg } from "@/lib/luzeria/reseller.functions";
import { requestConfirm } from "@/lib/luzeria/confirm-store";

function formatCents(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  trialing: { label: "Em teste", color: "#4A9EFF" },
  active: { label: "Ativa", color: "#4ADE80" },
  past_due: { label: "Atrasada", color: "#FF6B6B" },
  canceled: { label: "Cancelada", color: "#9AA4B2" },
};

function daysUntil(iso: string) {
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
  return diff;
}

// DDD -> UF (plano de numeração da Anatel, estável) — usado só pra estimar
// "Estados com mais agências" a partir do WhatsApp já cadastrado no
// cadastro, sem precisar pedir um campo de estado novo (que também não
// preencheria retroativamente as agências que já existem).
const DDD_TO_UF: Record<string, string> = {
  "11": "SP", "12": "SP", "13": "SP", "14": "SP", "15": "SP", "16": "SP", "17": "SP", "18": "SP", "19": "SP",
  "21": "RJ", "22": "RJ", "24": "RJ",
  "27": "ES", "28": "ES",
  "31": "MG", "32": "MG", "33": "MG", "34": "MG", "35": "MG", "37": "MG", "38": "MG",
  "41": "PR", "42": "PR", "43": "PR", "44": "PR", "45": "PR", "46": "PR",
  "47": "SC", "48": "SC", "49": "SC",
  "51": "RS", "53": "RS", "54": "RS", "55": "RS",
  "61": "DF",
  "62": "GO", "64": "GO",
  "63": "TO",
  "65": "MT", "66": "MT",
  "67": "MS",
  "68": "AC",
  "69": "RO",
  "71": "BA", "73": "BA", "74": "BA", "75": "BA", "77": "BA",
  "79": "SE",
  "81": "PE", "87": "PE",
  "82": "AL",
  "83": "PB",
  "84": "RN",
  "85": "CE", "88": "CE",
  "86": "PI", "89": "PI",
  "91": "PA", "93": "PA", "94": "PA",
  "92": "AM", "97": "AM",
  "95": "RR",
  "96": "AP",
  "98": "MA", "99": "MA",
};

function ufFromWhatsapp(whatsapp: string | null): string | null {
  if (!whatsapp) return null;
  const digits = whatsapp.replace(/\D/g, "");
  // Aceita com ou sem "55" de país e com ou sem o 9 extra do celular —
  // o DDD são sempre os 2 dígitos logo depois do "55" (se vier) e antes
  // do número de 8-9 dígitos.
  const withoutCountry = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  const ddd = withoutCountry.slice(0, 2);
  return DDD_TO_UF[ddd] ?? null;
}

function formatLastLogin(iso: string | null) {
  if (!iso) return "Nunca";
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diffDays <= 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays < 30) return `${diffDays}d atrás`;
  const months = Math.floor(diffDays / 30);
  return `${months}${months === 1 ? " mês" : " meses"} atrás`;
}

export function AgenciesBillingPanel() {
  const queryClient = useQueryClient();
  const { data: orgs = [], isLoading } = useQuery(orgsBillingQO());
  const [invoiceForId, setInvoiceForId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; hasAsaasSubscription: boolean } | null>(null);
  const [infoTarget, setInfoTarget] = useState<any>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resellerFilter, setResellerFilter] = useState<"all" | "resellers" | "resold">("all");
  const [creatingReseller, setCreatingReseller] = useState(false);
  const [infoPeriod, setInfoPeriod] = useState<"7d" | "30d" | "total">("7d");

  const visibleOrgs = orgs.filter((o: any) =>
    resellerFilter === "all" ? true :
    resellerFilter === "resellers" ? o.isReseller :
    !!o.resellerOrgId
  );

  // Funil de ativação — sempre calculado sobre todas as agências orgânicas
  // (fora revenda), independente do filtro acima, pra não mudar de
  // significado quando a pessoa troca o filtro da tabela.
  const organicOrgs = orgs.filter((o: any) => !o.isReseller && !o.resellerOrgId);
  const daysSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86_400_000;
  const infoPeriodDays = infoPeriod === "7d" ? 7 : infoPeriod === "30d" ? 30 : Infinity;
  const cohort = organicOrgs.filter((o: any) => daysSince(o.createdAt) <= infoPeriodDays);
  const withClient = cohort.filter((o: any) => o.clientsUsed >= 1).length;
  const withActiveClients = cohort.filter((o: any) => o.clientsUsed >= 2).length;
  const withTeam = cohort.filter((o: any) => o.teamCount > 1).length;
  const cold3d = organicOrgs.filter((o: any) => daysSince(o.createdAt) >= 3 && o.clientsUsed === 0);
  const pct = (n: number) => (cohort.length ? Math.round((100 * n) / cohort.length) : 0);

  // Totais gerais da plataforma inteira (todas as agências, orgânicas ou
  // não) — não mudam com o seletor de período, é "agora", não uma coorte.
  const totalUsers = orgs.reduce((sum: number, o: any) => sum + (o.teamCount ?? 0), 0);
  const totalClients = orgs.reduce((sum: number, o: any) => sum + (o.clientsUsed ?? 0), 0);

  // Receita: só orgânicas (fora Luzeria e revenda, que tem preço próprio
  // por fora) e só "active" com assinatura de verdade na Asaas —
  // `subscription_status='active'` sozinho não basta, porque a Views
  // Agência (conta demo) fica marcada como "active" sem nunca ter passado
  // pela Asaas. "Previsto" assume 100% de conversão de quem tá em teste —
  // é o teto, não uma estimativa realista (não temos histórico de
  // conversão ainda pra calcular uma taxa de verdade).
  const revenueOrgs = organicOrgs.filter((o: any) => o.id !== LUZERIA_ORG_ID);
  const payingOrgs = revenueOrgs.filter((o: any) => o.subscriptionStatus === "active" && o.hasAsaasSubscription);
  const trialOrgs = revenueOrgs.filter((o: any) => o.subscriptionStatus === "trialing");
  const realRevenueCents = payingOrgs.reduce((s: number, o: any) => s + (o.priceCents ?? 0), 0);
  const trialRevenueCents = trialOrgs.reduce((s: number, o: any) => s + (o.priceCents ?? 0), 0);
  const fmtBRL = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const stateCounts = new Map<string, number>();
  orgs.forEach((o: any) => {
    const uf = ufFromWhatsapp(o.whatsapp);
    if (uf) stateCounts.set(uf, (stateCounts.get(uf) ?? 0) + 1);
  });
  const topStates = [...stateCounts.entries()].sort((a, b) => b[1] - a[1]);

  const fetchInvoice = useMutation({
    mutationFn: useServerFn(getOrgNextInvoice),
  });

  const resetTrial = useMutation({
    mutationFn: useServerFn(resetOrgTrial),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs-billing"] });
      toast.success("Mais 30 dias de teste liberados.");
      setResettingId(null);
    },
    onError: (e: any) => { toast.error(e?.message ?? "Erro ao resetar teste."); setResettingId(null); },
  });

  async function handleResetTrial(o: { id: string; name: string }) {
    if (!(await requestConfirm(`Dar mais 30 dias de teste pra ${o.name}?`))) return;
    setResettingId(o.id);
    resetTrial.mutate({ data: { orgId: o.id } });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-foreground/40" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-[var(--lz-accent-ink)]" />
          <h2 className="text-foreground font-semibold">Agências no Modo Criador</h2>
          <span className="text-foreground/40 text-sm">— {visibleOrgs.length}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1 bg-background rounded-md p-1 text-xs">
            {([
              ["all", "Todas"],
              ["resellers", "Revendedoras"],
              ["resold", "Revendidas"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setResellerFilter(key)}
                className={`px-2.5 py-1 rounded font-semibold transition ${resellerFilter === key ? "bg-foreground/10 text-foreground" : "text-foreground/40 hover:text-foreground/70"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setCreatingReseller(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-xs text-[#0D0D0D] transition hover:opacity-90"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
          >
            <Plus size={13} /> Nova revenda
          </button>
        </div>
      </div>

      <div className="bg-card border border-foreground/7 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-foreground/40">Informações</h3>
          <div className="inline-flex items-center gap-1 bg-background rounded-md p-1 text-xs">
            {([
              ["7d", "Últimos 7 dias"],
              ["30d", "Últimos 30 dias"],
              ["total", "Total"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setInfoPeriod(key)}
                className={`px-2.5 py-1 rounded font-semibold transition ${infoPeriod === key ? "bg-foreground/10 text-foreground" : "text-foreground/40 hover:text-foreground/70"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Cadastros", value: cohort.length, sub: null },
            { label: "Importaram cliente", value: withClient, sub: `${pct(withClient)}%` },
            { label: "Já ativos (2+ clientes)", value: withActiveClients, sub: `${pct(withActiveClients)}%` },
            { label: "Chamaram equipe", value: withTeam, sub: `${pct(withTeam)}%` },
          ].map((s) => (
            <div key={s.label} className="bg-foreground/[0.03] rounded-lg px-3 py-2.5">
              <div className="text-lg font-bold text-foreground">{s.value}{s.sub && <span className="text-xs font-semibold text-foreground/40 ml-1.5">{s.sub}</span>}</div>
              <div className="text-[11px] text-foreground/50 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        {cold3d.length > 0 && (
          <div className="mt-3 pt-3 border-t border-foreground/6 text-xs text-foreground/60">
            <span className="font-semibold text-foreground/80">{cold3d.length}</span> agência{cold3d.length > 1 ? "s" : ""} com 3+ dias e nenhum cliente cadastrado: {cold3d.map((o: any) => o.name).join(", ")}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-foreground/6">
          <div className="text-[11px] text-foreground/50 mb-2">Receita mensal</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-foreground/[0.03] rounded-lg px-3 py-2.5">
              <div className="text-lg font-bold text-foreground">{fmtBRL(realRevenueCents)}</div>
              <div className="text-[11px] text-foreground/50 mt-0.5">Real — {payingOrgs.length} pagante{payingOrgs.length === 1 ? "" : "s"}</div>
            </div>
            <div className="bg-foreground/[0.03] rounded-lg px-3 py-2.5">
              <div className="text-lg font-bold text-foreground">{fmtBRL(realRevenueCents + trialRevenueCents)}</div>
              <div className="text-[11px] text-foreground/50 mt-0.5">Previsto — +{trialOrgs.length} em teste</div>
            </div>
          </div>
          <p className="text-[10.5px] text-foreground/35 mt-2 leading-relaxed">
            "Previsto" assume 100% de conversão de quem está em teste — é o teto, não uma estimativa realista (ainda não temos histórico pra calcular uma taxa de conversão de verdade).
          </p>
        </div>

        <div className="mt-4 pt-4 border-t border-foreground/6 grid grid-cols-2 gap-3">
          <div className="bg-foreground/[0.03] rounded-lg px-3 py-2.5">
            <div className="text-lg font-bold text-foreground">{totalUsers}</div>
            <div className="text-[11px] text-foreground/50 mt-0.5">Usuários no total</div>
          </div>
          <div className="bg-foreground/[0.03] rounded-lg px-3 py-2.5">
            <div className="text-lg font-bold text-foreground">{totalClients}</div>
            <div className="text-[11px] text-foreground/50 mt-0.5">Clientes no total</div>
          </div>
        </div>

        {topStates.length > 0 && (
          <div className="mt-4 pt-4 border-t border-foreground/6">
            <div className="text-[11px] text-foreground/50 mb-2">Estados com mais agências ({topStates.length})</div>
            <div className="flex flex-wrap gap-2">
              {topStates.map(([uf, count]) => (
                <span key={uf} className="inline-flex items-center gap-1.5 bg-foreground/[0.03] rounded-full px-2.5 py-1 text-xs">
                  <span className="font-bold text-foreground">{uf}</span>
                  <span className="text-foreground/40">{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {visibleOrgs.length === 0 ? (
        <div className="text-center py-12 px-6 bg-foreground/[0.03] border border-foreground/10 rounded-2xl">
          <p className="text-foreground/50 text-sm">Nenhuma agência encontrada nesse filtro.</p>
        </div>
      ) : (
        <div className="bg-card border border-foreground/7 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-foreground/7">
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/60">Agência</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/60">Plano</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/60">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/60">Teste / cobrança</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/60">Clientes</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-foreground/60">Drive</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-foreground/60">Instagram</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/60">Último acesso</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-foreground/60"></th>
              </tr>
            </thead>
            <tbody>
              {visibleOrgs.map((o: any) => {
                const status = STATUS_LABEL[o.subscriptionStatus] ?? { label: o.subscriptionStatus, color: "#9AA4B2" };
                const trialDays = o.subscriptionStatus === "trialing" && o.trialEndsAt ? daysUntil(o.trialEndsAt) : null;
                const isFetchingThis = fetchInvoice.isPending && invoiceForId === o.id;
                const invoiceResult = invoiceForId === o.id ? fetchInvoice.data : undefined;
                const invoiceError = invoiceForId === o.id ? fetchInvoice.error : undefined;
                return (
                  <tr key={o.id} className="border-b border-foreground/4 hover:bg-foreground/[0.02] transition">
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setInfoTarget(o)}
                          className="text-foreground font-medium hover:text-[var(--lz-accent-ink)] transition underline decoration-white/20 hover:decoration-current underline-offset-2"
                        >
                          {o.name}
                        </button>
                        {o.isReseller && (
                          <span title={`${o.resoldCount} instância(s) revendida(s) — ${formatCents(o.resoldMonthlyCents)}/mês em preço de parceiro`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0"
                            style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
                            <Crown size={10} /> Revenda{o.resoldCount > 0 ? ` · ${o.resoldCount}` : ""}
                          </span>
                        )}
                        {o.resellerOrgName && (
                          <span className="text-[10px] text-foreground/35 shrink-0">via {o.resellerOrgName}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground/70">
                      {o.planName}
                      {o.priceCents != null && (
                        <span className="text-foreground/40"> · R$ {(o.priceCents / 100).toFixed(2)}/mês</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold"
                        style={{ backgroundColor: `${status.color}22`, color: status.color }}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground/60">
                      {trialDays != null
                        ? trialDays >= 0 ? `Teste acaba em ${trialDays}d` : `Teste expirou há ${-trialDays}d`
                        : o.hasAsaasSubscription
                          ? (
                            <div className="flex items-center gap-2">
                              {invoiceResult === undefined ? (
                                <button
                                  onClick={() => { setInvoiceForId(o.id); fetchInvoice.mutate({ data: { orgId: o.id } }); }}
                                  disabled={isFetchingThis}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-foreground/60 hover:text-foreground transition disabled:opacity-50"
                                >
                                  <Receipt size={12} />
                                  {isFetchingThis ? "Buscando…" : "Ver fatura"}
                                </button>
                              ) : invoiceError ? (
                                <span className="text-[11px] text-red-400">Erro ao buscar</span>
                              ) : invoiceResult === null ? (
                                <span className="text-[11px] text-foreground/40">Sem fatura pendente</span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-foreground/80">
                                    R$ {(invoiceResult.valueCents / 100).toFixed(2)}
                                  </span>
                                  {invoiceResult.invoiceUrl && (
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(invoiceResult.invoiceUrl!);
                                        toast.success("Link copiado — manda pro cliente escolher PIX/boleto/cartão.");
                                      }}
                                      className="text-[11px] font-bold text-foreground/60 hover:text-foreground transition underline"
                                    >
                                      Copiar link
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                          : <span className="text-foreground/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-foreground/70">{o.clientsUsed}</td>
                    <td className="px-4 py-3 text-center">
                      <HardDrive size={14} className={`inline ${o.driveConnected ? "text-[var(--lz-accent-ink)]" : "text-foreground/20"}`} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {o.instagramConnected > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--lz-accent-ink)]">
                          <Instagram size={13} /> {o.instagramConnected}
                        </span>
                      ) : (
                        <Instagram size={14} className="inline text-foreground/20" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground/50">{formatLastLogin(o.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {o.subscriptionStatus !== "active" && (
                          <button
                            onClick={() => handleResetTrial(o)}
                            disabled={resettingId === o.id}
                            title="Dar mais 30 dias de teste"
                            className="p-1.5 rounded text-foreground/40 hover:text-[var(--lz-accent-ink)] hover:bg-foreground/5 transition disabled:opacity-40"
                          >
                            {resettingId === o.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget({ id: o.id, name: o.name, hasAsaasSubscription: o.hasAsaasSubscription })}
                          title="Remover agência"
                          className="p-1.5 rounded text-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <DeleteOrgModal target={deleteTarget} onClose={() => setDeleteTarget(null)} />
      )}
      {infoTarget && (
        <AgencyInfoModal org={infoTarget} onClose={() => setInfoTarget(null)} />
      )}
      {creatingReseller && (
        <CreateResellerModal onClose={() => setCreatingReseller(false)} />
      )}
    </div>
  );
}

function CreateResellerModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: plans = [] } = useQuery(plansQO());
  const [name, setName] = useState("");
  const [planId, setPlanId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [discount, setDiscount] = useState(60);

  const create = useMutation({
    mutationFn: useServerFn(createResellerOrg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs-billing"] });
      toast.success("Revenda criada! Um e-mail de acesso foi enviado pro responsável.");
      onClose();
    },
    onError: (error: any) => toast.error(error?.message || "Erro ao criar revenda."),
  });

  function submit() {
    if (!name.trim() || !planId || !ownerName.trim() || !ownerEmail.trim()) {
      toast.error("Preencha todos os campos.");
      return;
    }
    create.mutate({ data: { name: name.trim(), planId, ownerName: ownerName.trim(), ownerEmail: ownerEmail.trim(), wholesaleDiscountPercent: discount } });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-foreground/10 rounded-2xl p-6 max-w-sm w-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Crown size={18} className="text-[var(--lz-accent-ink)]" />
            <h3 className="text-lg font-bold text-foreground">Nova revenda</h3>
          </div>
          <button onClick={onClose} className="text-foreground/50 hover:text-foreground p-1 rounded hover:bg-foreground/5 transition">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-foreground/45 mb-4">
          Cria a org da revenda do zero, já aprovada, e manda o convite de acesso pro responsável — pra quando alguém
          te chamar no WhatsApp e ainda não tiver conta nenhuma no Modo Criador.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-foreground/40 mb-1">Nome da revenda</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Agência Fulano"
              className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-foreground/40 mb-1">Plano da conta dela</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)}
              className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]">
              <option value="">Selecione...</option>
              {plans.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-foreground/40 mb-1">Desconto de parceiro (%)</label>
            <input type="number" min={0} max={95} value={discount} onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
            <p className="text-[11px] text-foreground/35 mt-1">Aplicado sobre o preço de tabela de cada plano — ela paga esse valor por cada instância que criar.</p>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-foreground/40 mb-1">Nome do responsável</label>
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="ex: Maria Silva"
              className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-foreground/40 mb-1">E-mail de acesso</label>
            <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="maria@exemplo.com"
              className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
          </div>
        </div>
        <button
          onClick={submit}
          disabled={create.isPending}
          className="w-full mt-5 font-bold uppercase text-sm px-5 py-3 rounded-md transition disabled:opacity-40"
          style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          {create.isPending ? "Criando..." : "Criar revenda"}
        </button>
      </div>
    </div>
  );
}

const DEFAULT_WELCOME_TEMPLATE = `Oi{nome}, tudo bem? Aqui é o Junior, fundador do Modo Criador! Vi que você acabou de criar sua conta e quis te mandar um oi.

Espero que você curta bastante — aproveita os 30 dias de teste, tem muita funcionalidade boa aí dentro que tenho certeza que você vai gostar.

Qualquer dúvida no começo, é só me chamar por aqui mesmo 🙂`;

function AgencyInfoModal({ org, onClose }: { org: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const api = useApi();
  const [editing, setEditing] = useState(false);
  const [whatsapp, setWhatsapp] = useState(org.whatsapp ?? "");
  const [editingTemplate, setEditingTemplate] = useState(false);

  const { data: customTemplate } = useQuery(agencyWelcomeMessageQO());
  const [templateDraft, setTemplateDraft] = useState(customTemplate ?? DEFAULT_WELCOME_TEMPLATE);

  const saveWhatsapp = useMutation({
    mutationFn: useServerFn(updateOrgWhatsapp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs-billing"] });
      setEditing(false);
      toast.success("WhatsApp atualizado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });

  function openTemplateEditor() {
    setTemplateDraft(customTemplate ?? DEFAULT_WELCOME_TEMPLATE);
    setEditingTemplate(true);
  }
  function saveTemplate() {
    api.updateAgencyWelcomeMessage.mutate({ data: { message: templateDraft } }, {
      onSuccess: () => { toast.success("Mensagem padrão atualizada."); setEditingTemplate(false); },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
    });
  }

  // wa.me exige o código do país — sem o "55" na frente, o link abre
  // quebrado (WhatsApp tenta interpretar como outro país e falha).
  const rawDigits = (org.whatsapp ?? "").replace(/\D/g, "");
  const digits = rawDigits && rawDigits.length <= 11 ? `55${rawDigits}` : rawDigits;
  const namePart = org.ownerName ? ` ${org.ownerName}` : "";
  const welcomeMessage = (customTemplate ?? DEFAULT_WELCOME_TEMPLATE).replaceAll("{nome}", namePart);

  const approveResellerMutation = useMutation({
    mutationFn: useServerFn(approveReseller),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs-billing"] });
      toast.success(`${org.name} aprovada como revendedora — 60% de desconto de parceiro já configurado.`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao aprovar revendedor."),
  });

  async function handleApproveReseller() {
    if (!(await requestConfirm(`Aprovar ${org.name} como revendedora white label? Ela poderá criar instâncias novas com 60% de desconto de parceiro.`))) return;
    approveResellerMutation.mutate({ data: { orgId: org.id } });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-foreground/10 rounded-2xl p-6 max-w-sm w-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-[var(--lz-accent-ink)]" />
            <h3 className="text-lg font-bold text-foreground">{org.name}</h3>
          </div>
          <button onClick={onClose} className="text-foreground/50 hover:text-foreground p-1 rounded hover:bg-foreground/5 transition">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          {org.ownerName && (
            <div>
              <p className="text-[11px] font-bold uppercase text-foreground/40 tracking-wider mb-0.5">Responsável</p>
              <p className="text-foreground">{org.ownerName}</p>
            </div>
          )}
          {org.ownerEmail && (
            <div className="flex items-center gap-2 text-foreground/80">
              <Mail size={13} className="text-foreground/40 shrink-0" />
              <a href={`mailto:${org.ownerEmail}`} className="hover:text-foreground transition truncate">{org.ownerEmail}</a>
            </div>
          )}
          {org.taxId && (
            <div>
              <p className="text-[11px] font-bold uppercase text-foreground/40 tracking-wider mb-0.5">CNPJ/CPF</p>
              <p className="text-foreground/80">{org.taxId}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[11px] font-bold uppercase text-foreground/40 tracking-wider">WhatsApp</p>
              {!editing && (
                <button onClick={() => { setWhatsapp(org.whatsapp ?? ""); setEditing(true); }} className="text-foreground/40 hover:text-foreground transition">
                  <Pencil size={12} />
                </button>
              )}
            </div>
            {editing ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="(11) 91234-5678"
                  autoFocus
                  className="flex-1 px-3 py-2 bg-foreground/[0.08] border border-foreground/15 rounded-lg text-foreground text-sm placeholder:text-foreground/30 focus:outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition"
                />
                <button
                  onClick={() => saveWhatsapp.mutate({ data: { orgId: org.id, whatsapp } })}
                  disabled={saveWhatsapp.isPending}
                  className="p-2 rounded-lg text-black disabled:opacity-50"
                  style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
                >
                  {saveWhatsapp.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                </button>
              </div>
            ) : org.whatsapp ? (
              <div className="flex items-center gap-2 text-foreground/80">
                <Phone size={13} className="text-foreground/40 shrink-0" />
                {org.whatsapp}
              </div>
            ) : (
              <p className="text-foreground/30 text-[13px]">Não cadastrado.</p>
            )}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase text-foreground/40 tracking-wider mb-0.5">Revenda</p>
            {org.resellerOrgName ? (
              <p className="text-foreground/80">Instância revendida por <span className="text-foreground font-semibold">{org.resellerOrgName}</span>.</p>
            ) : org.isReseller ? (
              <p className="inline-flex items-center gap-1.5 text-[var(--lz-accent-ink)] font-semibold">
                <Check size={13} /> Aprovada como revendedora
              </p>
            ) : (
              <button
                onClick={handleApproveReseller}
                disabled={approveResellerMutation.isPending}
                className="text-xs font-semibold text-foreground/60 hover:text-foreground border border-foreground/15 hover:border-foreground/30 rounded-md px-3 py-1.5 transition disabled:opacity-40"
              >
                {approveResellerMutation.isPending ? "Aprovando..." : "Aprovar como revendedora"}
              </button>
            )}
          </div>
        </div>

        {!editing && digits && (
          <div className="mt-5 flex gap-2">
            <a
              href={`https://wa.me/${digits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-black transition"
              style={{ backgroundColor: "#25D366" }}
            >
              <MessageCircle size={15} /> Enviar mensagem
            </a>
            <a
              href={`https://wa.me/${digits}?text=${encodeURIComponent(welcomeMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-black transition border-2"
              style={{ backgroundColor: "transparent", borderColor: "#25D366", color: "#25D366" }}
            >
              <PartyPopper size={15} /> Enviar boas-vindas
            </a>
          </div>
        )}

        {!editing && digits && (
          <button onClick={openTemplateEditor} className="mt-2 text-[11px] text-foreground/40 hover:text-foreground transition inline-flex items-center gap-1">
            <Pencil size={11} /> Editar mensagem de boas-vindas (vale pra todas as agências)
          </button>
        )}

        {editingTemplate && (
          <div className="mt-3 bg-background rounded-lg border border-foreground/10 p-3">
            <p className="text-[11px] text-foreground/50 mb-2">
              Esse texto é usado no botão "Enviar boas-vindas" de qualquer agência. Use <code className="text-foreground/70">{"{nome}"}</code> onde
              quiser que apareça o nome de quem cadastrou (fica vazio se não tiver nome).
            </p>
            <textarea
              value={templateDraft}
              onChange={(e) => setTemplateDraft(e.target.value)}
              rows={7}
              className="w-full bg-card border border-foreground/10 rounded-md p-3 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-none"
            />
            <div className="flex items-center justify-end gap-2 mt-2">
              <button onClick={() => setEditingTemplate(false)} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Cancelar</button>
              <button
                onClick={saveTemplate}
                disabled={api.updateAgencyWelcomeMessage.isPending}
                className="text-xs font-bold px-4 py-2 rounded-md disabled:opacity-50"
                style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
              >
                {api.updateAgencyWelcomeMessage.isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteOrgModal({ target, onClose }: {
  target: { id: string; name: string; hasAsaasSubscription: boolean };
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmName, setConfirmName] = useState("");
  const matches = confirmName.trim().toLowerCase() === target.name.trim().toLowerCase();

  const removeOrg = useMutation({
    mutationFn: useServerFn(deleteOrg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs-billing"] });
      toast.success(`${target.name} removida.`);
      onClose();
    },
    onError: (error: any) => toast.error(error?.message || "Erro ao remover agência."),
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-red-500/30 rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={18} />
            <h3 className="text-lg font-bold text-foreground">Remover agência</h3>
          </div>
          <button onClick={onClose} className="text-foreground/50 hover:text-foreground p-1 rounded hover:bg-foreground/5 transition">
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-foreground/70 mb-3">
          Isso apaga <span className="text-foreground font-semibold">{target.name}</span> e tudo dela — clientes,
          posts, arquivos, equipe — pra sempre. Não tem como desfazer.
          {target.hasAsaasSubscription && " A assinatura no Asaas também é cancelada."}
        </p>

        <label className="block text-xs font-bold uppercase text-foreground/50 mb-2 tracking-wider">
          Digite "{target.name}" pra confirmar
        </label>
        <input
          type="text"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          className="w-full px-4 py-3 bg-foreground/[0.08] border border-foreground/15 rounded-xl text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-red-500/60 transition mb-4"
          placeholder={target.name}
          autoFocus
        />

        <div className="flex gap-3">
          <button
            onClick={() => removeOrg.mutate({ data: { orgId: target.id, confirmName } })}
            disabled={!matches || removeOrg.isPending}
            className="flex-1 px-6 py-3 bg-red-500/90 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-foreground font-bold rounded-xl transition"
          >
            {removeOrg.isPending ? "Removendo…" : "Remover pra sempre"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-foreground/[0.08] hover:bg-foreground/[0.12] text-foreground font-bold rounded-xl transition border border-foreground/10"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
