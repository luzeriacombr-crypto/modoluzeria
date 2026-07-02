import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useUI } from "@/lib/luzeria/ui-store";
import { AdminDashboard } from "@/components/luzeria/AdminDashboard";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  ssr: false,
});

function AdminPage() {
  const setView = useUI((s) => s.setView);
  useEffect(() => { setView("admin"); }, [setView]);
  return <AdminDashboard />;
}
