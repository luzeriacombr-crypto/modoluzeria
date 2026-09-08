import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { goalProgressQO, useMe } from "@/lib/luzeria/queries";
import { Target } from "lucide-react";
import { useGrowIn } from "@/lib/luzeria/animation-hooks";

export function GoalsWidget({ monthKey, userId }: { monthKey: string; userId?: string }) {
  const { data } = useQuery(goalProgressQO(monthKey, userId));
  const me = useMe().data;
  const navigate = useNavigate();
  if (!data) return null;

  // Reels tem card próprio agora (ver EditingStatsWidget em MyTasks.tsx,
  // que já junta editados/meta/média num lugar só) — não entra mais nas
  // barras genéricas daqui, senão duplicava a mesma meta em dois lugares.
  const items = [
    { label: "Posts", done: data.postsDone, goal: data.postsGoal },
    { label: "Stories", done: data.storiesDone, goal: data.storiesGoal },
    { label: "Gravação", done: data.gravacaoDone, goal: data.gravacaoGoal },
    { label: "Outros", done: data.outrosDone, goal: data.outrosGoal },
  ].filter((i) => i.goal > 0);

  if (items.length === 0) {
    // Tem só meta de reels (ou nenhuma meta) — se for só reels, ela já
    // aparece no card novo, não faz sentido mostrar esse widget vazio
    // nem o aviso de "sem meta" (a pessoa TEM meta, só que em outro lugar).
    const anyGoalAtAll = data.postsGoal || data.reelsGoal || data.storiesGoal || data.gravacaoGoal || data.outrosGoal;
    if (anyGoalAtAll) return null;
    const isSelf = !userId || userId === me?.id;
    if (!isSelf) return null;
    return (
      <div className="rounded-xl bg-card border border-foreground/6 p-4 mb-6 flex items-center gap-3">
        <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
          <Target size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">Sem meta definida este mês</div>
          <div className="text-[11px] text-foreground/50 mt-0.5">
            {me?.role === "master"
              ? "Defina as metas da equipe em Configurações › Metas."
              : "Seu adm ainda não definiu suas metas do mês."}
          </div>
        </div>
        {me?.role === "master" && (
          <button
            onClick={() => navigate({ to: "/configuracoes" })}
            className="text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-md text-black"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
          >
            Definir metas
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-foreground/6 p-4 mb-6">
      <div className="flex items-center gap-1.5 mb-3 text-[10px] uppercase font-bold tracking-wider text-[var(--lz-accent-ink)]">
        <Target size={12} /> Meta do mês
      </div>
      <div className="space-y-3">
        {items.map((i) => <Bar key={i.label} {...i} />)}
      </div>
    </div>
  );
}

function Bar({ label, done, goal }: { label: string; done: number; goal: number }) {
  const pct = Math.min(100, Math.round((done / goal) * 100));
  // alert: < 70% do esperado para o dia
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const expected = Math.round((dayOfMonth / daysInMonth) * goal);
  const behind = done < expected * 0.7;
  const color = done >= goal ? "var(--lz-accent-ink)" : behind ? "#FF8C42" : "#7EB3FF";
  const grown = useGrowIn(pct);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 text-xs">
        <span className="font-semibold text-foreground/70 uppercase tracking-wider text-[10px]">{label}</span>
        <span className="tabular-nums font-bold" style={{ color }}>
          {done}<span className="text-foreground/40 font-normal">/{goal}</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${grown}%`, background: color }} />
      </div>
    </div>
  );
}