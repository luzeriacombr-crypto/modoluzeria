import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMe } from "@/lib/luzeria/queries";
import { isHouse } from "@/lib/luzeria/house";
import { HouseOwnerPanel } from "@/components/luzeria/HouseOwnerPanel";

// Painel do dono (House): visão do mês numa tela só. Só gestor/Adm Setor.
export const Route = createFileRoute("/_authenticated/painel")({
  component: PainelPage,
  ssr: false,
});

function PainelPage() {
  const me = useMe().data;
  if (!me) return null;
  if (!isHouse(me)) return <Navigate to="/admin" replace />;
  if (me.role === "member") return <Navigate to="/meu-dia" replace />;
  return <HouseOwnerPanel />;
}
