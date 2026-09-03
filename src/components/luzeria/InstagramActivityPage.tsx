import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Instagram, Clock, CheckCircle2, Image as ImageIcon, BarChart3, Download, Loader2, ArrowUpDown, ExternalLink,
  Sparkles, Users, Eye, Heart, TrendingUp, TrendingDown,
} from "lucide-react";
import { instagramActivityQO, gridThumbnailsQO, useMe } from "@/lib/luzeria/queries";
import {
  getInstagramAccountMedia, getInstagramAccountMediaInsights, getInstagramAccountOverview,
  type InstagramActivityItem, type InstagramAccountMedia, type InstagramMediaInsights, type InstagramAccountOverview,
} from "@/lib/luzeria/instagram.functions";
import { useUI } from "@/lib/luzeria/ui-store";
import { POST_FORMAT_LABEL, CONTENT_TYPE_LABEL } from "@/lib/luzeria/types";

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
    <div className="px-5 md:px-10 py-8 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Instagram size={20} className="text-[var(--lz-accent-ink)]" />
        <h1 className="text-[28px] font-bold text-foreground tracking-tight">Instagram</h1>
      </div>
      <p className="text-xs text-foreground/40 mb-5">
        Posts programados e já publicados pelo Modo Criador, de todos os clientes. Publicação feita direto no
        Instagram (fora do app) não aparece aqui — pra ver tudo da conta de um cliente, use o painel de métricas
        abaixo.
      </p>

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
        <AccountOverviewDashboard key={clientFilter} clientId={clientFilter} clientName={clients.find((c) => c.id === clientFilter)?.name ?? ""} />
      )}

      {clientFilter && (
        <MetricsPanel key={`table-${clientFilter}`} clientId={clientFilter} clientName={clients.find((c) => c.id === clientFilter)?.name ?? ""} />
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
    </div>
  );
}

function KpiCard({ icon, label, value, changePct }: { icon: React.ReactNode; label: string; value: number; changePct: number | null }) {
  return (
    <div className="rounded-lg border border-foreground/8 bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-foreground/40 mb-1.5">
        {icon}
        <span className="text-[10px] uppercase font-bold tracking-wider">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-bold text-foreground tabular-nums">{value.toLocaleString("pt-BR")}</span>
        {changePct !== null && (
          <span
            className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{
              color: changePct >= 0 ? "#7ED957" : "#FF6B6B",
              backgroundColor: changePct >= 0 ? "rgba(126,217,87,0.12)" : "rgba(255,107,107,0.12)",
            }}
          >
            {changePct >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(changePct)}%
          </span>
        )}
      </div>
    </div>
  );
}

function DemographicBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-24 shrink-0 text-foreground/60 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-foreground/8 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "rgb(var(--lz-brand-rgb))" }} />
      </div>
      <span className="w-9 shrink-0 text-right text-foreground/50 tabular-nums">{pct}%</span>
    </div>
  );
}

/** Dashboard estilo "Insights do Instagram" — carrega sozinho ao escolher
 * um cliente (poucas chamadas: perfil, métricas de conta em série e
 * demografia), diferente do painel de desempenho por publicação abaixo
 * (que é sob demanda porque faz 1 chamada por post). */
