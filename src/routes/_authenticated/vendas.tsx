import { createFileRoute } from "@tanstack/react-router";
import { SalesPipelinePage } from "@/components/luzeria/SalesPipelinePage";

export const Route = createFileRoute("/_authenticated/vendas")({
  component: SalesPipelinePage,
  ssr: false,
});
