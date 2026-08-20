import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Receipt, Building2, Trash2, X, AlertTriangle, Mail, Phone, MessageCircle, Pencil, Check, RefreshCw, Crown, Plus } from "lucide-react";
import { orgsBillingQO, plansQO } from "@/lib/luzeria/queries";
import { getOrgNextInvoice, deleteOrg, updateOrgWhatsapp, resetOrgTrial } from "@/lib/luzeria/api.functions";
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

export function AgenciesBillingPanel() {
  const queryClient = useQueryClient();
  const { data: orgs = [], isLoading } = useQuery(orgsBillingQO());
  const [invoiceForId, setInvoiceForId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; hasAsaasSubscription: boolean } | null>(null);
  const [infoTarget, setInfoTarget] = useState<any>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resellerFilter, setResellerFilter] = useState<"all" | "resellers" | "resold">("all");
  const [creatingReseller, setCreatingReseller] = useState(false);

  const visibleOrgs = orgs.filter((o: any) =>
    resellerFilter === "all" ? true :
    resellerFilter === "resellers" ? o.isReseller :
    !!o.resellerOrgId
  );

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
        <Loader2 className="animate-spin text-white/40" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-[rgb(var(--lz-brand-rgb))]" />
          <h2 className="text-white font-semibold">Agências no Modo Criador</h2>
          <span className="text-white/40 text-sm">— {visibleOrgs.length}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1 bg-[#0D0D0D] rounded-md p-1 text-xs">
            {([
              ["all", "Todas"],
              ["resellers", "Revendedoras"],
              ["resold", "Revendidas"],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setResellerFilter(key)}
                className={`px-2.5 py-1 rounded font-semibold transition ${resellerFilter === key ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70"}`}
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

      {visibleOrgs.length === 0 ? (
        <div className="text-center py-12 px-6 bg-white/[0.03] border border-white/10 rounded-2xl">
          <p className="text-white/50 text-sm">Nenhuma agência encontrada nesse filtro.</p>
        </div>
      ) : (
        <div className="bg-[#161616] border border-white/[0.07] rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/60">Agência</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/60">Plano</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/60">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/60">Teste / cobrança</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-white/60">Clientes</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-white/60"></th>
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
                  <tr key={o.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setInfoTarget(o)}
                          className="text-white font-medium hover:text-[rgb(var(--lz-brand-rgb))] transition underline decoration-white/20 hover:decoration-current underline-offset-2"
                        >
                          {o.name}
                        </button>
                        {o.isReseller && (
                          <span title={`${o.resoldCount} instância(s) revendida(s) — ${formatCents(o.resoldMonthlyCents)}/mês no atacado`}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0"
                            style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.15)", color: "rgb(var(--lz-brand-rgb))" }}>
                            <Crown size={10} /> Revenda{o.resoldCount > 0 ? ` · ${o.resoldCount}` : ""}
                          </span>
                        )}
                        {o.resellerOrgName && (
                          <span className="text-[10px] text-white/35 shrink-0">via {o.resellerOrgName}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70">
                      {o.planName}
                      {o.priceCents != null && (
                        <span className="text-white/40"> · R$ {(o.priceCents / 100).toFixed(2)}/mês</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold"
                        style={{ backgroundColor: `${status.color}22`, color: status.color }}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/60">
                      {trialDays != null
                        ? trialDays >= 0 ? `Teste acaba em ${trialDays}d` : `Teste expirou há ${-trialDays}d`
                        : o.hasAsaasSubscription
                          ? (
                            <div className="flex items-center gap-2">
                              {invoiceResult === undefined ? (
                                <button
                                  onClick={() => { setInvoiceForId(o.id); fetchInvoice.mutate({ data: { orgId: o.id } }); }}
                                  disabled={isFetchingThis}
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-white/60 hover:text-white transition disabled:opacity-50"
                                >
                                  <Receipt size={12} />
                                  {isFetchingThis ? "Buscando…" : "Ver fatura"}
                                </button>
                              ) : invoiceError ? (
                                <span className="text-[11px] text-red-400">Erro ao buscar</span>
                              ) : invoiceResult === null ? (
                                <span className="text-[11px] text-white/40">Sem fatura pendente</span>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-white/80">
                                    R$ {(invoiceResult.valueCents / 100).toFixed(2)}
                                  </span>
                                  {invoiceResult.invoiceUrl && (
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(invoiceResult.invoiceUrl!);
                                        toast.success("Link copiado — manda pro cliente escolher PIX/boleto/cartão.");
                                      }}
                                      className="text-[11px] font-bold text-white/60 hover:text-white transition underline"
                                    >
                                      Copiar link
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                          : <span className="text-white/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-white/70">{o.clientsUsed}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {o.subscriptionStatus !== "active" && (
                          <button
                            onClick={() => handleResetTrial(o)}
                            disabled={resettingId === o.id}
                            title="Dar mais 30 dias de teste"
                            className="p-1.5 rounded text-white/40 hover:text-[rgb(var(--lz-brand-rgb))] hover:bg-white/5 transition disabled:opacity-40"
                          >
                            {resettingId === o.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget({ id: o.id, name: o.name, hasAsaasSubscription: o.hasAsaasSubscription })}
                          title="Remover agência"
                          className="p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition"
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
      <div className="bg-[#161616] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Crown size={18} className="text-[rgb(var(--lz-brand-rgb))]" />
            <h3 className="text-lg font-bold text-white">Nova revenda</h3>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white p-1 rounded hover:bg-white/5 transition">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-white/45 mb-4">
          Cria a org da revenda do zero, já aprovada, e manda o convite de acesso pro responsável — pra quando alguém
          te chamar no WhatsApp e ainda não tiver conta nenhuma no Modo Criador.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Nome da revenda</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Agência Fulano"
              className="w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Plano da conta dela</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)}
              className="w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]">
              <option value="">Selecione...</option>
              {plans.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Desconto de atacado (%)</label>
            <input type="number" min={0} max={95} value={discount} onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
            <p className="text-[11px] text-white/35 mt-1">Aplicado sobre o preço de tabela de cada plano — ela paga esse valor por cada instância que criar.</p>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Nome do responsável</label>
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="ex: Maria Silva"
              className="w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">E-mail de acesso</label>
            <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="maria@exemplo.com"
              className="w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
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

function AgencyInfoModal({ org, onClose }: { org: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [whatsapp, setWhatsapp] = useState(org.whatsapp ?? "");

  const saveWhatsapp = useMutation({
    mutationFn: useServerFn(updateOrgWhatsapp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs-billing"] });
      setEditing(false);
      toast.success("WhatsApp atualizado.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar."),
  });

  const digits = (org.whatsapp ?? "").replace(/\D/g, "");

  const approveResellerMutation = useMutation({
    mutationFn: useServerFn(approveReseller),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orgs-billing"] });
      toast.success(`${org.name} aprovada como revendedora — 60% de desconto de atacado já configurado.`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao aprovar revendedor."),
  });

  async function handleApproveReseller() {
    if (!(await requestConfirm(`Aprovar ${org.name} como revendedora white label? Ela poderá criar instâncias novas com 60% de desconto de atacado.`))) return;
    approveResellerMutation.mutate({ data: { orgId: org.id } });
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#161616] border border-white/10 rounded-2xl p-6 max-w-sm w-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-[rgb(var(--lz-brand-rgb))]" />
            <h3 className="text-lg font-bold text-white">{org.name}</h3>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white p-1 rounded hover:bg-white/5 transition">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 text-sm">
          {org.ownerName && (
            <div>
              <p className="text-[11px] font-bold uppercase text-white/40 tracking-wider mb-0.5">Responsável</p>
              <p className="text-white">{org.ownerName}</p>
            </div>
          )}
          {org.ownerEmail && (
            <div className="flex items-center gap-2 text-white/80">
              <Mail size={13} className="text-white/40 shrink-0" />
              <a href={`mailto:${org.ownerEmail}`} className="hover:text-white transition truncate">{org.ownerEmail}</a>
            </div>
          )}
          {org.taxId && (
            <div>
              <p className="text-[11px] font-bold uppercase text-white/40 tracking-wider mb-0.5">CNPJ/CPF</p>
              <p className="text-white/80">{org.taxId}</p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[11px] font-bold uppercase text-white/40 tracking-wider">WhatsApp</p>
              {!editing && (
                <button onClick={() => { setWhatsapp(org.whatsapp ?? ""); setEditing(true); }} className="text-white/40 hover:text-white transition">
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
                  className="flex-1 px-3 py-2 bg-white/[0.08] border border-white/15 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition"
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
              <div className="flex items-center gap-2 text-white/80">
                <Phone size={13} className="text-white/40 shrink-0" />
                {org.whatsapp}
              </div>
            ) : (
              <p className="text-white/30 text-[13px]">Não cadastrado.</p>
            )}
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase text-white/40 tracking-wider mb-0.5">Revenda</p>
            {org.resellerOrgName ? (
              <p className="text-white/80">Instância revendida por <span className="text-white font-semibold">{org.resellerOrgName}</span>.</p>
            ) : org.isReseller ? (
              <p className="inline-flex items-center gap-1.5 text-[rgb(var(--lz-brand-rgb))] font-semibold">
                <Check size={13} /> Aprovada como revendedora
              </p>
            ) : (
              <button
                onClick={handleApproveReseller}
                disabled={approveResellerMutation.isPending}
                className="text-xs font-semibold text-white/60 hover:text-white border border-white/15 hover:border-white/30 rounded-md px-3 py-1.5 transition disabled:opacity-40"
              >
                {approveResellerMutation.isPending ? "Aprovando..." : "Aprovar como revendedora"}
              </button>
            )}
          </div>
        </div>

        {!editing && digits && (
          <a
            href={`https://wa.me/${digits}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-black transition"
            style={{ backgroundColor: "#25D366" }}
          >
            <MessageCircle size={15} /> Abrir WhatsApp
          </a>
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
      <div className="bg-[#161616] border border-red-500/30 rounded-2xl p-6 max-w-md w-full">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={18} />
            <h3 className="text-lg font-bold text-white">Remover agência</h3>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white p-1 rounded hover:bg-white/5 transition">
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-white/70 mb-3">
          Isso apaga <span className="text-white font-semibold">{target.name}</span> e tudo dela — clientes,
          posts, arquivos, equipe — pra sempre. Não tem como desfazer.
          {target.hasAsaasSubscription && " A assinatura no Asaas também é cancelada."}
        </p>

        <label className="block text-xs font-bold uppercase text-white/50 mb-2 tracking-wider">
          Digite "{target.name}" pra confirmar
        </label>
        <input
          type="text"
          value={confirmName}
          onChange={(e) => setConfirmName(e.target.value)}
          className="w-full px-4 py-3 bg-white/[0.08] border border-white/15 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/60 transition mb-4"
          placeholder={target.name}
          autoFocus
        />

        <div className="flex gap-3">
          <button
            onClick={() => removeOrg.mutate({ data: { orgId: target.id, confirmName } })}
            disabled={!matches || removeOrg.isPending}
            className="flex-1 px-6 py-3 bg-red-500/90 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition"
          >
            {removeOrg.isPending ? "Removendo…" : "Remover pra sempre"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-white/[0.08] hover:bg-white/[0.12] text-white font-bold rounded-xl transition border border-white/10"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
