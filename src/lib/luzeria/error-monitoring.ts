import * as Sentry from "@sentry/react";

/**
 * Monitoramento de erro. Fica INERTE enquanto VITE_SENTRY_DSN não existir —
 * sem a variável, nada é inicializado e nenhuma requisição sai daqui, então
 * dá pra rodar local e em preview sem poluir o painel.
 *
 * O DSN é público por natureza (vai dentro do bundle que o navegador baixa);
 * quem faz o controle de quem pode enviar é a própria configuração do
 * projeto no Sentry, não o segredo da chave.
 */

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENV = import.meta.env.MODE === "production" ? "production" : "development";

export const errorMonitoringEnabled = Boolean(DSN);

export function initErrorMonitoring() {
  if (!DSN) return;

  // Ajuda temporária pra confirmar em produção que o envio pro Sentry
  // funciona de ponta a ponta, sem depender do navegador conseguir capturar
  // um throw digitado direto no console (nem sempre passa pelo
  // window.onerror do jeito esperado). Rodar no console: window.__testSentry()
  // Remover depois de confirmado.
  (window as any).__testSentry = () => {
    Sentry.captureException(new Error("teste manual do sentry"), { level: "warning" });
    Sentry.flush(2000).then(() => console.log("[sentry] enviado (ou tentativa concluída)"));
  };

  Sentry.init({
    dsn: DSN,
    environment: ENV,
    // Só envia de produção. Em dev o erro já aparece no console, e mandar
    // pro painel só ia misturar ruído de desenvolvimento com problema real.
    enabled: ENV === "production",
    // Amostragem de performance baixa: o que interessa aqui é erro, não
    // traçado de desempenho — e amostrar tudo encareceria à toa.
    tracesSampleRate: 0.1,
    // Não capturamos sessão em vídeo: as telas têm dado de cliente e de
    // contrato, e isso sairia do nosso controle.
    sendDefaultPii: false,
    ignoreErrors: [
      // Ruído conhecido de navegador/extensão, não é bug do app.
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      /^Network request failed$/,
      /Failed to fetch/,
      // O SDK do OneSignal reclama quando roda fora do domínio oficial
      // (preview da Vercel, localhost) — é esperado, não é erro nosso.
      /Can only be used on: https:\/\/www\.modocriador\.com\.br/,
    ],
    beforeSend(event) {
      // Higiene: nunca deixar token de URL assinada (Drive/Storage) ir junto
      // — eles dão acesso direto ao arquivo por horas.
      if (event.request?.url) {
        event.request.url = stripTokens(event.request.url);
      }
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) =>
          b.data && typeof b.data.url === "string"
            ? { ...b, data: { ...b.data, url: stripTokens(b.data.url) } }
            : b,
        );
      }
      return event;
    },
  });
}

function stripTokens(url: string): string {
  return url.replace(/([?&])(token|access_token|signature|sig)=[^&]*/gi, "$1$2=REMOVIDO");
}

/** Marca quem está usando, pra dar pra responder "isso só acontece com
 * fulano?" e "essa agência inteira está travada?". Sem e-mail nem nome —
 * o id já basta pra cruzar com o banco quando precisar. */
export function identifyForMonitoring(user: { id: string; orgId?: string | null; role?: string } | null) {
  if (!DSN) return;
  if (!user) { Sentry.setUser(null); return; }
  Sentry.setUser({ id: user.id });
  Sentry.setTag("org_id", user.orgId ?? "sem-org");
  Sentry.setTag("role", user.role ?? "desconhecido");
}

/** Registra um erro que a interface já tratou (mostrou aviso pra pessoa),
 * mas que a gente ainda quer enxergar. É por aqui que as falhas de mutation
 * e de carregamento — as que a auditoria achou invisíveis — chegam. */
export function reportHandledError(error: unknown, contexto: Record<string, unknown> = {}) {
  if (!DSN) return;
  Sentry.captureException(error, { level: "warning", extra: contexto });
}
