import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Save } from "lucide-react";
import { cleaningQO, profilesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { AssigneePicker, colorForLabel } from "./AssigneePicker";
import { Avatar } from "./Avatar";
import { toast } from "sonner";

export const CLEANING_TASKS = [
  "Varrer e passar pano no chão (tudo)",
  "Varrer calçada",
  "Limpar espelhos",
  "Limpar teto e paredes",
  "Limpar/organizar cozinha",
  "Lavar banheiro",
  "Recolher lixo",
  "Limpar os móveis (Hall, administrativo, escritório e sala de produção)",
  "Limpar estúdio e organizar equipamentos",
  "Lavar e trocar panos/toalhas/tapetes",
];
export const CLEANING_DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function CleaningView() {
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const { data } = useQuery(cleaningQO());
  const { data: profiles = [] } = useQuery(profilesQO());
  const { upsertCleaningCell, updateCleaningNote } = useApi();
  const [picker, setPicker] = useState<{ rect: DOMRect; taskIdx: number; weekday: number } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteDirty, setNoteDirty] = useState(false);

  useEffect(() => { if (data && !noteDirty) setNoteDraft(data.note); }, [data, noteDirty]);

  const cellMap = useMemo(() => {
    const m = new Map<string, { userId: string | null; label: string | null }>();
    (data?.cells ?? []).forEach((c) => m.set(`${c.taskIdx}-${c.weekday}`, { userId: c.userId, label: c.label }));
    return m;
  }, [data]);

  function info(entry?: { userId: string | null; label: string | null }) {
    if (!entry) return null;
    if (entry.userId) {
      const p = profiles.find((x) => x.id === entry.userId);
      if (p) return { name: p.name, color: p.color, profile: p };
    }
    if (entry.label) return { name: entry.label, color: colorForLabel(entry.label), profile: null };
    return null;
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-wider mb-2">
            <Sparkles size={13} /> <span>Escala</span>
          </div>
          <h1 className="text-[32px] font-bold text-white leading-none tracking-tight">Limpeza</h1>
          <p className="text-sm text-white/50 mt-2">Tabela semanal fixa de tarefas do estúdio.</p>
        </div>
      </div>

      <div className="bg-[#1C1C1C] rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[10px] uppercase font-bold tracking-wider text-white/40 px-4 py-3 w-[280px]">Tarefa</th>
                {CLEANING_DAYS.map((d) => (
                  <th key={d} className="text-left text-[10px] uppercase font-bold tracking-wider text-white/40 px-3 py-3">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CLEANING_TASKS.map((task, ti) => (
                <tr key={ti} className="border-b border-white/[0.04] last:border-b-0">
                  <td className="px-4 py-3 text-white/90 align-top">
                    <span className="text-white/40 text-[11px] mr-2">{String(ti + 1).padStart(2, "0")}</span>
                    {task}
                  </td>
                  {CLEANING_DAYS.map((_, wi) => {
                    const entry = cellMap.get(`${ti}-${wi}`);
                    const i = info(entry);
                    const isMine = !!entry?.userId && entry.userId === me?.id;
                    return (
                      <td key={wi} className="p-1.5 align-top">
                        <button
                          disabled={!isAdmin}
                          onClick={(e) => isAdmin && setPicker({ rect: (e.currentTarget as HTMLElement).getBoundingClientRect(), taskIdx: ti, weekday: wi })}
                          className="w-full min-h-[42px] rounded-md px-2 py-1.5 flex items-center gap-1.5 transition-colors text-left"
                          style={{
                            backgroundColor: isMine ? "rgba(200,212,78,0.1)" : i ? "rgba(255,255,255,0.03)" : "transparent",
                            border: isMine ? "1px solid #C8D44E" : "1px solid rgba(255,255,255,0.05)",
                            cursor: isAdmin ? "pointer" : "default",
                          }}
                        >
                          {i ? (
                            <>
                              {i.profile
                                ? <Avatar profile={i.profile} size={20} />
                                : <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: i.color }} />}
                              <span className="text-xs font-medium truncate" style={{ color: i.color === "#FFFFFF" ? "#FFFFFF" : i.color }}>{i.name}</span>
                            </>
                          ) : (
                            <span className="text-white/20 text-xs">—</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-white/[0.06] p-5">
          <div className="text-[10px] uppercase font-bold tracking-wider text-white/40 mb-2">Nota</div>
          {isAdmin ? (
            <div className="space-y-2">
              <textarea
                value={noteDraft}
                onChange={(e) => { setNoteDraft(e.target.value); setNoteDirty(true); }}
                rows={3}
                className="w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-xs text-white/90 outline-none focus:border-[#C8D44E] resize-none"
              />
              {noteDirty && (
                <button
                  onClick={() => updateCleaningNote.mutate(
                    { data: { note: noteDraft } },
                    { onSuccess: () => { setNoteDirty(false); toast.success("Nota salva"); } },
                  )}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md"
                  style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}
                >
                  <Save size={12} /> Salvar nota
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-white/60 italic leading-relaxed">{noteDraft}</p>
          )}
        </div>
      </div>

      {picker && createPortal(
        <AssigneePicker
          anchorRect={picker.rect}
          onClose={() => setPicker(null)}
          onPick={(p) => upsertCleaningCell.mutate({ data: { taskIdx: picker.taskIdx, weekday: picker.weekday, userId: p.userId, label: p.label } })}
        />,
        document.body,
      )}
    </div>
  );
}