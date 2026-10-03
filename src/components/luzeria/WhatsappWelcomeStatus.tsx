import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { getWhatsappWelcomeStatuses, resendWhatsappWelcome } from "@/lib/luzeria/whatsapp.functions";

const LABEL: Record<string, { text: string; color: string; hint: string }> = {
  read: { text: "WhatsApp: lida", color: "#25D366", hint: "A boas-vindas foi entregue e a pessoa abriu." },
  delivered: { text: "WhatsApp: entregue", color: "#25D366", hint: "A boas-vindas chegou no celular da pessoa." },
  sent: { text: "WhatsApp: enviada", color: "#E0A800", hint: "Enviada, ainda sem confirmação de entrega (celular desligado ou sem internet)." },
  failed: { text: "WhatsApp: falhou", color: "#E5484D", hint: "Não conseguiu entregar." },
  none: { text: "WhatsApp: não enviada", color: "#E5484D", hint: "Essa agência se cadastrou depois que a boas-vindas foi ligada e não recebeu." },
};

/** Erros da Meta em português claro (o texto original fica de fora, só no log). */
function friendlyError(error: string | null): string | null {
  if (!error) return null;
  if (/undeliverable|131026/i.test(error)) return "O número não recebeu: pode não ter WhatsApp ou estar digitado errado.";
  if (/131047|re-engagement/i.test(error)) return "Passou da janela de 24h pra texto livre.";
  if (/opt|131050/i.test(error)) return "A pessoa pediu pra não receber mensagens.";
  if (/does not exist|132001/i.test(error)) return "O modelo da mensagem ainda não está aprovado na Meta.";
  if (/not registered|133010/i.test(error)) return "O número do Modo Criador ainda não estava registrado.";
  return error;
}

/** Estado da boas-vindas no WhatsApp de uma agência (compartilha a mesma
 * consulta entre todas as linhas da lista). Só aparece pra quem se cadastrou
 * depois que a boas-vindas foi ligada ou que já tem tentativa registrada. */
export function useWelcomeStatuses() {
  return useQuery({ queryKey: ["whatsapp-welcome-statuses"], queryFn: () => getWhatsappWelcomeStatuses(), staleTime: 30_000 });
}

export function welcomeInfo(data: Awaited<ReturnType<typeof getWhatsappWelcomeStatuses>> | undefined, orgId: string, createdAt: string | null) {
  if (!data) return null;
  const rec = data.byOrg[orgId];
  if (rec) return { key: rec.status, error: rec.error, at: rec.at };
  if (createdAt && createdAt >= data.since) return { key: "none", error: null, at: null };
  return null;
}

export function WelcomeBadge({ orgId, createdAt }: { orgId: string; createdAt: string | null }) {
  const { data } = useWelcomeStatuses();
  const info = welcomeInfo(data, orgId, createdAt);
  if (!info) return null;
  const l = LABEL[info.key] ?? LABEL.sent;
  return (
    <span
      title={`${l.hint}${info.error ? ` ${friendlyError(info.error)}` : ""}`}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0"
      style={{ backgroundColor: `${l.color}22`, color: l.color }}
    >
      {info.key === "read" ? "✓✓" : info.key === "delivered" ? "✓✓" : info.key === "sent" ? "✓" : "✕"} {l.text}
    </span>
  );
}

/** Bloco da ficha da agência: estado da boas-vindas + reenviar. */
export function WelcomeStatusBlock({ orgId, createdAt }: { orgId: string; createdAt: string | null }) {
  const qc = useQueryClient();
  const { data } = useWelcomeStatuses();
  const info = welcomeInfo(data, orgId, createdAt);
  const resend = useMutation({
    mutationFn: useServerFn(resendWhatsappWelcome),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["whatsapp-welcome-statuses"] }); toast.success("Boas-vindas reenviada no WhatsApp."); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui reenviar a boas-vindas."),
  });
  const l = info ? LABEL[info.key] ?? LABEL.sent : null;
  return (
    <div>
      <p className="text-[11px] font-bold uppercase text-foreground/40 tracking-wider mb-0.5">Boas-vindas no WhatsApp</p>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        {l && info ? (
          <>
            <span className="font-semibold" style={{ color: l.color }}>{l.text.replace("WhatsApp: ", "")}</span>
            {info.at && <span className="text-foreground/40 text-[11px]">{new Date(info.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
            {info.error && <span className="text-[11px] text-red-500">{friendlyError(info.error)}</span>}
          </>
        ) : (
          <span className="text-foreground/40">Sem registro (cadastro anterior à boas-vindas automática).</span>
        )}
        {(!info || info.key === "failed" || info.key === "none" || info.key === "sent") && (
          <button
            onClick={() => resend.mutate({ data: { orgId } })}
            disabled={resend.isPending}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-bold disabled:opacity-50"
            style={{ backgroundColor: "#25D366", color: "#fff" }}
          >
            {resend.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Reenviar boas-vindas
          </button>
        )}
      </div>
    </div>
  );
}
