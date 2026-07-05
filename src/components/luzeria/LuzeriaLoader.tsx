import luzeriaLogo from "@/assets/luzeria-logo-login.png";

export function LuzeriaLoader({ fullScreen = true }: { fullScreen?: boolean }) {
  return (
    <div
      className={fullScreen ? "fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6" : "flex flex-col items-center justify-center w-full h-full min-h-40 gap-6"}
      style={{ background: "#0D0D0D" }}
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

      <img src={luzeriaLogo} alt="Luzeria" className="lz-logo" style={{ height: 32, width: "auto", objectFit: "contain" }} />

      <div style={{ width: 128, height: 2, borderRadius: 9999, overflow: "hidden", background: "rgba(200,212,78,0.15)" }}>
        <div className="lz-bar" style={{ height: "100%", borderRadius: 9999, background: "#C8D44E" }} />
      </div>
    </div>
  );
}
