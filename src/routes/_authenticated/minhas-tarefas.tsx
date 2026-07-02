import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useUI } from "@/lib/luzeria/ui-store";
import { MyTasks } from "@/components/luzeria/MyTasks";

export const Route = createFileRoute("/_authenticated/minhas-tarefas")({
  component: MinhasTarefasPage,
  ssr: false,
});

function MinhasTarefasPage() {
  const setView = useUI((s) => s.setView);
  useEffect(() => { setView("my"); }, [setView]);
  return <MyTasks />;
}
