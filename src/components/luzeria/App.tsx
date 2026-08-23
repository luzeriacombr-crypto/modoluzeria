import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PanelLeftClose, PanelLeftOpen, Settings as SettingsIcon, Video } from "lucide-react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { useTheme } from "@/lib/luzeria/theme-store";
import { useCallStore } from "@/lib/luzeria/call-store";
import type { Client } from "@/lib/luzeria/types";
import { Sidebar } from "./Sidebar";
import { DetailPanel } from "./DetailPanel";
import { NotificationsBell } from "./Notifications";
import { HelpButton } from "./HelpButton";
import { ThemeToggle } from "./ThemeToggle";
import { NewClientModal, CustomFieldsModal } from "./Modals";
import { supabase } from "@/integrations/supabase/client";
import { clearOneSignalUserId } from "@/lib/luzeria/push-notifications";
import { Avatar } from "./Avatar";
import { MobileNav } from "./MobileNav";
import { PullToRefresh } from "./PullToRefresh";
import { GlobalSearchOverlay, GlobalSearchButton } from "./GlobalSearch";
import { WelcomeOnboarding } from "./WelcomeOnboarding";
import { ClientFichaPanel } from "./ClientFichaPanel";
import { AppTour } from "./AppTour";
import { LuzeriaLoader } from "./LuzeriaLoader";
import { TrialEndingBanner } from "./TrialEndingBanner";
import { GlobalConfirmDialog } from "./GlobalConfirmDialog";
import { IncomingCallModal } from "./IncomingCallModal";
import { ActiveCallOverlay } from "./ActiveCallOverlay";
import { CallInvitePicker } from "./CallInvitePicker";
import { useScreenShareCall } from "@/hooks/use-screen-share-call";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hexToRgbChannels, readableAccentRgbChannels, deriveSecondaryHex } from "@/lib/luzeria/utils";

