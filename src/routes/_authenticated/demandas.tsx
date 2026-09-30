import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMe } from "@/lib/luzeria/queries";
import { isHouse } from "@/lib/luzeria/house";
import { HouseDemands } from "@/components/luzeria/HouseDemands";

export const Route = createFileRoute("/_authenticated/demandas")({
  component: DemandasPage,
  ssr: false,
});

function DemandasPage() {
  const me = useMe().data;
  if (!me) return null;
  if (!isHouse(me)) return <Navigate to="/minhas-tarefas" replace />;
  return <HouseDemands />;
}
