import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Menu } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import type { Client } from "@/lib/luzeria/types";
import { Sidebar } from "./Sidebar";
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
import { WelcomeOnboarding } from "./WelcomeOnboarding";
import { ProfilePage } from "./ProfilePage";
import { ClientFichaPanel } from "./ClientFichaPanel";
import luzeriaLogo from "@/assets/luzeria-sidebar.png.asset.json";

export function App() {
  const me = useMe();
  const { view, selectedClientId, sidebarHidden, toggleSidebar, setView } = useUI();
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

  if (me.data && !me.data.onboardedAt) {
    return <WelcomeOnboarding me={me.data} />;
  }

  return (
    <div className="flex min-h-screen bg-[#0D0D0D]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <Toaster theme="dark" position="bottom-right" />
      <div
        className="hidden md:flex overflow-hidden"
        style={{
          width: sidebarHidden ? 0 : 220,
          transition: "width 250ms ease",
        }}
      >
        <div
          style={{
            transform: sidebarHidden ? "translateX(-100%)" : "translateX(0)",
            transition: "transform 250ms ease",
          }}
        >
          <Sidebar onOpenCustomFields={setCustomFor} onCreateClient={(category) => setCreating({ category })} />
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <Header hidden={sidebarHidden} onToggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {view === "my" && <MyTasks />}
          {view === "client" && selectedClientId && <ClientView clientId={selectedClientId} />}
          {view === "settings" && <SettingsPage />}
          {view === "stories" && <StoriesView />}
          {view === "cleaning" && <CleaningView />}
          {view === "admin" && <AdminDashboard />}
          {view === "profile" && <ProfilePage />}
        </main>
      </div>
      <DetailPanel />
      <ClientFichaPanel />
      <MobileNav />
      {sidebarHidden && (
        <button
          onClick={toggleSidebar}
          aria-label="Reabrir sidebar"
          className="hidden md:flex fixed bottom-6 left-6 z-40 items-center justify-center h-11 w-11 rounded-full text-white hover:bg-black/70 transition-colors"
          style={{
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Menu size={18} />
        </button>
      )}
      <NewClientModal open={!!creating} category={creating?.category} onClose={() => setCreating(null)} />
      <CustomFieldsModal client={customFor} onClose={() => setCustomFor(null)} />
    </div>
  );
}

function Header({ hidden, onToggleSidebar }: { hidden: boolean; onToggleSidebar: () => void }) {
  const me = useMe().data;
  const setView = useUI((s) => s.setView);
  return (
    <header
      className="lz-app-header sticky top-0 z-30 px-4 md:px-6 flex items-center gap-2 overflow-hidden"
      style={{
        height: hidden ? 0 : 56,
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? "none" : "auto",
        transition: "height 250ms ease, opacity 200ms ease",
      }}
    >
      <button
        onClick={onToggleSidebar}
        aria-label={hidden ? "Mostrar sidebar" : "Ocultar sidebar"}
        className="hidden md:flex items-center justify-center h-8 w-8 rounded-md text-white/60 hover:text-white hover:bg-white/5 transition-colors"
      >
        {hidden ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>
      <img src={luzeriaLogo.url} alt="Luzeria" className="md:hidden h-6 w-auto object-contain" />
      <div className="flex-1" />
      <NotificationsBell />
      {me && (
        <button
          onClick={() => setView("profile")}
          className="flex items-center gap-2 pl-2 hover:opacity-90 transition-opacity"
          title="Meu perfil"
        >
          <div className="rounded-full p-[2px]" style={{ border: "2px solid #C8D44E" }}>
            <Avatar profile={me} size={26} />
          </div>
          <span className="hidden md:inline text-xs text-white/70">{me.name}</span>
        </button>
      )}
    </header>
  );
}