function AccountOverviewDashboard({ clientId, clientName }: { clientId: string; clientName: string }) {
  const getOverview = useServerFn(getInstagramAccountOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["instagram-account-overview", clientId],
    queryFn: () => getOverview({ data: { clientId } }),
  });

  if (isLoading) {
    return (
      <div className="mb-6 rounded-lg border border-foreground/8 bg-card p-8 text-center">
        <Loader2 size={18} className="animate-spin mx-auto text-foreground/30" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mb-6 rounded-lg border border-foreground/8 bg-card p-4 text-xs text-red-400/80">
        {(error as any)?.message ?? "Não foi possível carregar o painel de insights."}
      </div>
    );
  }

  const maxReach = Math.max(...data.reachSeries.map((r) => r.value), 1);
  const maxFreq = Math.max(...data.postingFrequency.map((d) => d.count), 1);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-1.5 mb-3 text-foreground/60">
        <BarChart3 size={14} />
        <span className="text-[11px] uppercase font-bold tracking-wider">Insights de {clientName}</span>
        {data.username && <span className="text-[11px] text-foreground/35">@{data.username}</span>}
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <KpiCard icon={<Users size={12} />} label="Seguidores" value={data.followersCount} changePct={null} />
        <KpiCard icon={<Eye size={12} />} label="Alcance (30d)" value={data.kpis.reach} changePct={data.kpis.reachChangePct} />
        <KpiCard icon={<Sparkles size={12} />} label="Visitas ao perfil" value={data.kpis.profileViews} changePct={data.kpis.profileViewsChangePct} />
        <KpiCard icon={<Heart size={12} />} label="Interações" value={data.kpis.totalInteractions} changePct={data.kpis.totalInteractionsChangePct} />
      </div>

      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "2fr 1fr" }}>
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
      </div>

      {data.demographics && (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <div className="rounded-lg border border-foreground/8 bg-card p-4">
            <span className="text-[11px] uppercase font-bold tracking-wider text-foreground/50 block mb-3">Gênero</span>
            <div className="space-y-2">
              {data.demographics.gender.map((g) => <DemographicBar key={g.label} label={g.label} pct={g.pct} />)}
            </div>
          </div>
          <div className="rounded-lg border border-foreground/8 bg-card p-4">
            <span className="text-[11px] uppercase font-bold tracking-wider text-foreground/50 block mb-3">Idade</span>
            <div className="space-y-2">
              {data.demographics.age.map((a) => <DemographicBar key={a.label} label={a.label} pct={a.pct} />)}
            </div>
          </div>
          <div className="rounded-lg border border-foreground/8 bg-card p-4">
            <span className="text-[11px] uppercase font-bold tracking-wider text-foreground/50 block mb-3">País</span>
            <div className="space-y-2">
              {data.demographics.countries.map((c) => <DemographicBar key={c.label} label={c.label} pct={c.pct} />)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const METRIC_COLUMNS: { key: keyof InstagramMediaInsights; label: string }[] = [
  { key: "reach", label: "Alcance" },
  { key: "likes", label: "Curtidas" },
  { key: "comments", label: "Comentários" },
  { key: "saved", label: "Salvamentos" },
  { key: "shares", label: "Compart." },
  { key: "views", label: "Visualizações" },
];

function csvEscape(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

/** Painel de métricas por cliente — busca TODAS as publicações reais da
 * conta do Instagram desse cliente (direto na Meta, não só o que passou
 * pelo Modo Criador), depois carrega o alcance/curtidas/etc de cada uma sob
 * demanda. Depende da permissão `instagram_business_manage_insights`,
 * ainda não aprovada pela Meta — enquanto isso, "Carregar métricas" mostra
 * o erro real que a Meta devolve pra cada publicação. */
function MetricsPanel({ clientId, clientName }: { clientId: string; clientName: string }) {
  const getMedia = useServerFn(getInstagramAccountMedia);
  const getInsights = useServerFn(getInstagramAccountMediaInsights);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [media, setMedia] = useState<InstagramAccountMedia[] | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [results, setResults] = useState<Map<string, InstagramMediaInsights & { error?: string }> | null>(null);
  const [sortKey, setSortKey] = useState<keyof InstagramMediaInsights>("reach");

  async function loadMedia() {
    setLoadingMedia(true);
    setMediaError(null);
    setResults(null);
    try {
      const r = await getMedia({ data: { clientId } });
      setMedia(r.items);
    } catch (e: any) {
      setMediaError(e?.message ?? "Falha ao listar publicações do Instagram.");
    } finally {
      setLoadingMedia(false);
    }
  }

  async function loadInsights() {
    if (!media) return;
    setLoadingInsights(true);
    const next = new Map<string, InstagramMediaInsights & { error?: string }>();
    for (const m of media) {
      try {
        const insights = await getInsights({ data: { clientId, mediaId: m.id, mediaProductType: m.mediaProductType } });
        next.set(m.id, insights);
      } catch (e: any) {
        next.set(m.id, { itemId: m.id, reach: null, likes: null, comments: null, saved: null, shares: null, views: null, totalInteractions: null, degradedReason: null, error: e?.message ?? "Falha ao buscar" });
      }
      // Pequena pausa entre chamadas pra não estourar limite de taxa da Meta.
      await new Promise((r) => setTimeout(r, 250));
    }
    setResults(next);
    setLoadingInsights(false);
  }

  const sorted = useMemo(() => {
    if (!media) return [];
    if (!results) return media;
    return [...media].sort((a, b) => {
      const av = results.get(a.id)?.[sortKey] as number | null ?? -1;
      const bv = results.get(b.id)?.[sortKey] as number | null ?? -1;
      return bv - av;
    });
  }, [media, results, sortKey]);

  function exportCsv() {
    if (!media) return;
    const header = ["Legenda", "Tipo", "Publicado em", "Pelo Modo Criador", ...METRIC_COLUMNS.map((c) => c.label), "Erro"];
    const lines = [header.map(csvEscape).join(",")];
    for (const m of sorted) {
      const r = results?.get(m.id);
      const row = [
        (m.caption ?? "").slice(0, 120) || "(sem legenda)",
        productTypeLabel(m.mediaProductType),
        new Date(m.timestamp).toLocaleString("pt-BR"),
        m.publishedByApp ? "Sim" : "Não",
        ...METRIC_COLUMNS.map((c) => String(r?.[c.key] ?? "")),
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
    <div className="mb-8 rounded-lg border border-foreground/8 bg-card p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-foreground/60">
          <BarChart3 size={14} />
          <span className="text-[11px] uppercase font-bold tracking-wider">Desempenho por publicação</span>
          <span className="text-[10px] text-foreground/35 normal-case font-normal">— toda a conta, não só o que passou pelo app</span>
        </div>
        <div className="flex items-center gap-2">
          {!media && (
            <button
              onClick={loadMedia} disabled={loadingMedia}
              className="lz-btn-primary text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {loadingMedia ? <Loader2 size={13} className="animate-spin" /> : <Instagram size={13} />}
              {loadingMedia ? "Buscando…" : "Carregar publicações da conta"}
            </button>
          )}
          {media && !results && (
            <button
              onClick={loadInsights} disabled={loadingInsights || media.length === 0}
              className="lz-btn-primary text-xs px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {loadingInsights ? <Loader2 size={13} className="animate-spin" /> : <BarChart3 size={13} />}
              {loadingInsights ? "Carregando métricas…" : "Carregar métricas"}
            </button>
          )}
          {results && (
            <button onClick={exportCsv} className="text-xs px-3 py-1.5 rounded-md border border-foreground/10 text-foreground/70 hover:text-foreground inline-flex items-center gap-1.5">
              <Download size={13} /> Exportar CSV
            </button>
          )}
        </div>
      </div>

      {mediaError && <p className="text-xs text-red-400/80">{mediaError}</p>}
      {media && media.length === 0 && <p className="text-xs text-foreground/40">Nenhuma publicação encontrada nessa conta do Instagram.</p>}

      {media && media.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-foreground/40 border-b border-foreground/8">
                <th className="py-1.5 pr-3 font-semibold">Publicação</th>
                <th className="py-1.5 pr-3 font-semibold">Tipo</th>
                {results && METRIC_COLUMNS.map((c) => (
                  <th key={c.key} className="py-1.5 pr-3 font-semibold">
                    <button onClick={() => setSortKey(c.key)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
                      {c.label} {sortKey === c.key && <ArrowUpDown size={10} />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => {
                const r = results?.get(m.id);
                return (
                  <tr key={m.id} className="border-b border-foreground/5 last:border-0">
                    <td className="py-1.5 pr-3 max-w-[260px]">
                      <div className="flex items-center gap-2">
                        {m.thumbnailUrl && <img src={m.thumbnailUrl} alt="" className="w-7 h-7 rounded object-cover shrink-0" />}
                        <div className="min-w-0">
                          <div className="text-foreground/80 truncate">{m.caption || "(sem legenda)"}</div>
                          <div className="text-[10px] text-foreground/35 flex items-center gap-1.5">
                            {new Date(m.timestamp).toLocaleDateString("pt-BR")}
                            {m.publishedByApp && (
                              <span className="inline-flex items-center gap-0.5" title="Publicado pelo Modo Criador">
                                <Sparkles size={9} /> Modo Criador
                              </span>
                            )}
                            {m.permalink && (
                              <a href={m.permalink} target="_blank" rel="noreferrer" className="hover:text-foreground/70">
                                <ExternalLink size={9} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-1.5 pr-3 text-foreground/60">{productTypeLabel(m.mediaProductType)}</td>
                    {results && (
                      r?.error ? (
                        <td colSpan={METRIC_COLUMNS.length} className="py-1.5 pr-3 text-red-400/80">{r.error}</td>
                      ) : (
                        METRIC_COLUMNS.map((c) => (
                          <td key={c.key} className="py-1.5 pr-3 text-foreground/70 tabular-nums">{r?.[c.key] ?? "—"}</td>
                        ))
                      )
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
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
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
