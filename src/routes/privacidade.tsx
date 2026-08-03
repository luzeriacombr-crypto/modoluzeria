import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPolicyPage } from "@/components/luzeria/PrivacyPolicyPage";

export const Route = createFileRoute("/privacidade")({
  component: PrivacyPolicyPage,
});
