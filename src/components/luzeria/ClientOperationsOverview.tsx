import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LayoutGrid } from "lucide-react";
import { clientOperationsOverviewQO, useApi, useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import type { ClientOperationsRow } from "@/lib/luzeria/journey-stages.functions";

function daysAgoLabel(iso: string | null): string {
  if (!iso) return "nunca";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}

function dueLabel(iso: string | null): { text: string; overdue: boolean } {
  if (!iso) return { text: "—", overdue: false };
  const days = Math.floor((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: `atrasada há ${Math.abs(days)}d`, overdue: true };
  if (days === 0) return { text: "hoje", overdue: false };
  return { text: `em ${days}d`, overdue: false };
}

export function ClientOperationsOverview() {
  const me = useMe().data;
  if (!me) return null;
  const isAdmin = me.role === "master" || me.role === "setor";
  if (!isAdmin) {
    return <div className="p-10 text-white/60 text-sm">Acesso restrito à equipe da agência.</div>;
  }
  return <ClientOperationsOverviewContent />;
}

function ClientOperationsOverviewContent() {
  const { data: rows = [], isLoading } = useQuery(clientOperationsOverviewQO());
  const api = useApi();
  const { openFicha } = useUI();
  const [editingCadence, setEditingCadence] = useState<string | null>(null);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-2">
        <LayoutGrid size={16} className="text-[rgb(var(--lz-brand-rgb))]" />
        <h1 className="text-white font-semibold text-lg">Visão Geral</h1>
        <span className="text-white/40 text-sm">— {rows.length} clientes</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-white/40" size={32} /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 px-6 bg-white/[0.03] border border-white/10 rounded-2xl">
          <p className="text-white/50 text-sm">Nenhum cliente ativo encontrado.</p>
        </div>
      ) : (
        <div className="bg-[#161616] border border-white/[0.07] rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/60">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/60">Etapa atual</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-white/60">Última gravação</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-white/60">Próxima prevista</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-white/60">Cadência</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-white/60">Última análise</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const due = dueLabel(r.nextGravacaoDue);
                return (
                  <tr key={r.clientId} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-4 py-3 text-sm text-white">
                      <button onClick={() => openFicha(r.clientId)} className="flex items-center gap-2 hover:underline">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: r.clientColor }} />
                        {r.clientName}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {r.stageName ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold"
                          style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "rgb(var(--lz-brand-rgb))" }}>
                          {r.stageName}
                        </span>
                      ) : <span className="text-white/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70 text-right">{daysAgoLabel(r.lastGravacaoAt)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold" style={{ color: due.overdue ? "#FF6B6B" : "rgba(255,255,255,0.7)" }}>
                      {due.text}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {editingCadence === r.clientId ? (
                        <input
                          type="number" min="1" autoFocus defaultValue={r.gravacaoCadenceDays ?? ""}
                          onBlur={(e) => {
                            const val = e.target.value.trim();
                            api.setClientGravacaoCadence.mutate({ data: { clientId: r.clientId, days: val === "" ? null : Number(val) } });
                            setEditingCadence(null);
                          }}
                          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          className="w-16 bg-[#1C1C1C] border border-white/10 rounded px-2 py-1 text-xs text-white text-right outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
                        />
                      ) : (
                        <button onClick={() => setEditingCadence(r.clientId)} className="text-white/70 hover:text-white hover:underline">
                          {r.gravacaoCadenceDays ? `${r.gravacaoCadenceDays}d` : "definir"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70 text-right">{daysAgoLabel(r.lastAnaliseAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
