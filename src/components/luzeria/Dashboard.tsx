import { useLuzeria } from "@/lib/luzeria/store";
import { Avatar } from "./Avatar";
import { STATUS_META, STATUS_ORDER } from "@/lib/luzeria/types";
import { formatMonth, currentMonthKey } from "@/lib/luzeria/utils";
import { ArrowRight, Plus } from "lucide-react";

interface Props {
  onNewClient: () => void;
}

export function Dashboard({ onNewClient }: Props) {
  const allClients = useLuzeria((s) => s.clients);
  const selectClient = useLuzeria((s) => s.selectClient);
  const clients = allClients.filter((c) => !c.archived);

  return (
    <div className="mx-auto w-full max-w-6xl px-10 py-12">
      <div className="mb-10 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Visão geral
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {clients.length} {clients.length === 1 ? "cliente ativo" : "clientes ativos"}
          </p>
        </div>
        <button
          onClick={onNewClient}
          className="inline-flex items-center gap-2 rounded bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Plus size={14} />
          Novo cliente
        </button>
      </div>

      {clients.length === 0 ? (
        <EmptyState onNewClient={onNewClient} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => {
            const monthKeys = Object.keys(c.months).sort();
            const latestKey = monthKeys[monthKeys.length - 1] ?? currentMonthKey();
            const month = c.months[latestKey];
            const items = month ? [...month.posts, ...month.reels] : [];
            const counts = STATUS_ORDER.map(
              (s) => items.filter((i) => i.status === s).length
            );
            const finalized = counts[STATUS_ORDER.indexOf("FINALIZADO")];
            const pct = items.length ? Math.round((finalized / items.length) * 100) : 0;

            return (
              <button
                key={c.id}
                onClick={() => selectClient(c.id)}
                className="group flex flex-col gap-5 rounded-lg border border-transparent bg-card p-5 text-left transition-all duration-150 hover:border-primary/60"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      name={c.name}
                      color={c.color}
                      icon={c.icon}
                      size={32}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">
                        {c.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatMonth(latestKey)}
                      </div>
                    </div>
                  </div>
                  <ArrowRight
                    size={14}
                    className="text-muted-foreground opacity-0 transition group-hover:opacity-100"
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>Finalizado</span>
                    <span className="font-semibold text-white">{pct}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {STATUS_ORDER.map((s, i) => {
                    const meta = STATUS_META[s];
                    const n = counts[i];
                    return (
                      <div key={s} className="flex items-center gap-1.5" title={`${meta.label}: ${n}`}>
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: meta.color }}
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {n}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onNewClient }: { onNewClient: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-white/10 py-24">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
        <Plus size={20} className="text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-white">Sem clientes ainda</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Crie o primeiro cliente para começar.
      </p>
      <button
        onClick={onNewClient}
        className="mt-6 rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
      >
        Novo cliente
      </button>
    </div>
  );
}