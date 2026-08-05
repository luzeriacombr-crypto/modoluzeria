import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useUI } from "@/lib/luzeria/ui-store";
import { ClientView } from "@/components/luzeria/ClientView";

export const Route = createFileRoute("/_authenticated/cliente/$clientId")({
  component: ClientePage,
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { tab?: string } => {
    return typeof search.tab === "string" ? { tab: search.tab } : {};
  },
});

function ClientePage() {
  const { clientId } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const selectClient = useUI((s) => s.selectClient);
  useEffect(() => { selectClient(clientId); }, [clientId, selectClient]);
  return (
    <ClientView
      clientId={clientId}
      tab={tab}
      onTabChange={(t) => navigate({ search: { tab: t }, replace: true })}
    />
  );
}
