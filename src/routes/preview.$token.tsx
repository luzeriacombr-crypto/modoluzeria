import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { publicFeedQO } from "@/lib/luzeria/queries";
import { addPublicFeedback, approvePublicFeed, approvePublicItem } from "@/lib/luzeria/feed-share.functions";
import { Film, Layers, AlertTriangle, type LucideIcon } from "lucide-react";
import { Hammer, ClipboardCheck, Rocket, CheckCheck } from "lucide-react";
import { InstagramPostModal, type IGModalItem } from "@/components/luzeria/InstagramPostModal";
import { PublicProgressBar } from "@/components/luzeria/PublicProgressBar";
import { CLIENT_STAGE_META, type ClientStage } from "@/lib/luzeria/client-stage";
import { RoteirosView, PlanejamentoView } from "@/components/luzeria/MarkdownLiteView";
import { ClientRoteiroApproval } from "@/components/luzeria/ClientRoteiroApproval";
import { parseMarkdownLite } from "@/lib/luzeria/markdown-lite";

const STAGE_ICONS: Record<string, LucideIcon> = { Hammer, AlertTriangle, ClipboardCheck, Rocket, CheckCheck };

export const Route = createFileRoute("/preview/$token")({
  component: PublicPreviewPage,
  loader: async ({ params, context }) => {
    try {
      return await (context as any).queryClient.fetchQuery(publicFeedQO(params.token));
    } catch {
      return null;
    }
  },
  head: ({ loaderData }) => {
    const client = loaderData?.client;
    const items = loaderData?.items ?? [];
    const month = loaderData?.month;

    const clientName = client?.name ?? "Preview";
    const monthLabel = month?.key ? formatMonth(month.key) : "";
    const title = monthLabel
      ? `Preview — ${clientName} · ${monthLabel}`
      : `Preview — ${clientName}`;
    const description = `Confira e aprove as publicações de ${monthLabel || "este mês"}.`;

    const defaultOgImage = `${import.meta.env.VITE_APP_URL ?? "https://www.modocriador.com.br"}/og-preview.jpg`;
    const ogImage = loaderData?.feedPreviewImageUrl ?? defaultOgImage;

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

function PublicPreviewPage() {
  const { token } = Route.useParams();
  const q = useQuery(publicFeedQO(token));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"feed" | "roteiro" | "planejamento">("feed");
  const [savedName, setSavedName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("lz_public_author") ?? "";
  });
  const addFb = useServerFn(addPublicFeedback);
  const approveFeed = useServerFn(approvePublicFeed);
  const approveItem = useServerFn(approvePublicItem);
  const [approved, setApproved] = useState<boolean>(false);
  const [approving, setApproving] = useState(false);

  const formattedMonth = useMemo(() => formatMonth(q.data?.month.key), [q.data?.month.key]);

  if (q.isLoading) {
    return <Shell><div className="text-white/60 text-sm">Carregando preview…</div></Shell>;
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

  const { client, items, orgName, orgLogoUrl, stageCounts, docs, roteiroClientStatuses } = q.data;
  const initial = client.name.charAt(0).toUpperCase();
  const activeItem = items.find((i) => i.id === activeId) ?? null;
  const blockedCount = items.filter((it) => it.stage === "blocked").length;
  const producingCount = stageCounts.find((s) => s.stage === "producing")?.count ?? 0;
  const canApproveMonth = producingCount === 0;

  const roteiroDocs = docs.filter((d) => d.type === "roteiro");
  const planejamentoDocs = docs.filter((d) => d.type === "planejamento");
  const roteiroBlocks = roteiroDocs.length > 0 ? parseMarkdownLite(roteiroDocs.map((d) => d.content).join("\n\n")) : [];
  const hasExtraTabs = roteiroDocs.length > 0 || planejamentoDocs.length > 0;
  // Multiple roteiro docs get merged into one block stream above, so their
  // groups can't be traced back to a specific doc — approval targets the
  // first roteiro doc's id, which covers the common case of one doc per client.
  const roteiroDocId = roteiroDocs[0]?.id ?? null;
  const roteiroStatusByTitle = new Map((roteiroClientStatuses ?? []).map((s) => [s.roteiroTitle, s]));

  const igModalItem: IGModalItem | null = activeItem ? {
    id: activeItem.id,
    type: activeItem.type,
    title: activeItem.title,
    caption: activeItem.caption,
    scheduledAt: activeItem.scheduledAt,
    coverUrl: activeItem.coverUrl,
    files: activeItem.files,
    feedback: activeItem.feedback,
  } : null;

  return (
    <div className="min-h-screen" style={{ background: "#0D0D0D" }}>
      {/* Header */}
      <div className="px-4 pt-8 pb-6 max-w-[640px] mx-auto">
        <div className="flex items-center gap-4">
          {client.photoUrl ? (
            <img
              src={client.photoUrl}
              alt={client.name}
              className="size-20 rounded-full object-cover shrink-0"
            />
          ) : (
            <div
              className="size-20 rounded-full grid place-items-center text-3xl font-bold text-white shrink-0"
              style={{ background: client.color }}
            >{initial}</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-white text-xl font-bold leading-tight truncate">{client.name}</div>
            <div className="text-white/50 text-[13px] mt-0.5">Preview do feed · {formattedMonth}</div>
            <div className="text-white/40 text-[12px] mt-2 leading-snug">
              {items.length} publicaç{items.length === 1 ? "ão planejada" : "ões planejadas"} para {formattedMonth}.
              Acompanhe o progresso de cada uma abaixo.
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-[640px] mx-auto px-4 pb-16">
        {hasExtraTabs && (
          <div className="flex items-center gap-2 mb-5">
            <PreviewTabPill active={activeTab === "feed"} onClick={() => setActiveTab("feed")}>Feed</PreviewTabPill>
            {roteiroDocs.length > 0 && (
              <PreviewTabPill active={activeTab === "roteiro"} onClick={() => setActiveTab("roteiro")}>Roteiros</PreviewTabPill>
            )}
            {planejamentoDocs.length > 0 && (
              <PreviewTabPill active={activeTab === "planejamento"} onClick={() => setActiveTab("planejamento")}>Planejamento</PreviewTabPill>
            )}
          </div>
        )}

        {activeTab === "feed" && (
        <>
        {items.length === 0 ? (
          <div className="rounded-xl py-14 text-center text-white/40 text-sm" style={{ background: "#1C1C1C" }}>
            Nenhuma publicação foi planejada para este mês ainda.
          </div>
        ) : (
          <>
            <PublicProgressBar stageCounts={stageCounts} blockedCount={blockedCount} />
            <div className="grid grid-cols-3 gap-[3px] bg-black/30 p-[3px] rounded-md">
              {items.map((it) => (
                <PublicGridCell
                  key={it.id}
                  item={it}
                  onClick={() => setActiveId(it.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Approval button — só faz sentido quando não há mais nada em produção */}
        {items.length > 0 && canApproveMonth && (
          <div className="mt-8 rounded-xl p-5 text-center" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" }}>
            {approved ? (
              <div>
                <div className="text-2xl mb-2">✅</div>
                <div className="text-white font-bold text-base">Feed aprovado!</div>
                <div className="text-white/50 text-sm mt-1">Sua aprovação foi registrada com sucesso.</div>
              </div>
            ) : (
              <div>
                <div className="text-white font-semibold text-sm mb-1">Tudo certo com o conteúdo?</div>
                <div className="text-white/50 text-xs mb-4">Ao aprovar, {orgName ?? "a agência"} recebe uma confirmação formal.</div>
                <button
                  onClick={async () => {
                    setApproving(true);
                    try {
                      await approveFeed({ data: { token } });
                      setApproved(true);
                    } catch {}
                    setApproving(false);
                  }}
                  disabled={approving}
                  className="px-6 py-2.5 rounded-full text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
                >
                  {approving ? "Registrando…" : "✓ Aprovar feed de " + formattedMonth}
                </button>
              </div>
            )}
          </div>
        )}
        </>
        )}

        {activeTab === "roteiro" && (
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

        {activeTab === "planejamento" && (
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

      {igModalItem && (
        <InstagramPostModal
          item={igModalItem}
          client={{ name: client.name, color: client.color }}
          mode={{ kind: "public", token }}
          canComment
          initialAuthorName={savedName || undefined}
          onClose={() => setActiveId(null)}
          onApproveItem={async () => {
            const author = savedName || "Cliente";
            await approveItem({ data: { token, itemId: activeItem!.id, authorName: author } });
            await q.refetch();
          }}
          onSubmitFeedback={async (author, text) => {
            await addFb({ data: { token, itemId: activeItem!.id, authorName: author, text } });
            try { localStorage.setItem("lz_public_author", author); setSavedName(author); } catch {}
            await q.refetch();
          }}
        />
      )}
    </div>
  );
}

function driveThumbnailUrl(fileId: string, size = 480) {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
}

function PublicGridCell({ item, onClick }: {
  item: {
    id: string; type: string; gridThumb?: string | null; files: { driveFileId: string }[];
    stage: ClientStage; stageLabel: string;
  };
  onClick: () => void;
}) {
  const thumbUrl = item.gridThumb ?? null;
  const isReel = item.type === "reel";
  const isCarousel = item.files.length > 1;
  const clickable = item.files.length > 0;
  const meta = CLIENT_STAGE_META[item.stage];
  const StageIcon = STAGE_ICONS[meta.icon];

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      aria-disabled={!clickable}
      className={`relative aspect-[4/5] overflow-hidden group ${clickable ? "" : "cursor-default"}`}
      style={{ background: "#1C1C1C" }}
    >
      {thumbUrl ? (
        <img src={thumbUrl} alt="" loading="lazy" className="w-full h-full object-cover transition-opacity duration-300 opacity-0"
          onLoad={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "1"; }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <div className="w-full h-full grid place-items-center text-white/30 text-[10px] font-bold uppercase">
          {isReel ? "Reel" : "Post"}
        </div>
      )}
      {(isReel || isCarousel) && (
        <div className="absolute top-1.5 right-1.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {isReel ? <Film size={16} /> : <Layers size={16} />}
        </div>
      )}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-center gap-1 px-1.5 py-1"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)" }}
      >
        <span
          className="size-4 rounded-full grid place-items-center shrink-0"
          style={{ background: meta.color, color: "#0D0D0D" }}
        >
          <StageIcon size={10} />
        </span>
        <span className="text-white text-[9px] font-semibold leading-tight text-left line-clamp-2">
          {item.stageLabel}
        </span>
      </div>
      {clickable && <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition" />}
    </button>
  );
}

function PreviewTabPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function formatMonth(key: string | undefined) {
  if (!key) return "";
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${months[m - 1]}/${y}`;
}