export function App() {
  const me = useMe();
  const qc = useQueryClient();
  const { sidebarHidden, toggleSidebar } = useUI();
  const { theme } = useTheme();
  // Matched route's static id (not the resolved path) — switching between
  // clients/months stays the same id, so it doesn't remount/reset that
  // page; jumping to a genuinely different section does, which is what
  // gets the subtle entrance animation below.
  const routeId = useRouterState({ select: (s) => s.matches.at(-1)?.routeId ?? "" });
  const [creating, setCreating] = useState<{ category?: string } | null>(null);
  const [customFor, setCustomFor] = useState<Client | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const call = useScreenShareCall();

  // Supabase Realtime — invalidate month cache when team edits content items
  useEffect(() => {
    const channel = supabase
      .channel("content-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "content_items" }, () => {
        qc.invalidateQueries({ queryKey: ["month"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, () => {
        qc.invalidateQueries({ queryKey: ["month"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // Personalize the browser tab title once we know which org is logged in
  // (the pre-login splash/login screen stays generic — org is unknown then).
  // Luzeria is treated like any other org here on purpose — its own org row
  // carries the "Luzeria" name/tagline as data, not as a code special-case.
  useEffect(() => {
    if (me.data?.orgName) {
      document.title = `Modo Criador - ${me.data.orgName}`;
    }
  }, [me.data?.orgName]);

  // Same idea for the brand colors: override the CSS variables (which
  // default to Luzeria's green in styles.css) whenever the org has custom
  // colors saved — including Luzeria's own org, once it sets any.
  useEffect(() => {
    const root = document.documentElement.style;
    const primary = me.data?.orgColorPrimary ? hexToRgbChannels(me.data.orgColorPrimary) : null;
    // If the org set a primary color but never touched "light" (still the
    // default lime), derive one from the primary instead of mixing the
    // org's own color with Luzeria's leftover green in every gradient.
    const lightHex = me.data?.orgColorPrimaryLight && me.data.orgColorPrimaryLight !== "#C8D44E"
      ? me.data.orgColorPrimaryLight
      : me.data?.orgColorPrimary ? deriveSecondaryHex(me.data.orgColorPrimary) : null;
    const light = lightHex ? hexToRgbChannels(lightHex) : null;
    const sidebar = me.data?.orgColorSidebar ? hexToRgbChannels(me.data.orgColorSidebar) : null;
    // A color naturally dark even at full brightness (navy, deep purple...)
    // reads as low-contrast when shown directly as accent text on this
    // app's near-black UI — --lz-brand-text-rgb is the same color when it's
    // light enough to read, or white as a safe fallback otherwise.
    const text = me.data?.orgColorPrimary ? readableAccentRgbChannels(me.data.orgColorPrimary) : null;
    // Degradê do cabeçalho do Dashboard: usa as cores escolhidas em
    // Configurações se a agência definiu alguma, senão cai pro par que já
    // era usado antes (cor clara da marca + cor da barra lateral).
    const heroA = me.data?.heroGradientFrom ? hexToRgbChannels(me.data.heroGradientFrom) : light;
    const heroB = me.data?.heroGradientTo ? hexToRgbChannels(me.data.heroGradientTo) : sidebar;
    if (primary) root.setProperty("--lz-brand-rgb", primary);
    if (light) root.setProperty("--lz-brand-light-rgb", light);
    if (sidebar) root.setProperty("--lz-sidebar-rgb", sidebar);
    if (text) root.setProperty("--lz-brand-text-rgb", text);
    if (heroA) root.setProperty("--lz-hero-a-rgb", heroA);
    if (heroB) root.setProperty("--lz-hero-b-rgb", heroB);
    if (me.data?.borderRadius != null) root.setProperty("--lz-radius", `${me.data.borderRadius}px`);
    return () => {
      root.removeProperty("--lz-brand-rgb");
      root.removeProperty("--lz-brand-light-rgb");
      root.removeProperty("--lz-sidebar-rgb");
      root.removeProperty("--lz-brand-text-rgb");
      root.removeProperty("--lz-hero-a-rgb");
      root.removeProperty("--lz-hero-b-rgb");
      root.removeProperty("--lz-radius");
    };
  }, [me.data?.orgId, me.data?.orgColorPrimary, me.data?.orgColorPrimaryLight, me.data?.orgColorSidebar, me.data?.borderRadius, me.data?.heroGradientFrom, me.data?.heroGradientTo]);

  // Same idea for the tab icon: swap the favicon + apple-touch-icon (used
  // when the client adds the app to their iOS home screen) whenever the org
  // uploaded a custom one — revert to whatever was there on cleanup.
  useEffect(() => {
    const url = me.data?.orgFaviconUrl;
    if (!url) return;
    const links = Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]'),
    );
    const originals = links.map((l) => l.href);
    links.forEach((l) => { l.href = url; });
    return () => {
      links.forEach((l, i) => { l.href = originals[i]; });
    };
  }, [me.data?.orgFaviconUrl]);

  // Cache the org's logo + brand colors locally so the loading screen
  // (which renders before we know who's logged in, so before the
  // --lz-brand-rgb CSS var is set) can show them immediately on a repeat
  // visit instead of the generic Modo Criador mark/lime — see
  // LuzeriaLoader.tsx. Clears the cache when the org has neither, so a
  // shared device switching between orgs doesn't briefly flash stale branding.
  useEffect(() => {
    if (!me.data) return;
    if (me.data.orgLogoUrl || me.data.orgColorPrimary) {
      localStorage.setItem("lz_org_branding", JSON.stringify({
        logoUrl: me.data.orgLogoUrl ?? null,
        name: me.data.orgName ?? null,
        colorPrimary: me.data.orgColorPrimary ?? null,
        colorPrimaryLight: me.data.orgColorPrimaryLight ?? null,
      }));
    } else {
      localStorage.removeItem("lz_org_branding");
    }
  }, [me.data?.orgLogoUrl, me.data?.orgName, me.data?.orgColorPrimary, me.data?.orgColorPrimaryLight]);

  if (me.isLoading) {
    return <LuzeriaLoader />;
  }

  if (me.data && !me.data.active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm w-full bg-card rounded-xl p-8 text-center"
          style={{ border: "1px solid rgba(var(--lz-brand-light-rgb),0.2)" }}>
          <div className="text-[var(--lz-accent-ink)] text-xs uppercase tracking-wider font-bold mb-3">Aguardando aprovação</div>
          <h1 className="text-foreground text-lg font-semibold mb-2">Sua conta está em análise</h1>
          <p className="text-foreground/50 text-sm leading-relaxed mb-6">
            Um Administrador precisa autorizar seu acesso antes que você possa usar o sistema. Você receberá acesso assim que for aprovado.
          </p>
          <button
            onClick={async () => { await clearOneSignalUserId(); await supabase.auth.signOut(); window.location.href = "/auth"; }}
            className="text-xs text-foreground/60 hover:text-foreground transition">
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
    <div className="flex h-screen overflow-hidden bg-background" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <Toaster theme={theme} position="bottom-right" />
      <div
        className="hidden md:flex overflow-hidden self-start"
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
        <TrialEndingBanner isMaster={me.data?.role === "master"} />
        <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-0">
          <PullToRefresh containerRef={mainRef}>
            <div key={routeId} className="lz-page-in">
              <Outlet />
            </div>
          </PullToRefresh>
        </main>
      </div>
      {/* Always-visible floating toggle when sidebar is hidden — never gets stuck */}
      {sidebarHidden && (
        <button
          onClick={toggleSidebar}
          aria-label="Mostrar sidebar"
          className="hidden md:flex fixed top-3 left-3 z-[9999] items-center gap-1.5 px-3 py-2 rounded-md text-foreground text-xs font-semibold transition-colors"
          style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          <PanelLeftOpen size={16} /> Menu
        </button>
      )}
      <DetailPanel />
      <ClientFichaPanel />
      <MobileNav />
      <AppTour />
      <GlobalSearchOverlay />
      <GlobalConfirmDialog />
      <IncomingCallModal call={call} />
      <ActiveCallOverlay call={call} />
      <NewClientModal open={!!creating} category={creating?.category} onClose={() => setCreating(null)} />
      <CustomFieldsModal client={customFor} onClose={() => setCustomFor(null)} />
    </div>
  );
}

function Header({ sidebarHidden, onToggleSidebar }: { sidebarHidden: boolean; onToggleSidebar: () => void }) {
  const me = useMe().data;
  const navigate = useNavigate();
  const disabled = new Set(me?.disabledFeatures ?? []);
  const canCall = useCallStore((s) => s.canCall);
  const callStatus = useCallStore((s) => s.status);
  const [callPickerOpen, setCallPickerOpen] = useState(false);
  const [callAnchor, setCallAnchor] = useState<DOMRect | null>(null);
  const callBtnRef = useRef<HTMLButtonElement>(null);
  return (
    <header className="lz-app-header sticky top-0 z-50 px-4 md:px-6 flex items-center gap-2 h-14">
      <button
        onClick={onToggleSidebar}
        aria-label={sidebarHidden ? "Mostrar sidebar" : "Ocultar sidebar"}
        className="hidden md:flex items-center justify-center h-8 w-8 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
      >
        {sidebarHidden ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
      </button>
      {me?.orgLogoUrl ? (
        <div className="md:hidden h-10 max-w-[140px]">
          <img src={me.orgLogoUrl} alt={me.orgName ?? "Logo"} className="h-full max-w-full object-contain object-left" />
        </div>
      ) : (
        <span className="md:hidden text-foreground font-extrabold text-sm uppercase tracking-wide truncate max-w-[140px]">
          {me?.orgName ?? "Modo Criador"}
        </span>
      )}
      <div className="flex-1" />
      <GlobalSearchButton variant="header" />
      {me?.role === "master" && (
        <button
          onClick={() => navigate({ to: "/configuracoes" })}
          title="Configurações"
          className="flex items-center justify-center h-8 w-8 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
        >
          <SettingsIcon size={18} />
        </button>
      )}
      {!disabled.has("video_call") && (
        <div className="relative">
          <button
            ref={callBtnRef}
            onClick={() => {
              const rect = callBtnRef.current?.getBoundingClientRect();
              if (rect) { setCallAnchor(rect); setCallPickerOpen(true); }
            }}
            disabled={!canCall || callStatus !== "idle"}
            title={!canCall ? "Câmera indisponível neste navegador" : callStatus !== "idle" ? "Você já está em uma chamada" : "Vídeo chamada"}
            className="flex items-center justify-center h-8 w-8 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Video size={18} />
          </button>
          {callPickerOpen && callAnchor && createPortal(
            <CallInvitePicker anchorRect={callAnchor} onClose={() => setCallPickerOpen(false)} />,
            document.body,
          )}
        </div>
      )}
      <ThemeToggle />
      <HelpButton />
      <NotificationsBell />
      {me && (
        <button
          onClick={() => navigate({ to: "/perfil" })}
          className="flex items-center gap-2 pl-2 hover:opacity-90 transition-opacity"
          title="Meu perfil"
          data-tour="profile-btn"
        >
          <div className="rounded-full p-[2px]" style={{ border: "2px solid rgb(var(--lz-brand-rgb))" }}>
            <Avatar profile={me} size={26} />
          </div>
          <span className="hidden md:inline text-xs text-foreground/70">{me.name}</span>
        </button>
      )}
    </header>
  );
}