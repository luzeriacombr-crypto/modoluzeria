import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/luzeria/Sidebar";
import { Dashboard } from "@/components/luzeria/Dashboard";
import { ClientView } from "@/components/luzeria/ClientView";
import { DetailPanel } from "@/components/luzeria/DetailPanel";
import {
  CustomFieldsModal,
  NewClientModal,
  RenameModal,
  StyleModal,
} from "@/components/luzeria/Modals";
import { useLuzeria } from "@/lib/luzeria/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Luzeria — Gestão de Conteúdo" },
      { name: "description", content: "Painel interno de produção de conteúdo da Luzeria Estúdio." },
      { property: "og:title", content: "Luzeria — Gestão de Conteúdo" },
      { property: "og:description", content: "Painel interno de produção de conteúdo da Luzeria Estúdio." },
    ],
  }),
  component: Index,
});

function Index() {
  const selectedClientId = useLuzeria((s) => s.selectedClientId);

  const [newClientOpen, setNewClientOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [styleId, setStyleId] = useState<string | null>(null);
  const [customId, setCustomId] = useState<string | null>(null);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <Sidebar
        onNewClient={() => setNewClientOpen(true)}
        onRename={setRenameId}
        onStyle={setStyleId}
        onCustomFields={setCustomId}
      />
      <main className="flex-1 overflow-hidden">
        {selectedClientId ? (
          <ClientView />
        ) : (
          <div className="h-full overflow-y-auto">
            <Dashboard onNewClient={() => setNewClientOpen(true)} />
          </div>
        )}
      </main>
      <DetailPanel />
      <NewClientModal open={newClientOpen} onOpenChange={setNewClientOpen} />
      <RenameModal clientId={renameId} onClose={() => setRenameId(null)} />
      <StyleModal clientId={styleId} onClose={() => setStyleId(null)} />
      <CustomFieldsModal clientId={customId} onClose={() => setCustomId(null)} />
      <Toaster theme="dark" position="bottom-right" />
    </div>
  );
}
