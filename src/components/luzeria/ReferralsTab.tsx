import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { Copy, Loader2, Pencil, Check } from "lucide-react";
import { myReferralInfoQO, useApi } from "@/lib/luzeria/queries";

const STATUS_LABEL: Record<string, string> = {
  pending_validation: "Aguardando o amigo configurar a agência",
  validated: "Configurado — aguardando virar cliente pagante",
  pending_reactivation: "Crédito ganho — aguardando sua assinatura reativar",
  confirmed: "Confirmado — 1 mês grátis aplicado",
  expired: "Expirado (não completou a configuração a tempo)",
};
const STATUS_COLOR: Record<string, string> = {
  pending_validation: "rgba(255,255,255,0.5)",
  validated: "#4A9EFF",
  pending_reactivation: "#F59E0B",
  confirmed: "rgb(var(--lz-brand-rgb))",
  expired: "rgba(255,255,255,0.3)",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function ReferralsTab() {
  const { data, isLoading } = useQuery(myReferralInfoQO());
  const api = useApi();
  const [copied, setCopied] = useState(false);
  const [editingCode, setEditingCode] = useState(false);
  const [codeDraft, setCodeDraft] = useState("");

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-foreground/40" size={24} />
      </div>
    );
  }

  function copyLink() {
    if (!data!.referralLink) return;
    navigator.clipboard.writeText(data!.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function saveCode() {
    const code = codeDraft.trim().toLowerCase();
    if (!code) return;
    api.setMyReferralCode.mutate(
      { data: { code } },
      {
        onSuccess: () => { toast.success("Código atualizado."); setEditingCode(false); },
        onError: (e: any) => toastFriendlyError(e, "Erro ao salvar o código."),
      },
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-foreground/15 rounded-2xl p-8 backdrop-blur-sm">
        <p className="text-sm text-foreground/50 mb-6">
          Indique outra agência — quando a indicação for confirmada, você ganha 1 mês grátis (até 3
          acumulados). Seu amigo ganha 15 dias extras de teste.{" "}
          <a href="/programa-de-indicacao" target="_blank" rel="noopener noreferrer" className="underline text-[var(--lz-accent-ink)]">
            Ver regulamento completo
          </a>.
        </p>

        <div className="mb-6">
          <p className="text-xs font-bold uppercase text-foreground/40 mb-1">Seu link de indicação</p>
          {data.referralCode && !editingCode ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 px-3 py-2 bg-foreground/[0.08] border border-foreground/10 rounded-lg text-foreground text-sm truncate">
                {data.referralLink}
              </span>
              <button onClick={copyLink} className="p-2 text-foreground/40 hover:text-foreground hover:bg-foreground/[0.12] rounded-lg transition" title="Copiar link">
                <Copy size={16} />
              </button>
              <button
                onClick={() => { setCodeDraft(data.referralCode ?? ""); setEditingCode(true); }}
                className="p-2 text-foreground/40 hover:text-foreground hover:bg-foreground/[0.12] rounded-lg transition"
                title="Editar código"
              >
                <Pencil size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-foreground/40 text-sm">modocriador.com.br/r/</span>
              <input
                autoFocus
                value={codeDraft}
                onChange={(e) => setCodeDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="sua-agencia"
                className="flex-1 px-3 py-2 bg-foreground/[0.08] border border-foreground/10 rounded-lg text-foreground text-sm outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
              />
              <button
                onClick={saveCode}
                disabled={!codeDraft.trim() || api.setMyReferralCode.isPending}
                className="p-2 text-[var(--lz-accent-ink)] hover:bg-foreground/[0.12] rounded-lg transition disabled:opacity-30"
                title="Salvar"
              >
                <Check size={16} />
              </button>
            </div>
          )}
          {copied && <p className="text-xs text-[var(--lz-accent-ink)] mt-1">Copiado!</p>}
        </div>

        <div className="flex items-center gap-3 bg-foreground/[0.05] border border-foreground/10 rounded-xl px-5 py-4">
          <div className="text-3xl font-black text-[var(--lz-accent-ink)]">{data.balance}</div>
          <div className="text-sm text-foreground/60">
            {data.balance === 1 ? "mês grátis disponível" : "meses grátis disponíveis"}
            <br />
            <span className="text-xs text-foreground/40">aplicado automaticamente na próxima cobrança</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground/40 mb-3">Histórico de indicações</h3>
        {data.referrals.length === 0 ? (
          <p className="text-sm text-foreground/40">Você ainda não indicou nenhuma agência.</p>
        ) : (
          <div className="space-y-2">
            {data.referrals.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-3 bg-foreground/[0.03] border border-foreground/10 rounded-lg px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">{r.referredAgencyName}</div>
                  <div className="text-xs text-foreground/40">Indicado em {formatDate(r.createdAt)}</div>
                </div>
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full text-right shrink-0"
                  style={{ color: STATUS_COLOR[r.status], backgroundColor: "rgba(255,255,255,0.06)" }}
                >
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
