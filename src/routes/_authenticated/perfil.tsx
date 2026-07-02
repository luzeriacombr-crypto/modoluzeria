import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useUI } from "@/lib/luzeria/ui-store";
import { ProfilePage } from "@/components/luzeria/ProfilePage";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: PerfilPage,
  ssr: false,
});

function PerfilPage() {
  const setView = useUI((s) => s.setView);
  useEffect(() => { setView("profile"); }, [setView]);
  return <ProfilePage />;
}
