import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMe } from "@/lib/luzeria/queries";
import { isHouse } from "@/lib/luzeria/house";
import { HouseLeadsPage } from "@/components/luzeria/HouseLeads";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
  ssr: false,
});

function LeadsPage() {
  const me = useMe().data;
  if (me && !isHouse(me)) return <Navigate to="/minhas-tarefas" replace />;
  return <HouseLeadsPage />;
}
