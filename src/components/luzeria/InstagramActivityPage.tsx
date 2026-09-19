import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Instagram, Clock, CheckCircle2, Image as ImageIcon, BarChart3, Download, Loader2, ExternalLink,
  Sparkles, Users, Eye, Heart, TrendingUp, TrendingDown, MessageCircle, Send, X, Mail, CalendarDays,
} from "lucide-react";
import { instagramActivityQO, gridThumbnailsQO, useMe } from "@/lib/luzeria/queries";
import {
  getInstagramAccountMedia, getInstagramAccountMediaInsights, getInstagramAccountOverview,
  getInstagramComments, replyToInstagramComment, postInstagramComment,
  getInstagramConversations, getInstagramConversationMessages, sendInstagramDirectMessage,
  type InstagramActivityItem, type InstagramAccountMedia, type InstagramMediaInsights, type InstagramAccountOverview,
  type InstagramComment, type InstagramConversation, type InstagramDirectMessage,
} from "@/lib/luzeria/instagram.functions";
import { useUI } from "@/lib/luzeria/ui-store";
import { POST_FORMAT_LABEL, CONTENT_TYPE_LABEL } from "@/lib/luzeria/types";
import { CalendarioContent } from "./CalendarioPage";

function typeLabel(item: InstagramActivityItem) {
  if (item.type === "post" && item.postFormat) {
    return POST_FORMAT_LABEL[item.postFormat as keyof typeof POST_FORMAT_LABEL] ?? item.postFormat;
  }
  return CONTENT_TYPE_LABEL[item.type as keyof typeof CONTENT_TYPE_LABEL] ?? item.type;
}

function productTypeLabel(t: string) {
  if (t === "REELS") return "Reel";
  if (t === "STORY") return "Story";
  return "Post";
}

