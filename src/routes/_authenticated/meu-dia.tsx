import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useUI } from "@/lib/luzeria/ui-store";
import { useMe } from "@/lib/luzeria/queries";
import { isHouse } from "@/lib/luzeria/house";
import { HouseMyDay } from "@/components/luzeria/HouseMyDay";

export const Route = createFileRoute("/_authenticated/meu-dia")({
  component: MeuDiaPage,
  ssr: false,
});

function MeuDiaPage() {
  const setView = useUI((s) => s.setView);
  const me = useMe().data;
  useEffect(() => { setView("my"); }, [setView]);
  if (me && !isHouse(me)) return <Navigate to="/minhas-tarefas" replace />;
  return <HouseMyDay />;
}
