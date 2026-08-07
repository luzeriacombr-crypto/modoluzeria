import { createFileRoute } from "@tanstack/react-router";
import { CalendarioPage } from "@/components/luzeria/CalendarioPage";

export const Route = createFileRoute("/_authenticated/calendario")({
  component: CalendarioPage,
  ssr: false,
});
