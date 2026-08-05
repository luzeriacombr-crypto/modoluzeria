import { createFileRoute, isRedirect, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { App } from "@/components/luzeria/App";
import { markSignedInDevice } from "@/lib/luzeria/device-flag";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // The PWA manifest's start_url opens straight into this protected
    // layout (see public/manifest.json) — any failure here, including a
    // network error from getUser()/mfa itself (not just "no session"),
    // must fall through to /auth instead of throwing and leaving the
    // launched app on a blank error screen.
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/auth" });
      markSignedInDevice();
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
        throw redirect({ to: "/mfa" });
      }
    } catch (e) {
      if (isRedirect(e)) throw e;
      throw redirect({ to: "/auth" });
    }
  },
  component: App,
});