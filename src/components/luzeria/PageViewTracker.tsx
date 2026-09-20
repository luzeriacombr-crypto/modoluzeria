// Registra qual página cada usuário abre, pra o Junior conseguir ver o
// que uma agência (principalmente uma trial nova) está de fato navegando
// dentro do app — usado hoje só via getOrgPageViews (AgencyInfoModal).
// Fire-and-forget total: nunca deve travar nem avisar erro pra quem só
// está usando o app normalmente.
import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { logPageView } from "@/lib/luzeria/api.functions";

export function PageViewTracker() {
  const path = useRouterState({ select: (s) => s.location.pathname + s.location.searchStr });
  const logView = useServerFn(logPageView);
  const lastLogged = useRef<string | null>(null);

  useEffect(() => {
    if (lastLogged.current === path) return;
    lastLogged.current = path;
    logView({ data: { path } }).catch(() => {});
  }, [path]);

  return null;
}
