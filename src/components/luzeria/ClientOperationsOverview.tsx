import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, LayoutGrid, List, Columns3, Info } from "lucide-react";
import { clientOperationsOverviewQO, useApi, useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import type { ClientOperationsRow } from "@/lib/luzeria/journey-stages.functions";
import { InfoTip } from "./InfoTip";

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
    return <div className="p-10 text-foreground/60 text-sm">Acesso restrito à equipe da agência.</div>;
  }
  return <ClientOperationsOverviewContent />;
}

function IntroBanner() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="text-xs text-foreground/60 leading-relaxed bg-foreground/[0.03] border border-foreground/10 rounded-lg px-4 py-3">
      {expanded ? (
        <div className="space-y-2">
          <p>
            Essa tela junta, num só lugar, o ciclo operacional de cada cliente ativo com operação recorrente — clientes{" "}
            <span className="text-foreground/80 font-medium">Avulsos</span> não entram aqui, já que são trabalhos pontuais sem
            ciclo mensal de gravação.
          </p>
          <p>
            A <span className="text-foreground/80 font-medium">última gravação</span> e a quantidade de{" "}
            <span className="text-foreground/80 font-medium">vídeos gravados</span> são puxadas automaticamente da atividade de
            Gravação mais recente registrada em <span className="text-foreground/80 font-medium">Mais Atividades</span> de cada
            cliente — se um cliente aparece em branco, é só cadastrar a gravação dele por lá que a informação aparece aqui
            sozinha. A <span className="text-foreground/80 font-medium">próxima gravação prevista</span> é calculada sozinha
            comparando isso com a meta mensal de vídeos do cliente (campo "Reels / mês" na Configuração do cliente, dentro da
            Ficha) — quem grava exatamente a meta volta em 30 dias; quem grava mais fica com mais folga, quem grava menos volta
            mais cedo.
          </p>
          <p>
            Já a <span className="text-foreground/80 font-medium">última análise do mês</span> vem da{" "}
            <span className="text-foreground/80 font-medium">Jornada do cliente</span> — pra isso funcionar, marque em{" "}
            <span className="text-foreground/80 font-medium">Configurações → Cliente → Jornada</span> qual etapa representa
            "Análise do mês" (passe o mouse ou toque no <Info size={10} className="inline -mt-0.5" /> de cada coluna abaixo
            pra entender o que ela mostra). Se não for útil pra sua agência, dá pra desligar em{" "}
            <span className="text-foreground/80 font-medium">Configurações → Geral</span>, na seção de recursos opcionais.
          </p>
          <button
            onClick={() => setExpanded(false)}
            className="text-[var(--lz-accent-ink)] font-semibold hover:underline"
          >
            Ver menos
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <p className="truncate flex-1 min-w-0">
            Ciclo operacional de cada cliente ativo — última gravação, próxima prevista e última análise do mês, tudo automático.
          </p>
          <button
            onClick={() => setExpanded(true)}
            className="shrink-0 text-[var(--lz-accent-ink)] font-semibold hover:underline"
          >
            Ver mais
          </button>
        </div>
      )}
    </div>
  );
}

