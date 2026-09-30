import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useMe } from "@/lib/luzeria/queries";
import { isHouse } from "@/lib/luzeria/house";
import { HouseProjects } from "@/components/luzeria/HouseProjects";

export const Route = createFileRoute("/_authenticated/projetos")({
  component: ProjetosPage,
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ id: typeof s.id === "string" ? s.id : undefined }),
});

function ProjetosPage() {
  const me = useMe().data;
  const { id } = Route.useSearch();
  const navigate = useNavigate({ from: "/projetos" });
  if (!me) return null;
  if (!isHouse(me)) return <Navigate to="/minhas-tarefas" replace />;
  return <HouseProjects projectId={id} onOpen={(pid) => navigate({ search: { id: pid } })} />;
}
