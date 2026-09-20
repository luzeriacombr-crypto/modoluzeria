import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Instagram, Check, Lightbulb } from "lucide-react";
import { agencyStoriesQO, profilesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { Avatar } from "@/components/luzeria/Avatar";
import { StoriesInspiracoesEditor } from "@/components/luzeria/StoriesInspiracoesEditor";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function chaveMes(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function chaveDia(ano: number, mes: number, dia: number) {
  return `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * Escala de Stories do perfil da agência — quem fica responsável em cada
 * dia do mês. Só admin escala; quem está escalado vê o lembrete nas
 * demandas e marca como feito por lá (ou aqui mesmo).
 */
export function AgencyStoriesCalendar() {
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const { data: profiles = [] } = useQuery(profilesQO());
  const { setAgencyStoriesDay, setAgencyStoriesDone } = useApi();

  const [refMes, setRefMes] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const mes = chaveMes(refMes);
  const { data: escala = [] } = useQuery(agencyStoriesQO(mes));
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [editorAberto, setEditorAberto] = useState(false);

  const porDia = useMemo(() => {
    const m = new Map<string, typeof escala>();
    escala.forEach((e) => m.set(e.date, [...(m.get(e.date) ?? []), e]));
    return m;
  }, [escala]);

  const ano = refMes.getFullYear();
  const mesIdx = refMes.getMonth();
  const primeiroDiaSemana = new Date(ano, mesIdx, 1).getDay();
  const diasNoMes = new Date(ano, mesIdx + 1, 0).getDate();
  const hoje = new Date();
  const hojeStr = chaveDia(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const celulas: (number | null)[] = [
    ...Array.from({ length: primeiroDiaSemana }, () => null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ];

  function alternarPessoa(dia: string, userId: string) {
    const atuais = (porDia.get(dia) ?? []).map((e) => e.userId);
    const novos = atuais.includes(userId)
      ? atuais.filter((id) => id !== userId)
      : [...atuais, userId];
    setAgencyStoriesDay.mutate(
      { data: { date: dia, userIds: novos } },
      {
        onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar a escala"),
      },
    );
  }

  const nomeDoMes = refMes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="bg-card rounded-lg p-4 mt-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Instagram size={13} className="text-foreground/40" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-foreground/60">
            Stories
          </span>
          <span className="text-[11px] text-foreground/40">
            perfil da {me?.orgName ?? "agência"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <button
              onClick={() => setEditorAberto(true)}
              title="Editar as inspirações que a equipe vê no dia"
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 mr-1 text-[10.5px] font-semibold text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors"
            ><Lightbulb size={12} /> Inspirações</button>
          )}
          <button
            onClick={() => setRefMes(new Date(ano, mesIdx - 1, 1))}
            className="p-1 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold text-foreground/70 capitalize min-w-[118px] text-center">
            {nomeDoMes}
          </span>
          <button
            onClick={() => setRefMes(new Date(ano, mesIdx + 1, 1))}
            className="p-1 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            className="text-[10px] uppercase font-bold tracking-wider text-foreground/30 text-center pb-1"
          >
            {d}
          </div>
        ))}
        {celulas.map((dia, i) => {
          if (dia == null) return <div key={`vazio-${i}`} />;
          const chave = chaveDia(ano, mesIdx, dia);
          const doDia = porDia.get(chave) ?? [];
          const eHoje = chave === hojeStr;
          const aberto = diaAberto === chave;
          return (
            <button
              key={chave}
              onClick={() => isAdmin && setDiaAberto(aberto ? null : chave)}
              disabled={!isAdmin}
              className={`rounded-lg p-1.5 min-h-[58px] flex flex-col items-center gap-1 border transition-colors ${
                aberto ? "border-[rgb(var(--lz-brand-rgb))]" : "border-transparent"
              } ${isAdmin ? "hover:bg-foreground/[0.05] cursor-pointer" : "cursor-default"}`}
              style={{
                backgroundColor: eHoje
                  ? "rgba(var(--lz-brand-rgb),0.10)"
                  : "color-mix(in srgb, var(--foreground) 3%, transparent)",
              }}
            >
              <span
                className={`text-[10.5px] font-bold tabular-nums ${eHoje ? "text-[var(--lz-accent-ink)]" : "text-foreground/40"}`}
              >
                {dia}
              </span>
              <div className="flex flex-wrap items-center justify-center gap-0.5">
                {doDia.map((e) => {
                  const p = profiles.find((x: any) => x.id === e.userId);
                  return (
                    <div
                      key={e.id}
                      className="relative"
                      title={`${p?.name ?? "—"}${e.doneAt ? " · feito" : ""}`}
                    >
                      <Avatar profile={p as any} size={18} />
                      {e.doneAt && (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
                        >
                          <Check size={7} color="#0D0D0D" strokeWidth={4} />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>

      {diaAberto && isAdmin && (
        <div className="mt-3 pt-3 border-t border-foreground/6">
          <div className="text-[11px] text-foreground/50 mb-2">
            Quem faz os Stories em{" "}
            {new Date(`${diaAberto}T12:00:00`).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
            })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {profiles.map((p: any) => {
              const escalado = (porDia.get(diaAberto) ?? []).some((e) => e.userId === p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => alternarPessoa(diaAberto, p.id)}
                  className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 text-[11px] font-medium transition-colors"
                  style={{
                    backgroundColor: escalado
                      ? "rgba(var(--lz-brand-light-rgb),0.16)"
                      : "color-mix(in srgb, var(--foreground) 5%, transparent)",
                    color: escalado
                      ? "var(--lz-accent-ink)"
                      : "color-mix(in srgb, var(--foreground) 60%, transparent)",
                  }}
                >
                  <Avatar profile={p} size={18} />
                  {p.name}
                </button>
              );
            })}
          </div>
          {(porDia.get(diaAberto) ?? []).some((e) => e.doneAt) && (
            <button
              onClick={() => {
                const feito = (porDia.get(diaAberto) ?? []).filter((e) => e.doneAt);
                feito.forEach((e) =>
                  setAgencyStoriesDone.mutate({ data: { id: e.id, done: false } }),
                );
              }}
              className="mt-2 text-[10.5px] text-foreground/35 hover:text-foreground/70 underline"
            >
              Desmarcar "feito" desse dia
            </button>
          )}
        </div>
      )}

      <StoriesInspiracoesEditor open={editorAberto} onClose={() => setEditorAberto(false)} />
    </div>
  );
}
