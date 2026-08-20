import { createFileRoute } from "@tanstack/react-router";
import { ResellerLandingPage } from "@/components/reseller/ResellerLandingPage";

const TITLE = "Revenda o Modo Criador com sua marca";
const DESCRIPTION = "Compre instâncias do Modo Criador no atacado, coloque sua marca e revenda pros seus clientes pelo preço que você definir.";

export const Route = createFileRoute("/revenda")({
  component: ResellerLandingPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
  }),
});