export function InstagramActivityPage() {
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const { data: items = [], isLoading } = useQuery({ ...instagramActivityQO(), enabled: isAdmin });
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);
  const { data: thumbs } = useQuery({ ...gridThumbnailsQO(itemIds), enabled: isAdmin && itemIds.length > 0 });

  const [tab, setTab] = useState<"atividade" | "calendario">("atividade");
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const clients = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    for (const i of items) if (!map.has(i.clientId)) map.set(i.clientId, { id: i.clientId, name: i.clientName, color: i.clientColor });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filtered = useMemo(
    () => (clientFilter ? items.filter((i) => i.clientId === clientFilter) : items),
    [items, clientFilter],
  );
  const scheduled = useMemo(
    () => filtered.filter((i) => i.igAutoPublish).sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()),
    [filtered],
  );
  const published = useMemo(
    () => filtered.filter((i) => !!i.igPublishedAt).sort((a, b) => new Date(b.igPublishedAt!).getTime() - new Date(a.igPublishedAt!).getTime()),
    [filtered],
  );

  if (me && !isAdmin) {
    return (
      <div className="px-5 md:px-10 py-8 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Instagram size={20} className="text-[var(--lz-accent-ink)]" />
          <h1 className="text-[28px] font-bold text-foreground tracking-tight">Instagram</h1>
        </div>
        <p className="text-sm text-foreground/40 mt-6">Essa tela é só pra Adm Master e Adm de Setor.</p>
      </div>
    );
  }

  return (
    <div className="px-5 md:px-10 py-8 max-w-[1400px] mx-auto" data-tour="instagram-page">
      <div className="flex items-center gap-2 mb-1">
        <Instagram size={20} className="text-[var(--lz-accent-ink)]" />
        <h1 className="text-[28px] font-bold text-foreground tracking-tight">Instagram</h1>
      </div>
      <p className="text-xs text-foreground/40 mb-5">
        Posts programados e já publicados pelo Modo Criador, de todos os clientes. Publicação feita direto no
        Instagram (fora do app) não aparece aqui — pra ver tudo da conta de um cliente, use o painel de métricas
        abaixo.
      </p>

      {/* Calendário virou aba daqui — só importa mesmo no contexto de "o que
       * vai publicar e quando", não precisa mais de item próprio na barra
       * lateral (feedback de usabilidade, call com Alexsander Felix). */}
      <div className="inline-flex items-center gap-1 rounded-full bg-card p-1 border border-foreground/10 mb-6">
        <button
          onClick={() => setTab("atividade")}
          className="px-3.5 py-1.5 rounded-full text-xs font-semibold transition"
          style={tab === "atividade" ? { background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" } : { color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
        >
          Atividade
        </button>
        <button
          onClick={() => setTab("calendario")}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition"
          style={tab === "calendario" ? { background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" } : { color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
        >
          <CalendarDays size={13} /> Calendário
        </button>
      </div>

      {tab === "calendario" && <CalendarioContent />}

      {tab === "atividade" && (
      <>
      {clients.length > 0 && (
        <div className="flex items-center gap-2 mb-6">
          <label className="text-[11px] uppercase font-bold tracking-wider text-foreground/40">Cliente</label>
          <select
            value={clientFilter ?? ""}
            onChange={(e) => setClientFilter(e.target.value || null)}
            className="bg-card border border-foreground/10 rounded-md px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
          >
            <option value="">Todos os clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {isLoading && <p className="text-xs text-foreground/30 text-center mt-10">Carregando…</p>}

      {!isLoading && items.length === 0 && (
        <div className="border border-dashed border-foreground/10 rounded-lg p-16 text-center">
          <Instagram size={22} className="mx-auto mb-3 text-foreground/20" />
          <p className="text-foreground/50 text-sm">Nenhuma publicação programada ou feita pelo app ainda.</p>
        </div>
      )}

      {clientFilter && (
        <InstagramInsightsTabs key={clientFilter} clientId={clientFilter} clientName={clients.find((c) => c.id === clientFilter)?.name ?? ""} />
      )}

      {scheduled.length > 0 && (
        <ActivitySection
          label="Programados"
          icon={<Clock size={13} />}
          items={scheduled}
          thumbs={thumbs}
          dateOf={(i) => i.scheduledAt!}
          datePrefix="Programado pra"
        />
      )}

      {published.length > 0 && (
        <ActivitySection
          label="Publicados pelo Modo Criador"
          icon={<CheckCircle2 size={13} />}
          items={published}
          thumbs={thumbs}
          dateOf={(i) => i.igPublishedAt!}
          datePrefix="Publicado em"
        />
      )}
      </>
      )}
    </div>
  );
}

function KpiTile({ label, value, changePct }: { label: string; value: number; changePct: number | null }) {
  return (
    <div className="rounded-lg border border-foreground/8 bg-card p-3 text-center">
      <div className="text-[9.5px] uppercase font-bold tracking-wider text-foreground/35 mb-1.5 truncate" title={label}>{label}</div>
      <div className="text-lg font-extrabold text-foreground tabular-nums">{value.toLocaleString("pt-BR")}</div>
      {changePct !== null && (
        <div
          className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
          style={{
            color: changePct >= 0 ? "#7ED957" : "#FF6B6B",
            backgroundColor: changePct >= 0 ? "rgba(126,217,87,0.12)" : "rgba(255,107,107,0.12)",
          }}
        >
          {changePct >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
          {Math.abs(changePct)}%
        </div>
      )}
    </div>
  );
}

function ThinBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2.5 text-xs mb-2.5">
      <span className="w-24 shrink-0 text-foreground/60 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-foreground/8 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "rgb(var(--lz-brand-rgb))" }} />
      </div>
      <span className="w-10 shrink-0 text-right text-foreground/50 tabular-nums">{pct}%</span>
    </div>
  );
}

/** Barra de faixa etária dividida por gênero (mesmo dado de demographics.age,
 * só desenhado como duas cores lado a lado) — imita o "Faixa etária" do
 * Instagram, sem precisar de nenhuma chamada nova. */
function AgeGenderBar({ label, female, male, other, pct }: { label: string; female: number; male: number; other: number; pct: number }) {
  const total = female + male + other || 1;
  return (
    <div className="flex items-center gap-2.5 text-xs mb-2.5">
      <span className="w-12 shrink-0 text-foreground/60">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-foreground/8 overflow-hidden flex">
        <div className="h-full" style={{ width: `${(female / total) * 100}%`, background: "rgb(var(--lz-brand-rgb))" }} />
        <div className="h-full" style={{ width: `${(male / total) * 100}%`, background: "rgba(var(--lz-brand-rgb),0.35)" }} />
      </div>
      <span className="w-10 shrink-0 text-right text-foreground/50 tabular-nums">{pct}%</span>
    </div>
  );
}

/** Carrega mídia real da conta + insights por post (1 chamada por post, com
 * pausa entre elas pra não estourar limite de taxa da Meta) — compartilhado
 * entre a aba "Conteúdo" (lista completa) e "Visão geral" ("conteúdo mais
 * relevante"), pra não duplicar a busca ao trocar de aba. */
function useAccountMediaWithInsights(clientId: string) {
  const getMedia = useServerFn(getInstagramAccountMedia);
  const getInsights = useServerFn(getInstagramAccountMediaInsights);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [media, setMedia] = useState<InstagramAccountMedia[] | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [results, setResults] = useState<Map<string, InstagramMediaInsights & { error?: string }>>(new Map());

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoadingMedia(true);
      setMediaError(null);
      setResults(new Map());
      let items: InstagramAccountMedia[] = [];
      try {
        const r = await getMedia({ data: { clientId } });
        if (cancelled) return;
        items = r.items;
        setMedia(items);
      } catch (e: any) {
        if (!cancelled) { setMediaError(e?.message ?? "Falha ao listar publicações do Instagram."); setLoadingMedia(false); }
        return;
      }
      setLoadingMedia(false);
      if (items.length === 0) return;
      setLoadingInsights(true);
      for (const m of items) {
        if (cancelled) return;
        try {
          const insights = await getInsights({ data: { clientId, mediaId: m.id, mediaProductType: m.mediaProductType } });
          if (!cancelled) setResults((prev) => new Map(prev).set(m.id, insights));
        } catch (e: any) {
          if (!cancelled) setResults((prev) => new Map(prev).set(m.id, {
            itemId: m.id, reach: null, likes: null, comments: null, saved: null, shares: null, views: null,
            totalInteractions: null, degradedReason: null, error: e?.message ?? "Falha ao buscar",
          }));
        }
        // Pequena pausa entre chamadas pra não estourar limite de taxa da Meta.
        await new Promise((r) => setTimeout(r, 250));
      }
      if (!cancelled) setLoadingInsights(false);
    }
    loadAll();
    return () => { cancelled = true; };
  }, [clientId]);

  return { media, mediaError, loadingMedia, loadingInsights, results };
}

const CONTENT_METRIC_PILLS: { key: keyof InstagramMediaInsights; label: string }[] = [
  { key: "views", label: "Visualizações" },
  { key: "likes", label: "Curtidas" },
  { key: "comments", label: "Comentários" },
  { key: "saved", label: "Salvamentos" },
  { key: "shares", label: "Compart." },
];
const CONTENT_TYPE_FILTERS = [
  { key: "ALL", label: "Todos os conteúdos" },
  { key: "REELS", label: "Reels" },
  { key: "FEED", label: "Posts" },
  { key: "STORY", label: "Stories" },
];

function csvEscape(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

/** Painel de insights de um cliente — mesma organização de abas do
 * Instagram de verdade (Visão geral / Conteúdo / Público), só que nas cores
 * do Modo Criador. Direct fica como uma 4ª aba (não existe no Instagram
 * "Insights", mas é a mesma funcionalidade que já existia aqui). */
// Direct escondido até a Meta aprovar `instagram_business_manage_messages`
// (o envio de resposta falha com código 10/2534022 enquanto o app está em
// acesso Standard). Voltar pra true quando a permissão for aprovada.
const SHOW_DIRECT_TAB = false;

function InstagramInsightsTabs({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [pane, setPane] = useState<"geral" | "conteudo" | "publico" | "direct">("geral");
  const mediaState = useAccountMediaWithInsights(clientId);

  const TABS: { key: typeof pane; label: string }[] = [
    { key: "geral", label: "Visão geral" },
    { key: "conteudo", label: "Conteúdo" },
    { key: "publico", label: "Público" },
    ...(SHOW_DIRECT_TAB ? [{ key: "direct" as const, label: "Direct" }] : []),
  ];

  return (
    <div className="mb-8 rounded-lg border border-foreground/8 bg-card p-4">
      <div className="flex items-center gap-1.5 mb-3 text-foreground/60">
        <BarChart3 size={14} />
        <span className="text-[11px] uppercase font-bold tracking-wider">Insights de {clientName}</span>
      </div>
      <div className="flex items-center gap-1 border-b border-foreground/8 mb-4 -mt-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setPane(t.key)}
            className="px-3 py-2.5 text-xs font-semibold relative shrink-0"
            style={{ color: pane === t.key ? "var(--foreground)" : "color-mix(in srgb, var(--foreground) 35%, transparent)" }}
          >
            {t.label}
            {pane === t.key && (
              <span className="absolute left-2 right-2 -bottom-px h-[2px] rounded-full" style={{ background: "rgb(var(--lz-brand-rgb))" }} />
            )}
          </button>
        ))}
      </div>

      {pane === "geral" && <VisaoGeralPane clientId={clientId} mediaState={mediaState} />}
      {pane === "conteudo" && <ConteudoPane clientId={clientId} clientName={clientName} mediaState={mediaState} />}
      {pane === "publico" && <PublicoPane clientId={clientId} />}
      {SHOW_DIRECT_TAB && pane === "direct" && <DirectMessagesPanel clientId={clientId} />}
    </div>
  );
}

