import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { publicClientDocsQO } from "@/lib/luzeria/queries";
import { RoteirosView, PlanejamentoView } from "@/components/luzeria/MarkdownLiteView";
import { ClientRoteiroApproval } from "@/components/luzeria/ClientRoteiroApproval";
import { parseMarkdownLite } from "@/lib/luzeria/markdown-lite";

export const Route = createFileRoute("/planejamento/$token")({
  component: PublicDocsPage,
  loader: async ({ params, context }) => {
    try {
      return await (context as any).queryClient.fetchQuery(publicClientDocsQO(params.token));
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => {
    const clientName = loaderData?.client?.name ?? "Cliente";
    const title = `Planejamento — ${clientName}`;
    const description = `Confira os roteiros e o planejamento de ${clientName}.`;

    const defaultOgImage = `${import.meta.env.VITE_APP_URL ?? "https://www.modocriador.com.br"}/og-preview.jpg`;
    const ogImage = loaderData?.orgPlanejamentoCoverImageUrl ?? defaultOgImage;

    const meta: Record<string, string>[] = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: ogImage },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: ogImage },
    ];

    return { meta };
  },
});

function PublicDocsPage() {
  const { token } = Route.useParams();
  const q = useQuery(publicClientDocsQO(token));
  const [tab, setTab] = useState<"roteiro" | "planejamento" | null>(null);

  if (q.isLoading) {
    return <Shell><div className="text-white/60 text-sm">Carregando…</div></Shell>;
  }
  if (!q.data) {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-white text-2xl font-bold mb-2">Link inválido</div>
          <div className="text-white/50 text-sm">Este link foi revogado ou nunca existiu. Solicite um novo à sua agência.</div>
        </div>
      </Shell>
    );
  }

  const { client, orgName, orgLogoUrl, roteiroDocs, planejamentoDocs, roteiroClientStatuses } = q.data;
  const initial = client.name.charAt(0).toUpperCase();
  const showRoteiro = roteiroDocs.length > 0;
  const showPlanejamento = planejamentoDocs.length > 0;
  const activeTab = tab ?? (showRoteiro ? "roteiro" : "planejamento");
  const roteiroBlocks = showRoteiro ? parseMarkdownLite(roteiroDocs.map((d) => d.content).join("\n\n")) : [];
  // Vários docs "roteiro" viram um stream só de blocos acima, então os
  // grupos não dão pra rastrear de volta pra um doc específico — a
  // aprovação usa o primeiro doc, cobrindo o caso comum de 1 doc por cliente.
  const roteiroDocId = roteiroDocs[0]?.id ?? null;
  const roteiroStatusByTitle = new Map(roteiroClientStatuses.map((s) => [s.roteiroTitle, s]));

  return (
    <div className="min-h-screen" style={{ background: "#0D0D0D" }}>
      <div className="px-4 pt-8 pb-6 max-w-[640px] mx-auto">
        <div className="flex items-center gap-4">
          {client.photoUrl ? (
            <img src={client.photoUrl} alt={client.name} className="size-16 rounded-full object-cover shrink-0" />
          ) : (
            <div
              className="size-16 rounded-full grid place-items-center text-2xl font-bold text-white shrink-0"
              style={{ background: client.color }}
            >{initial}</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-white text-xl font-bold leading-tight truncate">{client.name}</div>
            <div className="text-white/50 text-[13px] mt-0.5">Roteiros e planejamento</div>
          </div>
        </div>
      </div>

      <div className="max-w-[640px] mx-auto px-4 pb-16">
        {showRoteiro && showPlanejamento && (
          <div className="flex items-center gap-2 mb-5">
            <DocsTabPill active={activeTab === "roteiro"} onClick={() => setTab("roteiro")}>Roteiros</DocsTabPill>
            <DocsTabPill active={activeTab === "planejamento"} onClick={() => setTab("planejamento")}>Planejamento</DocsTabPill>
          </div>
        )}

        {!showRoteiro && !showPlanejamento && (
          <div className="rounded-xl py-14 text-center text-white/40 text-sm" style={{ background: "#1C1C1C" }}>
            Nada compartilhado ainda.
          </div>
        )}

        {activeTab === "roteiro" && showRoteiro && (
          <RoteirosView
            blocks={roteiroBlocks}
            renderFooter={(g) => roteiroDocId ? (
              <ClientRoteiroApproval
                token={token}
                docId={roteiroDocId}
                title={g.title}
                current={roteiroStatusByTitle.get(g.title)}
                onDone={() => q.refetch()}
              />
            ) : null}
          />
        )}

        {activeTab === "planejamento" && showPlanejamento && (
          <div className="space-y-4">
            {planejamentoDocs.map((d) => <PlanejamentoView key={d.id} blocks={parseMarkdownLite(d.content)} />)}
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-2">
          {orgLogoUrl && (
            <img src={orgLogoUrl} alt={orgName ?? "Logo da agência"} className="max-h-10 max-w-[160px] object-contain opacity-90" />
          )}
          <div className="text-center text-white/30 text-[11px]">
            Apresentado por <span className="font-semibold" style={{ color: "rgb(var(--lz-brand-rgb))" }}>{orgName ?? "sua agência"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocsTabPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors"
      style={{
        backgroundColor: active ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.06)",
        color: active ? "#0D0D0D" : "rgba(255,255,255,0.6)",
      }}
    >
      {children}
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center px-6" style={{ background: "#0D0D0D" }}>
      <div className="max-w-md w-full">{children}</div>
    </div>
  );
}
