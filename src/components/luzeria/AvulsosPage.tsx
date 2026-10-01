import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Folder, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckCircle2, RotateCcw, FolderInput, Trash2 } from "lucide-react";
import { clientsQO, clientCategoriesQO, avulsoMonthsQO, useApi, useMe } from "@/lib/luzeria/queries";
import { formatMonth, currentMonthKey } from "@/lib/luzeria/utils";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { Avatar } from "./Avatar";
import type { Client } from "@/lib/luzeria/types";

const CATEGORY_ORDER = ["Social Media", "Pack Digital", "Avulsos", "Ex-clientes"] as const;

/** Página /avulsos — antes as demandas avulsas só apareciam numa lista
 * única dentro de "Clientes" na barra lateral. Pedido do Junior (30/09):
 * uma tela própria, separada em "Projetos em aberto" (aberta por padrão)
 * e "Projetos entregues" (fechada por padrão), com um seletor de mês em
 * cima — cada avulso "pertence" ao mês do conteúdo dele (o mesmo critério
 * já usado no ClientView: monthKeys[0]), não a um mês escolhido à mão. */
export function AvulsosPage() {
  const { data: clients = [] } = useQuery(clientsQO());
  const { data: customCategories = [] } = useQuery(clientCategoriesQO());
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const { setAvulsoDelivered, updateClient, deleteClient } = useApi();

  // Um avulso pode virar cliente recorrente — pedido do Junior (30/09) pra
  // poder mover pra Social Media/Pack Digital (ou outra categoria) direto
  // daqui, sem precisar abrir o cliente e usar o menu de "..." de lá.
  const moveTargets = useMemo(() => {
    const set = new Set<string>(CATEGORY_ORDER);
    customCategories.forEach((c) => set.add(c.name));
    set.delete("Avulsos");
    return [...set];
  }, [customCategories]);

  const avulsos = useMemo(() => clients.filter((c) => c.category === "Avulsos" && !c.archived), [clients]);
  const avulsoIds = useMemo(() => avulsos.map((c) => c.id), [avulsos]);
  const { data: monthByClient = {} } = useQuery(avulsoMonthsQO(avulsoIds));

  const monthOptions = useMemo(
    () => [...new Set(Object.values(monthByClient))].sort(),
    [monthByClient],
  );
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const effectiveMonth = selectedMonth && monthOptions.includes(selectedMonth)
    ? selectedMonth
    : (monthOptions[monthOptions.length - 1] ?? currentMonthKey());
  const idx = monthOptions.indexOf(effectiveMonth);

  // Um avulso recém-criado ainda não tem nenhum conteúdo (logo, nenhum mês)
  // — sem essa exceção ele simplesmente sumiria da tela inteira até alguém
  // adicionar o primeiro post/reel/story. Aparece em aberto em qualquer mês
  // que a pessoa estiver olhando, até ganhar um mês de verdade.
  const semMes = avulsos.filter((c) => !monthByClient[c.id]);
  const projectsInMonth = avulsos.filter((c) => monthByClient[c.id] === effectiveMonth);
  const abertos = [...semMes, ...projectsInMonth].filter((c) => !c.avulsoDeliveredAt);
  const entregues = projectsInMonth.filter((c) => c.avulsoDeliveredAt);

  const [entreguesOpen, setEntreguesOpen] = useState(false);

  async function handleDelete(c: Client) {
    if (await requestConfirm(`Excluir "${c.name}" e todo seu histórico?`, { danger: true })) {
      deleteClient.mutate({ data: { id: c.id } });
    }
  }

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Folder size={20} className="text-[var(--lz-accent-ink)]" />
        <h1 className="text-lg font-bold text-foreground">Avulsos</h1>
      </div>
      <p className="text-xs text-foreground/50 mb-6">Demandas avulsas (jobs pontuais, fora do plano mensal dos clientes recorrentes).</p>

      <div className="flex items-center justify-center gap-3 mb-6">
        <button
          onClick={() => idx > 0 && setSelectedMonth(monthOptions[idx - 1])}
          disabled={idx <= 0}
          className="h-8 w-8 flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 transition"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="rounded-md px-4 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          {formatMonth(effectiveMonth)}
        </span>
        <button
          onClick={() => idx >= 0 && idx < monthOptions.length - 1 && setSelectedMonth(monthOptions[idx + 1])}
          disabled={idx < 0 || idx >= monthOptions.length - 1}
          className="h-8 w-8 flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 transition"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {avulsos.length === 0 ? (
        <div className="text-center py-16 text-foreground/40">
          <Folder size={28} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma demanda avulsa ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <ProjectFolder
            label="Projetos em aberto"
            open
            projects={abertos}
            emptyLabel="Nenhum projeto em aberto nesse mês."
            isAdmin={isAdmin}
            onToggleDelivered={(c) => setAvulsoDelivered.mutate({ data: { clientId: c.id, delivered: true } })}
            toggleIcon={<CheckCircle2 size={13} />}
            toggleTitle="Marcar como entregue"
            moveTargets={moveTargets}
            onMove={(c, category) => updateClient.mutate({ data: { id: c.id, patch: { category } } })}
            onDelete={handleDelete}
          />
          <ProjectFolder
            label="Projetos entregues"
            open={entreguesOpen}
            onToggleOpen={() => setEntreguesOpen((o) => !o)}
            projects={entregues}
            emptyLabel="Nenhum projeto entregue nesse mês."
            isAdmin={isAdmin}
            onToggleDelivered={(c) => setAvulsoDelivered.mutate({ data: { clientId: c.id, delivered: false } })}
            toggleIcon={<RotateCcw size={13} />}
            toggleTitle="Reabrir projeto"
            moveTargets={moveTargets}
            onMove={(c, category) => updateClient.mutate({ data: { id: c.id, patch: { category } } })}
            onDelete={handleDelete}
          />
        </div>
      )}
    </div>
  );
}

