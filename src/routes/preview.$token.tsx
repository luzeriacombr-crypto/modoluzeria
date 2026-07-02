import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { publicFeedQO } from "@/lib/luzeria/queries";
import { addPublicFeedback, approvePublicFeed, approvePublicItem } from "@/lib/luzeria/feed-share.functions";
import { Film, Layers } from "lucide-react";
import { InstagramPostModal, type IGModalItem } from "@/components/luzeria/InstagramPostModal";

export const Route = createFileRoute("/preview/$token")({
  component: PublicPreviewPage,
  ssr: false,
});

function PublicPreviewPage() {
  const { token } = Route.useParams();
  const q = useQuery(publicFeedQO(token));
  const [activeId, setActiveId] = useState<string | null>(null);
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
          <div className="text-white/50 text-sm">Este link foi revogado ou nunca existiu. Solicite um novo à equipe Luzeria.</div>
        </div>
      </Shell>
    );
  }

  const { client, items } = q.data;
  const initial = client.name.charAt(0).toUpperCase();
  const activeItem = items.find((i) => i.id === activeId) ?? null;

  const igModalItem: IGModalItem | null = activeItem ? {
    id: activeItem.id,
    type: activeItem.type,
    title: activeItem.title,
    caption: activeItem.caption,
    dueDate: activeItem.dueDate,
    coverUrl: activeItem.coverUrl,
    files: activeItem.files,
    feedback: activeItem.feedback,
  } : null;

  return (
    <div className="min-h-screen" style={{ background: "#0D0D0D" }}>
      {/* Header */}
      <div className="px-4 pt-8 pb-6 max-w-[640px] mx-auto">
        <div className="flex items-center gap-4">
          <div
            className="size-20 rounded-full grid place-items-center text-3xl font-bold text-white shrink-0"
            style={{ background: client.color }}
          >{initial}</div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xl font-bold leading-tight truncate">{client.name}</div>
            <div className="text-white/50 text-[13px] mt-0.5">Preview do feed · {formattedMonth}</div>
            <div className="text-white/40 text-[12px] mt-2 leading-snug">
              {items.length} publicaç{items.length === 1 ? "ão" : "ões"} aprovada{items.length === 1 ? "" : "s"}.
              Toque em uma publicação para ver detalhes e deixar um comentário.
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-[640px] mx-auto px-4 pb-16">
        {items.length === 0 ? (
          <div className="rounded-xl py-14 text-center text-white/40 text-sm" style={{ background: "#1C1C1C" }}>
            Ainda não há publicações prontas neste mês.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-[3px] bg-black/30 p-[3px] rounded-md">
            {items.map((it) => (
              <PublicGridCell
                key={it.id}
                item={it}
                onClick={() => setActiveId(it.id)}
              />
            ))}
          </div>
        )}

        {/* Approval button */}
        {items.length > 0 && (
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
                <div className="text-white/50 text-xs mb-4">Ao aprovar, a Luzeria Estúdio recebe uma confirmação formal.</div>
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
                  style={{ background: "#C8D44E", color: "#0D0D0D" }}
                >
                  {approving ? "Registrando…" : "✓ Aprovar feed de " + formattedMonth}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 text-center text-white/30 text-[11px]">
          Apresentado por <span className="font-semibold" style={{ color: "#C8D44E" }}>Luzeria Estúdio</span>
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
  item: { id: string; type: string; files: { driveFileId: string }[] };
  onClick: () => void;
}) {
  const firstFileId = item.files[0]?.driveFileId ?? null;
  const thumbUrl = firstFileId ? driveThumbnailUrl(firstFileId, 480) : null;
  const isReel = item.type === "reel";
  const isCarousel = item.files.length > 1;

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative aspect-square overflow-hidden group"
      style={{ background: "#1C1C1C" }}
    >
      {thumbUrl ? (
        <img src={thumbUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
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
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition" />
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