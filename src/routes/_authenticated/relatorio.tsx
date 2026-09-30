import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMe } from "@/lib/luzeria/queries";
import { isHouse } from "@/lib/luzeria/house";
import { HouseReport } from "@/components/luzeria/HouseReport";

export const Route = createFileRoute("/_authenticated/relatorio")({
  component: RelatorioPage,
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    mes: typeof s.mes === "string" && /^\d{4}-\d{2}$/.test(s.mes) ? s.mes : undefined,
  }),
});

function RelatorioPage() {
  const me = useMe().data;
  const { mes } = Route.useSearch();
  if (!me) return null;
  if (!isHouse(me)) return <Navigate to="/minhas-tarefas" replace />;
  return <HouseReport key={mes ?? "auto"} initialMonth={mes} />;
}