function ClientOperationsOverviewContent() {
  const { data: rows = [], isLoading } = useQuery(clientOperationsOverviewQO());
  const { openFicha } = useUI();
  const [view, setView] = useState<"lista" | "quadro">("quadro");

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <div className="flex items-center gap-2">
        <LayoutGrid size={16} className="text-[var(--lz-accent-ink)]" />
        <h1 className="text-foreground font-semibold text-lg">Visão Geral</h1>
        <span className="text-foreground/40 text-sm">— {rows.length} clientes</span>
        <div className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-foreground/[0.05] p-0.5">
          <button
            onClick={() => setView("quadro")}
            title="Quadro"
            className="h-7 w-7 rounded-full flex items-center justify-center transition-colors"
            style={{
              backgroundColor: view === "quadro" ? "rgb(var(--lz-brand-rgb))" : "transparent",
              color: view === "quadro" ? "#0D0D0D" : "color-mix(in srgb, var(--foreground) 50%, transparent)",
            }}
          ><Columns3 size={13} /></button>
          <button
            onClick={() => setView("lista")}
            title="Lista"
            className="h-7 w-7 rounded-full flex items-center justify-center transition-colors"
            style={{
              backgroundColor: view === "lista" ? "rgb(var(--lz-brand-rgb))" : "transparent",
              color: view === "lista" ? "#0D0D0D" : "color-mix(in srgb, var(--foreground) 50%, transparent)",
            }}
          ><List size={13} /></button>
        </div>
      </div>

      <IntroBanner />

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-foreground/40" size={32} /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 px-6 bg-foreground/[0.03] border border-foreground/10 rounded-2xl">
          <p className="text-foreground/50 text-sm">Nenhum cliente ativo encontrado.</p>
        </div>
      ) : view === "quadro" ? (
        <StageBoard rows={rows} onOpenClient={openFicha} />
      ) : (
        <div className="bg-card border border-foreground/7 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-foreground/7">
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/60">
                  <span className="inline-flex items-center gap-1">
                    Cliente
                    <InfoTip text="Nome do cliente. Clique pra abrir a ficha completa dele, com todos os detalhes." />
                  </span>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/60">
                  <span className="inline-flex items-center gap-1">
                    Etapa atual
                    <InfoTip text="Em qual etapa da Jornada do Cliente esse cliente está agora — a mesma configurada em Configurações → Cliente → Jornada." />
                  </span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/60">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <InfoTip text="Data da atividade de Gravação mais recente registrada em Mais Atividades pra esse cliente. Puxada automaticamente — se estiver em branco, cadastre a gravação em Mais Atividades." />
                    Última gravação
                  </span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/60">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <InfoTip text="Soma da quantidade de vídeos registrados em Mais Atividades (seção Gravação) no mês da última gravação, sobre a meta mensal do cliente (campo 'Reels / mês' na ficha, ou 6 se não estiver configurado). Puxado automaticamente." />
                    Vídeos gravados
                  </span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/60">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <InfoTip text="Calculada a partir de quantos meses de meta os vídeos gravados cobrem: gravou exatamente a meta = 30 dias; gravou mais = prazo maior (banco de vídeos); gravou menos = prazo menor. Fica vermelho quando já passou do prazo." />
                    Próxima prevista
                  </span>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/60">
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
                  <tr key={r.clientId} className="border-b border-foreground/4 last:border-0">
                    <td className="px-4 py-3 text-sm text-foreground">
                      <button onClick={() => openFicha(r.clientId)} className="flex items-center gap-2 hover:underline">
                        <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: r.clientColor }} />
                        {r.clientName}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {r.stageName ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold"
                          style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
                          {r.stageName}
                        </span>
                      ) : <span className="text-foreground/30">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground/70 text-right">
                      {r.lastGravacaoAt ? `${formatDateBR(r.lastGravacaoAt)} (${daysAgoLabel(r.lastGravacaoAt)})` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground/70 text-right">
                      {r.lastGravacaoAt ? `${r.gravacaoVideoCount ?? 0} / ${r.gravacaoMonthlyTarget}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold" style={{ color: due.overdue ? "#FF6B6B" : "color-mix(in srgb, var(--foreground) 70%, transparent)" }}>
                      {due.text}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground/70 text-right">{daysAgoLabel(r.lastAnaliseAt)}</td>
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

const NO_STAGE_KEY = "__sem_etapa__";

/** Quadro macro — mesma ideia da Dom (ver raio-x), adaptada pro que o Modo
 * Criador já tinha: a "Visão Geral" já juntava todos os clientes ativos
 * numa tela só, só faltava agrupar visualmente por etapa (pra responder
 * "quem tá em Revisão agora?" num olhar) e permitir arrastar pra mudar de
 * etapa direto daqui, sem abrir a ficha de cada cliente. Pedido do Junior
 * (02/10). */
function StageBoard({ rows, onOpenClient }: { rows: ClientOperationsRow[]; onOpenClient: (id: string) => void }) {
  const { setClientStage } = useApi();
  const qc = useQueryClient();
  const [dragClientId, setDragClientId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const columns = new Map<string, { key: string; stageId: string | null; name: string; sortKey: number; rows: ClientOperationsRow[] }>();
  for (const r of rows) {
    const key = r.stageId ?? NO_STAGE_KEY;
    if (!columns.has(key)) {
      columns.set(key, {
        key, stageId: r.stageId, name: r.stageName ?? "Sem etapa",
        sortKey: r.stageId ? (r.stageTrack === "onboarding" ? 0 : 1000) + (r.stageSortOrder ?? 0) : 9999,
        rows: [],
      });
    }
    columns.get(key)!.rows.push(r);
  }
  const sortedColumns = [...columns.values()].sort((a, b) => a.sortKey - b.sortKey);

  function drop(stageId: string | null) {
    if (!dragClientId || !stageId) { setDragClientId(null); setOverKey(null); return; }
    setClientStage.mutate(
      { data: { clientId: dragClientId, stageId } },
      { onSettled: () => qc.invalidateQueries({ queryKey: ["client-operations-overview"] }) },
    );
    setDragClientId(null);
    setOverKey(null);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {sortedColumns.map((col) => (
        <div
          key={col.key}
          onDragOver={(e) => { if (col.stageId) { e.preventDefault(); setOverKey(col.key); } }}
          onDragLeave={() => { if (overKey === col.key) setOverKey(null); }}
          onDrop={() => drop(col.stageId)}
          className="shrink-0 w-[260px] rounded-xl p-2.5"
          style={{
            background: overKey === col.key ? "rgba(var(--lz-brand-rgb),0.08)" : "color-mix(in srgb, var(--foreground) 3%, transparent)",
            border: overKey === col.key ? "1px dashed rgba(var(--lz-brand-rgb),0.5)" : "1px solid transparent",
          }}
        >
          <div className="flex items-center justify-between px-1.5 py-1 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-foreground/50 truncate">{col.name}</span>
            <span className="text-[10px] font-bold text-foreground/30 shrink-0 ml-1.5">{col.rows.length}</span>
          </div>
          <div className="space-y-1.5">
            {col.rows.map((r) => (
              <button
                key={r.clientId}
                draggable
                onDragStart={() => setDragClientId(r.clientId)}
                onDragEnd={() => { setDragClientId(null); setOverKey(null); }}
                onClick={() => onOpenClient(r.clientId)}
                className="w-full text-left rounded-lg px-2.5 py-2 bg-card border border-foreground/7 hover:border-foreground/20 transition-colors cursor-grab active:cursor-grabbing"
                style={{ opacity: dragClientId === r.clientId ? 0.4 : 1 }}
              >
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: r.clientColor }} />
                  <span className="text-[13px] text-foreground truncate">{r.clientName}</span>
                </div>
                {r.currentStageEnteredAt && (
                  <div className="text-[10px] text-foreground/35 mt-1 ml-3.5">nessa etapa {daysAgoLabel(r.currentStageEnteredAt)}</div>
                )}
              </button>
            ))}
            {col.rows.length === 0 && <p className="text-[11px] text-foreground/25 px-1.5 py-2">Nenhum cliente</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
