import { createFileRoute } from "@tanstack/react-router";
import { App } from "@/components/luzeria/App";

export const Route = createFileRoute("/_authenticated/")({
  component: App,
});