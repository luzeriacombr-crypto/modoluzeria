import { createFileRoute } from "@tanstack/react-router";
import { AffiliateDashboard } from "@/components/affiliate/AffiliateDashboard";

export const Route = createFileRoute("/_authenticated/afiliado/dashboard")({
  component: AffiliateDashboard,
});
