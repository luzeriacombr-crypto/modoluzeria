import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { clientsQO, monthQO } from "@/lib/luzeria/queries";
import { STATUS_META, STATUS_ORDER, type Status } from "@/lib/luzeria/types";
import { useUI } from "@/lib/luzeria/ui-store";
import { Avatar } from "./Avatar";

export function Dashboard({ onCreate }: { onCreate: () => void }) {
  const { data: clients = [] } = useQuery(clientsQO());
  const active = clients.filter((c) => !c.archived);

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-10">
        <div>
          <h1 className="text-[40px] font-extrabold text-white leading-none tracking-tight">Visão Geral</h1>
          <p className="text-sm text-white/50 mt-3">
            <span className="font-bold text-[#C8D44E]">{active.length}</span>{" "}
            {active.length === 1 ? "cliente ativo" : "clientes ativos"}
          </p>
        </div>
        <button onClick={onCreate}
          className="lz-btn-primary inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm">
          <Plus size={16} /> Novo cliente
        </button>
      </div>

      {active.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-lg p-16 text-center">
          <p className="text-white/50 text-sm">Nenhum cliente cadastrado.</p>
          <button onClick={onCreate} className="mt-4 text-[#C8D44E] text-sm hover:underline">+ Criar primeiro cliente</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {active.map((c) => <ClientCard key={c.id} clientId={c.id} />)}
        </div>
      )}
    </div>
  );
}

function ClientCard({ clientId }: { clientId: string }) {
  const { data: clients = [] } = useQuery(clientsQO());
  const client = clients.find((c) => c.id === clientId);
  const monthKey = useUI((s) => s.selectedMonthKey);
  const { data: month } = useQuery(monthQO(clientId, monthKey));
  const { selectClient } = useUI();

  if (!client) return null;

  const items = [...(month?.posts ?? []), ...(month?.reels ?? [])];
  const total = items.length;
  const done = items.filter((i) => i.status === "FINALIZADO").length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const counts: Record<Status, number> = { START: 0, CRIACAO: 0, REVISAO_ARTE: 0, REVISAO_CLIENTE: 0, FINALIZADO: 0 };
  items.forEach((i) => { counts[i.status]++; });

  return (
    <button onClick={() => selectClient(clientId)}
      className="group text-left rounded-lg p-5 bg-[#1C1C1C] transition-all duration-200 hover:-translate-y-0.5 relative overflow-hidden"
      style={{ borderTop: `3px solid ${client.color}` }}
      onMouseEnter={(e) => e.currentTarget.style.borderTopColor = "#C8D44E"}
      onMouseLeave={(e) => e.currentTarget.style.borderTopColor = client.color}
    >
      <div className="flex items-start gap-3 mb-4">
        <Avatar name={client.name} color={client.color} size={40} />
        <div className="min-w-0 flex-1">
          <div className="text-[18px] font-bold text-white truncate leading-tight">{client.name}</div>
          {client.customFields.niche && (
            <div className="text-[12px] text-white/50 truncate mt-0.5">{client.customFields.niche}</div>
          )}
        </div>
        <ProgressRing pct={pct} />
      </div>
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">{formatMonth(monthKey)}</div>
      <div className="flex flex-wrap gap-1.5">
        {STATUS_ORDER.map((s) => {
          const m = STATUS_META[s];
          return (
            <span key={s} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{ backgroundColor: m.bg, color: m.color, opacity: counts[s] ? 1 : 0.35 }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: m.color }} />
              {counts[s]}
            </span>
          );
        })}
      </div>
    </button>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const size = 44, stroke = 4, r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gid = `pr-${Math.round(pct * 1000)}-${size}`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C8D44E" />
            <stop offset="100%" stopColor="#8FA832" />
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke={`url(#${gid})`} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct/100)} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-white">{pct}%</div>
    </div>
  );
}

export function formatMonth(key: string) {
  const [y, m] = key.split("-").map(Number);
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${months[m - 1]} ${y}`;
}