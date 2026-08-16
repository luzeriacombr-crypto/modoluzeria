import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LayoutGrid, Info } from "lucide-react";
import { clientOperationsOverviewQO, useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import type { ClientOperationsRow } from "@/lib/luzeria/journey-stages.functions";

const TOOLTIP_WIDTH = 224;

/** "i" que mostra a explicação no hover (desktop) ou no toque/clique (mobile) —
 * pensado pra cabeçalhos de coluna cujo significado não é óbvio de bater o olho.
 * Usa portal + posição calculada da tela (não do pai) pra nunca cortar em
 * colunas perto da borda nem ficar preso pelo overflow-x-auto da tabela. */
function InfoTip({ text }: { text: string }) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  function computeAndShow() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const margin = 8;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2, margin),
      window.innerWidth - TOOLTIP_WIDTH - margin,
    );
    setCoords({ top: rect.bottom + 6, left });
  }

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={computeAndShow}
      onMouseLeave={() => setCoords(null)}
    >
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); coords ? setCoords(null) : computeAndShow(); }}
        className="inline-flex items-center justify-center text-white/30 hover:text-[rgb(var(--lz-brand-rgb))] transition-colors"
      >
        <Info size={11} />
      </button>
      {coords && createPortal(
        <div
          style={{ position: "fixed", top: coords.top, left: coords.left, width: TOOLTIP_WIDTH }}
          className="z-[999] rounded-md border border-white/10 bg-[#1C1C1C] px-3 py-2 text-[11px] font-normal leading-relaxed text-white/70 shadow-xl normal-case tracking-normal"
          onClick={(e) => e.stopPropagation()}
        >
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}

function daysAgoLabel(iso: string | null): string {
  if (!iso) return "nunca";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "hoje";
  if (days === 1) return "há 1 dia";
  return `há ${days} dias`;
}

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
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
  const { openFicha } = useUI();

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-2">
        <LayoutGrid size={16} className="text-[rgb(var(--lz-brand-rgb))]" />
        <h1 className="text-white font-semibold text-lg">Visão Geral</h1>
        <span className="text-white/40 text-sm">— {rows.length} clientes</span>
      </div>

      <div className="text-xs text-white/60 leading-relaxed bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3">
        Essa tela junta, num só lugar, o ciclo operacional de cada cliente ativo com operação recorrente — clientes{" "}
        <span className="text-white/80 font-medium">Avulsos</span> não entram aqui, já que são trabalhos pontuais sem ciclo
        mensal de gravação. A{" "}
        <span className="text-white/80 font-medium">última gravação</span> e a quantidade de{" "}
        <span className="text-white/80 font-medium">vídeos gravados</span> são puxadas automaticamente da atividade de Gravação
        mais recente registrada em <span className="text-white/80 font-medium">Mais Atividades</span> de cada cliente — se um
        cliente aparece em branco, é só cadastrar a gravação dele por lá que a informação aparece aqui sozinha. A{" "}
        <span className="text-white/80 font-medium">próxima gravação prevista</span> é calculada sozinha comparando isso com a
        meta mensal de vídeos do cliente (campo "Reels / mês" na Configuração do cliente, dentro da Ficha) — quem grava exatamente
        a meta volta em 30 dias; quem grava mais fica com mais folga, quem grava menos volta mais cedo. Já a{" "}
        <span className="text-white/80 font-medium">última análise do mês</span> vem da <span className="text-white/80 font-medium">Jornada do cliente</span> —
        pra isso funcionar, marque em <span className="text-white/80 font-medium">Configurações → Jornada do cliente</span> qual
        etapa representa "Análise do mês" (passe o mouse ou toque no <Info size={10} className="inline -mt-0.5" /> de cada coluna
        abaixo pra entender o que ela mostra). Se não for útil pra sua agência, dá pra desligar em <span className="text-white/80 font-medium">Configurações → Geral</span>,
        na seção de recursos opcionais.
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/60">
                  <span className="inline-flex items-center gap-1">
                    Cliente
                    <InfoTip text="Nome do cliente. Clique pra abrir a ficha completa dele, com todos os detalhes." />
                  </span>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/60">
                  <span className="inline-flex items-center gap-1">
                    Etapa atual
                    <InfoTip text="Em qual etapa da Jornada do Cliente esse cliente está agora — a mesma configurada em Configurações → Jornada do cliente." />
                  </span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-white/60">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <InfoTip text="Data da atividade de Gravação mais recente registrada em Mais Atividades pra esse cliente. Puxada automaticamente — se estiver em branco, cadastre a gravação em Mais Atividades." />
                    Última gravação
                  </span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-white/60">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <InfoTip text="Soma da quantidade de vídeos registrados em Mais Atividades (seção Gravação) no mês da última gravação, sobre a meta mensal do cliente (campo 'Reels / mês' na ficha, ou 6 se não estiver configurado). Puxado automaticamente." />
                    Vídeos gravados
                  </span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-white/60">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <InfoTip text="Calculada a partir de quantos meses de meta os vídeos gravados cobrem: gravou exatamente a meta = 30 dias; gravou mais = prazo maior (banco de vídeos); gravou menos = prazo menor. Fica vermelho quando já passou do prazo." />
                    Próxima prevista
                  </span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-white/60">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <InfoTip text="Há quantos dias o cliente esteve, pela última vez, na etapa marcada como 'Análise do mês' na Jornada." />
                    Última análise
                  </span>
                </th>
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
                    <td className="px-4 py-3 text-sm text-white/70 text-right">
                      {r.lastGravacaoAt ? `${formatDateBR(r.lastGravacaoAt)} (${daysAgoLabel(r.lastGravacaoAt)})` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/70 text-right">
                      {r.lastGravacaoAt ? `${r.gravacaoVideoCount ?? 0} / ${r.gravacaoMonthlyTarget}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold" style={{ color: due.overdue ? "#FF6B6B" : "rgba(255,255,255,0.7)" }}>
                      {due.text}
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
