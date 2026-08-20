import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SalesPage } from "@/components/luzeria/SalesPage";
import { hasSignedInBefore } from "@/lib/luzeria/device-flag";
import { getPublicPlans } from "@/lib/luzeria/signup.functions";
import { getMyDefaultLanding } from "@/lib/luzeria/api.functions";

function landingRoute(defaultLanding: { view: string; clientId?: string } | null): { to: string; params?: any } {
  if (!defaultLanding) return { to: "/minhas-tarefas" };
  if (defaultLanding.view === "admin") return { to: "/admin" };
  if (defaultLanding.view === "calendario") return { to: "/calendario" };
  if (defaultLanding.view === "cliente" && defaultLanding.clientId) return { to: "/cliente/$clientId", params: { clientId: defaultLanding.clientId } };
  return { to: "/minhas-tarefas" };
}

const SITE_URL = "https://www.modocriador.com.br";
const TITLE = "Modo Criador — Gestão de Conteúdo para Agências de Social Media";
const DESCRIPTION =
  "Centralize calendário de posts, aprovação de cliente por link e backup automático no Drive. Chega de planilha e WhatsApp bagunçado. Teste grátis por 30 dias.";

export const Route = createFileRoute("/")({
  component: IndexRoute,
  loader: async ({ context }) => {
    // Mesma queryKey usada pelo useQuery da SalesPage — já deixa em cache
    // pra hidratar sem refetch, além de alimentar o preço no JSON-LD abaixo.
    try {
      return await (context as any).queryClient.fetchQuery({ queryKey: ["public-plans"], queryFn: () => getPublicPlans() });
    } catch {
      return [];
    }
  },
  head: ({ loaderData }) => {
    const plans = (loaderData ?? []).filter((p: any) => p.priceCents != null);
    const cheapestCents = plans.length > 0 ? Math.min(...plans.map((p: any) => p.priceCents as number)) : null;

    // JSON-LD (schema.org) — dá ao Google material pra mostrar a logo em vez
    // do ícone de globo genérico, e potencialmente o preço direto no
    // resultado de busca. Sem "sameAs": o Modo Criador ainda não tem perfil
    // de rede social próprio pra apontar (só o WhatsApp de contato).
    const organizationLd = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Modo Criador",
      url: SITE_URL,
      logo: `${SITE_URL}/icon-192.png`,
      description: DESCRIPTION,
    };
    const softwareLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Modo Criador",
      url: SITE_URL,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: DESCRIPTION,
    };
    if (cheapestCents != null) {
      softwareLd.offers = {
        "@type": "Offer",
        price: (cheapestCents / 100).toFixed(2),
        priceCurrency: "BRL",
      };
    }

    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: TITLE },
        { property: "og:description", content: DESCRIPTION },
        { "script:ld+json": organizationLd },
        { "script:ld+json": softwareLd },
      ],
      links: [{ rel: "canonical", href: "https://www.modocriador.com.br/" }],
    };
  },
  beforeLoad: async () => {
    // Only ever true for a client-side navigation into "/" (e.g. clicking
    // "Home" from within the already-hydrated app) — SSR/a fresh load has
    // no access to the browser's session, so this is a fast path, not the
    // only path. See the effect below for the case this can't cover.
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const defaultLanding = await getMyDefaultLanding().catch(() => null);
      throw redirect(landingRoute(defaultLanding) as any);
    }
  },
});

function IndexRoute() {
  const nav = useNavigate();

  useEffect(() => {
    // Runs client-side after the SSR'd sales page has already painted (kept
    // SSR for the landing page's SEO) — covers a fresh/full load, which
    // beforeLoad's SSR pass can't: no localStorage, no real session, on the
    // server. This is also what makes the PWA shortcut behave: iOS opens a
    // fresh instance with none of the app's client state warmed up yet.
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        const defaultLanding = await getMyDefaultLanding().catch(() => null);
        if (cancelled) return;
        nav(landingRoute(defaultLanding) as any);
        return;
      }
      if (hasSignedInBefore()) nav({ to: "/auth" });
    })();
    return () => { cancelled = true; };
  }, [nav]);

  return <SalesPage />;
}
