import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle, Check, Undo2 } from "lucide-react";
import { clientPaymentsQO, useApi, useMe } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import type { ClientPaymentRow } from "@/lib/luzeria/client-payments.functions";

const money = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const inp = "w-full bg-[#1C1C1C] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))] transition-colors";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
}

function daysUntil(iso: string): number {
  const due = new Date(iso + "T00:00:00").getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((due - today.getTime()) / 86400000);
}

function waLink(phone: string | null, text: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}

function buildPaymentMessage(row: ClientPaymentRow, pixKey: string | null): string {
  const lines = [
    `Olá! Passando pra lembrar do pagamento referente a esse mês, com vencimento em ${formatDate(row.nextDueDate)}.`,
    "",
    `📋 Resumo do mês: ${row.postsDoneThisMonth} publicaç${row.postsDoneThisMonth === 1 ? "ão feita" : "ões feitas"}.`,
  ];
  if (row.contractValue != null) lines.push("", `💰 Valor: ${money(row.contractValue)}`);
  if (pixKey) lines.push("", `Chave Pix pra pagamento: ${pixKey}`);
  return lines.join("\n");
}

function PixKeyForm({ pixKey, isMaster }: { pixKey: string | null; isMaster: boolean }) {
  const api = useApi();
  const [value, setValue] = useState(pixKey ?? "");
  useEffect(() => setValue(pixKey ?? ""), [pixKey]);
  if (!isMaster) return null;
  return (
    <div className="bg-[#161616] border border-white/[0.07] rounded-xl p-4">
      <label className="text-xs text-white/50 mb-1.5 block">Chave Pix da agência (vai junto na cobrança pro cliente)</label>
      <div className="flex items-center gap-2">
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex: contato@suaagencia.com.br" className={inp} />
        <button
          onClick={() => api.setOrgPixKey.mutate({ data: { pixKey: value.trim() || null } })}
          disabled={api.setOrgPixKey.isPending}
          className="shrink-0 rounded-md px-4 py-2 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          {api.setOrgPixKey.isPending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}

export function ClientPaymentsPanel() {
  const me = useMe().data;
  const isMaster = me?.role === "master";
  const { data, isLoading } = useQuery(clientPaymentsQO());
  const api = useApi();
  const period = currentPeriod();

  if (isLoading || !data) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-white/40" size={24} /></div>;
  }

  const rows = [...data.clients].sort((a, b) => daysUntil(a.nextDueDate) - daysUntil(b.nextDueDate));

  return (
    <div className="space-y-4">
      <PixKeyForm pixKey={data.pixKey} isMaster={isMaster} />

      {rows.length === 0 ? (
        <div className="text-center py-12 text-sm text-white/40">
          Nenhum cliente com dia de vencimento cadastrado ainda. Configure em Ficha do Cliente → Configuração.
        </div>
      ) : (
        <div className="bg-[#161616] border border-white/[0.07] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-white/40 border-b border-white/[0.07]">
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Vencimento</th>
                <th className="px-4 py-3 font-semibold">Valor</th>
                <th className="px-4 py-3 font-semibold">Posts no mês</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const days = daysUntil(r.nextDueDate);
                const overdue = days < 0 && !r.paidThisPeriod;
                const dueSoon = days >= 0 && days <= 7 && !r.paidThisPeriod;
                const wa = waLink(r.whatsappPhone, buildPaymentMessage(r, data.pixKey));
                return (
                  <tr key={r.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="px-4 py-3 text-white font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-white/70">
                      {formatDate(r.nextDueDate)}
                      {overdue && <span className="ml-1.5 text-[10px] font-bold text-red-400">ATRASADO</span>}
                      {dueSoon && <span className="ml-1.5 text-[10px] font-bold" style={{ color: "#F5A623" }}>EM {days}D</span>}
                    </td>
                    <td className="px-4 py-3 text-white/70">{money(r.contractValue)}</td>
                    <td className="px-4 py-3 text-white/70">{r.postsDoneThisMonth}</td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded"
                        style={r.paidThisPeriod
                          ? { backgroundColor: "rgba(91,168,138,0.15)", color: "#5BA88A" }
                          : { backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
                      >
                        {r.paidThisPeriod ? "Em dia" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {wa && (
                          <a href={wa} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded text-white/40 hover:text-[#5BA88A] hover:bg-white/5" title="Enviar cobrança pelo WhatsApp">
                            <MessageCircle size={15} />
                          </a>
                        )}
                        {r.paidThisPeriod ? (
                          <button
                            onClick={async () => { if (await requestConfirm(`Desfazer o pagamento de ${r.name} nesse mês?`)) api.unmarkClientPaymentReceived.mutate({ data: { clientId: r.id, period } }); }}
                            className="p-1.5 rounded text-white/40 hover:text-white hover:bg-white/5" title="Desfazer marcação"
                          >
                            <Undo2 size={15} />
                          </button>
                        ) : (
                          <button
                            onClick={() => api.markClientPaymentReceived.mutate({ data: { clientId: r.id, period } })}
                            className="p-1.5 rounded text-white/40 hover:text-[#5BA88A] hover:bg-white/5" title="Marcar pagamento recebido"
                          >
                            <Check size={15} />
                          </button>
                        )}
                      </div>
                    </td>
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
