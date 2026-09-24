import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { Plus, Trash2, ArrowRight, Megaphone, Bell, Search } from "lucide-react";
import { platformUpdatesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { PLATFORM_UPDATE_CATEGORIES, type PlatformUpdate } from "@/lib/luzeria/platform-updates.functions";

/** "Setembro de 2026", com inicial maiúscula — chave de agrupamento da
 * linha do tempo (mesma ordem de `updates`, que já vem por published_at
 * desc, então os grupos saem em ordem cronológica decrescente de graça). */
function monthLabel(iso: string): string {
  const label = new Date(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function UpdatesTab() {
  const me = useMe().data;
  const api = useApi();
  const { data: updates = [] } = useQuery(platformUpdatesQO());
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of updates) counts.set(u.category, (counts.get(u.category) ?? 0) + 1);
    return counts;
  }, [updates]);

  const q = query.trim().toLowerCase();
  const filtered = updates.filter((u) =>
    (!filter || u.category === filter) &&
    (!q || (u.title + " " + u.description).toLowerCase().includes(q)));

  // Destaque só quando não tem filtro nem busca ativa — senão o resultado
  // filtrado ficaria faltando a própria coisa que a pessoa procurou.
  const showFeatured = !filter && !q;
  const featured = showFeatured ? updates[0] : undefined;
  const timelineItems = showFeatured ? filtered.filter((u) => u.id !== featured?.id) : filtered;

  const groups = useMemo(() => {
    const byMonth = new Map<string, PlatformUpdate[]>();
    for (const u of timelineItems) {
      const label = monthLabel(u.publishedAt);
      if (!byMonth.has(label)) byMonth.set(label, []);
      byMonth.get(label)!.push(u);
    }
    return [...byMonth.entries()].map(([label, items]) => ({ label, items }));
  }, [timelineItems]);

  function goTo(path: string) {
    if (path.startsWith("/")) {
      navigate({ to: path as any });
    } else {
      window.location.href = path;
    }
  }

  const unnotified = useMemo(() => updates.filter((u) => !u.notifiedAt), [updates]);

  return (
    <div>
      {/* Header + busca */}
      <div className="flex items-end justify-between gap-6 flex-wrap mb-6">
        <div className="max-w-xl">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--lz-accent-ink)" }}>Modo Criador · Changelog</span>
          <h2 className="font-criador-serif normal-case text-4xl mt-1.5 text-foreground">Novidades</h2>
          <p className="text-sm text-foreground/50 mt-2 leading-relaxed">
            {updates.length} novidade{updates.length === 1 ? "" : "s"} — tudo que mudou no sistema, em ordem.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-foreground/10 bg-foreground/[0.03] w-[260px]">
            <Search size={14} className="text-foreground/35 shrink-0" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar novidade…"
              className="flex-1 min-w-0 bg-transparent text-[13px] text-foreground outline-none placeholder:text-foreground/30"
            />
          </div>
          {me?.isPlatformAdmin && (
            <button onClick={() => setAdding(true)}
              className="lz-btn-primary text-xs px-4 py-2.5 rounded-md inline-flex items-center gap-2 shrink-0">
              <Plus size={14} /> Nova atualização
            </button>
          )}
        </div>
      </div>

      {me?.isPlatformAdmin && unnotified.length > 0 && <NotifyBatchPanel unnotified={unnotified} />}
      {adding && <NewUpdateForm onClose={() => setAdding(false)} />}

      {/* Categorias */}
      {updates.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-7">
          <button
            onClick={() => setFilter(null)}
            className="rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-colors"
            style={filter === null
              ? { background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }
              : { background: "transparent", border: "1px solid color-mix(in srgb, var(--foreground) 15%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
          >
            Todas <span className="opacity-55 font-medium">{updates.length}</span>
          </button>
          {PLATFORM_UPDATE_CATEGORIES.filter((c) => categoryCounts.has(c)).map((c) => (
            <button
              key={c}
              onClick={() => setFilter(filter === c ? null : c)}
              className="rounded-full px-3.5 py-2 text-[12.5px] font-bold transition-colors"
              style={filter === c
                ? { background: "rgba(var(--lz-brand-rgb),0.12)", border: "1px solid rgb(var(--lz-brand-rgb))", color: "var(--lz-accent-ink)" }
                : { background: "transparent", border: "1px solid color-mix(in srgb, var(--foreground) 15%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
            >
              {c} <span className="opacity-55 font-medium">{categoryCounts.get(c)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Destaque */}
      {featured && (
        <div
          className="rounded-2xl p-9 mb-8 relative overflow-hidden"
          style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full" style={{ background: "rgba(13,13,13,0.06)" }} />
          <span className="relative text-[11px] font-extrabold uppercase tracking-[0.1em] opacity-65">Destaque · {featured.category}</span>
          <h3 className="relative text-[28px] font-extrabold leading-tight mt-2 max-w-2xl">{featured.title}</h3>
          <p className="relative text-[14.5px] leading-relaxed mt-2.5 max-w-xl opacity-80">{featured.description}</p>
          <div className="relative flex items-center gap-3.5 mt-4">
            <span className="text-[12px] font-bold opacity-60">
              {new Date(featured.publishedAt).toLocaleDateString("pt-BR", { dateStyle: "long" })}
            </span>
            {featured.linkPath && (
              <button
                onClick={() => goTo(featured.linkPath!)}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold px-4 py-2 rounded-full transition-opacity hover:opacity-80"
                style={{ background: "rgba(13,13,13,0.14)" }}
              >
                {featured.linkLabel || "Ver atualização"} <ArrowRight size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Linha do tempo */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-foreground/10 rounded-lg p-16 text-center">
          <Megaphone size={22} className="mx-auto mb-3 text-foreground/20" />
          <p className="text-foreground/50 text-sm">
            {updates.length === 0 ? "Nenhuma atualização publicada ainda." : "Nenhuma novidade encontrada."}
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="flex items-center gap-3.5 mb-3.5">
                <span className="text-[11.5px] font-extrabold uppercase tracking-wide text-foreground/35 whitespace-nowrap">{group.label}</span>
                <span className="flex-1 h-px bg-foreground/6" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {group.items.map((u) => (
                  <div key={u.id} className="bg-card rounded-2xl p-5 group relative border border-foreground/6 hover:border-foreground/15 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10.5px] font-extrabold uppercase tracking-wide text-foreground/35">{u.category}</span>
                      <span className="text-[11px] text-foreground/35 whitespace-nowrap">
                        {new Date(u.publishedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-bold text-foreground mb-1.5 leading-snug">{u.title}</h3>
                    <p className="text-[13px] text-foreground/60 leading-relaxed mb-2.5">{u.description}</p>
                    {u.linkPath && (
                      <button
                        onClick={() => goTo(u.linkPath!)}
                        className="inline-flex items-center gap-1 text-[11.5px] font-bold py-1 transition"
                        style={{ color: "var(--lz-accent-ink)" }}
                      >
                        {u.linkLabel || "Ver atualização"} <ArrowRight size={11} />
                      </button>
                    )}
                    {me?.isPlatformAdmin && (
                      <button
                        onClick={async () => { if (await requestConfirm(`Excluir a atualização "${u.title}"?`, { danger: true })) api.deletePlatformUpdate.mutate({ data: { id: u.id } }); }}
                        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5 transition"
                      ><Trash2 size={13} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewUpdateForm({ onClose }: { onClose: () => void }) {
  const api = useApi();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(PLATFORM_UPDATE_CATEGORIES[0]);
  const [linkPath, setLinkPath] = useState("");
  const [linkLabel, setLinkLabel] = useState("");

  function submit() {
    if (!title.trim() || !description.trim()) { toast.error("Preencha título e descrição."); return; }
    api.createPlatformUpdate.mutate({
      data: {
        title: title.trim(),
        description: description.trim(),
        category,
        linkPath: linkPath.trim() || undefined,
        linkLabel: linkLabel.trim() || undefined,
      },
    }, {
      onSuccess: () => { toast.success("Atualização publicada."); onClose(); },
      onError: (e: any) => toastFriendlyError(e, "Erro ao publicar"),
    });
  }

  return (
    <div className="bg-card rounded-lg p-5 mb-5 space-y-3">
      <select
        value={category} onChange={(e) => setCategory(e.target.value)}
        className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
      >
        {PLATFORM_UPDATE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input
        value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Título (ex.: Novo checklist de onboarding)"
        className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
      />
      <textarea
        value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder="Descrição rápida do que melhorou"
        rows={3}
        className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-none"
      />
      <div className="flex gap-2">
        <input
          value={linkPath} onChange={(e) => setLinkPath(e.target.value)}
          placeholder="Caminho no app (opcional, ex.: /configuracoes?tab=drive)"
          className="flex-1 bg-background border border-foreground/10 rounded-md px-3 py-2 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
        />
        <input
          value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)}
          placeholder="Texto do botão (opcional)"
          className="w-48 bg-background border border-foreground/10 rounded-md px-3 py-2 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Cancelar</button>
        <button
          onClick={submit}
          disabled={api.createPlatformUpdate.isPending}
          className="lz-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-50"
        >Publicar</button>
      </div>
    </div>
  );
}

/** Uma notificação por lote, nunca uma por atualização — o admin escolhe
 * qual das ainda-não-avisadas é o destaque, o resto vira "e outras N
 * novidades". Some sozinho da tela assim que não sobrar nenhuma pendente. */
function NotifyBatchPanel({ unnotified }: { unnotified: PlatformUpdate[] }) {
  const api = useApi();
  const [headlineId, setHeadlineId] = useState(unnotified[0]?.id ?? "");
  const headline = unnotified.find((u) => u.id === headlineId) ?? unnotified[0];
  const otherCount = unnotified.length - 1;
  const preview = headline
    ? (otherCount > 0 ? `${headline.title} e outras ${otherCount} novidade${otherCount === 1 ? "" : "s"}... Clica aqui!` : `${headline.title} Clica aqui!`)
    : "";

  function send() {
    if (!headline) return;
    api.sendPlatformUpdateNotification.mutate({ data: { headlineId: headline.id } }, {
      onSuccess: (r: any) => toast.success(`Notificação enviada pra ${r.notifiedUsers} pessoa${r.notifiedUsers === 1 ? "" : "s"}.`),
      onError: (e: any) => toastFriendlyError(e, "Erro ao notificar"),
    });
  }

  return (
    <div className="bg-card rounded-lg p-5 mb-5 space-y-3" style={{ border: "1px solid rgba(var(--lz-brand-light-rgb),0.25)" }}>
      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Bell size={14} style={{ color: "var(--lz-accent-ink)" }} />
        {unnotified.length} novidade{unnotified.length === 1 ? "" : "s"} ainda não notificada{unnotified.length === 1 ? "" : "s"}
      </div>
      <p className="text-xs text-foreground/50">Escolha qual vira o destaque da notificação — as outras entram como "e outras N novidades".</p>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {unnotified.map((u) => (
          <label key={u.id} className="flex items-center gap-2 text-xs text-foreground/80 cursor-pointer px-2 py-1.5 rounded hover:bg-foreground/5">
            <input type="radio" name="headline" checked={headlineId === u.id} onChange={() => setHeadlineId(u.id)} />
            {u.title}
          </label>
        ))}
      </div>
      <div className="rounded-md px-3 py-2.5 text-xs text-foreground/70" style={{ background: "rgba(var(--lz-brand-light-rgb),0.08)" }}>
        <span className="text-foreground/40 uppercase text-[10px] font-bold tracking-wider block mb-1">Prévia da notificação</span>
        {preview}
      </div>
      <div className="flex justify-end">
        <button
          onClick={send}
          disabled={!headline || api.sendPlatformUpdateNotification.isPending}
          className="lz-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-50"
        >
          {api.sendPlatformUpdateNotification.isPending ? "Enviando…" : "Notificar todo mundo"}
        </button>
      </div>
    </div>
  );
}
