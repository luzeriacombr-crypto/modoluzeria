import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useUI } from "@/lib/luzeria/ui-store";
import { CleaningView } from "@/components/luzeria/CleaningView";

export const Route = createFileRoute("/_authenticated/limpeza")({
  component: LimpezaPage,
  ssr: false,
});

function LimpezaPage() {
  const setView = useUI((s) => s.setView);
  useEffect(() => { setView("cleaning"); }, [setView]);
  return <CleaningView />;
}
