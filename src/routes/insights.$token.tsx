import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { publicInstagramInsightsInfoQO } from "@/lib/luzeria/queries";
import {
  getPublicInstagramOverview, getPublicInstagramFollowerHistory,
  getPublicInstagramAccountMedia, getPublicInstagramAccountMediaInsights,
} from "@/lib/luzeria/instagram.functions";
import { InsightsTabsView, type InsightsSource } from "@/components/luzeria/InstagramActivityPage";
import { hexToRgbChannels } from "@/lib/luzeria/utils";

export const Route = createFileRoute("/insights/$token")({
  component: PublicInsightsPage,
  loader: async ({ params, context }) => {
    try {
      return await (context as any).queryClient.fetchQuery(publicInstagramInsightsInfoQO(params.token));
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `Insights — ${loaderData.clientName}` : "Insights";
    return { meta: [{ title }, { name: "description", content: "Métricas do Instagram, feito por " + (loaderData?.orgName ?? "Modo Criador") + "." }] };
  },
});

function PublicInsightsPage() {
  const { token } = Route.useParams();
  const q = useQuery(publicInstagramInsightsInfoQO(token));

  const getOverview = useServerFn(getPublicInstagramOverview);
  const getHistory = useServerFn(getPublicInstagramFollowerHistory);
  const getMedia = useServerFn(getPublicInstagramAccountMedia);
  const getMediaInsights = useServerFn(getPublicInstagramAccountMediaInsights);
  const source: InsightsSource = useMemo(() => ({
    getOverview: () => getOverview({ data: { token } }),
    getFollowerHistory: () => getHistory({ data: { token } }),
    getMedia: (after?: string) => getMedia({ data: { token, after } }),
    getMediaInsights: (mediaId: string, mediaProductType: string) => getMediaInsights({ data: { token, mediaId, mediaProductType } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [token]);

  const brandVars = useMemo(() => {
    const rgb = q.data?.colorPrimary ? hexToRgbChannels(q.data.colorPrimary) : null;
    return rgb ? ({ "--lz-brand-rgb": rgb, "--lz-brand-light-rgb": rgb } as React.CSSProperties) : undefined;
  }, [q.data?.colorPrimary]);

  if (q.isLoading) {
    return <Shell><div className="text-foreground/50 text-sm">Carregando…</div></Shell>;
  }
  if (!q.data) {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-foreground text-2xl font-bold mb-2">Link inválido</div>
          <div className="text-foreground/50 text-sm">Este link foi revogado ou nunca existiu. Peça um novo a quem te enviou.</div>
        </div>
      </Shell>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: "#0D0D0D", ...brandVars }}>
      <div className="max-w-4xl mx-auto">
        <InsightsTabsView
          cacheKey={`share:${token}`}
          source={source}
          clientName={q.data.clientName}
          brandingLabel={q.data.orgName}
          readOnly
        />
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
