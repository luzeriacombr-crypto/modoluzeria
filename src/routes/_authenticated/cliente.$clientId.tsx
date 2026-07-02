import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useUI } from "@/lib/luzeria/ui-store";
import { ClientView } from "@/components/luzeria/ClientView";

export const Route = createFileRoute("/_authenticated/cliente/$clientId")({
  component: ClientePage,
  ssr: false,
});

function ClientePage() {
  const { clientId } = Route.useParams();
  const selectClient = useUI((s) => s.selectClient);
  useEffect(() => { selectClient(clientId); }, [clientId, selectClient]);
  return <ClientView clientId={clientId} />;
}
