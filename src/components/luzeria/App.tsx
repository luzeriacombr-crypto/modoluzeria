import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import type { Client } from "@/lib/luzeria/types";
import { Sidebar } from "./Sidebar";
import { Dashboard } from "./Dashboard";
import { ClientView } from "./ClientView";
import { DetailPanel } from "./DetailPanel";
import { MyTasks } from "./MyTasks";
import { SettingsPage } from "./Settings";
import { NotificationsBell } from "./Notifications";
import { NewClientModal, CustomFieldsModal } from "./Modals";
import { Avatar } from "./Avatar";

export function App() {
  const me = useMe();
  const { view, selectedClientId } = useUI();
  const [creating, setCreating] = useState(false);
  const [customFor, setCustomFor] = useState<Client | null>(null);

  if (me.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] text-white/40 text-sm">Carregando…</div>;
  }

  return (
    <div className="flex min-h-screen bg-[#0D0D0D]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <Toaster theme="dark" position="bottom-right" />
      <Sidebar onOpenCustomFields={setCustomFor} onCreateClient={() => setCreating(true)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {view === "my" && <MyTasks />}
          {view === "dashboard" && <Dashboard onCreate={() => setCreating(true)} />}
          {view === "client" && selectedClientId && <ClientView clientId={selectedClientId} />}
          {view === "settings" && <SettingsPage />}
        </main>
      </div>
      <DetailPanel />
      <NewClientModal open={creating} onClose={() => setCreating(false)} />
      <CustomFieldsModal client={customFor} onClose={() => setCustomFor(null)} />
    </div>
  );
}

function Header() {
  const me = useMe().data;
  return (
    <header className="h-14 px-6 flex items-center justify-end gap-2 border-b border-white/[0.06] bg-[#0D0D0D]">
      <NotificationsBell />
      {me && (
        <div className="flex items-center gap-2 pl-2">
          <Avatar profile={me} size={28} />
          <span className="text-xs text-white/70">{me.name}</span>
        </div>
      )}
    </header>
  );
}