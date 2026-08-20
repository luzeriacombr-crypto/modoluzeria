import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SalesPage } from "@/components/luzeria/SalesPage";

export const Route = createFileRoute("/assinar")({
  component: SalesPage,
  // Mesmo conteúdo da home (SalesPage) — canonical pra home evita que o
  // Google veja como página duplicada competindo pelo mesmo termo.
  head: () => ({
    meta: [
      { title: "Teste Grátis por 30 Dias — Modo Criador" },
      {
        name: "description",
        content: "Comece seu teste grátis de 30 dias no Modo Criador: calendário de conteúdo, aprovação de cliente por link e relatórios de equipe pra sua agência de social media.",
      },
    ],
    links: [{ rel: "canonical", href: "https://www.modocriador.com.br/" }],
  }),
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
