import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useUI } from "@/lib/luzeria/ui-store";
import { StoriesView } from "@/components/luzeria/StoriesView";

export const Route = createFileRoute("/_authenticated/stories")({
  component: StoriesPage,
  ssr: false,
});

function StoriesPage() {
  const setView = useUI((s) => s.setView);
  useEffect(() => { setView("stories"); }, [setView]);
  return <StoriesView />;
}
