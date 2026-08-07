import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, Palette, HardDrive, Users, X } from "lucide-react";
import { setupChecklistQO, useMe } from "@/lib/luzeria/queries";
import { ImportClientsStep } from "./ImportClientsStep";

export function SetupChecklist() {
  const me = useMe().data;
  const qc = useQueryClient();
  const { data: status, isLoading } = useQuery(setupChecklistQO());
  const [showImport, setShowImport] = useState(false);

  if (me?.role !== "master" || isLoading || !status) return null;
  const allDone = status.brandingDone && status.driveConnected && status.hasClients;
  if (allDone) return null;

  function closeImport() {
    setShowImport(false);
    qc.invalidateQueries({ queryKey: ["setup-checklist"] });
  }

  const steps = [
    {
      done: status.brandingDone,
      icon: <Palette size={16} />,
      title: "Personalize a plataforma",
      desc: "Coloque a logo e as cores da sua agência.",
      action: (
        <Link to="/configuracoes" search={{ tab: "general" }}
          className="text-xs font-bold px-3 py-1.5 rounded-md whitespace-nowrap transition"
          style={{ background: "rgba(var(--lz-brand-light-rgb),0.15)", color: "rgb(var(--lz-brand-rgb))" }}>
          Personalizar →
        </Link>
      ),
    },
    {
      done: status.driveConnected,
      icon: <HardDrive size={16} />,
      title: "Conecte seu Google Drive",
      desc: "Seus conteúdos vão direto pro seu arquivo — evita precisar fazer backup.",
      action: (
        <Link to="/configuracoes" search={{ tab: "automations" }}
          className="text-xs font-bold px-3 py-1.5 rounded-md whitespace-nowrap transition"
          style={{ background: "rgba(var(--lz-brand-light-rgb),0.15)", color: "rgb(var(--lz-brand-rgb))" }}>
          Conectar →
        </Link>
      ),
    },
    {
      done: status.hasClients,
      icon: <Users size={16} />,
      title: "Traga seus clientes do Trello ou ClickUp",
      desc: "Importa de lá pra não digitar tudo de novo.",
      action: (
        <button onClick={() => setShowImport(true)}
          className="text-xs font-bold px-3 py-1.5 rounded-md whitespace-nowrap transition"
          style={{ background: "rgba(var(--lz-brand-light-rgb),0.15)", color: "rgb(var(--lz-brand-rgb))" }}>
          Importar →
        </button>
      ),
    },
  ];

  return (
    <>
      <div data-tour="setup-checklist" className="rounded-2xl mb-6 p-5 md:p-6"
        style={{ background: "#161616", border: "1px solid rgba(var(--lz-brand-light-rgb),0.18)" }}>
        <div className="text-[10px] uppercase font-bold tracking-wider mb-3" style={{ color: "rgb(var(--lz-brand-rgb))" }}>
          Primeiros passos
        </div>
        <div className="space-y-3">
          {steps.map((s) => (
            <div key={s.title} className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-4 py-3">
              {s.done ? <CheckCircle2 size={18} style={{ color: "rgb(var(--lz-brand-rgb))" }} className="shrink-0" /> : <Circle size={18} className="text-white/25 shrink-0" />}
              <div className="shrink-0" style={{ color: s.done ? "rgba(255,255,255,0.3)" : "rgb(var(--lz-brand-rgb))" }}>{s.icon}</div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${s.done ? "text-white/40 line-through" : "text-white"}`}>{s.title}</div>
                <div className="text-white/40 text-xs mt-0.5">{s.desc}</div>
              </div>
              {!s.done && s.action}
            </div>
          ))}
        </div>
      </div>

      {showImport && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4" onClick={closeImport}>
          <div className="w-full max-w-md bg-[#1A1A1A] rounded-2xl p-7"
            style={{ border: "1px solid rgba(var(--lz-brand-light-rgb),0.18)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-white text-lg font-bold">Traga seus clientes</h2>
              <button onClick={closeImport} className="text-white/40 hover:text-white transition"><X size={18} /></button>
            </div>
            <ImportClientsStep onDone={closeImport} onSkip={closeImport} />
          </div>
        </div>
      )}
    </>
  );
}
