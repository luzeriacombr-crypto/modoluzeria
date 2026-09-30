import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMe } from "@/lib/luzeria/queries";
import { KnowledgeTemplateAdmin } from "@/components/luzeria/KnowledgeTemplateAdmin";

// Base de conhecimento modelo das Houses (Método Luzeria) — só a Luzeria.
export const Route = createFileRoute("/_authenticated/base-modelo")({
  component: BaseModeloPage,
  ssr: false,
});

function BaseModeloPage() {
  const me = useMe().data;
  if (!me) return null;
  if (!me.isPlatformAdmin) return <Navigate to="/minhas-tarefas" replace />;
  return <KnowledgeTemplateAdmin />;
}
