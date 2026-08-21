import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Loader2, Plus, X, Package, Trash2, AlertTriangle } from "lucide-react";
import { getMyResellerProgram, createResoldOrg, cancelResoldOrg } from "@/lib/luzeria/reseller.functions";
import { getPublicPlans } from "@/lib/luzeria/signup.functions";

function formatCents(cents: number) {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export function ResellerPanel() {
  const { data: program, isLoading } = useQuery({
    queryKey: ["myResellerProgram"],
    queryFn: () => getMyResellerProgram(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-white/40" size={32} />
      </div>
    );
  }

  if (!program?.isReseller) {
    return (
      <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/15 rounded-2xl p-8 backdrop-blur-sm">
        <h2 className="text-2xl font-black text-white">Revenda White Label</h2>
        <p className="text-sm text-white/50 mt-1 mb-6 max-w-lg">
          Adquira instâncias do Modo Criador com preço de parceiro, coloque sua própria marca e revenda pros seus
          clientes pelo preço que você definir. A gente nunca cobra o cliente final — só a sua agência, com um preço
          fechado por instância.
        </p>
        <a
          href="/revenda"
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[rgb(var(--lz-brand-rgb))] to-[rgba(var(--lz-brand-rgb),0.8)] hover:opacity-90 rounded-xl font-bold text-[#0D0D0D] transition"
        >
          Saiba como funciona
          <ExternalLink size={16} />
        </a>
      </div>
    );
  }

  return <ResellerDashboard program={program} />;
}

function ResellerDashboard({ program }: { program: Extract<Awaited<ReturnType<typeof getMyResellerProgram>>, { isReseller: true }> }) {
  const [creating, setCreating] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/15 rounded-2xl p-8 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-black text-white">Revenda White Label</h2>
            <p className="text-sm text-white/50 mt-1">
              {program.resoldOrgs.length} {program.resoldOrgs.length === 1 ? "instância revendida" : "instâncias revendidas"}
              {" — "}
              <span className="text-white font-semibold">{formatCents(program.monthlyWholesaleTotalCents)}/mês</span> em preço de parceiro
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[rgb(var(--lz-brand-rgb))] to-[rgba(var(--lz-brand-rgb),0.8)] hover:opacity-90 rounded-xl font-bold text-[#0D0D0D] transition shrink-0"
          >
            <Plus size={16} /> Nova instância
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6">
          {program.wholesalePrices.map((w) => (
            <div key={w.planId} className="bg-white/[0.05] border border-white/10 rounded-lg px-4 py-3">
              <p className="text-[11px] font-bold uppercase text-white/40">{w.planName}</p>
              <p className="text-lg font-black text-white mt-0.5">{formatCents(w.wholesalePriceCents)}<span className="text-xs font-normal text-white/40">/mês</span></p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-white mb-3">Instâncias revendidas</h3>
        {program.resoldOrgs.length === 0 ? (
          <div className="border border-dashed border-white/10 rounded-lg p-10 text-center text-white/30 text-sm">
            Nenhuma instância criada ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {program.resoldOrgs.map((o) => (
              <div key={o.id} className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3">
                <Package size={16} className="text-white/40 shrink-0" />
                <span className="flex-1 min-w-0 text-sm text-white truncate">{o.name}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-white/40 shrink-0">{o.planName}</span>
                <span className="text-xs font-semibold text-white/60 shrink-0">{formatCents(o.wholesalePriceCents)}/mês</span>
                <button
                  onClick={() => setCancelTarget({ id: o.id, name: o.name })}
                  title="Cancelar instância"
                  className="p-1.5 rounded text-white/30 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {creating && <CreateResoldOrgModal onClose={() => setCreating(false)} wholesalePrices={program.wholesalePrices} />}
      {cancelTarget && <CancelResoldOrgModal target={cancelTarget} onClose={() => setCancelTarget(null)} />}
    </div>
  );
}

function CreateResoldOrgModal({ onClose, wholesalePrices }: {
  onClose: () => void;
  wholesalePrices: { planId: string; planName: string; wholesalePriceCents: number }[];
}) {
  const queryClient = useQueryClient();
  const { data: plans = [] } = useQuery({ queryKey: ["public-plans"], queryFn: () => getPublicPlans() });
  const [name, setName] = useState("");
  const [planId, setPlanId] = useState(wholesalePrices[0]?.planId ?? "");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");

  const create = useMutation({
    mutationFn: useServerFn(createResoldOrg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myResellerProgram"] });
      toast.success("Instância criada! Um e-mail de acesso foi enviado pro cliente.");
      onClose();
    },
    onError: (error: any) => toast.error(error?.message || "Erro ao criar instância."),
  });

  const retailPrice = plans.find((p: any) => p.id === planId)?.priceCents;

  function submit() {
    if (!name.trim() || !planId || !ownerName.trim() || !ownerEmail.trim()) {
      toast.error("Preencha todos os campos.");
      return;
    }
    create.mutate({ data: { name: name.trim(), planId, ownerName: ownerName.trim(), ownerEmail: ownerEmail.trim() } });
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#1C1C1C] border border-white/10 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-white">Nova instância revendida</span>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Nome do cliente/agência</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Studio Fulano"
              className="w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Plano</label>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)}
              className="w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]">
              {wholesalePrices.map((w) => <option key={w.planId} value={w.planId}>{w.planName} — {formatCents(w.wholesalePriceCents)}/mês (parceiro)</option>)}
            </select>
            {retailPrice != null && (
              <p className="text-[11px] text-white/35 mt-1">Preço de tabela pra esse plano: {formatCents(retailPrice)}/mês — você cobra do seu cliente o que quiser.</p>
            )}
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1">Nome de quem vai usar</label>
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
          {create.isPending ? "Criando..." : "Criar instância"}
        </button>
      </div>
    </div>
  );
}

function CancelResoldOrgModal({ target, onClose }: { target: { id: string; name: string }; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [confirmName, setConfirmName] = useState("");
  const matches = confirmName.trim().toLowerCase() === target.name.trim().toLowerCase();

  const cancel = useMutation({
    mutationFn: useServerFn(cancelResoldOrg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myResellerProgram"] });
      toast.success(`${target.name} cancelada.`);
      onClose();
    },
    onError: (error: any) => toast.error(error?.message || "Erro ao cancelar instância."),
  });

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#1C1C1C] border border-red-500/30 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle size={18} />
            <span className="text-sm font-bold text-white">Cancelar instância</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>

        <p className="text-sm text-white/70 mb-3">
          Isso apaga <span className="text-white font-semibold">{target.name}</span> e tudo dela — clientes, posts,
          arquivos, equipe — pra sempre, e para de contar na sua fatura mensal. Não tem como desfazer.
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
            onClick={() => cancel.mutate({ data: { orgId: target.id, confirmName } })}
            disabled={!matches || cancel.isPending}
            className="flex-1 px-6 py-3 bg-red-500/90 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition"
          >
            {cancel.isPending ? "Cancelando…" : "Cancelar pra sempre"}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-white/[0.08] hover:bg-white/[0.12] text-white font-bold rounded-xl transition border border-white/10"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
