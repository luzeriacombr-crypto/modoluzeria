import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useMe } from "@/lib/luzeria/queries";
import { isHouse } from "@/lib/luzeria/house";
import { HousePlaybook } from "@/components/luzeria/HousePlaybook";

// /playbook = playbook da House. /playbook?modelo=1 = playbook modelo global
// (só a Luzeria), o que é copiado pra cada House nova.
export const Route = createFileRoute("/_authenticated/playbook")({
  component: PlaybookPage,
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    pagina: typeof s.pagina === "string" ? s.pagina : undefined,
    modelo: s.modelo === "1" || s.modelo === 1 ? "1" : undefined,
  }),
});

function PlaybookPage() {
  const me = useMe().data;
  const { pagina, modelo } = Route.useSearch();
  const navigate = useNavigate({ from: "/playbook" });
  if (!me) return null;
  const scope = modelo && me.isPlatformAdmin ? "modelo" : "org";
  if (scope === "org" && !isHouse(me)) return <Navigate to="/minhas-tarefas" replace />;
  return (
    <HousePlaybook key={scope} scope={scope} pageId={pagina}
      onSelectPage={(id) => navigate({ search: (prev: any) => ({ ...prev, pagina: id }), replace: !pagina })} />
  );
}
