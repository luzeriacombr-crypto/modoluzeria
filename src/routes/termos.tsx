import { createFileRoute } from "@tanstack/react-router";
import { TermsOfServicePage } from "@/components/luzeria/TermsOfServicePage";

export const Route = createFileRoute("/termos")({
  component: TermsOfServicePage,
});
