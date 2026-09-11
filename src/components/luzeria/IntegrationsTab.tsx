import { useQuery } from "@tanstack/react-query";
import { Instagram, FolderTree } from "lucide-react";
import { instagramConnectionSummaryQO } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { DriveSettingsTab } from "./DriveSettingsTab";

function InstagramSummaryCard() {
  const { data, isLoading } = useQuery(instagramConnectionSummaryQO());
  const { openFicha } = useUI();
  const pct = data && data.total > 0 ? Math.round((data.connected / data.total) * 100) : 0;

  return (
    <section className="bg-card rounded-lg p-6 border border-foreground/6">
      <div className="flex items-center gap-2 text-foreground/60 text-[11px] uppercase tracking-wider font-bold mb-4">
        <Instagram size={12} /> Instagram dos clientes
      </div>
      {isLoading ? (
        <div className="text-foreground/40 text-sm">Verificando…</div>
      ) : !data || data.total === 0 ? (
        <p className="text-xs text-foreground/40">Nenhum cliente ativo ainda.</p>
      ) : (
        <>
          <div className="h-1.5 rounded-full bg-foreground/8 overflow-hidden mb-2">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: "rgb(var(--lz-brand-rgb))" }} />
          </div>
          <p className="text-xs text-foreground/50 mb-4">
            <span className="text-foreground font-semibold">{data.connected}</span> de {data.total} clientes com Instagram conectado.
          </p>
          {data.clientsMissing.length > 0 && (
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-foreground/40 mb-2">Ainda faltam</div>
              <div className="space-y-1.5">
                {data.clientsMissing.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openFicha(c.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md bg-foreground/[0.03] hover:bg-foreground/[0.06] text-left transition"
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="text-xs text-foreground/80 flex-1 truncate">{c.name}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--lz-accent-ink)" }}>Conectar →</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function IntegrationsTab({ disabledFeatures }: { disabledFeatures: string[] }) {
  return (
    <div className="space-y-10">
      {!disabledFeatures.includes("drive") && (
        <div>
          <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
            <FolderTree size={12} /> Google Drive
          </h2>
          <DriveSettingsTab />
        </div>
      )}
      <div className={disabledFeatures.includes("drive") ? "" : "pt-2 border-t border-foreground/10"}>
        <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
          <Instagram size={12} /> Instagram
        </h2>
        <InstagramSummaryCard />
      </div>
    </div>
  );
}
