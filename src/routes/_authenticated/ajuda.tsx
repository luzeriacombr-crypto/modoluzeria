import { createFileRoute } from "@tanstack/react-router";
import { AjudaPage } from "@/components/luzeria/AjudaPage";

export const Route = createFileRoute("/_authenticated/ajuda")({
  component: AjudaPage,
  ssr: false,
});
