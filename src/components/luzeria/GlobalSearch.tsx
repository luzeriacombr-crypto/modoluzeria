import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useMe, clientsQO } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { FEATURE_INDEX, type FeatureEntry } from "@/lib/luzeria/feature-index";
import { scoreFields } from "@/lib/luzeria/search-match";
import { Avatar } from "./Avatar";

/** Pontua a relevância de uma tela pra busca. Cada campo tem um peso: termo
 * guarda-chuva ("financeiro" pra Plano e Cobrança) pesa mais que o nome, que
 * pesa mais que as palavras-chave, que pesam mais que a descrição.
 *
 * O casamento em si é por PALAVRA e tolerante (ver search-match.ts): quebra a
 * frase, ignora acento e palavra vazia, aguenta erro de digitação e casa por
 * radical. Antes a busca comparava a frase inteira de forma literal, então
 * "pagar asinatura" não achava nada — nem por estar escrito errado, nem por
 * ninguém ter cadastrado essa frase exata como palavra-chave.
 */
function scoreEntry(entry: FeatureEntry, query: string): number {
  return scoreFields([
    { texto: (entry.strongKeywords ?? []).join(" "), peso: 3.0 },
    { texto: entry.label, peso: 2.5 },
    { texto: entry.keywords.join(" "), peso: 1.5 },
    { texto: entry.description, peso: 0.6 },
  ], query);
}

/** Botão que abre a busca — só no cabeçalho agora (o celular tinha uma
 * segunda lupa na barra inferior, removida por ser redundante com esta).
 * Abre o mesmo overlay global via useUI (só existe uma instância do
 * overlay, renderizada uma vez em App.tsx). */
export function GlobalSearchButton() {
  const setSearchOpen = useUI((s) => s.setSearchOpen);
  return (
    <button
      onClick={() => setSearchOpen(true)}
      title="Buscar"
      data-tour="global-search"
      className="flex items-center justify-center h-8 w-8 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
    >
      <Search size={18} />
    </button>
  );
}

/** Overlay da busca — renderizado uma vez, globalmente. Não busca dados
 * (posts, clientes): busca "onde é que fica isso" no FEATURE_INDEX, pra
 * quem não acha uma função saber pra onde ir. */
type Resultado =
  | { tipo: "tela"; entry: FeatureEntry }
  | { tipo: "cliente"; client: { id: string; name: string; color: string; photoUrl?: string | null; category?: string } };

export function GlobalSearchOverlay() {
  const open = useUI((s) => s.searchOpen);
  const setOpen = useUI((s) => s.setSearchOpen);
  const me = useMe().data;
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  // Busca também nos clientes: procurar "Filipe" tem que levar ao cliente,
  // não só a telas. Os dois tipos entram na mesma lista, ordenados juntos.
  const { data: clients = [] } = useQuery({ ...clientsQO(), enabled: open });

  const results = useMemo((): Resultado[] => {
    if (!me) return [];
    const disabled = new Set(me.disabledFeatures ?? []);
    const visible = FEATURE_INDEX.filter((e) =>
      (!e.roles || (me.role && e.roles.includes(me.role as "master" | "setor"))) &&
      (!e.hideIfDisabled || !disabled.has(e.hideIfDisabled))
    );
    const ativos = clients.filter((c) => !c.archived);

    if (!query.trim()) {
      return visible.map((entry) => ({ tipo: "tela" as const, entry }));
    }

    const telas = visible
      .map((entry) => ({ r: { tipo: "tela" as const, entry }, score: scoreEntry(entry, query) }))
      .filter((x) => x.score > 0);

    const porCliente = ativos
      .map((client) => ({
        r: { tipo: "cliente" as const, client },
        // Nome do cliente pesa alto: quem digita um nome quer o cliente,
        // não uma tela que por acaso menciona a palavra.
        score: scoreFields([{ texto: client.name, peso: 3.2 }, { texto: client.category ?? "", peso: 0.5 }], query),
      }))
      .filter((x) => x.score > 0);

    return [...telas, ...porCliente]
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((x) => x.r);
  }, [me, query, clients, open]);

  function go(r: Resultado) {
    setOpen(false);
    if (r.tipo === "cliente") {
      navigate({ to: "/cliente/$clientId", params: { clientId: r.client.id } } as any);
      return;
    }
    navigate({ to: r.entry.to, search: r.entry.toSearch } as any);
  }

  if (!open) return null;

  return createPortal(
    <div className="lz-overlay z-[200] flex items-start justify-center p-4 pt-[10vh]" onClick={() => setOpen(false)}>
      <div
        className="bg-card rounded-2xl w-full max-w-lg border border-foreground/10 shadow-2xl lz-modal-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-foreground/6">
          <Search size={17} className="text-foreground/40 shrink-0" />
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && results[0]) go(results[0]);
            }}
            placeholder="O que você está procurando?"
            className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-foreground/30"
          />
          <button onClick={() => setOpen(false)} className="text-foreground/40 hover:text-foreground shrink-0" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="text-center text-foreground/40 text-sm py-8">Nada encontrado — tenta outra palavra.</p>
          ) : (
            results.map((r) => r.tipo === "cliente" ? (
              <button
                key={`c-${r.client.id}`}
                onClick={() => go(r)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-foreground/5 transition-colors flex items-center gap-2.5"
              >
                <Avatar name={r.client.name} color={r.client.color} avatarUrl={r.client.photoUrl} size={28} />
                <span className="min-w-0 flex flex-col">
                  <span className="text-sm font-semibold text-foreground truncate">{r.client.name}</span>
                  <span className="text-xs text-foreground/45">Cliente{r.client.category ? ` · ${r.client.category}` : ""}</span>
                </span>
              </button>
            ) : (
              <button
                key={r.entry.id}
                onClick={() => go(r)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-foreground/5 transition-colors flex flex-col gap-0.5"
              >
                <span className="text-sm font-semibold text-foreground">{r.entry.label}</span>
                <span className="text-xs text-foreground/45">{r.entry.description}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
