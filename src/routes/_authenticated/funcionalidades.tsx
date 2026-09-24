import { createFileRoute } from "@tanstack/react-router";
import { FeatureShowcasePage } from "@/components/luzeria/FeatureShowcasePage";

export const Route = createFileRoute("/_authenticated/funcionalidades")({
  component: FeatureShowcasePage,
  ssr: false,
});
