import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getTrelloAuthUrl, fetchTrelloBoards, fetchTrelloLists,
  fetchClickUpTeams, fetchClickUpSpaces, fetchClickUpLists,
  fetchNotionDatabases, fetchNotionDatabaseRows,
  importClients,
} from "@/lib/luzeria/import.functions";

type Item = { id: string; name: string };
type Provider = "trello" | "clickup" | "notion";

export function ImportClientsStep({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"top" | "nested">("nested");
  const [topItems, setTopItems] = useState<Item[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null); // clickup only
  const [nestedParentId, setNestedParentId] = useState<string | null>(null);
  const [nestedItems, setNestedItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [names, setNames] = useState<string[] | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const authUrl = useServerFn(getTrelloAuthUrl);
  const trelloBoards = useServerFn(fetchTrelloBoards);
  const trelloLists = useServerFn(fetchTrelloLists);
  const clickupTeams = useServerFn(fetchClickUpTeams);
  const clickupSpaces = useServerFn(fetchClickUpSpaces);
  const clickupLists = useServerFn(fetchClickUpLists);
  const notionDatabases = useServerFn(fetchNotionDatabases);
  const notionRows = useServerFn(fetchNotionDatabaseRows);
  const doImport = useServerFn(importClients);

  const topLabel = provider === "trello" ? "quadro" : provider === "clickup" ? "space" : "database";

  async function connectTrello() {
    const { url } = await authUrl();
    window.open(url, "_blank");
  }

  async function fetchTop() {
    if (!token.trim()) { toast.error("Cola o token antes de continuar."); return; }
    setLoading(true);
    try {
      if (provider === "trello") {
        const boards = await trelloBoards({ data: { token: token.trim() } });
        setTopItems(boards);
      } else if (provider === "clickup") {
        const teams = await clickupTeams({ data: { token: token.trim() } });
        if (teams.length === 1) {
          setTeamId(teams[0].id);
          const spaces = await clickupSpaces({ data: { token: token.trim(), teamId: teams[0].id } });
          setTopItems(spaces);
        } else {
          setTopItems(teams); // reuse topItems as "pick your team" list first
        }
      } else {
        const databases = await notionDatabases({ data: { token: token.trim() } });
        setTopItems(databases);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao conectar.");
    } finally {
      setLoading(false);
    }
  }

  async function pickTeam(id: string) {
    setLoading(true);
    try {
      setTeamId(id);
      const spaces = await clickupSpaces({ data: { token: token.trim(), teamId: id } });
      setTopItems(spaces);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao buscar spaces.");
    } finally {
      setLoading(false);
    }
  }

  async function pickNestedParent(id: string) {
    setLoading(true);
    setNestedParentId(id);
    try {
      const lists = provider === "trello"
        ? await trelloLists({ data: { token: token.trim(), boardId: id } })
        : provider === "clickup"
        ? await clickupLists({ data: { token: token.trim(), spaceId: id } })
        : await notionRows({ data: { token: token.trim(), databaseId: id } });
      setNestedItems(lists);
      setSelected(Object.fromEntries(lists.map((l) => [l.id, true])));
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao buscar listas.");
    } finally {
      setLoading(false);
    }
  }

  function goToPreview() {
    const source = mode === "top" ? topItems : nestedItems;
    const chosen = source.filter((i) => selected[i.id]).map((i) => i.name);
    if (chosen.length === 0) { toast.error("Marca pelo menos um item."); return; }
    setNames(chosen);
  }

  async function confirmImport() {
    if (!names || !provider) return;
    setLoading(true);
    try {
      const r = await doImport({ data: { names, source: provider } });
      setResult(r);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao importar clientes.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="text-center">
        <div className="text-2xl mb-2">✅</div>
        <p className="text-foreground font-semibold mb-1">{result.imported} cliente{result.imported === 1 ? "" : "s"} importado{result.imported === 1 ? "" : "s"}!</p>
        {result.skipped > 0 && (
          <p className="text-foreground/50 text-xs mb-4">{result.skipped} não coube{result.skipped === 1 ? "" : "ram"} no limite do seu plano — dá pra adicionar depois ou fazer upgrade.</p>
        )}
        <button onClick={onDone} className="lz-btn-primary text-sm px-5 py-2.5 rounded-md mt-3">Ir para o painel</button>
      </div>
    );
  }

  if (names) {
    return (
      <div>
        <p className="text-foreground/60 text-xs mb-3">Confere os nomes antes de importar (edite se precisar):</p>
        <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
          {names.map((n, i) => (
            <input key={i} value={n} onChange={(e) => setNames((prev) => prev!.map((x, xi) => xi === i ? e.target.value : x))}
              className="lz-input text-sm" />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setNames(null)} className="lz-btn-ghost text-xs px-4 py-2 rounded-md">Voltar</button>
          <button onClick={confirmImport} disabled={loading} className="lz-btn-primary text-xs px-4 py-2 rounded-md flex-1 disabled:opacity-50">
            {loading ? "Importando…" : `Importar ${names.length} cliente${names.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div>
        <p className="text-foreground/60 text-sm mb-5">Já tem seus clientes organizados no Trello, ClickUp ou Notion? Importa de lá pra não digitar tudo de novo.</p>
        <div className="grid grid-cols-3 gap-3 mb-3">
          <button onClick={() => setProvider("trello")} className="bg-foreground/5 border border-foreground/10 rounded-lg py-4 text-sm font-semibold hover:bg-foreground/10 transition">Trello</button>
          <button onClick={() => setProvider("clickup")} className="bg-foreground/5 border border-foreground/10 rounded-lg py-4 text-sm font-semibold hover:bg-foreground/10 transition">ClickUp</button>
          <button onClick={() => setProvider("notion")} className="bg-foreground/5 border border-foreground/10 rounded-lg py-4 text-sm font-semibold hover:bg-foreground/10 transition">Notion</button>
        </div>
        <button onClick={onSkip} className="text-foreground/40 text-xs hover:text-foreground/70 transition w-full text-center mt-2">Pular por agora →</button>
      </div>
    );
  }

  if (topItems.length === 0) {
    return (
      <div>
        {provider === "trello" ? (
          <>
            <p className="text-foreground/60 text-xs mb-3">
              1. Clica em "Conectar com Trello", autorize o acesso (somente leitura).<br />
              2. O Trello vai mostrar um código na tela — copia e cola aqui embaixo.
            </p>
            <button onClick={connectTrello} className="lz-btn-ghost text-xs px-4 py-2 rounded-md mb-3">Conectar com Trello →</button>
          </>
        ) : provider === "clickup" ? (
          <p className="text-foreground/60 text-xs mb-3">
            No ClickUp, vai em Configurações → Apps → "Personal API Token" → Gerar, copia e cola aqui embaixo.
          </p>
        ) : (
          <p className="text-foreground/60 text-xs mb-3">
            1. Vai em <b>notion.so/my-integrations</b>, cria uma integração interna e copia o "Internal Integration Secret".<br />
            2. Abre a página/database com sua lista de clientes no Notion, clica em "•••" → "Conectar a" → escolhe a integração que você criou (sem esse passo, o Notion não deixa a integração ver nada, mesmo com o token certo).<br />
            3. Cola o secret aqui embaixo.
          </p>
        )}
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cola o token aqui" className="lz-input text-sm mb-3" />
        <div className="flex gap-2">
          <button onClick={() => setProvider(null)} className="lz-btn-ghost text-xs px-4 py-2 rounded-md">Voltar</button>
          <button onClick={fetchTop} disabled={loading} className="lz-btn-primary text-xs px-4 py-2 rounded-md flex-1 disabled:opacity-50">
            {loading ? "Buscando…" : "Buscar"}
          </button>
        </div>
      </div>
    );
  }

  // ClickUp: choosing a team (only shown if more than one team exists)
  if (provider === "clickup" && !teamId) {
    return (
      <div>
        <p className="text-foreground/60 text-xs mb-3">Você tem mais de um workspace no ClickUp — escolhe qual:</p>
        <div className="space-y-2">
          {topItems.map((t) => (
            <button key={t.id} onClick={() => pickTeam(t.id)} className="w-full text-left bg-foreground/5 border border-foreground/10 rounded-md px-3 py-2 text-sm hover:bg-foreground/10 transition">
              {t.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {provider !== "notion" && (
        <div className="flex gap-2 mb-4 text-xs">
          <button onClick={() => setMode("nested")} className={`px-3 py-1.5 rounded-full ${mode === "nested" ? "bg-foreground text-black" : "bg-foreground/10 text-foreground/60"}`}>
            Cada lista é um cliente
          </button>
          <button onClick={() => setMode("top")} className={`px-3 py-1.5 rounded-full ${mode === "top" ? "bg-foreground text-black" : "bg-foreground/10 text-foreground/60"}`}>
            Cada {topLabel} é um cliente
          </button>
        </div>
      )}

      {mode === "top" && provider !== "notion" ? (
        <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
          {topItems.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm bg-foreground/5 rounded-md px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={selected[item.id] ?? true} onChange={(e) => setSelected((s) => ({ ...s, [item.id]: e.target.checked }))} />
              {item.name}
            </label>
          ))}
        </div>
      ) : !nestedParentId ? (
        <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
          <p className="text-foreground/50 text-xs mb-2">Escolhe o {topLabel} com a lista de clientes:</p>
          {topItems.map((item) => (
            <button key={item.id} onClick={() => pickNestedParent(item.id)} className="w-full text-left bg-foreground/5 border border-foreground/10 rounded-md px-3 py-2 text-sm hover:bg-foreground/10 transition">
              {item.name}
            </button>
          ))}
        </div>
      ) : loading ? (
        <p className="text-foreground/40 text-sm mb-4">Buscando listas…</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
          {nestedItems.map((item) => (
            <label key={item.id} className="flex items-center gap-2 text-sm bg-foreground/5 rounded-md px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={selected[item.id] ?? true} onChange={(e) => setSelected((s) => ({ ...s, [item.id]: e.target.checked }))} />
              {item.name}
            </label>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => { setTopItems([]); setNestedParentId(null); setTeamId(null); }} className="lz-btn-ghost text-xs px-4 py-2 rounded-md">Voltar</button>
        {(mode === "top" || nestedParentId) && !loading && (
          <button onClick={goToPreview} className="lz-btn-primary text-xs px-4 py-2 rounded-md flex-1">Continuar</button>
        )}
      </div>
    </div>
  );
}
