import { createFileRoute } from "@tanstack/react-router";
import { AvulsosPage } from "@/components/luzeria/AvulsosPage";

export const Route = createFileRoute("/_authenticated/avulsos")({
  component: AvulsosPage,
  ssr: false,
});
