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
import { StoriesView } from "./StoriesView";
import { CleaningView } from "./CleaningView";
import { AdminDashboard } from "./AdminDashboard";
import { NotificationsBell } from "./Notifications";
import { NewClientModal, CustomFieldsModal } from "./Modals";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "./Avatar";
import { MobileNav } from "./MobileNav";

export function App() {
  const me = useMe();
  const { view, selectedClientId } = useUI();
  const [creating, setCreating] = useState<{ category?: string } | null>(null);
  const [customFor, setCustomFor] = useState<Client | null>(null);

  if (me.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] text-white/40 text-sm">Carregando…</div>;
  }

  if (me.data && !me.data.active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] px-4">
        <div className="max-w-sm w-full bg-[#1A1A1A] rounded-xl p-8 text-center"
          style={{ border: "1px solid rgba(200,212,78,0.2)" }}>
          <div className="text-[#C8D44E] text-xs uppercase tracking-wider font-bold mb-3">Aguardando aprovação</div>
          <h1 className="text-white text-lg font-semibold mb-2">Sua conta está em análise</h1>
          <p className="text-white/50 text-sm leading-relaxed mb-6">
            Um Administrador precisa autorizar seu acesso antes que você possa usar o sistema. Você receberá acesso assim que for aprovado.
          </p>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }}
            className="text-xs text-white/60 hover:text-white transition">
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0D0D0D]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <Toaster theme="dark" position="bottom-right" />
      <div className="hidden md:flex"><Sidebar onOpenCustomFields={setCustomFor} onCreateClient={(category) => setCreating({ category })} /></div>
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {view === "my" && <MyTasks />}
          {view === "dashboard" && <Dashboard onCreate={() => setCreating({})} />}
          {view === "client" && selectedClientId && <ClientView clientId={selectedClientId} />}
          {view === "settings" && <SettingsPage />}
          {view === "stories" && <StoriesView />}
          {view === "cleaning" && <CleaningView />}
          {view === "admin" && <AdminDashboard />}
        </main>
      </div>
      <DetailPanel />
      <MobileNav />
      <NewClientModal open={!!creating} category={creating?.category} onClose={() => setCreating(null)} />
      <CustomFieldsModal client={customFor} onClose={() => setCustomFor(null)} />
    </div>
  );
}

function Header() {
  const me = useMe().data;
  return (
    <header className="lz-app-header sticky top-0 z-30 h-14 px-4 md:px-6 flex items-center justify-end gap-2">
      <NotificationsBell />
      {me && (
        <div className="flex items-center gap-2 pl-2">
          <div className="rounded-full p-[2px]" style={{ border: "2px solid #C8D44E" }}>
            <Avatar profile={me} size={26} />
          </div>
          <span className="hidden md:inline text-xs text-white/70">{me.name}</span>
        </div>
      )}
    </header>
  );
}