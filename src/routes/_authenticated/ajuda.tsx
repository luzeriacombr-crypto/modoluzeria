import { createFileRoute } from "@tanstack/react-router";
import { AjudaPage } from "@/components/luzeria/AjudaPage";

export const Route = createFileRoute("/_authenticated/ajuda")({
  component: AjudaRoute,
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { tab?: string } => {
    return typeof search.tab === "string" ? { tab: search.tab } : {};
  },
});

function AjudaRoute() {
  const { tab } = Route.useSearch();
  return <AjudaPage initialTab={tab} />;
}
