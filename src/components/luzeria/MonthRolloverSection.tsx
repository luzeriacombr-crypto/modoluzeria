import { useState } from "react";
import { toast } from "sonner";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { CalendarSync } from "lucide-react";
import { useApi, useMe } from "@/lib/luzeria/queries";

/**
 * Virada de mês automática — o sistema cria o mês seguinte de cada cliente
 * no dia escolhido, copiando só a quantidade de itens por tipo (mesma
 * regra do botão "Duplicar mês"), ou apenas avisa quem ainda está sem.
 */
export function MonthRolloverSection() {
  const me = useMe().data;
  const isMaster = me?.role === "master";
  const { updateMyOrg } = useApi();

  const [ligado, setLigado] = useState(me?.monthRolloverDay != null);
  const [dia, setDia] = useState(String(me?.monthRolloverDay ?? 25));
  const [modo, setModo] = useState<"criar" | "avisar">(me?.monthRolloverMode ?? "criar");

  function salvar(proximo: { ligado?: boolean; dia?: string; modo?: "criar" | "avisar" }) {
    const ligadoFinal = proximo.ligado ?? ligado;
    const diaFinal = Number(proximo.dia ?? dia);
    const modoFinal = proximo.modo ?? modo;
    updateMyOrg.mutate({
      data: {
        monthRolloverDay: ligadoFinal ? Math.min(28, Math.max(1, diaFinal || 25)) : null,
        monthRolloverMode: modoFinal,
      },
    }, {
      onSuccess: () => toast.success("Virada de mês salva."),
      onError: (e: any) => toastFriendlyError(e, "Erro ao salvar"),
    });
  }

  return (
    <div>
      <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-1.5 flex items-center gap-1.5">
        <CalendarSync size={12} /> Virada de mês
      </h2>
      <p className="text-[11px] text-foreground/40 mb-3 leading-relaxed">
        Todo mês alguém precisa lembrar de duplicar o mês de cada cliente. Aqui o sistema faz isso sozinho no dia que você escolher.
      </p>
      <div className="bg-card rounded-lg px-5 py-4 space-y-3">
        <label className="flex items-center gap-2 text-sm text-foreground/80">
          <input
            type="checkbox"
            checked={ligado}
            disabled={!isMaster}
            onChange={(e) => { setLigado(e.target.checked); salvar({ ligado: e.target.checked }); }}
          />
          Ligar a virada automática
        </label>

        {ligado && (
          <>
            <label className="block">
              <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/50">Dia do mês</span>
              <input
                type="number" min={1} max={28} value={dia} disabled={!isMaster}
                onChange={(e) => setDia(e.target.value)}
                onBlur={() => salvar({})}
                className="lz-input mt-1.5 max-w-[110px]"
              />
              <span className="text-[10px] text-foreground/35 mt-1 block">
                De 1 a 28 — dia 29, 30 e 31 não existem em todo mês, e uma virada que pula fevereiro é pior que nenhuma.
              </span>
            </label>

            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-foreground/50">No dia, o sistema</span>
              <div className="flex flex-col gap-2 mt-1.5">
                {([
                  { valor: "criar", titulo: "Cria o mês seguinte", detalhe: "Copia só a quantidade de itens por tipo do mês atual — sem título, responsável, prazo ou arquivo." },
                  { valor: "avisar", titulo: "Só me avisa", detalhe: "Não cria nada; manda uma notificação com quantos clientes ainda estão sem o mês." },
                ] as const).map((op) => (
                  <label key={op.valor} className="flex items-start gap-2 text-sm text-foreground/80">
                    <input
                      type="radio" name="modo-virada" checked={modo === op.valor} disabled={!isMaster}
                      onChange={() => { setModo(op.valor); salvar({ modo: op.valor }); }}
                      className="mt-0.5"
                    />
                    <span>
                      {op.titulo}
                      <span className="block text-[10.5px] text-foreground/35 leading-relaxed">{op.detalhe}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <p className="text-[10.5px] text-foreground/35 leading-relaxed pt-1 border-t border-foreground/6">
              Vale pros clientes ativos fora de "Avulsos" e "Ex-clientes". Cliente que já tiver o mês criado é pulado, então rodar duas vezes não duplica nada.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
