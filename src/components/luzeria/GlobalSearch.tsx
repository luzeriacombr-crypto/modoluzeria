import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { FEATURE_INDEX, type FeatureEntry } from "@/lib/luzeria/feature-index";

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Pontua a relevância de uma entrada pra uma busca — maior é melhor, 0 é
 * "não bate". Prioriza: termo guarda-chuva exato (ex: "financeiro" pra
 * Plano e Cobrança) > nome exato > nome começa com > keyword exata >
 * keyword começa com > nome contém > keyword contém > descrição contém.
 * Isso é o que faz "financeiro" cair primeiro em Plano e Cobrança mesmo
 * aparecendo também como sinônimo em Margem/Afiliados/Revenda. */
function scoreEntry(entry: FeatureEntry, rawQuery: string): number {
  const q = normalize(rawQuery.trim());
  if (!q) return 1;
  const label = normalize(entry.label);
  let best = 0;
  for (const sk of entry.strongKeywords ?? []) {
    if (normalize(sk) === q) best = Math.max(best, 100);
  }
  if (label === q) best = Math.max(best, 95);
  else if (label.startsWith(q)) best = Math.max(best, 80);
  for (const k of entry.keywords) {
    const nk = normalize(k);
    if (nk === q) best = Math.max(best, 70);
    else if (nk.startsWith(q)) best = Math.max(best, 55);
  }
  if (label.includes(q)) best = Math.max(best, 40);
  for (const k of entry.keywords) {
    if (normalize(k).includes(q)) best = Math.max(best, 25);
  }
  if (normalize(entry.description).includes(q)) best = Math.max(best, 10);
  return best;
}

/** Botão que abre a busca — usado no cabeçalho (desktop) e na barra
 * inferior (celular), cada um com seu próprio visual, ambos abrindo o
 * mesmo overlay global via useUI (só existe uma instância do overlay,
 * renderizada uma vez em App.tsx). */
export function GlobalSearchButton({ variant, active }: { variant: "header" | "mobile"; active?: boolean }) {
  const setSearchOpen = useUI((s) => s.setSearchOpen);
  if (variant === "mobile") {
    return (
      <button
        onClick={() => setSearchOpen(true)}
        aria-label="Buscar"
        className="flex items-center justify-center h-12 w-14 transition-colors"
        style={{ color: active ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.4)" }}
      >
        <Search size={20} />
      </button>
    );
  }
  return (
    <button
      onClick={() => setSearchOpen(true)}
      title="Buscar"
      className="flex items-center justify-center h-8 w-8 rounded-md text-white/60 hover:text-white hover:bg-white/5 transition-colors"
    >
      <Search size={18} />
    </button>
  );
}

/** Overlay da busca — renderizado uma vez, globalmente. Não busca dados
 * (posts, clientes): busca "onde é que fica isso" no FEATURE_INDEX, pra
 * quem não acha uma função saber pra onde ir. */
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

  const results = useMemo(() => {
    if (!me) return [];
    const disabled = new Set(me.disabledFeatures ?? []);
    const visible = FEATURE_INDEX.filter((e) =>
      (!e.roles || (me.role && e.roles.includes(me.role as "master" | "setor"))) &&
      (!e.hideIfDisabled || !disabled.has(e.hideIfDisabled))
    );
    if (!query.trim()) return visible;
    return visible
      .map((e) => ({ entry: e, score: scoreEntry(e, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.entry);
  }, [me, query]);

  function go(entry: FeatureEntry) {
    setOpen(false);
    navigate({ to: entry.to, search: entry.toSearch } as any);
  }

  if (!open) return null;

  return createPortal(
    <div className="lz-overlay z-[200] flex items-start justify-center p-4 pt-[10vh]" onClick={() => setOpen(false)}>
      <div
        className="bg-[#1C1C1C] rounded-2xl w-full max-w-lg border border-white/10 shadow-2xl lz-modal-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <Search size={17} className="text-white/40 shrink-0" />
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
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/30"
          />
          <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white shrink-0" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="text-center text-white/40 text-sm py-8">Nada encontrado — tenta outra palavra.</p>
          ) : (
            results.map((entry) => (
              <button
                key={entry.id}
                onClick={() => go(entry)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors flex flex-col gap-0.5"
              >
                <span className="text-sm font-semibold text-white">{entry.label}</span>
                <span className="text-xs text-white/45">{entry.description}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
