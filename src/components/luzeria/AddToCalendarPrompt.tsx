import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CalendarPlus } from "lucide-react";
import { Modal } from "./Modals";
import { myCalendarConnectionQO, useApi } from "@/lib/luzeria/queries";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";

export type CalendarPromptDefaults = { title: string; date: string; location?: string; notes?: string };

const DURATIONS = [
  { v: 30, l: "30 min" }, { v: 60, l: "1 hora" }, { v: 120, l: "2 horas" }, { v: 180, l: "3 horas" }, { v: 240, l: "4 horas" },
];

/** "Quer colocar no Google Agenda?" — aparece logo depois de registrar uma gravação com data
 * (ideia de um cliente, 03/10). O evento vai pra Google Agenda de quem registrou. */
export function AddToCalendarPrompt({ defaults, onClose }: { defaults: CalendarPromptDefaults | null; onClose: () => void }) {
  const { data: conn, isLoading } = useQuery({ ...myCalendarConnectionQO(), enabled: !!defaults });
  const { createCalendarEvent } = useApi();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(120);
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (!defaults) return;
    setTitle(defaults.title); setLocation(defaults.location ?? ""); setTime("09:00"); setDuration(120); setAllDay(false);
  }, [defaults]);

  if (!defaults) return null;
  const input = "w-full bg-background border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";
  const label = "block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5";
  const dateLabel = new Date(defaults.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  function submit() {
    if (!defaults) return;
    createCalendarEvent.mutate(
      {
        data: {
          title: title.trim() || defaults.title, date: defaults.date, time, durationMinutes: duration, allDay,
          location: location.trim() || undefined, description: defaults.notes?.trim() || undefined,
        },
      },
      {
        onSuccess: () => { toast.success("Colocado na sua Google Agenda."); onClose(); },
        onError: (e: any) => toastFriendlyError(e, "Não consegui colocar na Google Agenda"),
      },
    );
  }

  return (
    <Modal open onClose={onClose} title="Quer colocar no Google Agenda?" maxWidthClass="max-w-md">
      {isLoading ? (
        <div className="text-sm text-foreground/50 py-6 text-center">Verificando sua Google Agenda…</div>
      ) : !conn?.connected ? (
        <div className="space-y-4">
          <p className="text-sm text-foreground/70 leading-relaxed">
            Pra colocar a gravação na sua agenda, conecte a Google Agenda uma vez em <b>Meu perfil</b>. Depois disso, toda gravação que você registrar vai poder ir pra lá com um clique.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Agora não</button>
            <button onClick={() => { onClose(); navigate({ to: "/perfil" }); }} className="lz-btn-primary text-xs px-4 py-2 rounded-md">Conectar Google Agenda</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3.5">
          <div className="rounded-lg px-3 py-2.5 text-[13px] text-foreground/80 flex items-center gap-2" style={{ background: "rgba(var(--lz-brand-light-rgb),0.1)" }}>
            <CalendarPlus size={14} style={{ color: "var(--lz-accent-ink)" }} className="shrink-0" />
            <span className="capitalize">{dateLabel}</span>
          </div>
          <div>
            <label className={label} htmlFor="cal-title">Título do compromisso</label>
            <input id="cal-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={input} />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-foreground/75 cursor-pointer">
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> Dia inteiro
          </label>
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="cal-time">Horário de início</label>
                <input id="cal-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
              </div>
              <div>
                <label className={label} htmlFor="cal-dur">Duração</label>
                <select id="cal-dur" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={input}>
                  {DURATIONS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
                </select>
              </div>
            </div>
          )}
          <div>
            <label className={label} htmlFor="cal-loc">Local (opcional)</label>
            <input id="cal-loc" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={300} className={input} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Agora não</button>
            <button onClick={submit} disabled={createCalendarEvent.isPending} className="lz-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-50">
              {createCalendarEvent.isPending ? "Colocando…" : "Colocar na Google Agenda"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
