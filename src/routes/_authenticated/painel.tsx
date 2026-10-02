import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMe } from "@/lib/luzeria/queries";
import { isHouse } from "@/lib/luzeria/house";

// O antigo "Painel do dono" virou seção do Dashboard (mesma tela da agência).
// A rota fica só pra links antigos.
export const Route = createFileRoute("/_authenticated/painel")({
  component: PainelPage,
  ssr: false,
});

function PainelPage() {
  const me = useMe().data;
  if (!me) return null;
  if (isHouse(me) && me.role === "member") return <Navigate to="/meu-dia" replace />;
  return <Navigate to="/admin" replace />;
}
