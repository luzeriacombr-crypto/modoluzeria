import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { logPageActivity } from "./page-activity.functions";

const FLUSH_INTERVAL_MS = 20_000;

/** Grava em que rota a pessoa está e por quanto tempo — nunca posição de
 * mouse/toque. Acumula localmente e manda em lote: o flush periódico
 * fecha o trecho atual e reabre na hora (contínuo), então uma visita
 * longa numa mesma tela também é contabilizada, não só troca de rota. */
export function usePageActivityTracker(routeId: string, enabled: boolean) {
  const send = useServerFn(logPageActivity);
  const queueRef = useRef<{ path: string; durationSeconds: number }[]>([]);
  const currentRef = useRef<{ path: string; enteredAt: number } | null>(null);
  const flushingRef = useRef(false);
  const routeIdRef = useRef(routeId);
  routeIdRef.current = routeId;

  function finalizeCurrent() {
    const cur = currentRef.current;
    currentRef.current = null;
    if (!cur) return;
    const durationSeconds = Math.round((Date.now() - cur.enteredAt) / 1000);
    if (durationSeconds > 0) queueRef.current.push({ path: cur.path, durationSeconds });
  }

  function flush() {
    if (flushingRef.current || queueRef.current.length === 0) return;
    flushingRef.current = true;
    const batch = queueRef.current.splice(0, queueRef.current.length);
    send({ data: { visits: batch } })
      .catch(() => {
        // Melhor esforço — perde esse lote em vez de travar a navegação.
      })
      .finally(() => { flushingRef.current = false; });
  }

  useEffect(() => {
    if (!enabled || !routeId) return;
    finalizeCurrent();
    currentRef.current = { path: routeId, enteredAt: Date.now() };
  }, [routeId, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const cur = currentRef.current;
      finalizeCurrent();
      if (cur) currentRef.current = { path: cur.path, enteredAt: Date.now() };
      flush();
    }, FLUSH_INTERVAL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        finalizeCurrent();
        flush();
      } else if (!currentRef.current && routeIdRef.current) {
        currentRef.current = { path: routeIdRef.current, enteredAt: Date.now() };
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onVisibilityChange);
    };
  }, [enabled]);
}
