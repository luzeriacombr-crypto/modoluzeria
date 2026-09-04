import { createFileRoute } from "@tanstack/react-router";
import { PhotoClientsListPage } from "@/components/luzeria/PhotoClientsListPage";

export const Route = createFileRoute("/_authenticated/selecao-de-fotos")({
  component: PhotoClientsListPage,
  ssr: false,
});
