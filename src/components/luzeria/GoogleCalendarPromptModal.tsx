import { CalendarClock, X } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/luzeria/queries";
import { withOAuthState } from "@/lib/luzeria/google-calendar-connect";

export function GoogleCalendarPromptModal({ onClose }: { onClose: () => void }) {
  const { getGoogleCalendarAuthUrl } = useApi();

  async function connect() {
    try {
      const { url } = await getGoogleCalendarAuthUrl.mutateAsync({} as any);
      window.location.href = withOAuthState(url);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao iniciar conexão com o Google.");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="w-full max-w-sm bg-[#1C1C1C] border border-white/10 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="h-10 w-10 rounded-md flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(200,212,78,0.15)", color: "#C8D44E" }}>
            <CalendarClock size={18} />
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X size={16} /></button>
        </div>
        <h3 className="text-base font-semibold text-white">
          Que tal integrar o Modo Luzeria com o seu Google Agenda?
        </h3>
        <p className="text-[13px] text-white/50 mt-2 leading-relaxed">
          Conecte sua conta e veja os compromissos de hoje direto aqui em Minhas Tarefas — gravações, reuniões, tudo num só lugar.
        </p>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/5">
            Agora não
          </button>
          <button onClick={connect} disabled={getGoogleCalendarAuthUrl.isPending}
            className="flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold bg-[#C8D44E] text-black disabled:opacity-40">
            {getGoogleCalendarAuthUrl.isPending ? "Abrindo…" : "Conectar"}
          </button>
        </div>
      </div>
    </div>
  );
}
