import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useUI } from "@/lib/luzeria/ui-store";
import { useMe } from "@/lib/luzeria/queries";
import { isHouse } from "@/lib/luzeria/house";
import { CleaningView } from "@/components/luzeria/CleaningView";
import { HouseChecklists } from "@/components/luzeria/HouseChecklists";

export const Route = createFileRoute("/_authenticated/rotina")({
  component: RotinaPage,
  ssr: false,
});

function RotinaPage() {
  const setView = useUI((s) => s.setView);
  const me = useMe().data;
  useEffect(() => { setView("cleaning"); }, [setView]);
  // Na House, a Rotina vira os checklists recorrentes da função.
  if (isHouse(me)) return <HouseChecklists />;
  return <CleaningView />;
}
