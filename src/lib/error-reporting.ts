import { reportHandledError } from "./luzeria/error-monitoring";

/** Ponto único por onde todo erro tratado da interface passa. Continua
 * escrevendo no console (útil em dev e pra quem abre o inspetor), e agora
 * também manda pro monitoramento quando ele está configurado. */
export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[app-error]", {
    route: window.location.pathname,
    ...context,
    error,
  });
  reportHandledError(error, { route: window.location.pathname, ...context });
}
