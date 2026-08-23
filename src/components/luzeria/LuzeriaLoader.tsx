import { ModoCriadorLogo } from "@/components/ModoCriadorLogo";
import { hexToRgbChannels } from "@/lib/luzeria/utils";
import { useTheme } from "@/lib/luzeria/theme-store";

/** Reads the org logo + brand colors cached by App.tsx on a previous
 * successful load — this component renders before the profile fetch
 * resolves (before --lz-brand-rgb is set), so it has no other way to know
 * which org is logged in yet. */
function readCachedBranding(): { logoUrl: string | null; logoUrlLight: string | null; name: string | null; colorPrimary: string | null; colorPrimaryLight: string | null } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("lz_org_branding");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function LuzeriaLoader({ fullScreen = true }: { fullScreen?: boolean }) {
  const cached = readCachedBranding();
  const { theme } = useTheme();
  const logoUrl = (theme === "light" && cached?.logoUrlLight) || cached?.logoUrl || null;
  const barRgb = cached?.colorPrimary ? hexToRgbChannels(cached.colorPrimary) : null;
  const trackRgb = cached?.colorPrimaryLight ? hexToRgbChannels(cached.colorPrimaryLight) : barRgb;
  return (
    <div
      className={fullScreen ? "fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6" : "flex flex-col items-center justify-center w-full h-full min-h-40 gap-6"}
      style={{ background: "var(--background)" }}
    >
      <style>{`
        @keyframes lz-bar {
          0% { width: 0%; }
          60% { width: 80%; }
          100% { width: 95%; }
        }
        @keyframes lz-fade {
          0% { opacity: 0; } 100% { opacity: 1; }
        }
        .lz-bar { animation: lz-bar 2s ease-out both; }
        .lz-logo { animation: lz-fade 0.4s ease-out both; }
      `}</style>

      {logoUrl ? (
        <img
          src={logoUrl}
          alt={cached?.name ?? "Logo"}
          className="lz-logo"
          style={{ height: 32, maxWidth: 200, width: "auto", objectFit: "contain" }}
        />
      ) : (
        <ModoCriadorLogo variant={theme === "light" ? "black" : "white"} className="lz-logo" style={{ height: 32, width: "auto" }} />
      )}

      <div style={{ width: 128, height: 2, borderRadius: 9999, overflow: "hidden", background: trackRgb ? `rgba(${trackRgb},0.15)` : "rgba(var(--lz-brand-light-rgb),0.15)" }}>
        <div className="lz-bar" style={{ height: "100%", borderRadius: 9999, background: barRgb ? `rgb(${barRgb})` : "rgb(var(--lz-brand-rgb))" }} />
      </div>
    </div>
  );
}
