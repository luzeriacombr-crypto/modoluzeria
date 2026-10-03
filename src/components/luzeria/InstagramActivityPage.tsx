import { useEffect, useMemo, useRef, useState } from "react";
import { FolderTabs } from "./FolderTabs";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useGoToItem } from "@/lib/luzeria/go-to-item";
import { useServerFn } from "@tanstack/react-start";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Instagram, Clock, CheckCircle2, Image as ImageIcon, BarChart3, Download, Loader2, ExternalLink, ChevronDown, ChevronUp,
  Sparkles, Users, Eye, Heart, TrendingUp, TrendingDown, MessageCircle, Send, X, Mail, CalendarDays, UserCheck, Cake, MapPin,
  Share2, Link2, Copy, Check, Sun, Moon, Bookmark, UserPlus, Percent,
} from "lucide-react";
import { Modal } from "./Modals";
import { toast } from "sonner";
import { getFacebookConnectionStatus, getFacebookPagePosts } from "@/lib/luzeria/facebook.functions";
import { instagramActivityQO, gridThumbnailsQO, clientsQO, useMe } from "@/lib/luzeria/queries";
import {
  getInstagramAccountMedia, getInstagramAccountMediaInsights, getInstagramAccountOverview, getInstagramFollowerHistory,
  getInstagramComments, replyToInstagramComment, postInstagramComment,
  getInstagramConversations, getInstagramConversationMessages, sendInstagramDirectMessage,
  getOrCreateInsightsShareToken, rotateInsightsShareToken, generateInsightsPdf,
  type InstagramActivityItem, type InstagramAccountMedia, type InstagramMediaInsights, type InstagramAccountOverview,
  type InstagramComment, type InstagramConversation, type InstagramDirectMessage, type InstagramFollowerHistory,
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
  // Antes vinha só dos itens de atividade (post programado/publicado) — um
  // cliente sem nada programado nunca aparecia no filtro, mesmo pra só ver
  // as métricas dele. Agora é a lista de clientes de verdade. Pedido do
  // Junior (01/10).
  const { data: allClients = [] } = useQuery(clientsQO());
  const clients = useMemo(
    () => [...allClients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name, color: c.color })),
    [allClients],
  );

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
      <FolderTabs size="sm" activeId={tab} onChange={(id) => setTab(id as any)} items={[{ id: "atividade", label: "Atividade" }, { id: "calendario", label: "Calendário" }]} />

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

const KPI_ACCENT: Record<string, string> = {
  seguidores: "rgb(var(--lz-brand-rgb))",
  alcance: "#7AA7FF",
  visitas: "#FFA67A",
  interacoes: "#D896FF",
  novos: "#7ED957",
  engajamento: "#FF8FB1",
};

