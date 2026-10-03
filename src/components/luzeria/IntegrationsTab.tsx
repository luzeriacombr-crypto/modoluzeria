import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Instagram, FolderTree, CalendarClock, Bot, Sparkles, ChevronDown, Check, Music2 } from "lucide-react";
import { instagramConnectionSummaryQO, tiktokConnectionSummaryQO } from "@/lib/luzeria/queries";
import { InstagramSection } from "./ClientFichaPanel";
import { TikTokConnectSection } from "./TikTokSections";
import { DriveSettingsTab } from "./DriveSettingsTab";
import { GoogleCalendarSection } from "./ProfilePage";
import { McpSection } from "./McpSection";
import { AiConnectionSection } from "./AiConnectionSection";

type SummaryClient = { id: string; name: string; color: string; connected: boolean };

/** Card de uma rede (Instagram / TikTok): barra de progresso + lista de
 * clientes que abre e fecha. Cada cliente expande ali mesmo o mesmo bloco de
 * conexão da Ficha (conectar, desconectar, link pro cliente conectar), pra
 * dar pra conectar todo mundo sem abrir ficha por ficha. */
function ConnectionSummaryCard({ network, icon, data, isLoading, renderConnect }: {
  network: string;
  icon: ReactNode;
  data: { total: number; connected: number; clients: SummaryClient[] } | undefined;
  isLoading: boolean;
  renderConnect: (clientId: string) => ReactNode;
}) {
  const [listOpen, setListOpen] = useState(false);
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  const pct = data && data.total > 0 ? Math.round((data.connected / data.total) * 100) : 0;
  // Quem falta conectar vem primeiro.
  const clients = data ? [...data.clients].sort((a, b) => Number(a.connected) - Number(b.connected)) : [];
  const missing = data ? data.total - data.connected : 0;

  return (
    <section className="bg-card rounded-lg p-6 border border-foreground/6">
      <div className="flex items-center gap-2 text-foreground/60 text-[11px] uppercase tracking-wider font-bold mb-4">
        {icon} {network} dos clientes
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
          <p className="text-xs text-foreground/50">
            <span className="text-foreground font-semibold">{data.connected}</span> de {data.total} clientes com {network} conectado.
          </p>
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            className="mt-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider transition hover:opacity-80"
            style={{ color: "var(--lz-accent-ink)" }}
          >
            <ChevronDown size={14} className={`transition-transform ${listOpen ? "rotate-180" : ""}`} />
            {listOpen ? "Esconder clientes" : `Ver clientes${missing > 0 ? ` (${missing} sem conectar)` : ""}`}
          </button>
          {listOpen && (
            <div className="space-y-1.5 mt-3">
              {clients.map((c) => {
                const open = openClientId === c.id;
                return (
                  <div key={c.id} className="rounded-md bg-foreground/[0.03]">
                    <button
                      type="button"
                      onClick={() => setOpenClientId(open ? null : c.id)}
                      aria-expanded={open}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-foreground/[0.06] text-left transition"
                    >
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="text-xs text-foreground/80 flex-1 truncate">{c.name}</span>
                      {c.connected ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/45 flex items-center gap-1"><Check size={11} /> Conectado</span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--lz-accent-ink)" }}>Conectar</span>
                      )}
                      <ChevronDown size={13} className={`text-foreground/40 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open && <div className="px-3 pb-3 pt-1">{renderConnect(c.id)}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function InstagramSummaryCard() {
  const { data, isLoading } = useQuery(instagramConnectionSummaryQO());
  return (
    <ConnectionSummaryCard network="Instagram" icon={<Instagram size={12} />} data={data} isLoading={isLoading}
      renderConnect={(id) => <InstagramSection clientId={id} />} />
  );
}

function TikTokSummaryCard() {
  const { data, isLoading } = useQuery(tiktokConnectionSummaryQO());
  return (
    <ConnectionSummaryCard network="TikTok" icon={<Music2 size={12} />} data={data} isLoading={isLoading}
      renderConnect={(id) => <TikTokConnectSection clientId={id} />} />
  );
}

export function IntegrationsTab({ disabledFeatures }: { disabledFeatures: string[] }) {
  return (
    <div className="space-y-10">
      <div data-tour="ai-connection">
        <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
          <Sparkles size={12} /> Inteligência artificial
        </h2>
        <AiConnectionSection />
      </div>
      {!disabledFeatures.includes("drive") && (
        <div>
          <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
            <FolderTree size={12} /> Google Drive
          </h2>
          <DriveSettingsTab />
        </div>
      )}
      {!disabledFeatures.includes("google_calendar") && (
        <div className="pt-2 border-t border-foreground/10">
          <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
            <CalendarClock size={12} /> Google Agenda
          </h2>
          <div className="bg-card rounded-lg p-6">
            <GoogleCalendarSection />
          </div>
        </div>
      )}
      <div className={disabledFeatures.includes("drive") && disabledFeatures.includes("google_calendar") ? "" : "pt-2 border-t border-foreground/10"}>
        <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
          <Instagram size={12} /> Instagram
        </h2>
        <InstagramSummaryCard />
      </div>
      <div className="pt-2 border-t border-foreground/10">
        <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
          <Music2 size={12} /> TikTok
        </h2>
        <TikTokSummaryCard />
      </div>
      <div className="pt-2 border-t border-foreground/10">
        <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-3 flex items-center gap-1.5">
          <Bot size={12} /> Conectar IA (MCP)
        </h2>
        <McpSection />
      </div>
    </div>
  );
}
