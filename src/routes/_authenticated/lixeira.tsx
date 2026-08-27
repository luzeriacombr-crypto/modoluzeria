import { createFileRoute } from "@tanstack/react-router";
import { TrashPage } from "@/components/luzeria/TrashPage";

export const Route = createFileRoute("/_authenticated/lixeira")({
  component: TrashPage,
  ssr: false,
});