function KpiTile({ label, value, changePct, icon, accent = "seguidores" }: {
  label: string; value: number | string; changePct: number | null; icon: React.ReactNode; accent?: keyof typeof KPI_ACCENT;
}) {
  const color = KPI_ACCENT[accent];
  return (
    <div className="rounded-2xl bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="h-[34px] w-[34px] rounded-[9px] flex items-center justify-center shrink-0"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}>
          {icon}
        </div>
        {changePct !== null && (
          <div
            className="inline-flex items-center gap-0.5 text-[10.5px] font-extrabold px-1.5 py-0.5 rounded-full"
            style={{
              color: changePct >= 0 ? "#7ED957" : "#FF6B6B",
              backgroundColor: changePct >= 0 ? "rgba(126,217,87,0.14)" : "rgba(255,107,107,0.14)",
            }}
          >
            {changePct >= 0 ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
            {Math.abs(changePct)}%
          </div>
        )}
      </div>
      <div>
        <div className="text-2xl font-extrabold text-foreground tabular-nums tracking-tight">{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</div>
        <div className="text-[11.5px] font-semibold text-foreground/40 mt-0.5 truncate" title={label}>{label}</div>
      </div>
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

/** Ponto único de acesso aos dados dos Insights — a versão autenticada
 * (dentro do app) e a pública (link de compartilhamento, sem login) batem
 * em server fns diferentes mas com o mesmo formato de resposta; todo o
 * resto da tela (panes, gráficos, cards) não precisa saber qual delas
 * está em uso. */
export type InsightsSource = {
  getOverview: () => Promise<InstagramAccountOverview | null>;
  getFollowerHistory: () => Promise<InstagramFollowerHistory | null>;
  getMedia: (after?: string) => Promise<{ items: InstagramAccountMedia[]; nextAfter: string | null } | null>;
  getMediaInsights: (mediaId: string, mediaProductType: string) => Promise<InstagramMediaInsights | null>;
};

export function useInstagramInsightsSource(clientId: string): InsightsSource {
  const getOverview = useServerFn(getInstagramAccountOverview);
  const getHistory = useServerFn(getInstagramFollowerHistory);
  const getMedia = useServerFn(getInstagramAccountMedia);
  const getMediaInsights = useServerFn(getInstagramAccountMediaInsights);
  return useMemo(() => ({
    getOverview: () => getOverview({ data: { clientId } }),
    getFollowerHistory: () => getHistory({ data: { clientId } }),
    getMedia: (after?: string) => getMedia({ data: { clientId, after } }),
    getMediaInsights: (mediaId: string, mediaProductType: string) => getMediaInsights({ data: { clientId, mediaId, mediaProductType } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [clientId]);
}

/** Carrega mídia real da conta + insights por post (1 chamada por post, com
 * pausa entre elas pra não estourar limite de taxa da Meta) — compartilhado
 * entre a aba "Conteúdo" (lista completa) e "Visão geral" ("conteúdo mais
 * relevante"), pra não duplicar a busca ao trocar de aba. */
function useAccountMediaWithInsights(cacheKey: string, source: InsightsSource) {
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
        const r = await source.getMedia();
        if (cancelled) return;
        items = r?.items ?? [];
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
          const insights = await source.getMediaInsights(m.id, m.mediaProductType);
          if (!cancelled && insights) setResults((prev) => new Map(prev).set(m.id, insights));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

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

/** Botão + modal pra gerar/copiar o link público desses Insights (o
 * cliente acessa sem login) — 1 link por cliente, rotacionável (gerar um
 * novo invalida o anterior, já que ele para de bater com o token salvo). */
function ShareInsightsButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const getOrCreate = useServerFn(getOrCreateInsightsShareToken);
  const rotate = useServerFn(rotateInsightsShareToken);

  async function openModal() {
    setOpen(true);
    if (token) return;
    setLoading(true);
    try {
      const r = await getOrCreate({ data: { clientId } });
      setToken(r.token);
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui gerar o link.");
      setOpen(false);
    }
    setLoading(false);
  }

  async function regenerate() {
    setLoading(true);
    try {
      const r = await rotate({ data: { clientId } });
      setToken(r.token);
      setCopied(false);
      toast.success("Novo link gerado — o anterior parou de funcionar.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui gerar o link.");
    }
    setLoading(false);
  }

  const url = token ? `${window.location.origin}/insights/${token}` : "";

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <button
        onClick={openModal}
        title="Compartilhar com o cliente (link sem login)"
        className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition hover:opacity-80"
        style={{ backgroundColor: "var(--lz-hero-badge-bg)", color: "var(--lz-accent-ink)" }}
      >
        <Share2 size={14} />
      </button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Compartilhar Insights">
          <p className="text-xs text-foreground/50 mb-3">Qualquer pessoa com esse link vê essas métricas, sem precisar de login.</p>
          {loading && !token ? (
            <div className="py-6 text-center"><Loader2 className="animate-spin inline text-foreground/30" size={18} /></div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <input readOnly value={url} onFocus={(e) => e.target.select()}
                  className="flex-1 min-w-0 bg-background border border-foreground/10 rounded-md px-3 py-2 text-xs text-foreground/70" />
                <button onClick={copy} title="Copiar link"
                  className="shrink-0 h-9 w-9 rounded-md flex items-center justify-center border border-foreground/10 text-foreground/60 hover:text-foreground">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <button onClick={regenerate} disabled={loading}
                className="text-[11px] text-foreground/40 hover:text-foreground underline inline-flex items-center gap-1">
                <Link2 size={11} /> Gerar novo link (desativa o atual)
              </button>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

/** Botão + modal pra exportar os Insights em PDF (capa + Visão geral +
 * Atividade + Público), escolhendo modo claro ou escuro antes de gerar. */
function DownloadInsightsPdfButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [loading, setLoading] = useState(false);
  const generate = useServerFn(generateInsightsPdf);

  async function download() {
    setLoading(true);
    try {
      const r = await generate({ data: { clientId, clientName, theme } });
      const bytes = Uint8Array.from(atob(r.pdfBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `insights-instagram-${clientName.toLowerCase().replace(/\s+/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("PDF gerado!");
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui gerar o PDF.");
    }
    setLoading(false);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Baixar em PDF"
        className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 transition hover:opacity-80"
        style={{ backgroundColor: "var(--lz-hero-badge-bg)", color: "var(--lz-accent-ink)" }}
      >
        <Download size={14} />
      </button>
      {open && (
        <Modal open onClose={() => setOpen(false)} title="Baixar Insights em PDF">
          <p className="text-xs text-foreground/50 mb-3">Capa, Visão geral, Atividade e Público (quando disponível), com a marca da agência.</p>
          <div className="text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Aparência do PDF</div>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setTheme("light")}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-md transition"
              style={theme === "light" ? { background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" } : { background: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}>
              <Sun size={13} /> Claro
            </button>
            <button onClick={() => setTheme("dark")}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-md transition"
              style={theme === "dark" ? { background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" } : { background: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}>
              <Moon size={13} /> Escuro
            </button>
          </div>
          <button onClick={download} disabled={loading}
            className="w-full py-2.5 rounded-md text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90 inline-flex items-center justify-center gap-2"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {loading ? "Gerando..." : "Baixar PDF"}
          </button>
        </Modal>
      )}
    </>
  );
}

function InstagramInsightsTabs({ clientId, clientName }: { clientId: string; clientName: string }) {
  const me = useMe().data;
  const source = useInstagramInsightsSource(clientId);
  const getFbStatus = useServerFn(getFacebookConnectionStatus);
  const { data: fbStatus } = useQuery({
    queryKey: ["facebook-connection-status", clientId],
    queryFn: () => getFbStatus({ data: { clientId } }),
  });
  return (
    <InsightsTabsView
      cacheKey={clientId}
      source={source}
      clientName={clientName}
      brandingLabel={me?.orgName ?? "Modo Criador"}
      headerRight={<div className="flex items-center gap-2"><DownloadInsightsPdfButton clientId={clientId} clientName={clientName} /><ShareInsightsButton clientId={clientId} /></div>}
      facebookClientId={fbStatus?.connected ? clientId : undefined}
    />
  );
}

/** Miolo compartilhado entre a versão autenticada (dentro do app) e a
 * pública (link de compartilhamento, sem login) — recebe a fonte de dados
 * já resolvida (`InsightsSource`) e não sabe nem precisa saber qual é.
 * `facebookClientId` só vem preenchido quando o cliente tem Facebook
 * conectado — liga a aba extra "Facebook" (mesma tela, dado diferente). */
export function InsightsTabsView({ cacheKey, source, clientName, brandingLabel, headerRight, readOnly, facebookClientId }: {
  cacheKey: string; source: InsightsSource; clientName: string; brandingLabel: string;
  headerRight?: React.ReactNode; readOnly?: boolean; facebookClientId?: string;
}) {
  const [pane, setPane] = useState<"geral" | "conteudo" | "publico" | "direct" | "facebook">("geral");
  const mediaState = useAccountMediaWithInsights(cacheKey, source);
  const { data: overview, isLoading: overviewLoading, error: overviewError } = useQuery({
    queryKey: ["instagram-account-overview", cacheKey],
    queryFn: () => source.getOverview(),
  });
  const { data: history } = useQuery({
    queryKey: ["instagram-follower-history", cacheKey],
    queryFn: () => source.getFollowerHistory(),
  });

  const TABS: { key: typeof pane; label: string }[] = [
    { key: "geral", label: "Visão geral" },
    { key: "conteudo", label: "Conteúdo" },
    { key: "publico", label: "Público" },
    ...(facebookClientId ? [{ key: "facebook" as const, label: "Facebook" }] : []),
    ...(SHOW_DIRECT_TAB && !readOnly ? [{ key: "direct" as const, label: "Direct" }] : []),
  ];

  return (
    <div className="mb-8">
      {/* Cabeçalho "hero" — mesma receita visual do cabeçalho do Dashboard
          (halos radiais suaves sobre o fundo do card, nunca uma cor sólida
          atrás do texto), com a marca da própria agência (cores + nome). */}
      <div className="relative overflow-hidden rounded-2xl mb-4"
        style={{
          background: "var(--lz-hero-bg)",
          border: "1px solid rgba(var(--lz-hero-a-rgb),0.18)",
        }}>
        <div className="pointer-events-none absolute -top-16 -left-16 h-56 w-56 rounded-full opacity-25 blur-3xl" style={{ background: "rgb(var(--lz-hero-a-rgb))" }} />
        <div className="pointer-events-none absolute -bottom-20 right-10 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ background: "rgb(var(--lz-hero-blob-b-rgb))" }} />
        <div className="relative flex items-center justify-between gap-4 p-6 flex-wrap">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: "var(--lz-hero-badge-bg)", color: "var(--lz-accent-ink)" }}>
              <Instagram size={11} /> Instagram
            </div>
            <div className="mt-2.5 text-[28px] font-extrabold text-foreground tracking-tight leading-none">Insights</div>
            <div className="mt-1.5 text-base font-bold text-foreground/75">@{overview?.username ?? clientName}</div>
          </div>
          <div className="flex items-center gap-3">
            {headerRight}
            <div className="text-right flex flex-col items-end gap-1">
              <div className="text-[9.5px] uppercase tracking-wider font-bold text-foreground/35">Feito por</div>
              <div className="text-[12.5px] font-bold text-foreground/75">{brandingLabel}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="inline-flex items-center gap-1 rounded-full bg-card p-1 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setPane(t.key)}
            className="px-4 py-2 rounded-full text-xs font-bold transition shrink-0"
            style={pane === t.key ? { background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" } : { color: "color-mix(in srgb, var(--foreground) 50%, transparent)" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {pane === "geral" && <VisaoGeralPane overview={overview ?? null} isLoading={overviewLoading} error={overviewError} history={history ?? null} mediaState={mediaState} />}
      {pane === "conteudo" && <ConteudoPane clientId={readOnly ? undefined : cacheKey} clientName={clientName} mediaState={mediaState} readOnly={readOnly} />}
      {pane === "publico" && <PublicoPane overview={overview ?? null} isLoading={overviewLoading} error={overviewError} />}
      {pane === "facebook" && facebookClientId && <FacebookPane clientId={facebookClientId} />}
      {SHOW_DIRECT_TAB && pane === "direct" && <DirectMessagesPanel clientId={cacheKey} />}
    </div>
  );
}

/** Comparativo "de lá pra cá" (pedido real de cliente numa call de
 * demonstração) — enquanto não tem pelo menos 2 retratos guardados
 * (runInstagramFollowerSnapshots roda 1x/dia), mostra um aviso em vez do
 * comparativo, já que ainda não tem o que comparar. */
function FollowerComparisonCard({ history }: { history: InstagramFollowerHistory }) {
  const { series, earliestDate, earliestFollowers, latestDate, latestFollowers } = history;

  if (series.length < 2 || earliestFollowers == null || latestFollowers == null || !earliestDate || !latestDate) {
    return (
      <div className="rounded-2xl bg-card p-4 mb-5 flex items-center gap-3">
        <div className="h-8 w-8 rounded-[9px] flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
          <TrendingUp size={15} />
        </div>
        <p className="text-[11.5px] text-foreground/40">
          Estamos guardando um retrato diário dos seguidores a partir de hoje — em alguns dias dá pra ver aqui a evolução "de lá pra cá".
        </p>
      </div>
    );
  }

  const delta = latestFollowers - earliestFollowers;
  const deltaPct = earliestFollowers > 0 ? Math.round((delta / earliestFollowers) * 1000) / 10 : 0;
  const days = Math.round((new Date(latestDate).getTime() - new Date(earliestDate).getTime()) / 86400000);
  const periodLabel = days <= 1 ? "Ontem" : days < 60 ? `Há ${days} dias` : `Desde ${new Date(earliestDate).toLocaleDateString("pt-BR")}`;

  return (
    <div className="rounded-2xl bg-card p-4 mb-5 flex items-center gap-4 flex-wrap">
      <div className="h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
        <TrendingUp size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/40">Comparativo de seguidores</div>
        <div className="text-sm font-semibold text-foreground mt-0.5">
          {periodLabel}: {earliestFollowers.toLocaleString("pt-BR")} → hoje {latestFollowers.toLocaleString("pt-BR")}
        </div>
      </div>
      <div
        className="inline-flex items-center gap-1 text-[12px] font-extrabold px-2.5 py-1.5 rounded-full shrink-0"
        style={{
          color: delta >= 0 ? "#7ED957" : "#FF6B6B",
          backgroundColor: delta >= 0 ? "rgba(126,217,87,0.14)" : "rgba(255,107,107,0.14)",
        }}
      >
        {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
        {delta >= 0 ? "+" : ""}{delta.toLocaleString("pt-BR")} ({deltaPct >= 0 ? "+" : ""}{deltaPct}%)
      </div>
    </div>
  );
}

const PERF_SERIES = {
  reach: { label: "Alcance", color: "#7AA7FF" },
  followers: { label: "Novos seguidores", color: "#7ED957" },
} as const;

/** Alcance e novos seguidores por dia (30 dias) no mesmo gráfico, cada um
 * com a própria escala; os botões ligam e desligam cada linha. Usa só a
 * série diária que a Visão geral já busca. */
function PerformanceCard({ days, reachSeries, followersSeries }: {
  days: number; reachSeries: { date: string; value: number }[]; followersSeries: { date: string; value: number }[];
}) {
  const [show, setShow] = useState({ reach: true, followers: true });
  const data = useMemo(() => {
    const byDate = new Map<string, { date: string; reach: number | null; followers: number | null }>();
    for (const r of reachSeries) byDate.set(r.date, { date: r.date, reach: r.value, followers: null });
    for (const f of followersSeries) {
      const row = byDate.get(f.date) ?? { date: f.date, reach: null, followers: null };
      row.followers = f.value; byDate.set(f.date, row);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
      .map((r) => ({ ...r, label: new Date(r.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) }));
  }, [reachSeries, followersSeries]);

  function toggle(k: "reach" | "followers") {
    const other = k === "reach" ? "followers" : "reach";
    // Sempre deixa pelo menos uma linha ligada.
    if (show[k] && !show[other]) return;
    setShow((s) => ({ ...s, [k]: !s[k] }));
  }

  return (
    <div className="rounded-2xl bg-card p-4 mb-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-[11px] uppercase font-bold tracking-wider text-foreground/50">Desempenho · {days} dias</span>
        <div className="flex items-center gap-1.5">
          {(Object.keys(PERF_SERIES) as (keyof typeof PERF_SERIES)[]).map((k) => (
            <button key={k} onClick={() => toggle(k)} aria-pressed={show[k]}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${show[k] ? "text-foreground border-foreground/20" : "text-foreground/35 border-foreground/8 hover:text-foreground/70"}`}>
              <span className="h-2 w-2 rounded-full" style={{ background: show[k] ? PERF_SERIES[k].color : "color-mix(in srgb, var(--foreground) 25%, transparent)" }} />
              {PERF_SERIES[k].label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-56 mt-3 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(data.length / 8) - 1)}
              tick={{ fill: "color-mix(in srgb, var(--foreground) 40%, transparent)", fontSize: 9 }} />
            <YAxis yAxisId="reach" hide={!show.reach} axisLine={false} tickLine={false} width={34}
              tick={{ fill: "color-mix(in srgb, var(--foreground) 35%, transparent)", fontSize: 9 }} />
            <YAxis yAxisId="followers" orientation="right" hide={!show.followers} axisLine={false} tickLine={false} width={30}
              tick={{ fill: "color-mix(in srgb, var(--foreground) 35%, transparent)", fontSize: 9 }} />
            <Tooltip
              cursor={{ stroke: "color-mix(in srgb, var(--foreground) 25%, transparent)" }}
              content={({ active, payload }: any) => active && payload?.length ? (
                <div className="bg-background border border-foreground/10 rounded-md px-2.5 py-1.5 text-[10px] text-foreground/80 shadow-xl">
                  <div className="font-bold mb-0.5">{payload[0].payload.label}</div>
                  {show.reach && payload[0].payload.reach != null && <div><span style={{ color: PERF_SERIES.reach.color }}>●</span> Alcance: <b>{payload[0].payload.reach.toLocaleString("pt-BR")}</b></div>}
                  {show.followers && payload[0].payload.followers != null && <div><span style={{ color: PERF_SERIES.followers.color }}>●</span> Novos seguidores: <b>{payload[0].payload.followers >= 0 ? "+" : ""}{payload[0].payload.followers.toLocaleString("pt-BR")}</b></div>}
                </div>
              ) : null}
            />
            {show.reach && <Line yAxisId="reach" type="monotone" dataKey="reach" stroke={PERF_SERIES.reach.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />}
            {show.followers && <Line yAxisId="followers" type="monotone" dataKey="followers" stroke={PERF_SERIES.followers.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} connectNulls />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const RANKING_CATEGORIES: { key: "likes" | "comments" | "reach" | "shares" | "saved" | "views"; title: string; unit: string; color: string; icon: React.ReactNode }[] = [
  { key: "likes", title: "Campeão de curtidas", unit: "curtidas", color: "#FF6B8A", icon: <Heart size={13} /> },
  { key: "comments", title: "Gerador de conversas", unit: "comentários", color: "#FFA67A", icon: <MessageCircle size={13} /> },
  { key: "reach", title: "Maior alcance", unit: "contas alcançadas", color: "#7AA7FF", icon: <Eye size={13} /> },
  { key: "shares", title: "Mais viral", unit: "compartilhamentos", color: "#D896FF", icon: <Share2 size={13} /> },
  { key: "saved", title: "Mais valioso", unit: "salvamentos", color: "#7ED957", icon: <Bookmark size={13} /> },
  { key: "views", title: "Rei das visualizações", unit: "visualizações", color: "#FFD166", icon: <TrendingUp size={13} /> },
];

/** Melhor publicação em cada categoria, entre as que a aba Conteúdo já
 * carregou (sem nenhuma chamada nova à Meta). */
function PostRanking({ mediaState, days }: { mediaState: ReturnType<typeof useAccountMediaWithInsights>; days: number }) {
  const cutoff = Date.now() - days * 86400000;
  const inPeriod = (mediaState.media ?? []).filter((m) => new Date(m.timestamp).getTime() >= cutoff);
  const rows = inPeriod
    .map((m) => ({ m, r: mediaState.results.get(m.id) }))
    .filter((x): x is { m: InstagramAccountMedia; r: InstagramMediaInsights & { error?: string } } => !!x.r && !x.r.error);

  const winners = RANKING_CATEGORIES.map((c) => {
    let best: (typeof rows)[number] | null = null;
    for (const x of rows) {
      const v = x.r[c.key];
      if (v != null && v > 0 && (best === null || v > (best.r[c.key] as number))) best = x;
    }
    return { c, best };
  }).filter((w) => w.best);

  if (winners.length === 0) {
    if (mediaState.loadingMedia || mediaState.loadingInsights) {
      return <div className="mb-5 text-[11px] text-foreground/35 flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> Calculando o ranking de posts…</div>;
    }
    return mediaState.media && inPeriod.length === 0
      ? <p className="mb-5 text-[11px] text-foreground/35">Nenhuma publicação nos últimos {days} dias pra montar o ranking.</p>
      : null;
  }

  return (
    <div className="mb-5">
      <div className="flex items-baseline gap-2 mb-2.5">
        <span className="text-[11px] uppercase font-bold tracking-wider text-foreground/50">Ranking de posts</span>
        <span className="text-[10.5px] text-foreground/35">
          {inPeriod.length} publicaç{inPeriod.length === 1 ? "ão" : "ões"} nos últimos {days} dias
          {mediaState.loadingInsights ? " · atualizando…" : ""}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {winners.map(({ c, best }) => {
          const { m, r } = best!;
          const value = r[c.key] as number;
          const Wrapper: any = m.permalink ? "a" : "div";
          return (
            <Wrapper key={c.key} {...(m.permalink ? { href: m.permalink, target: "_blank", rel: "noopener noreferrer" } : {})}
              className="rounded-2xl bg-card p-3 flex gap-3 hover:bg-foreground/[0.04] transition-colors">
              <div className="relative shrink-0 h-[72px] w-[72px] rounded-lg overflow-hidden bg-foreground/5">
                {m.thumbnailUrl && <img src={m.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: c.color }}>{c.icon}{c.title}</div>
                <div className="text-xs text-foreground/55 mt-1 line-clamp-2">{m.caption ?? "Sem legenda"}</div>
                <div className="mt-1.5 flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-lg font-extrabold tabular-nums text-foreground leading-none">{value.toLocaleString("pt-BR")}</span>
                  <span className="text-[11px] text-foreground/45">{c.unit}</span>
                  <span className="text-[10.5px] text-foreground/30 ml-auto">{new Date(m.timestamp).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                </div>
              </div>
            </Wrapper>
          );
        })}
      </div>
    </div>
  );
}

function VisaoGeralPane({ overview: data, isLoading, error, history, mediaState }: {
  overview: InstagramAccountOverview | null; isLoading: boolean; error: unknown;
  history: InstagramFollowerHistory | null; mediaState: ReturnType<typeof useAccountMediaWithInsights>;
}) {
  // Período: a Meta entrega a série diária de 30 dias — 7 e 15 dias são um
  // recorte dela (sem nenhuma chamada nova).
  const [days, setDays] = useState<7 | 15 | 30>(30);
  if (isLoading) return <div className="text-center py-10"><Loader2 size={18} className="animate-spin mx-auto text-foreground/30" /></div>;
  if (error || !data) return <p className="text-xs text-red-400/80 py-4">{(error as any)?.message ?? "Não foi possível carregar o painel de insights."}</p>;

  // Derivados do que a Meta já devolve (sem chamada nova): novos seguidores
  // = soma da série diária de follower_count; engajamento = interações ÷ alcance.
  const sumOf = (xs: { value: number }[]) => xs.reduce((n, r) => n + r.value, 0);
  const reachSeriesN = data.reachSeries.slice(-days);
  const followersSeriesN = data.followersSeries.slice(-days);
  const newFollowers = sumOf(followersSeriesN);
  const reachN = days === 30 ? data.kpis.reach : sumOf(reachSeriesN);
  // Variação contra o período anterior de mesmo tamanho (cabe nos 30 dias da série só pra 7 e 15).
  const prevReach = days === 30 ? null : sumOf(data.reachSeries.slice(-days * 2, -days));
  const reachChangeN = days === 30 ? data.kpis.reachChangePct : (prevReach ? Math.round(((reachN - prevReach) / prevReach) * 1000) / 10 : null);
  const only30 = days < 30;
  const engagementRate = data.kpis.reach > 0
    ? `${(Math.round((data.kpis.totalInteractions / data.kpis.reach) * 10000) / 100).toLocaleString("pt-BR")}%`
    : "—";
  const maxFreq = Math.max(...data.postingFrequency.map((d) => d.count), 1);
  const maxEngagementHour = Math.max(...(data.engagementByHour?.map((h) => h.value) ?? []), 1);
  const bestHour = data.engagementByHour ? [...data.engagementByHour].sort((a, b) => b.value - a.value)[0] : null;

  // "Conteúdo mais relevante" — reaproveita o que a aba Conteúdo já carregou
  // (sem chamada extra), ordenado por visualizações (ou alcance, se o tipo
  // de mídia não tiver "views").
  const topContent = (mediaState.media ?? [])
    .filter((m) => days === 30 || new Date(m.timestamp).getTime() >= Date.now() - days * 86400000)
    .map((m) => ({ m, r: mediaState.results.get(m.id) }))
    .filter((x): x is { m: InstagramAccountMedia; r: InstagramMediaInsights & { error?: string } } =>
      !!x.r && !x.r.error && (x.r.views != null || x.r.reach != null))
    .sort((a, b) => (b.r.views ?? b.r.reach ?? 0) - (a.r.views ?? a.r.reach ?? 0))
    .slice(0, 8);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <span className="text-[11px] uppercase font-bold tracking-wider text-foreground/50">Período</span>
        <div className="flex items-center gap-1 rounded-full p-1 border border-foreground/10" role="group" aria-label="Período">
          {([7, 15, 30] as const).map((d) => (
            <button key={d} onClick={() => setDays(d)} aria-pressed={days === d}
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${days === d ? "bg-[rgb(var(--lz-brand-rgb))] text-[#0D0D0D]" : "text-foreground/55 hover:text-foreground hover:bg-foreground/[0.06]"}`}>
              {d} dias
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
        <KpiTile label="Seguidores" value={data.followersCount} changePct={only30 ? null : data.followersChangePct} accent="seguidores" icon={<Users size={16} />} />
        <KpiTile label={`Novos seguidores (${days}d)`} value={newFollowers} changePct={null} accent="novos" icon={<UserPlus size={16} />} />
        <KpiTile label={`Alcance (${days}d)`} value={reachN} changePct={reachChangeN} accent="alcance" icon={<Eye size={16} />} />
        <KpiTile label={only30 ? "Visitas ao perfil (30d)" : "Visitas ao perfil"} value={data.kpis.profileViews} changePct={data.kpis.profileViewsChangePct} accent="visitas" icon={<UserCheck size={16} />} />
        <KpiTile label={only30 ? "Interações (30d)" : "Interações"} value={data.kpis.totalInteractions} changePct={data.kpis.totalInteractionsChangePct} accent="interacoes" icon={<Heart size={16} />} />
        <KpiTile label={only30 ? "Engajamento (30d)" : "Taxa de engajamento"} value={engagementRate} changePct={null} accent="engajamento" icon={<Percent size={16} />} />
      </div>

      {only30 && <p className="text-[10.5px] text-foreground/35 -mt-3 mb-4">Visitas ao perfil, interações e engajamento a Meta entrega só em 30 dias; os demais indicadores seguem o período escolhido.</p>}

      {history && <FollowerComparisonCard history={history} />}

      <PerformanceCard days={days} reachSeries={reachSeriesN} followersSeries={followersSeriesN} />

      <PostRanking mediaState={mediaState} days={days} />

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
        <div className="rounded-2xl bg-card p-4">
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

        {data.engagementByHour && (
          <div className="rounded-2xl bg-card p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase font-bold tracking-wider text-foreground/50">Melhor horário por engajamento</span>
              {bestHour && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: "var(--lz-accent-ink)", backgroundColor: "rgba(var(--lz-brand-rgb),0.12)" }}>
                  Melhor: {String(bestHour.hour).padStart(2, "0")}h
                </span>
              )}
            </div>
            <p className="text-[10px] text-foreground/35 mb-1">Curtidas + comentários por horário de publicação, baseado no histórico de posts</p>
            <div className="h-32 mt-2 -ml-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.engagementByHour.map((h) => ({ ...h, label: `${String(h.hour).padStart(2, "0")}h` }))}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} interval={2}
                    tick={{ fill: "color-mix(in srgb, var(--foreground) 40%, transparent)", fontSize: 9 }} />
                  <Tooltip
                    cursor={{ fill: "rgba(var(--lz-brand-light-rgb),0.08)" }}
                    content={({ active, payload }: any) => active && payload?.length ? (
                      <div className="bg-background border border-foreground/10 rounded-md px-2 py-1 text-[10px] text-foreground/80 shadow-xl">
                        {payload[0].payload.label}: <b>{payload[0].value.toLocaleString("pt-BR")}</b> engajamento médio
                      </div>
                    ) : null}
                  />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {data.engagementByHour.map((h, i) => (
                      <Cell key={i} fill={h.value === maxEngagementHour && maxEngagementHour > 0 ? "var(--lz-accent-ink)" : "rgba(var(--lz-brand-light-rgb),0.4)"} />
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
function ConteudoPane({ clientId, clientName, mediaState, readOnly }: { clientId?: string; clientName: string; mediaState: ReturnType<typeof useAccountMediaWithInsights>; readOnly?: boolean }) {
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
        {!readOnly && media && media.length > 0 && (
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

      {sorted.length > 0 && (
        <div className="rounded-2xl bg-card p-2 divide-y divide-foreground/6">
          {sorted.map((m) => {
            const r = results.get(m.id);
            const bigValue = r?.error ? null : r?.[metric] ?? null;
            const Row = readOnly ? "div" : "button";
            return (
              <Row key={m.id} onClick={readOnly ? undefined : () => setSelected(m)} className={`w-full flex items-center gap-3.5 px-2.5 py-3 text-left rounded-xl transition-colors${readOnly ? "" : " hover:bg-foreground/[0.03]"}`}>
                <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-foreground/5 shrink-0">
                  {m.thumbnailUrl ? (
                    <img src={m.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center"><ImageIcon size={16} className="text-foreground/15" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground truncate">
                    {m.caption ? m.caption.slice(0, 42) + (m.caption.length > 42 ? "…" : "") : "(sem legenda)"}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-foreground/35 mt-1">
                    <span>{timeAgo(m.timestamp)}</span>
                    <span className="flex items-center gap-1"><Heart size={11} />{r?.error ? "—" : r?.likes ?? "—"}</span>
                    <span className="flex items-center gap-1"><MessageCircle size={11} />{r?.error ? "—" : r?.comments ?? "—"}</span>
                    <span className="flex items-center gap-1"><Send size={11} />{r?.error ? "—" : r?.shares ?? "—"}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-extrabold tabular-nums text-foreground tracking-tight">
                    {r ? (r.error ? "—" : bigValue != null ? bigValue.toLocaleString("pt-BR") : "—") : (loadingInsights ? <Loader2 size={13} className="animate-spin inline" /> : "—")}
                  </div>
                  <div className="text-[9.5px] font-semibold text-foreground/35">{metricLabel}</div>
                </div>
              </Row>
            );
          })}
        </div>
      )}

      {!readOnly && selected && clientId && (
        <PostDetailModal clientId={clientId} media={selected} insights={results.get(selected.id) ?? null} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

/** Público (demografia dos seguidores) — mesmos dados de sempre
 * (overview, já buscado pelo pai), reaproveitando o cache da aba Visão
 * geral — trocar de aba não refaz a chamada. */
function PublicoPane({ overview: data, isLoading, error }: { overview: InstagramAccountOverview | null; isLoading: boolean; error: unknown }) {
  if (isLoading) return <div className="text-center py-10"><Loader2 size={18} className="animate-spin mx-auto text-foreground/30" /></div>;
  if (error || !data) return <p className="text-xs text-red-400/80 py-4">{(error as any)?.message ?? "Não foi possível carregar o painel de insights."}</p>;
  if (!data.demographics) return <p className="text-xs text-foreground/40 text-center py-8">Essa conta ainda não tem seguidores suficientes pra Meta liberar dados de público.</p>;

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
      <div className="rounded-2xl bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-7 w-7 rounded-[8px] flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
            <Users size={14} />
          </div>
          <span className="text-[11.5px] font-extrabold uppercase tracking-wider text-foreground/60">Gênero</span>
        </div>
        {data.demographics.gender.map((g) => <ThinBar key={g.label} label={g.label} pct={g.pct} />)}
      </div>

      <div className="rounded-2xl bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-7 w-7 rounded-[8px] flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
            <Cake size={14} />
          </div>
          <span className="text-[11.5px] font-extrabold uppercase tracking-wider text-foreground/60">Faixa etária</span>
        </div>
        <div className="flex items-center gap-3 text-[10.5px] text-foreground/40 mb-3">
          <span className="flex items-center gap-1.5"><i className="inline-block w-2 h-2 rounded-full" style={{ background: "rgb(var(--lz-brand-rgb))" }} />Mulheres</span>
          <span className="flex items-center gap-1.5"><i className="inline-block w-2 h-2 rounded-full" style={{ background: "rgba(var(--lz-brand-rgb),0.35)" }} />Homens</span>
        </div>
        {data.demographics.age.map((a) => <AgeGenderBar key={a.label} {...a} />)}
      </div>

      <div className="rounded-2xl bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-7 w-7 rounded-[8px] flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
            <MapPin size={14} />
          </div>
          <span className="text-[11.5px] font-extrabold uppercase tracking-wider text-foreground/60">Principais localizações</span>
        </div>
        {data.demographics.countries.map((c) => <ThinBar key={c.label} label={c.label} pct={c.pct} />)}
      </div>
    </div>
  );
}

/** Publicações da Página do Facebook do cliente, com engajamento — mesma
 * ideia da aba Conteúdo do Instagram, só que puxando direto da Graph API
 * do Facebook (pages_read_engagement), sem passar pelo nosso banco. */
function FacebookPane({ clientId }: { clientId: string }) {
  const getPosts = useServerFn(getFacebookPagePosts);
  const { data, isLoading, error } = useQuery({
    queryKey: ["facebook-page-posts", clientId],
    queryFn: () => getPosts({ data: { clientId } }),
  });

  if (isLoading) return <div className="text-center py-10"><Loader2 size={18} className="animate-spin mx-auto text-foreground/30" /></div>;
  if (error) return <p className="text-xs text-red-400/80 py-4">{(error as any)?.message ?? "Não foi possível carregar as publicações do Facebook."}</p>;
  if (!data || data.length === 0) return <p className="text-xs text-foreground/40 text-center py-6">Nenhuma publicação encontrada nessa Página do Facebook.</p>;

  return (
    <div className="rounded-2xl bg-card p-2 divide-y divide-foreground/6">
      {data.map((p) => (
        <a key={p.id} href={p.permalink ?? undefined} target="_blank" rel="noopener noreferrer"
          className="w-full flex items-center gap-3.5 px-2.5 py-3 text-left hover:bg-foreground/[0.03] rounded-xl transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-foreground truncate">
              {p.message ? p.message.slice(0, 60) + (p.message.length > 60 ? "…" : "") : "(sem legenda)"}
            </p>
            <div className="flex items-center gap-3 text-[11px] text-foreground/35 mt-1">
              <span>{timeAgo(p.createdTime)}</span>
              <span className="flex items-center gap-1"><Heart size={11} />{p.likes.toLocaleString("pt-BR")}</span>
              <span className="flex items-center gap-1"><Send size={11} />{p.shares.toLocaleString("pt-BR")}</span>
            </div>
          </div>
          <ExternalLink size={13} className="text-foreground/25 shrink-0" />
        </a>
      ))}
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

/** Quantas linhas do grid aparecem antes de precisar expandir. */
const LINHAS_VISIVEIS = 3;

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
  const goTo = useGoToItem();
  const [expandido, setExpandido] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const [colunas, setColunas] = useState(5);

  // O grid é auto-fill, então quantos cabem por linha depende da largura —
  // medimos pra "3 linhas" valer igual no notebook e no celular.
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const medir = () => {
      const gap = 12;
      const minima = 150;
      setColunas(Math.max(1, Math.floor((el.clientWidth + gap) / (minima + gap))));
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const limite = colunas * LINHAS_VISIVEIS;
  const visiveis = expandido ? items : items.slice(0, limite);
  const escondidos = items.length - visiveis.length;

  function goToItem(item: InstagramActivityItem) {
    goTo({ itemId: item.id, clientId: item.clientId, monthKey: item.monthKey, type: item.type, openPanel: true });
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-1.5 mb-3 text-foreground/50">
        {icon}
        <span className="text-[11px] uppercase font-bold tracking-wider">{label}</span>
        <span className="text-[11px] text-foreground/30">· {items.length}</span>
      </div>
      <div ref={gridRef} className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
        {visiveis.map((item) => (
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
      {(escondidos > 0 || expandido) && (
        <button
          onClick={() => setExpandido((v) => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground/50 hover:text-foreground transition-colors"
        >
          {expandido
            ? <>Esconder <ChevronUp size={13} /></>
            : <>Expandir — mais {escondidos} <ChevronDown size={13} /></>}
        </button>
      )}
    </div>
  );
}
