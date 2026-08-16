import { createFileRoute } from "@tanstack/react-router";
import { ClientOperationsOverview } from "@/components/luzeria/ClientOperationsOverview";

export const Route = createFileRoute("/_authenticated/visao-geral")({
  component: ClientOperationsOverview,
  ssr: false,
});
