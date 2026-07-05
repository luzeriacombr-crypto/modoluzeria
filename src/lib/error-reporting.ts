export function reportAppError(error: unknown, context: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  console.error("[app-error]", {
    route: window.location.pathname,
    ...context,
    error,
  });
}
