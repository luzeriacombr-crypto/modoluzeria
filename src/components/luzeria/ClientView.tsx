import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Plus } from "lucide-react";
import { useLuzeria } from "@/lib/luzeria/store";
import { ContentRow } from "./ContentRow";
import { Avatar } from "./Avatar";
import { formatMonth, shortMonth } from "@/lib/luzeria/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "posts" | "reels" | "profile";

export function ClientView() {
  const selectedClientId = useLuzeria((s) => s.selectedClientId);
  const selectedMonthKey = useLuzeria((s) => s.selectedMonthKey);
  const clients = useLuzeria((s) => s.clients);
  const openItem = useLuzeria((s) => s.openItem);
  const selectMonth = useLuzeria((s) => s.selectMonth);
  const duplicateMonth = useLuzeria((s) => s.duplicateMonth);

  const [tab, setTab] = useState<Tab>("posts");

  const client = clients.find((c) => c.id === selectedClientId) ?? null;

  const monthKeys = useMemo(() => {
    if (!client) return [];
    return Object.keys(client.months).sort();
  }, [client]);

  if (!client) return null;
  const month = client.months[selectedMonthKey];

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-10 pt-8 pb-5">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-3">
            <Avatar name={client.name} color={client.color} icon={client.icon} size={36} />
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white">
                {client.name}
              </h1>
              {client.customFields.niche && (
                <p className="text-xs text-muted-foreground">
                  {client.customFields.niche}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => {
              duplicateMonth(client.id, selectedMonthKey);
              toast.success("Mês duplicado");
            }}
            className="inline-flex items-center gap-1.5 rounded bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/10"
          >
            <Copy size={12} />
            Duplicar mês
          </button>
        </div>

        {/* Month pills */}
        <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
          <MonthArrow direction="prev" />
          {monthKeys.map((key) => (
            <button
              key={key}
              onClick={() => selectMonth(key)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition",
                key === selectedMonthKey
                  ? "bg-primary text-primary-foreground"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white"
              )}
            >
              {shortMonth(key)}
            </button>
          ))}
          <button
            onClick={() => {
              // create next month from current
              duplicateMonth(client.id, selectedMonthKey);
            }}
            className="shrink-0 rounded-full bg-white/5 p-1.5 text-muted-foreground transition hover:bg-white/10 hover:text-white"
            title="Novo mês"
          >
            <Plus size={12} />
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex items-center gap-6 border-b border-white/[0.06] -mb-5">
          {([
            ["posts", "Posts"],
            ["reels", "Reels"],
            ["profile", "Perfil"],
          ] as Array<[Tab, string]>).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "relative pb-3 text-sm font-medium transition",
                tab === k ? "text-white" : "text-muted-foreground hover:text-white"
              )}
            >
              {label}
              {tab === k && (
                <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {tab === "profile" ? (
          <ProfileTab client={client} />
        ) : !month ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            Nenhum mês selecionado.
          </div>
        ) : (
          <div className="mx-auto max-w-4xl">
            <div className="mb-4 px-4 text-xs text-muted-foreground">
              {formatMonth(selectedMonthKey)} ·{" "}
              {tab === "posts" ? month.posts.length : month.reels.length} itens
            </div>
            <div className="rounded-lg bg-card/60 py-2">
              {(tab === "posts" ? month.posts : month.reels).map((item) => (
                <ContentRow
                  key={item.id}
                  clientId={client.id}
                  monthKey={month.key}
                  item={item}
                  onOpen={() => openItem(item.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MonthArrow({ direction }: { direction: "prev" | "next" }) {
  // visual only, list-driven selection
  return (
    <span className="shrink-0 rounded-full p-1.5 text-muted-foreground/40">
      {direction === "prev" ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
    </span>
  );
}

function ProfileTab({ client }: { client: import("@/lib/luzeria/types").Client }) {
  const fields = client.customFields;
  const rows: Array<[string, string | number]> = [
    ["Nicho", fields.niche || "—"],
    ["Posts por semana", fields.postsPerWeek || "—"],
    ["Reels por semana", fields.reelsPerWeek || "—"],
    ["Responsável fixo", fields.fixedResponsible || "—"],
    ["Dia de revisão", fields.reviewDay || "—"],
  ];
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-lg bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold text-white">Perfil do cliente</h2>
        <dl className="divide-y divide-white/[0.06]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-3 text-sm">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="text-white">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      {fields.notes && (
        <div className="rounded-lg bg-card p-6">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Observações
          </h3>
          <p className="text-sm text-white/90 whitespace-pre-wrap">{fields.notes}</p>
        </div>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Edite estes campos pelo menu “…” do cliente na sidebar.
      </p>
    </div>
  );
}