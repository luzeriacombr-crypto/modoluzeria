import { useQuery } from "@tanstack/react-query";
import { Trash2, RotateCcw, FileText, Film, Clapperboard } from "lucide-react";
import { trashQO, useApi, useMe } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { Avatar } from "./Avatar";
import { InfoTip } from "./InfoTip";
import type { TrashedItem } from "@/lib/luzeria/trash.functions";

function timeSince(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

const TYPE_ICON: Record<TrashedItem["type"], React.ReactNode> = {
  post: <FileText size={14} />,
  reel: <Film size={14} />,
  story: <Clapperboard size={14} />,
};
const TYPE_LABEL: Record<TrashedItem["type"], string> = { post: "Post", reel: "Reel", story: "Story" };

export function TrashPage() {
  // O item some do menu pra quem não é admin, mas a rota abria assim mesmo
  // (link direto, histórico do navegador, PWA). O dado já é protegido por
  // RLS, mas a tela não devia nem montar.
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const { data: items = [], isLoading } = useQuery({ ...trashQO(), enabled: isAdmin });
  const { restoreItem, purgeItem } = useApi();

  if (me && !isAdmin) {
    return <div className="px-4 sm:px-6 md:px-10 py-10 text-foreground/60 text-sm">Acesso restrito à administração da agência.</div>;
  }

  async function purge(item: TrashedItem) {
    if (await requestConfirm(`Excluir "${item.title}" para sempre? Não tem como desfazer.`, { danger: true })) {
      purgeItem.mutate({ data: { id: item.id } });
    }
  }

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Trash2 size={20} className="text-[var(--lz-accent-ink)]" />
        <h1 className="text-lg font-bold text-foreground">Lixeira</h1>
        <InfoTip text="Posts excluídos ficam aqui por 7 dias, prontos pra restaurar com comentários e arquivos intactos. Depois disso somem de vez." />
      </div>
      <p className="text-xs text-foreground/50 mb-6">Posts, reels e stories excluídos recentemente — restaure ou apague de vez.</p>

      {isLoading ? (
        <p className="text-sm text-foreground/40">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-foreground/40">
          <Trash2 size={28} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">A lixeira está vazia.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg border border-foreground/10 bg-card px-3 py-2.5">
              <Avatar name={item.clientName} color={item.clientColor ?? undefined} size={30} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground truncate">
                  {TYPE_ICON[item.type]}
                  {item.title || "(sem título)"}
                </div>
                <div className="text-[11px] text-foreground/40 truncate">
                  {item.clientName} · {TYPE_LABEL[item.type]} · excluído {timeSince(item.deletedAt)}
                  {item.deletedByName ? ` por ${item.deletedByName}` : ""}
                </div>
              </div>
              <div className="text-[10px] text-foreground/30 shrink-0 hidden sm:block">
                {item.daysLeft > 0 ? `expira em ${item.daysLeft}d` : "expira hoje"}
              </div>
              <button
                onClick={() => restoreItem.mutate({ data: { id: item.id } })}
                disabled={restoreItem.isPending}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
              >
                <RotateCcw size={12} /> Restaurar
              </button>
              <button
                onClick={() => purge(item)}
                disabled={purgeItem.isPending}
                title="Excluir para sempre"
                className="shrink-0 p-1.5 rounded-md text-foreground/30 hover:text-red-400 hover:bg-foreground/5 transition disabled:opacity-50"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
