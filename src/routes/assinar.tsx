import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SalesPage } from "@/components/luzeria/SalesPage";

export const Route = createFileRoute("/assinar")({
  component: SalesPage,
  validateSearch: (search) =>
    z.object({
      promoCode: z.string().optional(),
      affiliateCode: z.string().optional(),
    }).parse(search),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/minhas-tarefas" });
  },
});
