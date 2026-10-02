import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, User } from "lucide-react";
import { toast } from "sonner";

/** Perfil & Briefing do cliente (nicho, concorrentes, briefing, observações, roteiros recentes) — bloco recolhível da Ficha. A House esconde nicho/concorrentes/briefing porque já edita isso em "Briefing da marca". */
export function ClientProfileBriefing({ client, canEdit, hideBriefing, onSave }: {
  client: any; canEdit: boolean; hideBriefing?: boolean; onSave: (patch: Record<string, any>) => void;
}) {
  const [open, setOpen] = useState(true);
  const [niche, setNiche] = useState<string>(client.customFields.niche ?? "");
  const [notes, setNotes] = useState<string>(client.customFields.notes ?? "");
  const [competitors, setCompetitors] = useState<string>(client.customFields.competitors ?? "");
  const [contentBriefing, setContentBriefing] = useState<string>(client.customFields.contentBriefing ?? "");
  const [recentRoteiros, setRecentRoteiros] = useState<string>(client.customFields.recentRoteiros ?? "");

  useEffect(() => {
    setNiche(client.customFields.niche ?? "");
    setNotes(client.customFields.notes ?? "");
    setCompetitors(client.customFields.competitors ?? "");
    setContentBriefing(client.customFields.contentBriefing ?? "");
    setRecentRoteiros(client.customFields.recentRoteiros ?? "");
  }, [client.id]);

  function save() {
    onSave({
      ...(hideBriefing ? {} : { niche, competitors, content_briefing: contentBriefing }),
      notes, recent_roteiros: recentRoteiros,
    });
    toast.success("Perfil salvo.");
  }

  const inp = "w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition-colors disabled:opacity-60 resize-none";

  return (
    <div className="rounded-xl p-5 mb-5" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2.5 text-left">
        <User size={16} className="shrink-0" style={{ color: "var(--lz-accent-ink)" }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">Perfil & Briefing</div>
          <div className="text-[11px] text-foreground/45">Nicho, concorrentes e tom de voz — é o que a IA de planejamento lê pra esse cliente.</div>
        </div>
        {open ? <ChevronDown size={14} className="text-foreground/40 shrink-0" /> : <ChevronRight size={14} className="text-foreground/40 shrink-0" />}
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {!hideBriefing && (
            <label className="block">
              <span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Nicho</span>
              <input value={niche} disabled={!canEdit} onChange={(e) => setNiche(e.target.value)} className={inp} />
            </label>
          )}
          <label className="block sm:col-span-2">
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Observações</span>
            <textarea value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} rows={2} className={inp} />
          </label>
          {!hideBriefing && (
            <label className="block sm:col-span-2">
              <span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Concorrentes</span>
              <textarea
                value={competitors} disabled={!canEdit} onChange={(e) => setCompetitors(e.target.value)}
                placeholder="Um por linha, ex: @perfil_concorrente ou nome da empresa"
                rows={2} className={inp}
              />
            </label>
          )}
          {!hideBriefing && (
            <label className="block sm:col-span-2">
              <span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Briefing / sistema de conteúdo</span>
              <textarea
                value={contentBriefing} disabled={!canEdit} onChange={(e) => setContentBriefing(e.target.value)}
                placeholder="Cole aqui o briefing/manual de como criar conteúdo pra esse cliente — alimenta a prévia de planejamento por IA."
                rows={4} className={inp}
              />
            </label>
          )}
          <label className="block sm:col-span-2">
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Roteiros recentes</span>
            <textarea
              value={recentRoteiros} disabled={!canEdit} onChange={(e) => setRecentRoteiros(e.target.value)}
              placeholder="Cole os últimos roteiros já escritos pra esse cliente — ajuda a IA a aprender o padrão e o tom já usado."
              rows={4} className={inp}
            />
          </label>
          {canEdit && (
            <div className="sm:col-span-2">
              <button onClick={save} className="rounded-md px-4 py-2 text-xs font-bold transition-opacity hover:opacity-90"
                style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>Salvar perfil</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

