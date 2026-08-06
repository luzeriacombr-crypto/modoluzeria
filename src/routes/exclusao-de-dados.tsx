import { createFileRoute } from "@tanstack/react-router";
import { DataDeletionPage } from "@/components/luzeria/DataDeletionPage";

export const Route = createFileRoute("/exclusao-de-dados")({
  component: DataDeletionPage,
});
