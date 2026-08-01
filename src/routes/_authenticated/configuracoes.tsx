import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useUI } from "@/lib/luzeria/ui-store";
import { SettingsPage } from "@/components/luzeria/Settings";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfiguracoesPage,
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { tab?: string } => {
    return typeof search.tab === "string" ? { tab: search.tab } : {};
  },
});

function ConfiguracoesPage() {
  const setView = useUI((s) => s.setView);
  const { tab } = Route.useSearch();
  useEffect(() => { setView("settings"); }, [setView]);
  return <SettingsPage initialTab={tab} />;
}
