import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Power } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { getWhatsappAutoSettings, setWhatsappAutoSetting } from "@/lib/luzeria/whatsapp.functions";

type Which = "welcome" | "support" | "activation";

const ITEMS: { which: Which; title: string; text: string; example?: string }[] = [
  {
    which: "welcome",
    title: "Boas-vindas no WhatsApp",
    text: "Toda agência que se cadastrar recebe uma mensagem no WhatsApp que informou, na hora do cadastro.",
    example: "Oi Maria, a conta da Agência Luz no Modo Criador foi criada com sucesso! Para acessar, entre em modocriador.com.br com o e-mail que você cadastrou…",
  },
  {
    which: "activation",
    title: "Mensagens de ativação (48h depois do cadastro)",
    text: "Quem se cadastrou há 2 a 14 dias e ainda está sem clientes, com poucos clientes ou sem equipe recebe, uma vez, a mensagem certa com os botões Já fiz / Preciso de ajuda / Agora não. Sai todo dia às 9h. Depende dos modelos novos estarem aprovados na Meta.",
  },
  {
    which: "support",
    title: "Alertas de suporte no seu WhatsApp",
    text: "Quando alguém pede ajuda, chega um alerta no seu WhatsApp. Você responde arrastando a mensagem, e a resposta vai pro chat do app e pro WhatsApp da agência.",
  },
];

/** Botões grandes de liga/desliga das mensagens automáticas do WhatsApp —
 * ficam no topo da seção Mensagens (antes ficavam escondidos dentro do bloco
 * de campanhas, que só aparece depois de buscar agências). */
export function WhatsappAutoSwitches() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["whatsapp-auto-settings"], queryFn: () => getWhatsappAutoSettings() });
  const toggle = useMutation({
    mutationFn: useServerFn(setWhatsappAutoSetting),
    onSuccess: (r: any) => {
      qc.setQueryData(["whatsapp-auto-settings"], (old: any) => ({ ...(old ?? {}), [r.which]: r.enabled }));
      toast.success(r.enabled ? "Ligado." : "Desligado.");
    },
    onError: (e: any) => toastFriendlyError(e, "Não consegui mudar isso agora."),
  });

  return (
    <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: "#25D36655" }}>
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#25D366" }}>WhatsApp automático — o que sai sozinho</p>
      {ITEMS.map((item) => {
        const on = data ? !!data[item.which] : null;
        const pending = toggle.isPending && toggle.variables?.data?.which === item.which;
        return (
          <div key={item.which} className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                {item.title}
                <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded" style={on ? { backgroundColor: "#25D366", color: "#fff" } : { backgroundColor: "rgba(128,128,128,0.2)" }}>
                  {on === null ? "…" : on ? "LIGADO" : "DESLIGADO"}
                </span>
              </p>
              <p className="text-[12px] text-foreground/60 mt-0.5">{item.text}</p>
              {item.example && <p className="text-[11px] text-foreground/40 mt-1 italic">Ex.: “{item.example}”</p>}
            </div>
            <button
              onClick={() => toggle.mutate({ data: { which: item.which, enabled: !on } })}
              disabled={on === null || toggle.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-40 shrink-0"
              style={on ? { border: "2px solid #E5484D", color: "#E5484D" } : { backgroundColor: "#25D366", color: "#fff" }}
            >
              {pending ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
              {on ? "Desligar" : item.which === "welcome" ? "Ativar boas-vindas" : item.which === "activation" ? "Ativar mensagens de ativação" : "Ativar alertas"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
