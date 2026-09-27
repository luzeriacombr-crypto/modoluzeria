import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { publicCampaignQO } from "@/lib/luzeria/queries";
import { CONTENT_TYPE_LABEL, getStatusMeta } from "@/lib/luzeria/types";
import { Megaphone } from "lucide-react";

export const Route = createFileRoute("/campanha/$token")({
  component: PublicCampaignPage,
  loader: async ({ params, context }) => {
    try {
      return await (context as any).queryClient.fetchQuery(publicCampaignQO(params.token));
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => {
    const name = loaderData?.campaign?.name ?? "Projeto";
    const clientName = loaderData?.clientName;
    const title = clientName ? `${name} — ${clientName}` : name;
    return { meta: [{ title }, { name: "description", content: "Acompanhe este projeto." }] };
  },
});

function PublicCampaignPage() {
  const { token } = Route.useParams();
  const q = useQuery(publicCampaignQO(token));

  if (q.isLoading) {
    return <Shell><div className="text-white/60 text-sm">Carregando…</div></Shell>;
  }
  if (!q.data) {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-white text-2xl font-bold mb-2">Link inválido</div>
          <div className="text-white/50 text-sm">Este link foi revogado ou nunca existiu. Peça um novo a quem te enviou.</div>
        </div>
      </Shell>
    );
  }

  const { campaign, clientName, orgName, items } = q.data;

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: "#0D0D0D" }}>
      <div className="max-w-lg mx-auto">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-white/40 mb-1">{orgName} · {clientName}</div>
        <div className="flex items-center gap-2 mb-4">
          <Megaphone size={18} style={{ color: "rgb(var(--lz-brand-rgb))" }} />
          <h1 className="text-xl font-bold text-white">{campaign.name}</h1>
        </div>

        {campaign.description && (
          <p className="text-sm text-white/70 mb-4">{campaign.description}</p>
        )}

        {(campaign.briefing || campaign.services || campaign.materials) && (
          <div className="rounded-xl p-4 mb-5 space-y-3" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" }}>
            {campaign.briefing && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Briefing</div>
                <p className="text-sm text-white/80 whitespace-pre-wrap">{campaign.briefing}</p>
              </div>
            )}
            {campaign.services && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Serviços</div>
                <p className="text-sm text-white/80 whitespace-pre-wrap">{campaign.services}</p>
              </div>
            )}
            {campaign.materials && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1">Materiais</div>
                <p className="text-sm text-white/80 whitespace-pre-wrap">{campaign.materials}</p>
              </div>
            )}
          </div>
        )}

        <div className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2">Itens ({items.length})</div>
        {items.length === 0 ? (
          <p className="text-sm text-white/30">Nenhum item ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((it) => {
              const meta = getStatusMeta(it.status);
              return (
                <div key={it.id} className="flex items-center gap-3 rounded-md px-3 py-2.5" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-[10px] font-bold uppercase text-white/40 shrink-0">{CONTENT_TYPE_LABEL[it.type]}</span>
                  <span className="text-sm text-white flex-1 truncate">{it.title}</span>
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0" style={{ background: meta.bg, color: meta.color }}>
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center px-6" style={{ background: "#0D0D0D" }}>
      <div className="max-w-md w-full">{children}</div>
    </div>
  );
}
