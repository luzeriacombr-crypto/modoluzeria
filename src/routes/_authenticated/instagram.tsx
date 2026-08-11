import { createFileRoute } from "@tanstack/react-router";
import { InstagramActivityPage } from "@/components/luzeria/InstagramActivityPage";

export const Route = createFileRoute("/_authenticated/instagram")({
  component: InstagramActivityPage,
  ssr: false,
});
