import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useUI } from "@/lib/luzeria/ui-store";
import { SettingsPage } from "@/components/luzeria/Settings";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfiguracoesPage,
  ssr: false,
});

function ConfiguracoesPage() {
  const setView = useUI((s) => s.setView);
  useEffect(() => { setView("settings"); }, [setView]);
  return <SettingsPage />;
}
