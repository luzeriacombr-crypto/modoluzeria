import { createFileRoute } from "@tanstack/react-router";
import { AffiliatePage } from "@/components/affiliate/AffiliatePage";

export const Route = createFileRoute("/afiliar")({
  component: AffiliatePage,
});
