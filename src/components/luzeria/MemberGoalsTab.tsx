import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { goalsQO, profilesQO, useApi } from "@/lib/luzeria/queries";
import { listGoals } from "@/lib/luzeria/roadmap.functions";
import { Avatar } from "./Avatar";
import { toast } from "sonner";
import { Target, Copy, Save } from "lucide-react";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(monthKey: string, delta: number) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function labelFor(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

type Row = { posts: number; reels: number; stories: number };

export function MemberGoalsTab() {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const { data: profiles = [] } = useQuery(profilesQO());
  const { data: goals = [] } = useQuery(goalsQO(monthKey));
  const { setGoals } = useApi();

  const activeMembers = useMemo(
    () => profiles.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name)),
    [profiles],
  );

  const [draft, setDraft] = useState<Record<string, Row>>({});

  useEffect(() => {
    const next: Record<string, Row> = {};
    activeMembers.forEach((p) => {
      const g = goals.find((x: any) => x.userId === p.id);
      next[p.id] = {
        posts: g?.postsGoal ?? 0,
        reels: g?.reelsGoal ?? 0,
        stories: g?.storiesGoal ?? 0,
      };
    });
    setDraft(next);
  }, [goals, activeMembers]);

  const update = (uid: string, field: keyof Row, value: number) =>
    setDraft((d) => ({ ...d, [uid]: { ...d[uid], [field]: Math.max(0, Math.min(9999, value || 0)) } }));

  const save = (uid: string) => {
    const row = draft[uid];
    if (!row) return;
    setGoals.mutate(
      { data: { userId: uid, monthKey, postsGoal: row.posts, reelsGoal: row.reels, storiesGoal: row.stories } },
      {
        onSuccess: () => toast.success("Meta salva."),
        onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
      },
    );
  };

  const copyPrevious = async () => {
    const prev = shiftMonth(monthKey, -1);
    try {
      const prevGoals = await listGoals({ data: { monthKey: prev } });
      if (!prevGoals.length) {
        toast.error(`Sem metas em ${labelFor(prev)} para copiar.`);
        return;
      }
      const next: Record<string, Row> = { ...draft };
      let count = 0;
      prevGoals.forEach((g: any) => {
        if (next[g.userId]) {
          next[g.userId] = { posts: g.postsGoal, reels: g.reelsGoal, stories: g.storiesGoal };
          count++;
        }
      });
      setDraft(next);
      toast.success(`${count} metas copiadas de ${labelFor(prev)}. Clique em salvar para aplicar.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao copiar");
    }
  };

  const saveAll = () => {
    let n = 0;
    activeMembers.forEach((p) => {
      const row = draft[p.id];
      if (!row) return;
      const g = goals.find((x: any) => x.userId === p.id);
      const changed = !g || g.postsGoal !== row.posts || g.reelsGoal !== row.reels || g.storiesGoal !== row.stories;
      if (!changed) return;
      n++;
      setGoals.mutate({
        data: { userId: p.id, monthKey, postsGoal: row.posts, reelsGoal: row.reels, storiesGoal: row.stories },
      });
    });
    if (n === 0) toast.info("Nada para salvar.");
    else toast.success(`Salvando ${n} meta(s)…`);
  };

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonthKey(shiftMonth(monthKey, -1))}
            className="text-xs px-2.5 py-1.5 rounded-md border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition"
          >
            ←
          </button>
          <div className="flex items-center gap-2 text-white">
            <Target size={14} className="text-[#C8D44E]" />
            <span className="text-sm font-bold">{labelFor(monthKey)}</span>
          </div>
          <button
            onClick={() => setMonthKey(shiftMonth(monthKey, 1))}
            className="text-xs px-2.5 py-1.5 rounded-md border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition"
          >
            →
          </button>
          {monthKey !== currentMonthKey() && (
            <button
              onClick={() => setMonthKey(currentMonthKey())}
              className="text-[11px] text-white/40 hover:text-[#C8D44E] transition ml-1"
            >
              Hoje
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyPrevious}
            className="text-xs px-3 py-2 rounded-md border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition inline-flex items-center gap-1.5"
          >
            <Copy size={12} /> Copiar do mês anterior
          </button>
          <button
            onClick={saveAll}
            className="lz-btn-primary text-xs px-3 py-2 rounded-md inline-flex items-center gap-1.5"
          >
            <Save size={12} /> Salvar tudo
          </button>
        </div>
      </div>

      <p className="text-[11px] text-white/40 mb-3">
        Defina quantos posts, reels e dias de stories cada membro precisa entregar neste mês.
        Use <span className="text-white/60">0</span> para não definir meta naquela categoria.
      </p>

      <div className="bg-[#1C1C1C] rounded-lg overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_90px_90px_90px_70px] gap-3 px-5 py-3 border-b border-white/[0.06] text-[10px] uppercase font-bold tracking-wider text-white/40">
          <div>Membro</div>
          <div className="text-center">Posts</div>
          <div className="text-center">Reels</div>
          <div className="text-center">Stories</div>
          <div></div>
        </div>
        {activeMembers.length === 0 && (
          <div className="px-5 py-6 text-sm text-white/40">Sem membros ativos.</div>
        )}
        {activeMembers.map((p) => {
          const row = draft[p.id] ?? { posts: 0, reels: 0, stories: 0 };
          const g = goals.find((x: any) => x.userId === p.id);
          const dirty = !g
            ? row.posts || row.reels || row.stories
            : g.postsGoal !== row.posts || g.reelsGoal !== row.reels || g.storiesGoal !== row.stories;
          return (
            <div
              key={p.id}
              className="grid grid-cols-[1fr_90px_90px_90px_70px] gap-3 items-center px-5 py-3 border-b border-white/[0.05] last:border-b-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <Avatar profile={p} size={32} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{p.name}</div>
                  <div className="text-[10px] text-white/40 truncate">{p.email}</div>
                </div>
              </div>
              <GoalInput value={row.posts} onChange={(v) => update(p.id, "posts", v)} />
              <GoalInput value={row.reels} onChange={(v) => update(p.id, "reels", v)} />
              <GoalInput value={row.stories} onChange={(v) => update(p.id, "stories", v)} />
              <button
                onClick={() => save(p.id)}
                disabled={!dirty}
                className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md text-black transition disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ backgroundColor: "#C8D44E" }}
              >
                Salvar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      max={9999}
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      className="w-full bg-[#0D0D0D] border border-white/10 text-sm text-white rounded-md px-2 py-1.5 text-center outline-none focus:border-[#C8D44E]"
    />
  );
}