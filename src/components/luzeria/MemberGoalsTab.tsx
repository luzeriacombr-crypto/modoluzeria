import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { goalsQO, goalProgressForOrgQO, profilesQO, useApi } from "@/lib/luzeria/queries";
import { listGoals } from "@/lib/luzeria/roadmap.functions";
import { Avatar } from "./Avatar";
import { toast } from "sonner";
import { Target, Copy, Save, Sparkles } from "lucide-react";

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

type Row = { posts: number; reels: number; stories: number; gravacao: number; outros: number };

const GOAL_FIELDS: { key: keyof Row; label: string }[] = [
  { key: "posts", label: "Posts" },
  { key: "reels", label: "Reels" },
  { key: "stories", label: "Stories" },
  { key: "gravacao", label: "Gravação" },
  { key: "outros", label: "Outros" },
];

export function MemberGoalsTab() {
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const { data: profiles = [] } = useQuery(profilesQO());
  const { data: goals = [] } = useQuery(goalsQO(monthKey));
  const { data: progress = [] } = useQuery(goalProgressForOrgQO(monthKey));
  const { setGoals } = useApi();

  const progressByUser = useMemo(
    () => new Map(progress.map((p: any) => [p.userId, p])),
    [progress],
  );

  const activeMembers = useMemo(
    () => profiles.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name)),
    [profiles],
  );

  const [draft, setDraft] = useState<Record<string, Row>>({});

  useEffect(() => {
    const next: Record<string, Row> = {};
    activeMembers.forEach((p) => {
      const g: any = goals.find((x: any) => x.userId === p.id);
      next[p.id] = {
        posts: g?.postsGoal ?? 0,
        reels: g?.reelsGoal ?? 0,
        stories: g?.storiesGoal ?? 0,
        gravacao: g?.gravacaoGoal ?? 0,
        outros: g?.outrosGoal ?? 0,
      };
    });
    setDraft(next);
  }, [goals, activeMembers]);

  const update = (uid: string, field: keyof Row, value: number) =>
    setDraft((d) => ({ ...d, [uid]: { ...d[uid], [field]: Math.max(0, Math.min(9999, value || 0)) } }));

  const rowPayload = (uid: string, row: Row) => ({
    userId: uid, monthKey,
    postsGoal: row.posts, reelsGoal: row.reels, storiesGoal: row.stories,
    gravacaoGoal: row.gravacao, outrosGoal: row.outros,
  });

  const save = (uid: string) => {
    const row = draft[uid];
    if (!row) return;
    setGoals.mutate(
      { data: rowPayload(uid, row) },
      {
        onSuccess: () => toast.success("Meta salva."),
        onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
      },
    );
  };

  const isDirty = (uid: string, row: Row) => {
    const g: any = goals.find((x: any) => x.userId === uid);
    if (!g) return row.posts || row.reels || row.stories || row.gravacao || row.outros;
    return (
      g.postsGoal !== row.posts || g.reelsGoal !== row.reels || g.storiesGoal !== row.stories ||
      g.gravacaoGoal !== row.gravacao || g.outrosGoal !== row.outros
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
          next[g.userId] = {
            posts: g.postsGoal, reels: g.reelsGoal, stories: g.storiesGoal,
            gravacao: g.gravacaoGoal ?? 0, outros: g.outrosGoal ?? 0,
          };
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
      if (!row || !isDirty(p.id, row)) return;
      n++;
      setGoals.mutate({ data: rowPayload(p.id, row) });
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
            className="text-xs px-2.5 py-1.5 rounded-md border border-foreground/10 text-foreground/70 hover:text-foreground hover:border-foreground/30 transition"
          >
            ←
          </button>
          <div className="flex items-center gap-2 text-foreground">
            <Target size={14} className="text-[var(--lz-accent-ink)]" />
            <span className="text-sm font-bold">{labelFor(monthKey)}</span>
          </div>
          <button
            onClick={() => setMonthKey(shiftMonth(monthKey, 1))}
            className="text-xs px-2.5 py-1.5 rounded-md border border-foreground/10 text-foreground/70 hover:text-foreground hover:border-foreground/30 transition"
          >
            →
          </button>
          {monthKey !== currentMonthKey() && (
            <button
              onClick={() => setMonthKey(currentMonthKey())}
              className="text-[11px] text-foreground/40 hover:text-[var(--lz-accent-ink)] transition ml-1"
            >
              Hoje
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyPrevious}
            className="text-xs px-3 py-2 rounded-md border border-foreground/10 text-foreground/70 hover:text-foreground hover:border-foreground/30 transition inline-flex items-center gap-1.5"
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

      <p className="text-[11px] text-foreground/40 mb-3">
        Defina quantos posts, reels, dias de stories, gravações e outros conteúdos cada membro
        precisa entregar neste mês. Use <span className="text-foreground/60">0</span> para não definir
        meta naquela categoria. Rotina não tem meta — só mostra quantas tarefas do dia a dia a
        pessoa já concluiu.
      </p>

      <div className="space-y-3">
        {activeMembers.length === 0 && (
          <div className="px-5 py-6 text-sm text-foreground/40 bg-card rounded-lg">Sem membros ativos.</div>
        )}
        {activeMembers.map((p) => {
          const row = draft[p.id] ?? { posts: 0, reels: 0, stories: 0, gravacao: 0, outros: 0 };
          const prog: any = progressByUser.get(p.id);
          const dirty = isDirty(p.id, row);
          return (
            <div key={p.id} className="bg-card rounded-lg p-4">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar profile={p} size={32} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{p.name}</div>
                    <div className="text-[10px] text-foreground/40 truncate">{p.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => save(p.id)}
                  disabled={!dirty}
                  className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md text-black transition disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                  style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
                >
                  Salvar
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                {GOAL_FIELDS.map((f) => (
                  <GoalField
                    key={f.key}
                    label={f.label}
                    value={row[f.key]}
                    done={prog?.[`${f.key}Done`] ?? 0}
                    onChange={(v) => update(p.id, f.key, v)}
                  />
                ))}
                <div className="flex flex-col items-center gap-1 w-[76px]">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-foreground/40 inline-flex items-center gap-1">
                    <Sparkles size={9} /> Rotina
                  </span>
                  <div className="w-full h-[34px] rounded-md border border-foreground/6 bg-background/40 flex items-center justify-center text-sm font-bold text-foreground/70 tabular-nums">
                    {prog?.rotinaDone ?? 0}
                  </div>
                  <span className="text-[9px] text-foreground/30">concluídas</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoalField({
  label, value, done, onChange,
}: { label: string; value: number; done: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col items-center gap-1 w-[76px]">
      <span className="text-[9px] uppercase font-bold tracking-wider text-foreground/40">{label}</span>
      <input
        type="number"
        min={0}
        max={9999}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        className="w-full bg-background border border-foreground/10 text-sm text-foreground rounded-md px-2 py-1.5 text-center outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
      />
      <span className="text-[9px] text-foreground/30 tabular-nums">
        {value > 0 ? `${done}/${value} feito` : "sem meta"}
      </span>
    </div>
  );
}
