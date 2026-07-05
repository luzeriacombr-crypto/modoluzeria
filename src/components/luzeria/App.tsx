import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import type { Client } from "@/lib/luzeria/types";
import { Sidebar } from "./Sidebar";
import { DetailPanel } from "./DetailPanel";
import { NotificationsBell } from "./Notifications";
import { NewClientModal, CustomFieldsModal } from "./Modals";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "./Avatar";
import { MobileNav } from "./MobileNav";
import { WelcomeOnboarding } from "./WelcomeOnboarding";
import { ClientFichaPanel } from "./ClientFichaPanel";
import { AppTour } from "./AppTour";
import { LuzeriaLoader } from "./LuzeriaLoader";
import luzeriaLogo from "@/assets/luzeria-sidebar.png";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function App() {
  const me = useMe();
  const qc = useQueryClient();
  const { sidebarHidden, toggleSidebar } = useUI();
  const [creating, setCreating] = useState<{ category?: string } | null>(null);
  const [customFor, setCustomFor] = useState<Client | null>(null);

  // Supabase Realtime — invalidate month cache when team edits content items
  useEffect(() => {
    const channel = supabase
      .channel("content-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "content_items" }, () => {
        qc.invalidateQueries({ queryKey: ["month"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "content_comments" }, () => {
        qc.invalidateQueries({ queryKey: ["month"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  if (me.isLoading) {
    return <LuzeriaLoader />;
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
        <Header sidebarHidden={sidebarHidden} onToggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>
      {/* Always-visible floating toggle when sidebar is hidden — never gets stuck */}
      {sidebarHidden && (
        <button
          onClick={toggleSidebar}
          aria-label="Mostrar sidebar"
          className="hidden md:flex fixed top-3 left-3 z-[9999] items-center gap-1.5 px-3 py-2 rounded-md text-white text-xs font-semibold transition-colors"
          style={{ background: "#C8D44E", color: "#0D0D0D" }}
        >
          <PanelLeftOpen size={16} /> Menu
        </button>
      )}
      <DetailPanel />
      <ClientFichaPanel />
      <MobileNav />
      <AppTour />
      <NewClientModal open={!!creating} category={creating?.category} onClose={() => setCreating(null)} />
      <CustomFieldsModal client={customFor} onClose={() => setCustomFor(null)} />
    </div>
  );
}

function Header({ sidebarHidden, onToggleSidebar }: { sidebarHidden: boolean; onToggleSidebar: () => void }) {
  const me = useMe().data;
  const navigate = useNavigate();
  return (
    <header className="lz-app-header sticky top-0 z-30 px-4 md:px-6 flex items-center gap-2 h-14">
      <button
        onClick={onToggleSidebar}
        aria-label={sidebarHidden ? "Mostrar sidebar" : "Ocultar sidebar"}
        className="hidden md:flex items-center justify-center h-8 w-8 rounded-md text-white/60 hover:text-white hover:bg-white/5 transition-colors"
      >
        {sidebarHidden ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>
      <img src={luzeriaLogo} alt="Luzeria" className="md:hidden h-6 w-auto object-contain" />
      <div className="flex-1" />
      <NotificationsBell />
      {me && (
        <button
          onClick={() => navigate({ to: "/perfil" })}
          className="flex items-center gap-2 pl-2 hover:opacity-90 transition-opacity"
          title="Meu perfil"
          data-tour="profile-btn"
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