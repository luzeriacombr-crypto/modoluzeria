import { createFileRoute } from "@tanstack/react-router";
import { FinancePage, FINANCE_TABS, type FinanceTab } from "@/components/luzeria/FinancePage";

export const Route = createFileRoute("/_authenticated/financeiro")({
  component: FinanceiroRoute,
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { aba?: FinanceTab } => {
    return typeof search.aba === "string" && (FINANCE_TABS as string[]).includes(search.aba) ? { aba: search.aba as FinanceTab } : {};
  },
});

function FinanceiroRoute() {
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();
  return <FinancePage tab={aba ?? "entradas"} onTabChange={(t) => navigate({ search: { aba: t }, replace: true })} />;
}
