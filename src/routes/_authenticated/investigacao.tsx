// TEMPORARY — investigating missing posts reported by Jordânia (2026-07-09). Delete after use.
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { investigateItemLoss, getGoogleClientIdDebug } from "@/lib/luzeria/debug-investigation.functions";

export const Route = createFileRoute("/_authenticated/investigacao")({
  component: InvestigacaoPage,
  ssr: false,
});

function InvestigacaoPage() {
  const fn = useServerFn(investigateItemLoss);
  const clientIdFn = useServerFn(getGoogleClientIdDebug);
  const { data, isLoading, error } = useQuery({
    queryKey: ["debug-investigacao"],
    queryFn: () => fn(),
  });
  const { data: clientIdData } = useQuery({
    queryKey: ["debug-google-client-id"],
    queryFn: () => clientIdFn(),
  });

  if (isLoading) return <div className="p-10 text-white">Carregando…</div>;
  if (error) return <div className="p-10 text-red-400">Erro: {(error as any)?.message}</div>;
  if (!data) return null;

  const profileName = (id: string | null) => data.profiles.find((p: any) => p.id === id)?.name ?? id ?? "—";
  const clientName = (monthId: string) => {
    const m = data.months.find((mm: any) => mm.id === monthId);
    return m ? `${data.clients.find((c: any) => c.id === m.client_id)?.name ?? "?"} (${m.key})` : "?";
  };

  const directIds = new Set(data.directLookup.map((i: any) => i.id));
  const createdEvents = data.activity.filter((a: any) => a.action === "created");
  const missing = createdEvents.filter((a: any) => !directIds.has(a.entity_id));
  const survivingClientName = (monthId: string) => {
    const m = data.survivingMonths.find((mm: any) => mm.id === monthId);
    return m ? `${data.survivingClients.find((c: any) => c.id === m.client_id)?.name ?? "?"} (${m.key})` : "?";
  };
  const anyError = Object.values(data.errors).some((v) => v);

  // Classify each (client, month) group: is it EXACTLY the bug's fingerprint
  // (Post 1..6 + Reels 1..6, plural "Reels", all created within seconds of
  // each other) or does it need a human to look at it before touching anything.
  const BUG_TITLES = new Set([1, 2, 3, 4, 5, 6].flatMap((i) => [`Post ${i}`, `Reels ${i}`]));
  const byMonth = new Map<string, any[]>();
  for (const i of data.directLookup) {
    const arr = byMonth.get(i.month_id) ?? [];
    arr.push(i);
    byMonth.set(i.month_id, arr);
  }
  const groups = [...byMonth.entries()].map(([monthId, groupItems]) => {
    const titles = groupItems.map((i: any) => i.title);
    const allMatchBugPattern = titles.length > 0 && titles.every((t: string) => BUG_TITLES.has(t));
    const isFullSet = new Set(titles).size === 12 && titles.length === 12;
    const times = groupItems.map((i: any) => new Date(i.updated_at).getTime());
    const spreadMs = Math.max(...times) - Math.min(...times);
    const isBugJunk = allMatchBugPattern && isFullSet && spreadMs < 15_000;
    return { monthId, clientName: survivingClientName(monthId), items: groupItems, isBugJunk, allMatchBugPattern, count: titles.length };
  });

  return (
    <div className="p-10 text-white text-sm space-y-10 max-w-6xl">
      <h1 className="text-xl font-bold">Investigação temporária — itens sumidos</h1>

      <section>
        <h2 className="text-base font-bold text-[#C8D44E] mb-2">Google Client ID (não é secreto)</h2>
        <p className="font-mono break-all">{clientIdData?.clientId ?? "carregando…"}</p>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#C8D44E] mb-2">Checagem de sanidade</h2>
        <p>Total de content_items no banco (todos os clientes): <b>{data.totalItemsCount}</b></p>
        <p>Itens com ID direto confirmados existentes agora (dos {createdEvents.length} criados no período): <b>{data.directLookup.length}</b></p>
        {anyError && (
          <pre className="text-red-400 text-xs mt-2 whitespace-pre-wrap">{JSON.stringify(data.errors, null, 2)}</pre>
        )}
      </section>

      <section>
        <h2 className="text-base font-bold text-[#C8D44E] mb-2">
          ✅ Sobreviveram (existem agora), agrupado por cliente/mês ({data.directLookup.length} itens em {groups.length} grupos)
        </h2>
        {groups.map((g) => (
          <div key={g.monthId} className="mb-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold">{g.clientName}</span>
              <span className="text-[11px]">({g.count} itens)</span>
              {g.isBugJunk ? (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                  🗑️ lote fantasma do bug — confirmado
                </span>
              ) : (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-200">
                  ⚠️ revisar manualmente antes de mexer
                </span>
              )}
            </div>
            <table className="w-full text-left border-collapse mb-2">
              <thead><tr className="text-white/40 text-xs"><th className="pr-4">Título</th><th className="pr-4">Status</th><th>Atualizado em</th></tr></thead>
              <tbody>
                {g.items.map((i: any) => (
                  <tr key={i.id} className="border-t border-white/10">
                    <td className="pr-4 py-1">{i.title || <i className="text-white/30">(sem título)</i>}</td>
                    <td className="pr-4 py-1">{i.status}</td>
                    <td className="py-1">{new Date(i.updated_at).toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-base font-bold text-[#C8D44E] mb-2">Clientes encontrados</h2>
        <table className="w-full text-left border-collapse">
          <thead><tr className="text-white/50"><th className="pr-4">Nome</th><th className="pr-4">Categoria</th><th className="pr-4">Arquivado</th><th>ID</th></tr></thead>
          <tbody>
            {data.clients.map((c: any) => (
              <tr key={c.id} className="border-t border-white/10">
                <td className="pr-4 py-1">{c.name}</td>
                <td className="pr-4 py-1">{c.category}</td>
                <td className="pr-4 py-1">{String(c.archived)}</td>
                <td className="py-1 text-white/40">{c.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#C8D44E] mb-2">
          🚨 Criados mas NÃO existem mais agora ({missing.length})
        </h2>
        {missing.length === 0 && <p className="text-white/50">Nenhum — todos os itens criados nos últimos 4 dias ainda existem.</p>}
        <table className="w-full text-left border-collapse">
          <thead><tr className="text-white/50"><th className="pr-4">Quando</th><th className="pr-4">Quem criou</th><th className="pr-4">Título</th><th className="pr-4">Tipo</th><th>Item ID</th></tr></thead>
          <tbody>
            {missing.map((a: any) => (
              <tr key={a.id} className="border-t border-white/10 bg-red-500/10">
                <td className="pr-4 py-1">{new Date(a.at).toLocaleString("pt-BR")}</td>
                <td className="pr-4 py-1">{profileName(a.actor_id)}</td>
                <td className="pr-4 py-1">{a.meta?.title}</td>
                <td className="pr-4 py-1">{a.meta?.type}</td>
                <td className="py-1 text-white/40">{a.entity_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#C8D44E] mb-2">Itens atuais nesses 5 clientes ({data.items.length})</h2>
        <table className="w-full text-left border-collapse">
          <thead><tr className="text-white/50"><th className="pr-4">Cliente/Mês</th><th className="pr-4">Título</th><th className="pr-4">Status</th><th>Atualizado em</th></tr></thead>
          <tbody>
            {data.items.map((i: any) => (
              <tr key={i.id} className="border-t border-white/10">
                <td className="pr-4 py-1">{clientName(i.month_id)}</td>
                <td className="pr-4 py-1">{i.title}</td>
                <td className="pr-4 py-1">{i.status}</td>
                <td className="py-1">{new Date(i.updated_at).toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-base font-bold text-[#C8D44E] mb-2">Todas as ações registradas (últimos 4 dias, todos os clientes, {data.activity.length})</h2>
        <table className="w-full text-left border-collapse">
          <thead><tr className="text-white/50"><th className="pr-4">Quando</th><th className="pr-4">Quem</th><th className="pr-4">Ação</th><th className="pr-4">Meta</th><th>Item ID</th></tr></thead>
          <tbody>
            {data.activity.map((a: any) => (
              <tr key={a.id} className="border-t border-white/10">
                <td className="pr-4 py-1">{new Date(a.at).toLocaleString("pt-BR")}</td>
                <td className="pr-4 py-1">{profileName(a.actor_id)}</td>
                <td className="pr-4 py-1">{a.action}</td>
                <td className="pr-4 py-1">{JSON.stringify(a.meta)}</td>
                <td className="py-1 text-white/40">{a.entity_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