function ProjectFolder({
  label, open, onToggleOpen, projects, emptyLabel, isAdmin, onToggleDelivered, toggleIcon, toggleTitle, moveTargets, onMove, onDelete,
}: {
  label: string; open: boolean; onToggleOpen?: () => void; projects: Client[]; emptyLabel: string;
  isAdmin: boolean; onToggleDelivered: (c: Client) => void; toggleIcon: React.ReactNode; toggleTitle: string;
  moveTargets: string[]; onMove: (c: Client, category: string) => void; onDelete: (c: Client) => void;
}) {
  return (
    <div className="rounded-xl border border-foreground/7 bg-card overflow-hidden">
      <button
        onClick={onToggleOpen}
        disabled={!onToggleOpen}
        className="w-full flex items-center gap-2 px-4 py-3 text-left disabled:cursor-default"
      >
        {onToggleOpen ? (open ? <ChevronDown size={14} className="text-foreground/40" /> : <ChevronUp size={14} className="text-foreground/40" style={{ transform: "rotate(180deg)" }} />) : (
          <ChevronDown size={14} className="text-foreground/40" />
        )}
        <span className="text-sm font-bold text-foreground">{label}</span>
        <span className="text-[11px] text-foreground/40">{projects.length}</span>
      </button>
      {open && (
        <div className="border-t border-foreground/6 divide-y divide-foreground/6">
          {projects.length === 0 ? (
            <div className="px-4 py-3 text-xs text-foreground/35">{emptyLabel}</div>
          ) : (
            projects.map((c) => (
              <ProjectRow
                key={c.id} client={c} isAdmin={isAdmin}
                onToggleDelivered={() => onToggleDelivered(c)} toggleIcon={toggleIcon} toggleTitle={toggleTitle}
                moveTargets={moveTargets} onMove={(category) => onMove(c, category)}
                onDelete={() => onDelete(c)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ProjectRow({
  client: c, isAdmin, onToggleDelivered, toggleIcon, toggleTitle, moveTargets, onMove, onDelete,
}: {
  client: Client; isAdmin: boolean; onToggleDelivered: () => void; toggleIcon: React.ReactNode; toggleTitle: string;
  moveTargets: string[]; onMove: (category: string) => void; onDelete: () => void;
}) {
  const [moving, setMoving] = useState(false);
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-3">
        <Link to="/cliente/$clientId" params={{ clientId: c.id }} className="flex-1 min-w-0 flex items-center gap-2.5">
          <Avatar name={c.name} color={c.color} size={30} avatarUrl={c.photoUrl} />
          <span className="text-sm font-medium text-foreground truncate">{c.name}</span>
        </Link>
        {isAdmin && (
          <>
            <button
              onClick={() => setMoving((o) => !o)}
              title="Virou cliente recorrente? Mover pra outra categoria"
              className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition"
            >
              <FolderInput size={13} /> Mover
            </button>
            <button
              onClick={onToggleDelivered}
              title={toggleTitle}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition"
            >
              {toggleIcon} {toggleTitle}
            </button>
            <button
              onClick={onDelete}
              title="Excluir cliente"
              className="shrink-0 inline-flex items-center justify-center rounded-md p-1.5 text-foreground/30 hover:text-red-400 hover:bg-foreground/5 transition"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
      {moving && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2 ml-[42px]">
          <span className="text-[10.5px] text-foreground/35 mr-1">Mover pra:</span>
          {moveTargets.map((cat) => (
            <button
              key={cat}
              onClick={() => { onMove(cat); setMoving(false); }}
              className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold text-foreground/60 hover:text-foreground border border-foreground/10 hover:border-foreground/25 transition"
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
