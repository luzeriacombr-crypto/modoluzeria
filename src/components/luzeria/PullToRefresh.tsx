import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

const PULL_THRESHOLD = 64;
const MAX_PULL = 96;

/** Puxar de cima pra baixo, no topo da tela, atualiza os dados — mesmo
 * gesto do Instagram etc. Precisa ser feito na mão porque o app roda como
 * PWA instalado (manifest.json: display "standalone"), modo em que o
 * pull-to-refresh nativo do navegador não existe.
 *
 * Usa addEventListener direto no elemento (não onTouch* do React) porque
 * só um listener registrado como não-passivo permite chamar preventDefault
 * no touchmove — sem isso o scroll nativo do celular brigaria com o
 * indicador visual arrastando junto. */
export function PullToRefresh({ containerRef, children }: {
  containerRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const state = useRef({ startY: 0, pulling: false, refreshing: false });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (state.current.refreshing || el!.scrollTop > 0) return;
      state.current.startY = e.touches[0].clientY;
      state.current.pulling = true;
    }
    function onTouchMove(e: TouchEvent) {
      if (!state.current.pulling) return;
      if (el!.scrollTop > 0) { state.current.pulling = false; setPull(0); return; }
      const delta = e.touches[0].clientY - state.current.startY;
      if (delta <= 0) { setPull(0); return; }
      e.preventDefault();
      setPull(Math.min(MAX_PULL, delta * 0.5));
    }
    function onTouchEnd() {
      if (!state.current.pulling) return;
      state.current.pulling = false;
      setPull((current) => {
        if (current >= PULL_THRESHOLD) {
          state.current.refreshing = true;
          setRefreshing(true);
          qc.refetchQueries({ type: "active" }).finally(() => {
            state.current.refreshing = false;
            setRefreshing(false);
            setPull(0);
          });
          return PULL_THRESHOLD;
        }
        return 0;
      });
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [containerRef, qc]);

  return (
    <>
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ height: pull, transition: state.current.pulling ? "none" : "height 200ms ease-out" }}
      >
        <RefreshCw
          size={18}
          className={refreshing ? "animate-spin" : ""}
          style={{
            color: "var(--lz-accent-ink)",
            opacity: Math.min(pull / PULL_THRESHOLD, 1),
            transform: refreshing ? undefined : `rotate(${Math.min(pull / PULL_THRESHOLD, 1) * 300}deg)`,
          }}
        />
      </div>
      {children}
    </>
  );
}