function VisaoGeralPane({ clientId, mediaState }: { clientId: string; mediaState: ReturnType<typeof useAccountMediaWithInsights> }) {
  const getOverview = useServerFn(getInstagramAccountOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["instagram-account-overview", clientId],
    queryFn: () => getOverview({ data: { clientId } }),
  });

  if (isLoading) return <div className="text-center py-10"><Loader2 size={18} className="animate-spin mx-auto text-foreground/30" /></div>;
  if (error || !data) return <p className="text-xs text-red-400/80 py-4">{(error as any)?.message ?? "Não foi possível carregar o painel de insights."}</p>;

  const maxReach = Math.max(...data.reachSeries.map((r) => r.value), 1);
  const maxFreq = Math.max(...data.postingFrequency.map((d) => d.count), 1);
  const maxOnline = Math.max(...(data.onlineFollowers?.map((h) => h.value) ?? []), 1);
  const bestHour = data.onlineFollowers ? [...data.onlineFollowers].sort((a, b) => b.value - a.value)[0] : null;

  // "Conteúdo mais relevante" — reaproveita o que a aba Conteúdo já carregou
  // (sem chamada extra), ordenado por visualizações (ou alcance, se o tipo
  // de mídia não tiver "views").
  const topContent = (mediaState.media ?? [])
    .map((m) => ({ m, r: mediaState.results.get(m.id) }))
    .filter((x): x is { m: InstagramAccountMedia; r: InstagramMediaInsights & { error?: string } } =>
      !!x.r && !x.r.error && (x.r.views != null || x.r.reach != null))
    .sort((a, b) => (b.r.views ?? b.r.reach ?? 0) - (a.r.views ?? a.r.reach ?? 0))
    .slice(0, 8);

  return (
    <div>
      {data.username && <p className="text-[11px] text-foreground/35 mb-3">@{data.username}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
        <KpiTile label="Seguidores" value={data.followersCount} changePct={data.followersChangePct} />
        <KpiTile label="Alcance (30d)" value={data.kpis.reach} changePct={data.kpis.reachChangePct} />
        <KpiTile label="Visitas ao perfil" value={data.kpis.profileViews} changePct={data.kpis.profileViewsChangePct} />
        <KpiTile label="Interações" value={data.kpis.totalInteractions} changePct={data.kpis.totalInteractionsChangePct} />
      </div>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <div className="rounded-lg border border-foreground/8 bg-card p-4">
          <span className="text-[11px] uppercase font-bold tracking-wider text-foreground/50">Alcance por dia (30 dias)</span>
          <div className="h-40 mt-2 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.reachSeries.map((r) => ({ ...r, label: new Date(r.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) }))}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} interval={4}
                  tick={{ fill: "color-mix(in srgb, var(--foreground) 40%, transparent)", fontSize: 9 }} />
                <Tooltip
                  cursor={{ fill: "rgba(var(--lz-brand-light-rgb),0.08)" }}
                  content={({ active, payload }: any) => active && payload?.length ? (
                    <div className="bg-background border border-foreground/10 rounded-md px-2 py-1 text-[10px] text-foreground/80 shadow-xl">
                      {payload[0].payload.label}: <b>{payload[0].value.toLocaleString("pt-BR")}</b>
                    </div>
                  ) : null}
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {data.reachSeries.map((r, i) => (
                    <Cell key={i} fill={r.value === maxReach ? "var(--lz-accent-ink)" : "rgba(var(--lz-brand-light-rgb),0.4)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border border-foreground/8 bg-card p-4">
          <span className="text-[11px] uppercase font-bold tracking-wider text-foreground/50">Seguidores por dia (30 dias)</span>
          <div className="h-40 mt-2 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.followersSeries.map((r) => ({ ...r, label: new Date(r.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) }))}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} interval={4}
                  tick={{ fill: "color-mix(in srgb, var(--foreground) 40%, transparent)", fontSize: 9 }} />
                <Tooltip
                  cursor={{ fill: "rgba(var(--lz-brand-light-rgb),0.08)" }}
                  content={({ active, payload }: any) => active && payload?.length ? (
                    <div className="bg-background border border-foreground/10 rounded-md px-2 py-1 text-[10px] text-foreground/80 shadow-xl">
                      {payload[0].payload.label}: <b>{payload[0].value >= 0 ? "+" : ""}{payload[0].value.toLocaleString("pt-BR")}</b>
                    </div>
                  ) : null}
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {data.followersSeries.map((r, i) => (
                    <Cell key={i} fill={r.value >= 0 ? "#7ED957" : "#FF6B6B"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {topContent.length > 0 && (
        <div className="mb-5">
          <span className="text-[11px] uppercase font-bold tracking-wider text-foreground/50 block mb-2.5">Conteúdo mais relevante</span>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {topContent.map(({ m, r }) => (
              <div key={m.id} className="relative shrink-0 w-[84px] aspect-[9/16] rounded-md overflow-hidden bg-foreground/5">
                {m.thumbnailUrl && <img src={m.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />}
                <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[9px] font-bold text-white bg-black/60 rounded px-1.5 py-0.5">
                  <Eye size={9} /> {(r.views ?? r.reach ?? 0).toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <div className="rounded-lg border border-foreground/8 bg-card p-4">
          <span className="text-[11px] uppercase font-bold tracking-wider text-foreground/50">Frequência de postagem</span>
          <div className="h-40 mt-2 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.postingFrequency}>
                <XAxis dataKey="day" axisLine={false} tickLine={false}
                  tick={{ fill: "color-mix(in srgb, var(--foreground) 40%, transparent)", fontSize: 9 }} />
                <Tooltip
                  cursor={{ fill: "rgba(var(--lz-brand-light-rgb),0.08)" }}
                  content={({ active, payload }: any) => active && payload?.length ? (
                    <div className="bg-background border border-foreground/10 rounded-md px-2 py-1 text-[10px] text-foreground/80 shadow-xl">
                      {payload[0].payload.day}: <b>{payload[0].value}</b> post{payload[0].value === 1 ? "" : "s"}
                    </div>
                  ) : null}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {data.postingFrequency.map((d, i) => (
                    <Cell key={i} fill={d.count === maxFreq && maxFreq > 0 ? "var(--lz-accent-ink)" : "rgba(var(--lz-brand-light-rgb),0.4)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {data.onlineFollowers && (
          <div className="rounded-lg border border-foreground/8 bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase font-bold tracking-wider text-foreground/50">Seguidores online por horário</span>
              {bestHour && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: "var(--lz-accent-ink)", backgroundColor: "rgba(var(--lz-brand-rgb),0.12)" }}>
                  Melhor: {String(bestHour.hour).padStart(2, "0")}h
                </span>
              )}
            </div>
            <div className="h-32 mt-2 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.onlineFollowers.map((h) => ({ ...h, label: `${String(h.hour).padStart(2, "0")}h` }))}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} interval={2}
                    tick={{ fill: "color-mix(in srgb, var(--foreground) 40%, transparent)", fontSize: 9 }} />
                  <Tooltip
                    cursor={{ fill: "rgba(var(--lz-brand-light-rgb),0.08)" }}
                    content={({ active, payload }: any) => active && payload?.length ? (
                      <div className="bg-background border border-foreground/10 rounded-md px-2 py-1 text-[10px] text-foreground/80 shadow-xl">
                        {payload[0].payload.label}: <b>{payload[0].value.toLocaleString("pt-BR")}</b> online
                      </div>
                    ) : null}
                  />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {data.onlineFollowers.map((h, i) => (
                      <Cell key={i} fill={h.value === maxOnline && maxOnline > 0 ? "var(--lz-accent-ink)" : "rgba(var(--lz-brand-light-rgb),0.4)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Lista de conteúdo no estilo Instagram: miniatura + legenda + horário +
 * ícones de engajamento, número grande à direita conforme a métrica
 * escolhida nas pills. Clicar abre o detalhe (comentários + resposta). */
function ConteudoPane({ clientId, clientName, mediaState }: { clientId: string; clientName: string; mediaState: ReturnType<typeof useAccountMediaWithInsights> }) {
  const { media, mediaError, loadingMedia, loadingInsights, results } = mediaState;
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [metric, setMetric] = useState<keyof InstagramMediaInsights>("views");
  // "date" é a ordem padrão (mais recente primeiro, igual a Meta já devolve)
  // — clicar numa pill de métrica passa a ordenar por ela também, igual o
  // Instagram de verdade faz.
  const [sortBy, setSortBy] = useState<keyof InstagramMediaInsights | "date">("date");
  const [selected, setSelected] = useState<InstagramAccountMedia | null>(null);

  const filtered = (media ?? []).filter((m) => typeFilter === "ALL" || m.mediaProductType === typeFilter);
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "date") return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    const ra = results.get(a.id);
    const rb = results.get(b.id);
    const va = ra?.error ? null : ra?.[sortBy] ?? null;
    const vb = rb?.error ? null : rb?.[sortBy] ?? null;
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return (vb as number) - (va as number);
  });
  const metricLabel = CONTENT_METRIC_PILLS.find((p) => p.key === metric)?.label ?? "";

  function selectMetric(key: keyof InstagramMediaInsights) {
    setMetric(key);
    setSortBy(key);
  }

  function exportCsv() {
    if (!media) return;
    const header = ["Legenda", "Tipo", "Publicado em", "Pelo Modo Criador", ...CONTENT_METRIC_PILLS.map((c) => c.label), "Erro"];
    const lines = [header.map(csvEscape).join(",")];
    for (const m of media) {
      const r = results.get(m.id);
      const row = [
        (m.caption ?? "").slice(0, 120) || "(sem legenda)",
        productTypeLabel(m.mediaProductType),
        new Date(m.timestamp).toLocaleString("pt-BR"),
        m.publishedByApp ? "Sim" : "Não",
        ...CONTENT_METRIC_PILLS.map((c) => String(r?.[c.key] ?? "")),
        r?.error ?? r?.degradedReason ?? "",
      ];
      lines.push(row.map((v) => csvEscape(String(v))).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metricas-instagram-${clientName.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-background border border-foreground/10 rounded-md px-2.5 py-1.5 text-xs font-bold text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
        >
          {CONTENT_TYPE_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        {media && media.length > 0 && (
          <button onClick={exportCsv} className="text-xs px-3 py-1.5 rounded-md border border-foreground/10 text-foreground/70 hover:text-foreground inline-flex items-center gap-1.5">
            <Download size={13} /> Exportar CSV
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {CONTENT_METRIC_PILLS.map((p) => (
            <button
              key={p.key}
              onClick={() => selectMetric(p.key)}
              title={`Mostrar e ordenar por ${p.label.toLowerCase()}`}
              className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition"
              style={sortBy === p.key
                ? { background: "rgba(var(--lz-brand-rgb),0.16)", color: "var(--lz-accent-ink)" }
                : { background: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 50%, transparent)" }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {sortBy !== "date" && (
          <button
            onClick={() => setSortBy("date")}
            title="Voltar pra ordem de publicação (mais recente primeiro)"
            className="shrink-0 text-[11px] font-semibold text-foreground/50 hover:text-foreground inline-flex items-center gap-1"
          >
            <Clock size={11} /> Ordem de publicação
          </button>
        )}
      </div>

      {loadingMedia && <div className="text-center py-10"><Loader2 size={18} className="animate-spin mx-auto text-foreground/30" /></div>}
      {mediaError && <p className="text-xs text-red-400/80">{mediaError}</p>}
      {!loadingMedia && sorted.length === 0 && <p className="text-xs text-foreground/40 text-center py-6">Nenhuma publicação encontrada nessa conta do Instagram.</p>}

      <div className="divide-y divide-foreground/8">
        {sorted.map((m) => {
          const r = results.get(m.id);
          const bigValue = r?.error ? null : r?.[metric] ?? null;
          return (
            <button key={m.id} onClick={() => setSelected(m)} className="w-full flex items-center gap-3 py-2.5 text-left hover:bg-foreground/[0.02] transition-colors">
              <div className="relative w-12 h-12 rounded-md overflow-hidden bg-foreground/5 shrink-0">
                {m.thumbnailUrl ? (
                  <img src={m.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center"><ImageIcon size={16} className="text-foreground/15" /></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-foreground truncate">
                  {m.caption ? m.caption.slice(0, 42) + (m.caption.length > 42 ? "…" : "") : "(sem legenda)"}
                  <span className="text-foreground/35 text-[11px] ml-1.5">{timeAgo(m.timestamp)}</span>
                </p>
                <div className="flex items-center gap-3 text-[11px] text-foreground/35 mt-1">
                  <span className="flex items-center gap-1"><Heart size={11} />{r?.error ? "—" : r?.likes ?? "—"}</span>
                  <span className="flex items-center gap-1"><MessageCircle size={11} />{r?.error ? "—" : r?.comments ?? "—"}</span>
                  <span className="flex items-center gap-1"><Send size={11} />{r?.error ? "—" : r?.shares ?? "—"}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[15px] font-extrabold tabular-nums text-foreground">
                  {r ? (r.error ? "—" : bigValue != null ? bigValue.toLocaleString("pt-BR") : "—") : (loadingInsights ? <Loader2 size={13} className="animate-spin inline" /> : "—")}
                </div>
                <div className="text-[9.5px] text-foreground/35">{metricLabel}</div>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <PostDetailModal clientId={clientId} media={selected} insights={results.get(selected.id) ?? null} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/** Público (demografia dos seguidores) — mesmos dados de sempre
 * (getInstagramAccountOverview), reaproveitando o cache da aba Visão geral
 * (mesma queryKey) — trocar de aba não refaz a chamada. */
function PublicoPane({ clientId }: { clientId: string }) {
  const getOverview = useServerFn(getInstagramAccountOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["instagram-account-overview", clientId],
    queryFn: () => getOverview({ data: { clientId } }),
  });

  if (isLoading) return <div className="text-center py-10"><Loader2 size={18} className="animate-spin mx-auto text-foreground/30" /></div>;
  if (error || !data) return <p className="text-xs text-red-400/80 py-4">{(error as any)?.message ?? "Não foi possível carregar o painel de insights."}</p>;
  if (!data.demographics) return <p className="text-xs text-foreground/40 text-center py-8">Essa conta ainda não tem seguidores suficientes pra Meta liberar dados de público.</p>;

  return (
    <div>
      <div className="mb-6">
        <span className="text-[11px] uppercase font-bold tracking-wider text-foreground/50 block mb-3">Gênero</span>
        {data.demographics.gender.map((g) => <ThinBar key={g.label} label={g.label} pct={g.pct} />)}
      </div>

      <div className="mb-6">
        <span className="text-[11px] uppercase font-bold tracking-wider text-foreground/50 block mb-2">Faixa etária</span>
        <div className="flex items-center gap-3 text-[10.5px] text-foreground/40 mb-3">
          <span className="flex items-center gap-1.5"><i className="inline-block w-2 h-2 rounded-full" style={{ background: "rgb(var(--lz-brand-rgb))" }} />Mulheres</span>
          <span className="flex items-center gap-1.5"><i className="inline-block w-2 h-2 rounded-full" style={{ background: "rgba(var(--lz-brand-rgb),0.35)" }} />Homens</span>
        </div>
        {data.demographics.age.map((a) => <AgeGenderBar key={a.label} {...a} />)}
      </div>

      <div>
        <span className="text-[11px] uppercase font-bold tracking-wider text-foreground/50 block mb-3">Principais localizações</span>
        {data.demographics.countries.map((c) => <ThinBar key={c.label} label={c.label} pct={c.pct} />)}
      </div>
    </div>
  );
}

const AVATAR_COLORS = ["#F58529", "#DD2A7B", "#8134AF", "#515BD4", "#7ED957", "#4FA3E3"];
function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
/** A Meta não devolve foto de perfil de quem comenta — um círculo com a
 * inicial (cor derivada do nome) fica bem mais próximo do Instagram de
 * verdade do que um ícone genérico repetido em todo comentário. */
function CommentAvatar({ username, size = 32 }: { username: string | null; size?: number }) {
  const label = username ?? "?";
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4, background: avatarColor(label) }}
    >
      {label[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} sem`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function CommentRow({ comment, reply, isReply, onReply }: {
  comment: InstagramComment | InstagramComment["replies"][number];
  reply: { draft: string; sending: boolean; open: boolean };
  isReply?: boolean;
  onReply: (patch: Partial<{ draft: string; open: boolean }>, send?: boolean) => void;
}) {
  return (
    <div className="flex gap-2.5">
      <CommentAvatar username={comment.username} size={isReply ? 26 : 32} />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-foreground leading-snug">
          <span className="font-bold">{comment.username ?? "seguidor"}</span>{" "}
          <span className="text-foreground/90">{comment.text}</span>
        </p>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-foreground/40">
          <span>{timeAgo(comment.timestamp)}</span>
          {!isReply && (
            <button onClick={() => onReply({ open: !reply.open })} className="font-semibold hover:text-foreground/70">
              Responder
            </button>
          )}
        </div>
        {reply.open && !isReply && (
          <div className="flex items-center gap-1.5 mt-2">
            <input
              autoFocus
              value={reply.draft}
              onChange={(e) => onReply({ draft: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") onReply({}, true); }}
              placeholder={`Respondendo a ${comment.username ?? "seguidor"}…`}
              className="flex-1 bg-transparent border-b border-foreground/15 py-1 text-[13px] outline-none focus:border-foreground/40 placeholder:text-foreground/30"
            />
            <button
              onClick={() => onReply({}, true)}
              disabled={reply.sending || !reply.draft.trim()}
              className="text-[12px] font-bold disabled:opacity-30"
              style={{ color: "var(--lz-accent-ink)" }}
            >
              {reply.sending ? <Loader2 size={13} className="animate-spin" /> : "Enviar"}
            </button>
          </div>
        )}
      </div>
      {!isReply && "likeCount" in comment && comment.likeCount > 0 && (
        <div className="flex flex-col items-center text-foreground/30 shrink-0 pt-0.5">
          <Heart size={11} />
          <span className="text-[10px] mt-0.5">{comment.likeCount}</span>
        </div>
      )}
    </div>
  );
}

/** Modal de post no estilo do próprio Instagram: mídia à esquerda,
 * legenda + comentários + composer à direita — reusa a mesma lógica de
 * carregar/responder/comentar que já existia no modal antigo, só
 * reorganizada nesse layout de duas colunas. */
function PostDetailModal({ clientId, media, insights, onClose }: {
  clientId: string; media: InstagramAccountMedia; insights: (InstagramMediaInsights & { error?: string }) | null; onClose: () => void;
}) {
  const getComments = useServerFn(getInstagramComments);
  const doReply = useServerFn(replyToInstagramComment);
  const doPostComment = useServerFn(postInstagramComment);
  const [comments, setComments] = useState<InstagramComment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyState, setReplyState] = useState<Record<string, { draft: string; sending: boolean; open: boolean }>>({});
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [composerDraft, setComposerDraft] = useState("");
  const [posting, setPosting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await getComments({ data: { clientId, mediaId: media.id } });
      setComments(r);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao buscar comentários.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function replyFor(id: string) {
    return replyState[id] ?? { draft: "", sending: false, open: false };
  }

  async function sendReply(commentId: string) {
    const message = replyFor(commentId).draft.trim();
    if (!message) return;
    setReplyState((s) => ({ ...s, [commentId]: { ...replyFor(commentId), sending: true } }));
    try {
      await doReply({ data: { clientId, commentId, message } });
      setReplyState((s) => ({ ...s, [commentId]: { draft: "", sending: false, open: false } }));
      setExpandedReplies((s) => new Set(s).add(commentId));
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Falha ao responder o comentário.");
      setReplyState((s) => ({ ...s, [commentId]: { ...replyFor(commentId), sending: false } }));
    }
  }

  async function postComment() {
    const message = composerDraft.trim();
    if (!message) return;
    setPosting(true);
    try {
      await doPostComment({ data: { clientId, mediaId: media.id, message } });
      setComposerDraft("");
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Falha ao publicar o comentário.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="bg-card border border-foreground/10 rounded-2xl w-full max-w-4xl h-[85vh] flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mídia — igual a coluna esquerda do post aberto no próprio Instagram */}
        <div className="hidden sm:flex flex-1 bg-black items-center justify-center relative">
          {media.thumbnailUrl ? (
            <img src={media.thumbnailUrl} alt="" className="max-w-full max-h-full object-contain" />
          ) : (
            <ImageIcon size={40} className="text-white/20" />
          )}
          {media.mediaProductType !== "FEED" && (
            <span
              className="absolute top-3 left-3 text-[10px] font-bold uppercase px-2 py-1 rounded tracking-wider"
              style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#FFFFFF", backdropFilter: "blur(2px)" }}
            >
              {productTypeLabel(media.mediaProductType)}
            </span>
          )}
        </div>

        {/* Legenda + comentários + composer */}
        <div className="w-full sm:w-[380px] flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-2 p-3.5 border-b border-foreground/10">
            <div className="flex items-center gap-2 min-w-0">
              <CommentAvatar username={media.publishedByApp ? "Modo Criador" : "Instagram"} size={30} />
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-foreground truncate">
                  {media.publishedByApp ? "Publicado pelo Modo Criador" : productTypeLabel(media.mediaProductType)}
                </div>
                <div className="text-[10px] text-foreground/40">{new Date(media.timestamp).toLocaleDateString("pt-BR")}</div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {media.permalink && (
                <a href={media.permalink} target="_blank" rel="noreferrer" className="p-1.5 rounded-full text-foreground/50 hover:text-foreground hover:bg-foreground/5">
                  <ExternalLink size={15} />
                </a>
              )}
              <button onClick={onClose} className="p-1.5 rounded-full text-foreground/50 hover:text-foreground hover:bg-foreground/5">
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
            {media.caption && (
              <div className="flex gap-2.5">
                <CommentAvatar username={media.publishedByApp ? "Modo Criador" : "Instagram"} size={30} />
                <p className="text-[13px] text-foreground/90 leading-snug">
                  <span className="font-bold">{media.publishedByApp ? "modocriador" : "legenda"}</span> {media.caption}
                </p>
              </div>
            )}
            {loading && <div className="text-center py-8"><Loader2 size={16} className="animate-spin mx-auto text-foreground/30" /></div>}
            {error && <p className="text-xs text-red-400/80">{error}</p>}
            {!loading && comments && comments.length === 0 && (
              <div className="text-center py-8 text-foreground/40 text-sm">
                <MessageCircle size={20} className="mx-auto mb-2 opacity-40" />
                Nenhum comentário ainda.
              </div>
            )}
            {!loading && comments?.map((c) => (
              <div key={c.id}>
                <CommentRow comment={c} reply={replyFor(c.id)} onReply={(patch, send) => {
                  if (send) { sendReply(c.id); return; }
                  setReplyState((s) => ({ ...s, [c.id]: { ...replyFor(c.id), ...patch } }));
                }} />
                {c.replies.length > 0 && (
                  <div className="ml-[42px] mt-2">
                    {!expandedReplies.has(c.id) ? (
                      <button
                        onClick={() => setExpandedReplies((s) => new Set(s).add(c.id))}
                        className="flex items-center gap-2 text-[12px] font-semibold text-foreground/40 hover:text-foreground/70"
                      >
                        <span className="w-6 h-px bg-foreground/20" />
                        Ver {c.replies.length} resposta{c.replies.length > 1 ? "s" : ""}
                      </button>
                    ) : (
                      <div className="space-y-3">
                        {c.replies.map((r) => (
                          <CommentRow key={r.id} comment={r} isReply reply={{ draft: "", sending: false, open: false }} onReply={() => {}} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-foreground/10 p-3">
            {insights && !insights.error && (insights.likes != null || insights.comments != null) && (
              <div className="flex items-center gap-4 mb-2.5 text-foreground/70">
                <span className="flex items-center gap-1.5 text-[13px] font-bold"><Heart size={16} /> {insights.likes ?? "—"} curtidas</span>
                <span className="flex items-center gap-1.5 text-[13px] font-bold"><MessageCircle size={16} /> {insights.comments ?? "—"} comentários</span>
              </div>
            )}
            <div className="flex items-center gap-2.5">
              <CommentAvatar username={media.publishedByApp ? "Modo Criador" : "Conta"} size={28} />
              <input
                value={composerDraft}
                onChange={(e) => setComposerDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") postComment(); }}
                placeholder="Adicione um comentário…"
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-foreground/30"
              />
              <button
                onClick={postComment}
                disabled={posting || !composerDraft.trim()}
                className="text-[13px] font-bold disabled:opacity-30 shrink-0"
                style={{ color: "var(--lz-accent-ink)" }}
              >
                {posting ? <Loader2 size={14} className="animate-spin" /> : "Publicar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DirectMessagesPanel({ clientId }: { clientId: string }) {
  const getConversations = useServerFn(getInstagramConversations);
  const getMessages = useServerFn(getInstagramConversationMessages);
  const sendMessage = useServerFn(sendInstagramDirectMessage);

  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<InstagramConversation[] | null>(null);
  const [activeConversation, setActiveConversation] = useState<InstagramConversation | null>(null);
  const [messages, setMessages] = useState<InstagramDirectMessage[] | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function loadConversations() {
    setLoading(true);
    setError(null);
    try {
      const r = await getConversations({ data: { clientId } });
      setConversations(r);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao buscar as conversas do Direct.");
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }

  async function openConversation(c: InstagramConversation) {
    setActiveConversation(c);
    setMessages(null);
    setLoadingMessages(true);
    setError(null);
    try {
      const r = await getMessages({ data: { clientId, conversationId: c.id } });
      setMessages(r);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao buscar as mensagens.");
    } finally {
      setLoadingMessages(false);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || !activeConversation?.participantId) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage({ data: { clientId, recipientId: activeConversation.participantId, message: text } });
      setDraft("");
      await openConversation(activeConversation);
    } catch (e: any) {
      setError(e?.message ?? "Falha ao enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mb-8 rounded-lg border border-foreground/8 bg-card p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-foreground/60">
          <Mail size={14} />
          <span className="text-[11px] uppercase font-bold tracking-wider">Direct</span>
          <span className="text-[10px] text-foreground/35 normal-case font-normal">— veja e responda as mensagens da conta</span>
        </div>
        {!loaded && (
          <button
            onClick={loadConversations} disabled={loading}
            className="lz-btn-primary text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
            {loading ? "Buscando…" : "Carregar Direct"}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-400/80 mb-2">{error}</p>}

      {loaded && conversations && conversations.length === 0 && (
        <p className="text-xs text-foreground/40">Nenhuma conversa encontrada nessa conta.</p>
      )}

      {loaded && conversations && conversations.length > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "220px 1fr" }}>
          <div className="border border-foreground/8 rounded-lg overflow-hidden max-h-[360px] overflow-y-auto">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c)}
                className="w-full text-left px-3 py-2.5 border-b border-foreground/5 last:border-0 hover:bg-foreground/5 transition-colors"
                style={activeConversation?.id === c.id ? { backgroundColor: "rgba(var(--lz-brand-rgb),0.1)" } : undefined}
              >
                <div className="text-xs font-bold text-foreground truncate">@{c.participantUsername ?? "desconhecido"}</div>
                {c.lastMessagePreview && (
                  <div className="text-[10px] text-foreground/40 truncate mt-0.5">{c.lastMessagePreview}</div>
                )}
              </button>
            ))}
          </div>

          <div className="border border-foreground/8 rounded-lg flex flex-col max-h-[360px]">
            {!activeConversation && (
              <div className="flex-1 flex items-center justify-center text-xs text-foreground/30 p-6 text-center">
                Escolha uma conversa pra ver as mensagens.
              </div>
            )}
            {activeConversation && (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {loadingMessages && <div className="text-center py-6"><Loader2 size={15} className="animate-spin mx-auto text-foreground/30" /></div>}
                  {!loadingMessages && messages?.map((m) => (
                    <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className="max-w-[75%] rounded-lg px-2.5 py-1.5 text-xs"
                        style={m.fromMe
                          ? { backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }
                          : { backgroundColor: "color-mix(in srgb, var(--foreground) 8%, transparent)" }}
                      >
                        {m.text ?? "(mídia ou mensagem não suportada)"}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 p-2.5 border-t border-foreground/8">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                    placeholder="Escreva uma mensagem…"
                    className="flex-1 bg-background border border-foreground/10 rounded-md px-2.5 py-1.5 text-xs outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
                  />
                  <button
                    onClick={send}
                    disabled={sending || !draft.trim()}
                    className="p-1.5 rounded-md text-foreground/50 hover:text-foreground disabled:opacity-30"
                  >
                    {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  </button>
                </div>
                <p className="text-[9px] text-foreground/30 px-2.5 pb-2">
                  O Instagram só permite responder dentro de 24h da última mensagem recebida.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivitySection({ label, icon, items, thumbs, dateOf, datePrefix }: {
  label: string;
  icon: React.ReactNode;
  items: InstagramActivityItem[];
  thumbs: Record<string, { thumbUrl: string | null; fileCount: number }> | undefined;
  dateOf: (i: InstagramActivityItem) => string;
  datePrefix: string;
}) {
  const navigate = useNavigate();
  const { selectMonth, openItem, flash } = useUI();

  function goToItem(item: InstagramActivityItem) {
    navigate({ to: "/cliente/$clientId", params: { clientId: item.clientId } });
    selectMonth(item.monthKey);
    setTimeout(() => { openItem(item.id); flash(item.id); }, 50);
    setTimeout(() => flash(null), 2050);
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-1.5 mb-3 text-foreground/50">
        {icon}
        <span className="text-[11px] uppercase font-bold tracking-wider">{label}</span>
        <span className="text-[11px] text-foreground/30">· {items.length}</span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => goToItem(item)}
            className="text-left group rounded-lg overflow-hidden bg-card border border-foreground/7 hover:border-foreground/20 transition"
          >
            <div className="relative aspect-square bg-[#111]">
              {thumbs?.[item.id]?.thumbUrl ? (
                <img src={thumbs[item.id]!.thumbUrl!} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <ImageIcon size={22} className="text-foreground/15" />
                </div>
              )}
              <span
                className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider"
                style={{ backgroundColor: "rgba(0,0,0,0.6)", color: "#FFFFFF", backdropFilter: "blur(2px)" }}
              >
                {typeLabel(item)}
              </span>
              {item.igLastError && (
                <span
                  title={item.igLastError}
                  className="absolute top-1.5 right-1.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider"
                  style={{ backgroundColor: "rgba(220,38,38,0.85)", color: "#FFFFFF", backdropFilter: "blur(2px)" }}
                >
                  Falhou
                </span>
              )}
            </div>
            <div className="p-2">
              <span
                className="inline-block max-w-full truncate text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mb-1"
                style={{ backgroundColor: `${item.clientColor}22`, color: item.clientColor }}
              >
                {item.clientName}
              </span>
              <div className="text-foreground text-xs truncate group-hover:text-foreground/80 transition">{item.title}</div>
              <div className="text-[10px] text-foreground/35 mt-0.5">
                {datePrefix} {new Date(dateOf(item)).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </div>
              {item.igLastError && (
                <div className="text-[10px] text-red-400/80 mt-0.5 truncate" title={item.igLastError}>{item.igLastError}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
