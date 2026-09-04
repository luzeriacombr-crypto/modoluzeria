import { createFileRoute } from "@tanstack/react-router";
import { PhotoClientDetailPage } from "@/components/luzeria/PhotoClientDetailPage";

export const Route = createFileRoute("/_authenticated/selecao-de-fotos_/$clientId")({
  component: RouteComponent,
  ssr: false,
});

function RouteComponent() {
  const { clientId } = Route.useParams();
  return <PhotoClientDetailPage clientId={clientId} />;
}
