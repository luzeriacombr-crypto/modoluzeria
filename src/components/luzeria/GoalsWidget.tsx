import { useQuery } from "@tanstack/react-query";
import { goalProgressQO } from "@/lib/luzeria/queries";
import { Target } from "lucide-react";

export function GoalsWidget({ monthKey, userId }: { monthKey: string; userId?: string }) {
  const { data } = useQuery(goalProgressQO(monthKey, userId));
  if (!data) return null;
  if (!data.postsGoal && !data.reelsGoal && !data.storiesGoal) return null;

  const items = [
    { label: "Posts", done: data.postsDone, goal: data.postsGoal },
    { label: "Reels", done: data.reelsDone, goal: data.reelsGoal },
    { label: "Stories", done: data.storiesDone, goal: data.storiesGoal },
  ].filter((i) => i.goal > 0);

  return (
    <div className="rounded-xl bg-[#1C1C1C] border border-white/[0.06] p-4 mb-6">
      <div className="flex items-center gap-1.5 mb-3 text-[10px] uppercase font-bold tracking-wider text-[#C8D44E]">
        <Target size={12} /> Meta do mês
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((i) => <Ring key={i.label} {...i} />)}
      </div>
    </div>
  );
}

function Ring({ label, done, goal }: { label: string; done: number; goal: number }) {
  const pct = Math.min(100, Math.round((done / goal) * 100));
  // alert: < 70% do esperado para o dia
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const expected = Math.round((dayOfMonth / daysInMonth) * goal);
  const behind = done < expected * 0.7;
  const color = done >= goal ? "#C8D44E" : behind ? "#FF8C42" : "#7EB3FF";

  const R = 24, C = 2 * Math.PI * R;
  const offset = C - (Math.min(100, pct) / 100) * C;
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[70px] w-[70px]">
        <svg viewBox="0 0 60 60" className="-rotate-90">
          <circle cx="30" cy="30" r={R} stroke="rgba(255,255,255,0.07)" strokeWidth="6" fill="none" />
          <circle cx="30" cy="30" r={R} stroke={color} strokeWidth="6" fill="none"
            strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 600ms ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[14px] font-bold leading-none" style={{ color }}>{done}</div>
          <div className="text-[9px] text-white/40 leading-none mt-0.5">/{goal}</div>
        </div>
      </div>
      <div className="text-[10px] uppercase font-bold tracking-wider text-white/60 mt-1.5">{label}</div>
    </div>
  );
}