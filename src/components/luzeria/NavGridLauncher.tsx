import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid } from "lucide-react";
import { useSecondaryNavItems } from "./Sidebar";
import { GlobalSearchButton } from "./GlobalSearch";
import { HelpButton } from "./HelpButton";
import { VideoCallButton } from "./VideoCallButton";
import { useMe } from "@/lib/luzeria/queries";

/** Menu em grade no cabeçalho pros itens que saíram da barra lateral
 * (Calendário, Biblioteca, Instagram, Vendas, Seleção de Fotos, Lixeira,
 * Rotina) — ideia do Junior depois de ver algo parecido numa call, validada
 * com um mockup (Artifact "Menu em grade") antes de construir. Mesmo molde
 * de popover de `NotificationsBell` (trigger ref + panel ref + portal +
 * `getBoundingClientRect` pra posição + fecha com clique fora), mais o
 * fecha-com-Escape que nenhum popover de cabeçalho tinha ainda. */
export function NavGridLauncher() {
  const items = useSecondaryNavItems();
  const me = useMe().data;
  const videoCallEnabled = !(me?.disabledFeatures ?? []).includes("video_call");
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        title="Mais seções"
        aria-expanded={open}
        className="p-2 rounded-md transition"
        style={{
          color: open ? "#0D0D0D" : "color-mix(in srgb, var(--foreground) 60%, transparent)",
          background: open ? "rgb(var(--lz-brand-rgb))" : "transparent",
        }}
      >
        <LayoutGrid size={18} />
      </button>
      {open && pos && createPortal(
        <div
          ref={popRef}
          className="fixed w-[300px] z-[100] lz-notif-pop"
          style={{
            top: pos.top,
            right: pos.right,
            background: "var(--card)",
            border: "1px solid color-mix(in srgb, var(--foreground) 10%, transparent)",
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            padding: 14,
          }}
        >
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-foreground/40 px-1 pb-2.5">
            Mais seções
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => { it.onClick(); setOpen(false); }}
                className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-lg text-center transition hover:bg-foreground/5"
                style={{ color: it.active ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 70%, transparent)" }}
              >
                <span
                  className="h-8 w-8 rounded-md flex items-center justify-center"
                  style={{
                    background: it.active ? "rgba(var(--lz-brand-light-rgb),0.18)" : "rgba(var(--lz-brand-light-rgb),0.1)",
                    color: "rgb(var(--lz-brand-rgb))",
                  }}
                >
                  {it.icon}
                </span>
                <span className="text-[10.5px] font-semibold leading-tight">{it.label}</span>
              </button>
            ))}
          </div>

          {/* Busca, Ajuda e Vídeo chamada saíram do cabeçalho pra cá — são
           * widgets de verdade (a Busca abre um overlay, a Ajuda tem seu
           * próprio menu + formulário de bug, o Vídeo tem um picker
           * ancorado ao próprio botão), não links simples como os itens
           * acima, por isso ficam numa fileira à parte em vez de virar
           * mais um "tile". Não fecha a grade no clique — a Ajuda, por
           * exemplo, precisa continuar montada pro próprio menu dela abrir
           * (fechar a grade aqui desmontaria o menu antes da pessoa
           * conseguir clicar numa opção). */}
          <div className="h-px my-2.5" style={{ background: "color-mix(in srgb, var(--foreground) 8%, transparent)" }} />
          <div className="flex items-center justify-center gap-1">
            <GlobalSearchButton />
            <HelpButton />
            {videoCallEnabled && <VideoCallButton />}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
