import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ClipboardCheck, ChevronDown, ChevronRight, Info } from "lucide-react";
import { profilesQO, productionAuditQO } from "@/lib/luzeria/queries";
import { InfoTip } from "./InfoTip";

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Reconstrói, sob demanda e pra qualquer editor/mês, a mesma comparação
 * "planilha dele vs Modo Criador" que já fizemos na mão pro Calebe em
 * agosto — sem precisar rodar consulta nenhuma de novo. O número da
 * planilha é digitado aqui mesmo (a planilha em si vive fora do app),
 * o resto é ao vivo. */
export function ProductionAuditTab() {
  const { data: profiles = [] } = useQuery(profilesQO());
  const [userId, setUserId] = useState<string>("");
  const [monthKey, setMonthKey] = useState<string>(currentMonthKey());
  const [sheetNumber, setSheetNumber] = useState<string>("");

  const { data, isLoading } = useQuery(productionAuditQO(userId || null, monthKey));

  const activeProfiles = useMemo(() => profiles.filter((p) => p.active), [profiles]);
  const sheetN = sheetNumber === "" ? null : Number(sheetNumber);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-foreground/60 text-[11px] uppercase tracking-wider font-bold">
        <ClipboardCheck size={13} /> Auditoria de Produção
      </div>
      <p className="text-xs text-foreground/50 leading-relaxed max-w-2xl">
        Compara o que o Modo Criador contou de vídeos editados/finalizados por uma pessoa num mês com o
        número que ela registrou por fora (planilha própria, controle manual). Duas contagens, pela data
        real da ação — não pelo mês do calendário de conteúdo do item, então um vídeo do lote seguinte
        que ela já adiantou conta como produção do mês em que foi editado/aprovado.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-foreground/40 mb-1">Pessoa</label>
          <select value={userId} onChange={(e) => setUserId(e.target.value)}
            className="bg-card border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] min-w-[200px]">
            <option value="">Selecione…</option>
            {activeProfiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-foreground/40 mb-1">Mês</label>
          <input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)}
            className="bg-card border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-bold tracking-wider text-foreground/40 mb-1 inline-flex items-center gap-1">
            Número da planilha dela
            <InfoTip text="Digite aqui o que a pessoa registrou por fora (planilha própria), só pra comparar visualmente com o que o Modo Criador contou. Não é salvo em lugar nenhum." />
          </label>
          <input type="number" value={sheetNumber} onChange={(e) => setSheetNumber(e.target.value)}
            placeholder="ex: 87"
            className="bg-card border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] w-32" />
        </div>
      </div>

      {!userId ? (
        <div className="text-center py-14 px-6 bg-foreground/[0.03] border border-foreground/10 rounded-2xl">
          <p className="text-foreground/50 text-sm">Escolha uma pessoa pra ver a produção de {formatMonthLabel(monthKey)}.</p>
        </div>
      ) : isLoading || !data ? (
        <div className="flex items-center justify-center py-14"><Loader2 className="animate-spin text-foreground/40" size={28} /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Editados (Modo Criador)" value={data.edited.total} />
            <StatCard label="Finalizados (Modo Criador)" value={data.finalized.total} />
            <StatCard
              label="Diferença vs. planilha"
              value={sheetN == null ? "—" : data.edited.total - sheetN}
              tone={sheetN == null ? undefined : data.edited.total - sheetN === 0 ? "good" : "warn"}
            />
          </div>

          <AuditTable title="Editados por cliente" rows={data.edited.byClient} />
          <AuditTable title="Finalizados por cliente" rows={data.finalized.byClient} />
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number | string; tone?: "good" | "warn" }) {
  const color = tone === "good" ? "#4FD98A" : tone === "warn" ? "#F4C15C" : "var(--foreground)";
  return (
    <div className="bg-card border border-foreground/7 rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-wider font-bold text-foreground/50">{label}</div>
      <div className="text-2xl font-extrabold tabular-nums mt-1" style={{ color }}>{value}</div>
    </div>
  );
}

function AuditTable({ title, rows }: { title: string; rows: { clientId: string; clientName: string; clientColor: string; count: number; items: { id: string; title: string; date: string }[] }[] }) {
  const [openClient, setOpenClient] = useState<string | null>(null);
  if (rows.length === 0) {
    return (
      <div>
        <h3 className="text-xs font-semibold text-foreground/70 mb-2">{title}</h3>
        <p className="text-xs text-foreground/40">Nada nesse período.</p>
      </div>
    );
  }
  return (
    <div>
      <h3 className="text-xs font-semibold text-foreground/70 mb-2">{title}</h3>
      <div className="bg-card border border-foreground/7 rounded-xl overflow-hidden">
        {rows.map((r) => (
          <div key={r.clientId} className="border-b border-foreground/4 last:border-0">
            <button
              onClick={() => setOpenClient((c) => (c === r.clientId ? null : r.clientId))}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-foreground/[0.03] transition-colors"
            >
              {openClient === r.clientId ? <ChevronDown size={13} className="text-foreground/40 shrink-0" /> : <ChevronRight size={13} className="text-foreground/40 shrink-0" />}
              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: r.clientColor }} />
              <span className="text-sm text-foreground flex-1 truncate">{r.clientName}</span>
              <span className="text-sm font-bold tabular-nums text-foreground/70">{r.count}</span>
            </button>
            {openClient === r.clientId && (
              <div className="px-4 pb-3 pl-9 space-y-1">
                {r.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 text-[12px] text-foreground/60 py-1">
                    <span className="truncate">{it.title}</span>
                    <span className="text-foreground/35 shrink-0">{new Date(it.date).toLocaleDateString("pt-BR")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
