import { createFileRoute } from "@tanstack/react-router";
import { ResellerLandingPage } from "@/components/reseller/ResellerLandingPage";

export const Route = createFileRoute("/revenda")({
  component: ResellerLandingPage,
  head: () => ({
    meta: [
      { title: "Revenda White Label — Modo Criador" },
      {
        name: "description",
        content: "Compre instâncias do Modo Criador no atacado, coloque sua marca e revenda pros seus clientes pelo preço que você definir.",
      },
    ],
  }),
});
