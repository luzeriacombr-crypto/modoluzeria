import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { setOneSignalUserId } from "@/lib/luzeria/push-notifications";
import { siteTrackingSettingsQO } from "@/lib/luzeria/queries";
import { supabase } from "@/integrations/supabase/client";
import { InAppBrowserBanner } from "@/components/luzeria/InAppBrowserBanner";

import appCss from "../styles.css?url";
import { reportAppError } from "../lib/error-reporting";
import { initErrorMonitoring } from "@/lib/luzeria/error-monitoring";

// Inicializa cedo, antes de qualquer tela montar, pra pegar erro que
// acontece no carregamento. Só roda no navegador e só faz alguma coisa se
// VITE_SENTRY_DSN existir — sem a variável, é uma função vazia.
if (typeof window !== "undefined") {
  initErrorMonitoring();
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Essa página não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir pro início
          </Link>
        </div>
      </div>
    </div>
  );
}

// Depois de um deploy novo, uma aba que já estava aberta ainda referencia os
// arquivos JS da versão antiga (hash antigo) — ao tentar carregar uma aba/
// rota preguiçosa (lazy) depois disso, o navegador tenta buscar um arquivo
// que não existe mais e quebra com esse tipo de mensagem. "Tentar de novo"
// (reset do router) não resolve, porque não busca JS novo nenhum, só
// re-roda os loaders com o MESMO módulo quebrado já carregado — por isso
// a pessoa via esse erro "com frequência" mesmo clicando em tentar de novo.
// Um reload de verdade busca o HTML/JS atual e resolve sozinho.
const CHUNK_LOAD_ERROR_PATTERN = /dynamically imported module|loading chunk|importing a module script failed|unable to preload css/i;
const CHUNK_RELOAD_KEY = "lz:chunk-reload-at";

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const isChunkLoadError = CHUNK_LOAD_ERROR_PATTERN.test(error?.message ?? "");

  useEffect(() => {
    reportAppError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  useEffect(() => {
    if (!isChunkLoadError || typeof window === "undefined") return;
    // Só recarrega sozinho uma vez a cada 10s — evita loop infinito se por
    // algum motivo o erro persistir depois do reload (aí vira o erro normal
    // pra pessoa resolver manualmente, em vez de recarregar pra sempre).
    let lastReload = 0;
    try { lastReload = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0); } catch { /* noop */ }
    if (Date.now() - lastReload < 10_000) return;
    try { window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now())); } catch { /* noop */ }
    window.location.reload();
  }, [isChunkLoadError]);

  if (isChunkLoadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Atualizando o app…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não consegui carregar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado do nosso lado. Tenta de novo, ou volta pro início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir pro início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Modo Criador" },
      { name: "description", content: "Gestão de conteúdo, equipe e entregas para agências de social media." },
      { name: "author", content: "Modo Criador" },
      { property: "og:title", content: "Modo Criador" },
      { property: "og:description", content: "Gestão de conteúdo, equipe e entregas para agências de social media." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Modo Criador" },
      { name: "twitter:description", content: "Gestão de conteúdo, equipe e entregas para agências de social media." },
      { property: "og:image", content: "https://www.modocriador.com.br/og-image.png" },
      { name: "twitter:image", content: "https://www.modocriador.com.br/og-image.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg?v=5" },
      { rel: "icon", href: "/favicon.ico?v=5" },
      { rel: "apple-touch-icon", href: "/icon-192.png?v=5" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // Só no site de vendas público — nunca dentro do app logado, pra não
  // mandar pro Meta o comportamento de clientes pagantes já dentro do
  // produto (o pixel é pra medir anúncio -> cadastro, não uso do app).
  const isAuthenticatedRoute = useRouterState({
    select: (s) => s.matches.some((m) => m.routeId.startsWith("/_authenticated")),
  });

  useEffect(() => {
    if (isAuthenticatedRoute) return;
    let cancelled = false;
    // Pixel ID vem de Configurações > Site (site_tracking_settings) — editável
    // pelo Junior sem precisar de deploy a cada troca de conta de anúncio.
    queryClient.fetchQuery(siteTrackingSettingsQO()).then((settings) => {
      if (cancelled || !settings.metaPixelId) return;
      const pixelId = settings.metaPixelId;
      if ((window as any).fbq) { (window as any).fbq("track", "PageView"); return; }
      (function (f: any, b: Document, e: string, v: string) {
        if (f.fbq) return;
        const n: any = (f.fbq = function (...args: any[]) {
          n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
        });
        if (!f._fbq) f._fbq = n;
        n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
        const t = b.createElement(e) as HTMLScriptElement;
        t.async = true; t.src = v;
        const s = b.getElementsByTagName(e)[0];
        s.parentNode?.insertBefore(t, s);
      })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
      (window as any).fbq("init", pixelId);
      (window as any).fbq("track", "PageView");
    });
    return () => { cancelled = true; };
  }, [isAuthenticatedRoute, queryClient]);

  useEffect(() => {
    // Inject OneSignal SDK and init client-side only
    (window as any).OneSignalDeferred = (window as any).OneSignalDeferred || [];
    (window as any).OneSignalDeferred.push(async (OneSignal: any) => {
      await OneSignal.init({ appId: "ec59cdb7-8660-4a15-b023-1886d2b4c76d" });
    });
    if (!document.getElementById("onesignal-sdk")) {
      const s = document.createElement("script");
      s.id = "onesignal-sdk";
      s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
      s.defer = true;
      document.head.appendChild(s);
    }
    // Identify logged-in user
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setOneSignalUserId(data.user.id);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {!isAuthenticatedRoute && <InAppBrowserBanner />}
      <Outlet />
    </QueryClientProvider>
  );
}
