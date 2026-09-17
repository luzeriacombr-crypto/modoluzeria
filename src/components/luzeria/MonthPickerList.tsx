import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { monthKeysQO } from "@/lib/luzeria/queries";
import { currentMonthKey, nextMonthKey, formatMonth } from "@/lib/luzeria/utils";

/** Lista de meses pra escolher: os já existentes desse cliente + os 6
 * próximos a partir de hoje (marcando "Novo mês" quando ainda não existe).
 * Mesmo espírito do seletor de mês do MoveItemModal, mas reutilizável fora
 * do contexto de "mover item" (usado na prévia de planejamento por IA). */
export function MonthPickerList({
  clientId, onSelect, pending,
}: {
  clientId: string;
  onSelect: (key: string) => void;
  pending?: boolean;
}) {
  const { data: existingMonthKeys = [] } = useQuery(monthKeysQO(clientId));
  const start = currentMonthKey();
  const upcoming: string[] = [start];
  let k = start;
  for (let i = 0; i < 5; i++) { k = nextMonthKey(k); upcoming.push(k); }
  const monthOptions = [...new Set([...existingMonthKeys, ...upcoming])].sort();

  return (
    <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
      {monthOptions.map((key) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          disabled={pending}
          className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm text-left transition disabled:opacity-50"
          style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}
        >
          <span className="flex items-center gap-2 text-foreground"><CalendarDays size={14} className="text-foreground/40" /> {formatMonth(key)}</span>
          {!existingMonthKeys.includes(key) && (
            <span className="text-[10px] uppercase font-bold text-foreground/30">Novo mês</span>
          )}
        </button>
      ))}
    </div>
  );
}
