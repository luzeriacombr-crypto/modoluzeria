import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SalesPage } from "@/components/luzeria/SalesPage";
import { hasSignedInBefore } from "@/lib/luzeria/device-flag";

export const Route = createFileRoute("/")({
  component: IndexRoute,
  beforeLoad: async () => {
    // Only ever true for a client-side navigation into "/" (e.g. clicking
    // "Home" from within the already-hydrated app) — SSR/a fresh load has
    // no access to the browser's session, so this is a fast path, not the
    // only path. See the effect below for the case this can't cover.
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/minhas-tarefas" });
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
      if (data.session) { nav({ to: "/minhas-tarefas" }); return; }
      if (hasSignedInBefore()) nav({ to: "/auth" });
    })();
    return () => { cancelled = true; };
  }, [nav]);

  return <SalesPage />;
}
