import { createFileRoute } from "@tanstack/react-router";
import { AffiliatePage } from "@/components/affiliate/AffiliatePage";

export const Route = createFileRoute("/afiliar")({
  component: AffiliatePage,
  head: () => ({
    meta: [
      { title: "Programa de Afiliados — Modo Criador" },
      {
        name: "description",
        content: "Indique o Modo Criador pra agências de social media e ganhe 10% de comissão recorrente por 12 meses em cada assinatura.",
      },
    ],
  }),
});
