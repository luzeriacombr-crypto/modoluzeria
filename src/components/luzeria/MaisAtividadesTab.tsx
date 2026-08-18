import { useState } from "react";
import { Plus, Trash2, Pencil, ChevronDown, ChevronRight, MapPin, Link as LinkIcon, Calendar, User, Hash, Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { ACTIVITY_QUANTITY_LABEL, type ContentItem, type Profile } from "@/lib/luzeria/types";

type ActivityType = "gravacao" | "roteiro" | "sistema" | "outros";

const ACTIVITY_CONFIG: Record<ActivityType, { label: string; hasLocation: boolean; dateLabel: string; quantityLabel: string | null }> = {
  gravacao: { label: "Gravação",       hasLocation: true,  dateLabel: "Data para gravação", quantityLabel: ACTIVITY_QUANTITY_LABEL.gravacao },
  roteiro:  { label: "Roteiro",        hasLocation: false, dateLabel: "Data de entrega",    quantityLabel: ACTIVITY_QUANTITY_LABEL.roteiro },
  sistema:  { label: "Sistema",        hasLocation: false, dateLabel: "Data de entrega",    quantityLabel: ACTIVITY_QUANTITY_LABEL.sistema },
  outros:   { label: "Outro",          hasLocation: false, dateLabel: "Data de entrega",    quantityLabel: ACTIVITY_QUANTITY_LABEL.outros },
};

// Gravação continua com seção própria — entra na contagem do relatório de
// atividades e tem campos específicos (local, data pra gravação). Roteiro,
// Sistema e Outros viram uma única seção "Outras atividades": itens antigos
// desses 3 tipos continuam aparecendo juntos ali, e todo registro novo feito
// nessa seção passa a entrar como "outros".
type GroupKey = "gravacao" | "outras";

interface Props {
  clientId: string;
  monthKey: string;
  gravacoes: ContentItem[];
  roteiros: ContentItem[];
  sistemas: ContentItem[];
  outros: ContentItem[];
  profiles: Profile[];
  isAdmin: boolean;
}

export function MaisAtividadesTab({ clientId, monthKey, gravacoes, roteiros, sistemas, outros, profiles, isAdmin }: Props) {
  const { addContentItem, addAssignee, deleteItem, setItemStatus } = useApi();
  const { openItem } = useUI();
  const [openForm, setOpenForm] = useState<GroupKey | null>(null);
  const [collapsed, setCollapsed] = useState<Record<GroupKey, boolean>>({
    gravacao: false, outras: false,
  });

  const groups: { key: GroupKey; label: string; cfg: typeof ACTIVITY_CONFIG[ActivityType]; items: ContentItem[]; registerType: ActivityType }[] = [
    { key: "gravacao", label: ACTIVITY_CONFIG.gravacao.label, cfg: ACTIVITY_CONFIG.gravacao, items: gravacoes, registerType: "gravacao" },
    { key: "outras", label: "Outras atividades", cfg: ACTIVITY_CONFIG.outros, items: [...roteiros, ...sistemas, ...outros], registerType: "outros" },
  ];

  const totalItems = gravacoes.length + roteiros.length + sistemas.length + outros.length;

  return (
    <div className="mt-4 space-y-6">
      {totalItems === 0 && !isAdmin && (
        <div className="py-14 text-center text-sm text-white/40">Nenhuma atividade registrada neste mês.</div>
      )}

      {groups.map((group) => {
        const { key, label, cfg, items, registerType } = group;
        const type = registerType;
        const isCollapsed = collapsed[key];
        const formOpen = openForm === key;

        return (
          <section key={key}>
            {/* Section header */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setCollapsed((p) => ({ ...p, [key]: !p[key] }))}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/50 hover:text-white transition"
              >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                {label}
                {items.length > 0 && (
                  <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "rgb(var(--lz-brand-rgb))" }}>
                    {items.length}
                  </span>
                )}
              </button>
              <div className="flex-1 h-px bg-white/[0.06]" />
              {isAdmin && !formOpen && (
                <button
                  onClick={() => setOpenForm(key)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/50 hover:text-[rgb(var(--lz-brand-rgb))] transition"
                >
                  <Plus size={13} /> Registrar
                </button>
              )}
            </div>

            {/* Inline registration form */}
            {formOpen && isAdmin && (
              <ActivityForm
                type={type}
                cfg={cfg}
                clientId={clientId}
                monthKey={monthKey}
                profiles={profiles}
                onSubmit={async (vals) => {
                  try {
                    const { assigneeIds, status, ...itemVals } = vals;
                    const result = await addContentItem.mutateAsync({
                      data: { clientId, key: monthKey, type, ...itemVals },
                    });
                    const newId = (result as any)?.id;
                    // Precisa terminar de atribuir todo mundo ANTES de marcar
                    // como Concluído — o gatilho que credita a finalização
                    // (e, no fim, as horas de cada um na margem por cliente)
                    // lê os responsáveis no momento da transição de status.
                    if (assigneeIds?.length && newId) {
                      await Promise.all(assigneeIds.map((uid) =>
                        addAssignee.mutateAsync({ data: { itemId: newId, userId: uid } })
                      ));
                    }
                    // Criado sempre como PENDENTE (padrão do backend); se a
                    // pessoa já marcou como Concluído no formulário, aplica a
                    // transição em seguida — precisa ser um UPDATE separado
                    // pra disparar o trigger que credita a finalização.
                    if (status === "CONCLUIDO" && newId) {
                      await setItemStatus.mutateAsync({ data: { id: newId, status: "CONCLUIDO" } });
                    }
                    toast.success(`${label} registrada com sucesso`);
                    setOpenForm(null);
                  } catch (e: any) {
                    toast.error(e?.message ?? "Erro ao registrar. Tente novamente.");
                  }
                }}
                onCancel={() => setOpenForm(null)}
                loading={addContentItem.isPending || addAssignee.isPending || setItemStatus.isPending}
              />
            )}

            {/* Items list */}
            {!isCollapsed && items.length > 0 && (
              <div className="space-y-0.5">
                {items.map((item, i) => (
                  <div key={item.id} className="group/row flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/[0.03] transition cursor-pointer" onClick={() => openItem(item.id)}>
                    <span className="text-[11px] font-bold text-white/30 w-5 text-right shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1 text-sm text-white truncate">{item.title}</span>
                    {typeof item.activityQuantity === "number" && (
                      <span className="flex items-center gap-1 text-[11px] text-white/40 shrink-0">
                        <Hash size={11} /> {item.activityQuantity}
                      </span>
                    )}
                    {item.status === "CONCLUIDO" && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                        style={{ backgroundColor: "#1A3A1A", color: "rgb(var(--lz-brand-rgb))" }}>
                        Concluído
                      </span>
                    )}
                    {item.dueDate && (
                      <span className="flex items-center gap-1 text-[11px] text-white/40 shrink-0">
                        <Calendar size={11} /> {new Date(item.dueDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                    )}
                    <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => openItem(item.id)} title="Editar" className="p-1.5 rounded text-white/40 hover:text-[rgb(var(--lz-brand-rgb))] hover:bg-white/5 transition">
                        <Pencil size={13} />
                      </button>
                      {isAdmin && (
                        <button onClick={async () => { if (await requestConfirm(`Excluir "${item.title}"?`, { danger: true })) deleteItem.mutate({ data: { id: item.id } }); }} title="Excluir" className="p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isCollapsed && items.length === 0 && !formOpen && isAdmin && (
              <div className="text-[12px] text-white/30 px-2 py-1">Nenhum(a) {label.toLowerCase()} registrado(a). Use "+ Registrar" para adicionar.</div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ActivityForm({
  type, cfg, profiles, onSubmit, onCancel, loading,
}: {
  type: ActivityType;
  cfg: { label: string; hasLocation: boolean; dateLabel: string; quantityLabel: string | null };
  clientId: string;
  monthKey: string;
  profiles: Profile[];
  onSubmit: (vals: { title: string; dueDate?: string; location?: string; quantity?: number; notes?: string; assigneeIds?: string[]; status: "PENDENTE" | "CONCLUIDO" }) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"PENDENTE" | "CONCLUIDO">("PENDENTE");

  const inp = "w-full bg-[#1A1A1A] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition-colors placeholder:text-white/30";

  async function submit() {
    if (!title.trim()) return;
    const qty = quantity.trim() ? Number(quantity) : undefined;
    await onSubmit({
      title: title.trim(),
      dueDate: dueDate || undefined,
      location: cfg.hasLocation && location.trim() ? location.trim() : undefined,
      quantity: cfg.quantityLabel && qty !== undefined && !Number.isNaN(qty) ? qty : undefined,
      notes: notes.trim() || undefined,
      assigneeIds: assigneeIds.length ? assigneeIds : undefined,
      status,
    });
  }

  return (
    <div className="mb-4 rounded-lg border border-white/[0.08] p-4 space-y-3" style={{ background: "#161616" }}>
      <div className="text-xs font-bold uppercase tracking-wider text-white/50 mb-1">Nova {cfg.label}</div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={`Título (ex: ${cfg.label} de março)`}
        className={inp}
        autoFocus
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1">
            <Calendar size={11} /> {cfg.dateLabel}
          </label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inp} />
        </div>
        {cfg.hasLocation && (
          <div>
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1">
              <MapPin size={11} /> Local
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Clínica, estúdio, externo…"
              className={inp}
            />
          </div>
        )}
        {cfg.quantityLabel && (
          <div>
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1">
              <Hash size={11} /> {cfg.quantityLabel}
            </label>
            <input
              type="number" min={0} step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className={inp}
            />
          </div>
        )}
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1">
          Status
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatus("PENDENTE")}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              backgroundColor: status === "PENDENTE" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
              color: status === "PENDENTE" ? "#FFFFFF" : "rgba(255,255,255,0.5)",
            }}
          >
            <Clock size={12} /> Pendente
          </button>
          <button
            type="button"
            onClick={() => setStatus("CONCLUIDO")}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              backgroundColor: status === "CONCLUIDO" ? "rgba(var(--lz-brand-light-rgb),0.18)" : "rgba(255,255,255,0.05)",
              color: status === "CONCLUIDO" ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.5)",
            }}
          >
            <Check size={12} /> Concluído
          </button>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1">
          <User size={11} /> Responsáveis {assigneeIds.length > 1 && <span className="text-white/30 normal-case">(quando mais de uma pessoa participa, a hora de todas conta na margem do cliente)</span>}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {profiles.map((p) => {
            const checked = assigneeIds.includes(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setAssigneeIds((ids) => checked ? ids.filter((id) => id !== p.id) : [...ids, p.id])}
                className="inline-flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 text-xs font-semibold transition-colors border"
                style={{
                  backgroundColor: checked ? "rgba(var(--lz-brand-light-rgb),0.15)" : "rgba(255,255,255,0.05)",
                  borderColor: checked ? "rgb(var(--lz-brand-rgb))" : "transparent",
                  color: checked ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.6)",
                }}
              >
                {checked ? <Check size={12} /> : <span className="w-3" />} {p.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/40 mb-1">
          <LinkIcon size={11} /> Comentários / links importantes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Links de referência, observações, briefs…"
          className={inp + " resize-none"}
          maxLength={2000}
        />
      </div>

      <div className="flex items-center gap-2 justify-end">
        <button onClick={onCancel} className="text-xs text-white/50 hover:text-white px-3 py-2 transition">Cancelar</button>
        <button
          onClick={submit}
          disabled={!title.trim() || loading}
          className="text-xs font-bold px-4 py-2 rounded-md transition disabled:opacity-40"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          {loading ? "Registrando…" : `Registrar ${cfg.label}`}
        </button>
      </div>
    </div>
  );
}
