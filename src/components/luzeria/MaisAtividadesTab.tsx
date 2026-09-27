import { useState } from "react";
import { Plus, Trash2, Pencil, ChevronDown, ChevronRight, MapPin, Link as LinkIcon, Calendar, User, Hash, Check, Clock, FolderInput, CheckSquare, X, Tags, Video, FileText, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { useApi } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { ACTIVITY_QUANTITY_LABEL, type ContentItem, type ContentType, type Profile } from "@/lib/luzeria/types";
import { MoveItemModal, BulkMoveModal, BulkStatusModal } from "./ClientView";
import { AvatarStack } from "./Avatar";

type ActivityType = "gravacao" | "roteiro" | "sistema" | "outros";

const ACTIVITY_CONFIG: Record<ActivityType, { label: string; gender: "f" | "m"; hasLocation: boolean; dateLabel: string; quantityLabel: string | null }> = {
  gravacao: { label: "Gravação",       gender: "f", hasLocation: true,  dateLabel: "Data para gravação", quantityLabel: ACTIVITY_QUANTITY_LABEL.gravacao },
  roteiro:  { label: "Roteiro",        gender: "m", hasLocation: false, dateLabel: "Data de entrega",    quantityLabel: ACTIVITY_QUANTITY_LABEL.roteiro },
  sistema:  { label: "Sistema",        gender: "m", hasLocation: false, dateLabel: "Data de entrega",    quantityLabel: ACTIVITY_QUANTITY_LABEL.sistema },
  outros:   { label: "Outro",          gender: "m", hasLocation: false, dateLabel: "Data de entrega",    quantityLabel: ACTIVITY_QUANTITY_LABEL.outros },
};

// Gravação e Roteiro têm seção própria — entram na contagem do relatório de
// atividades com o tipo certo. Sistema e Outros viram uma única seção
// "Outras atividades": itens antigos desses 2 tipos continuam aparecendo
// juntos ali, e todo registro novo feito nessa seção passa a entrar como
// "outros".
type GroupKey = "gravacao" | "roteiro" | "outras";

interface Props {
  clientId: string;
  monthKey: string;
  gravacoes: ContentItem[];
  roteiros: ContentItem[];
  sistemas: ContentItem[];
  outros: ContentItem[];
  profiles: Profile[];
  isAdmin: boolean;
  isAvulso: boolean;
}

export function MaisAtividadesTab({ clientId, monthKey, gravacoes, roteiros, sistemas, outros, profiles, isAdmin, isAvulso }: Props) {
  const { addContentItem, addAssignee, deleteItem, deleteContentItems, setItemStatus, moveItemToMonth, moveContentItemsToMonth, setContentItemsStatus } = useApi();
  const { openItem } = useUI();
  const [openForm, setOpenForm] = useState<GroupKey | null>(null);
  const [movingItem, setMovingItem] = useState<ContentItem | null>(null);
  const [collapsed, setCollapsed] = useState<Record<GroupKey, boolean>>({
    gravacao: false, roteiro: false, outras: false,
  });
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [bulkStatusType, setBulkStatusType] = useState<ContentType | null>(null);

  const groups: { key: GroupKey; label: string; ctaLabel: string; icon: typeof Video; cfg: typeof ACTIVITY_CONFIG[ActivityType]; items: ContentItem[]; registerType: ActivityType }[] = [
    { key: "gravacao", label: ACTIVITY_CONFIG.gravacao.label, ctaLabel: "Registrar nova gravação", icon: Video, cfg: ACTIVITY_CONFIG.gravacao, items: gravacoes, registerType: "gravacao" },
    { key: "roteiro", label: ACTIVITY_CONFIG.roteiro.label, ctaLabel: "Registrar criação de roteiro", icon: ScrollText, cfg: ACTIVITY_CONFIG.roteiro, items: roteiros, registerType: "roteiro" },
    { key: "outras", label: "Outras atividades", ctaLabel: "Registrar nova atividade", icon: FileText, cfg: ACTIVITY_CONFIG.outros, items: [...sistemas, ...outros], registerType: "outros" },
  ];
  const allItems = [...gravacoes, ...roteiros, ...sistemas, ...outros];
  const allSelected = allItems.length > 0 && allItems.every((it) => selectedIds.has(it.id));

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkMoveOpen(false);
    setBulkStatusType(null);
  }
  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (!(await requestConfirm(`Excluir ${selectedIds.size} ${selectedIds.size === 1 ? "item" : "itens"} selecionado${selectedIds.size === 1 ? "" : "s"}?`, { danger: true }))) return;
    deleteContentItems.mutate({ data: { ids: [...selectedIds] } }, { onSuccess: exitSelectMode });
  }

  const totalItems = gravacoes.length + roteiros.length + sistemas.length + outros.length;

  return (
    <div className="mt-4 space-y-6">
      {totalItems === 0 && !isAdmin && (
        <div className="py-14 text-center text-sm text-foreground/40">Nenhuma atividade registrada neste mês.</div>
      )}

      {isAdmin && totalItems > 0 && (
        selectMode ? (
          <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2" style={{ background: "rgba(var(--lz-brand-rgb),0.1)", border: "1px solid rgba(var(--lz-brand-rgb),0.3)" }}>
            <span className="text-xs font-semibold text-foreground">
              {selectedIds.size === 0 ? "Selecione os itens" : `${selectedIds.size} selecionado${selectedIds.size === 1 ? "" : "s"}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds(allSelected ? new Set() : new Set(allItems.map((it) => it.id)))}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition"
              >
                <CheckSquare size={13} /> {allSelected ? "Limpar seleção" : "Selecionar tudo"}
              </button>
              <button
                onClick={() => setBulkMoveOpen(true)}
                disabled={selectedIds.size === 0}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 transition"
              >
                <FolderInput size={13} /> Mover
              </button>
              <button
                onClick={() => setBulkStatusType(allItems.find((it) => selectedIds.has(it.id))?.type ?? null)}
                disabled={selectedIds.size === 0}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 transition"
              >
                <Tags size={13} /> Alterar status
              </button>
              <button
                onClick={bulkDelete}
                disabled={selectedIds.size === 0 || deleteContentItems.isPending}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition"
              >
                <Trash2 size={13} /> Excluir selecionados
              </button>
              <button onClick={exitSelectMode} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition">
                <X size={13} /> Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end -mb-2">
            <button
              onClick={() => setSelectMode(true)}
              title="Selecionar vários"
              className="h-6 w-6 rounded-full flex items-center justify-center transition-colors text-foreground/50 hover:text-foreground hover:bg-foreground/[0.08]"
            ><CheckSquare size={13} /></button>
          </div>
        )
      )}

      {isAdmin && (
        <div className="flex flex-col sm:flex-row gap-2">
          {groups.map((g) => {
            const Icon = g.icon;
            const active = openForm === g.key;
            return (
              <button
                key={g.key}
                onClick={() => {
                  setCollapsed((p) => ({ ...p, [g.key]: false }));
                  setOpenForm((prev) => (prev === g.key ? null : g.key));
                }}
                className="lz-btn-primary text-xs px-4 py-2.5 rounded-md inline-flex items-center justify-center gap-1.5 sm:flex-1"
                style={active ? { outline: "2px solid #0D0D0D", outlineOffset: "-3px" } : undefined}
              >
                <Icon size={13} /> {g.ctaLabel}
              </button>
            );
          })}
        </div>
      )}

      {groups.map((group) => {
        const { key, label, icon: TypeIcon, cfg, items, registerType } = group;
        const type = registerType;
        const isCollapsed = collapsed[key];
        const formOpen = openForm === key;

        return (
          <section key={key}>
            {/* Section header */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setCollapsed((p) => ({ ...p, [key]: !p[key] }))}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground/50 hover:text-foreground transition"
              >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                {label}
                {items.length > 0 && (
                  <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
                    {items.length}
                  </span>
                )}
              </button>
              <div className="flex-1 h-px bg-foreground/[0.06]" />
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
                    // "Outras atividades" (o rótulo do grupo) é plural feminino;
                    // gravação/roteiro têm concordância própria via cfg.gender.
                    const participle = key === "outras" ? "registrada" : cfg.gender === "f" ? "registrada" : "registrado";
                    toast.success(`${label} ${participle} com sucesso`);
                    setOpenForm(null);
                  } catch (e: any) {
                    toastFriendlyError(e, "Erro ao registrar. Tente novamente.");
                  }
                }}
                onCancel={() => setOpenForm(null)}
                loading={addContentItem.isPending || addAssignee.isPending || setItemStatus.isPending}
              />
            )}

            {/* Items list */}
            {!isCollapsed && items.length > 0 && (
              <div className="space-y-2">
                {items.map((item) => {
                  const assignees = item.assigneeIds
                    .map((id) => profiles.find((p) => p.id === id))
                    .filter(Boolean) as Profile[];
                  const done = item.status === "CONCLUIDO";
                  return (
                    <div
                      key={item.id}
                      className="group/row flex items-center gap-3 rounded-xl border border-foreground/8 bg-card p-3 hover:-translate-y-0.5 hover:shadow-lg hover:border-foreground/15 transition-all duration-200 cursor-pointer"
                      onClick={() => (selectMode ? toggleSelected(item.id) : openItem(item.id))}
                    >
                      {selectMode ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelected(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 shrink-0 accent-[rgb(var(--lz-brand-rgb))]"
                        />
                      ) : (
                        <div
                          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                          style={type === "gravacao"
                            ? { backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }
                            : { backgroundColor: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 45%, transparent)" }}
                        >
                          <TypeIcon size={17} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{item.title}</div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                          {item.dueDate && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-foreground/40">
                              <Calendar size={11} /> {new Date(item.dueDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                            </span>
                          )}
                          {item.location && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-foreground/40">
                              <MapPin size={11} /> {item.location}
                            </span>
                          )}
                          {typeof item.activityQuantity === "number" && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-foreground/40">
                              <Hash size={11} /> {item.activityQuantity}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: done ? "var(--status-concluido-bg)" : "var(--status-pendente-bg)", color: done ? "var(--status-concluido-color)" : "var(--status-pendente-color)" }}
                        >
                          {done ? <Check size={10} /> : <Clock size={10} />} {done ? "Concluído" : "Pendente"}
                        </span>
                        {assignees.length > 0 && <AvatarStack profiles={assignees} size={22} />}
                      </div>
                      {!selectMode && (
                        <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => openItem(item.id)} title="Editar" className="p-1.5 rounded text-foreground/40 hover:text-[var(--lz-accent-ink)] hover:bg-foreground/5 transition">
                            <Pencil size={13} />
                          </button>
                          {isAdmin && !isAvulso && (
                            <button onClick={() => setMovingItem(item)} title="Mover para outro mês" className="p-1.5 rounded text-foreground/40 hover:text-[var(--lz-accent-ink)] hover:bg-foreground/5 transition">
                              <FolderInput size={13} />
                            </button>
                          )}
                          {isAdmin && (
                            <button onClick={async () => { if (await requestConfirm(`Excluir "${item.title}"?`, { danger: true })) deleteItem.mutate({ data: { id: item.id } }); }} title="Excluir" className="p-1.5 rounded text-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!isCollapsed && items.length === 0 && !formOpen && isAdmin && (
              <div className="border border-dashed border-foreground/10 rounded-xl p-6 text-center">
                <div
                  className="mx-auto mb-2 h-10 w-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 45%, transparent)" }}
                >
                  <TypeIcon size={18} />
                </div>
                <p className="text-sm text-foreground/40">Nenhum(a) {label.toLowerCase()} registrado(a) ainda.</p>
              </div>
            )}
          </section>
        );
      })}

      {movingItem && (
        <MoveItemModal
          item={movingItem}
          clientId={clientId}
          currentKey={monthKey}
          onClose={() => setMovingItem(null)}
          onMove={(targetKey) => {
            moveItemToMonth.mutate({ data: { itemId: movingItem.id, targetKey } });
            setMovingItem(null);
          }}
        />
      )}
      {bulkMoveOpen && (
        <BulkMoveModal
          count={selectedIds.size}
          clientId={clientId}
          currentKey={monthKey}
          onClose={() => setBulkMoveOpen(false)}
          onMove={(targetKey) => {
            moveContentItemsToMonth.mutate(
              { data: { itemIds: [...selectedIds], targetKey } },
              { onSuccess: exitSelectMode },
            );
            setBulkMoveOpen(false);
          }}
        />
      )}
      {bulkStatusType && (
        <BulkStatusModal
          type={bulkStatusType}
          count={selectedIds.size}
          isAvulso={isAvulso}
          onClose={() => setBulkStatusType(null)}
          onApply={(status) => {
            setContentItemsStatus.mutate(
              { data: { itemIds: [...selectedIds], status } },
              { onSuccess: exitSelectMode },
            );
            setBulkStatusType(null);
          }}
        />
      )}
    </div>
  );
}

function ActivityForm({
  type, cfg, profiles, onSubmit, onCancel, loading,
}: {
  type: ActivityType;
  cfg: { label: string; gender: "f" | "m"; hasLocation: boolean; dateLabel: string; quantityLabel: string | null };
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

  const inp = "w-full bg-card border border-foreground/8 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition-colors placeholder:text-foreground/30";

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
    <div className="mb-4 rounded-lg border border-foreground/8 p-4 space-y-3" style={{ background: "var(--card)" }}>
      <div className="text-xs font-bold uppercase tracking-wider text-foreground/50 mb-1">{cfg.gender === "f" ? "Nova" : "Novo"} {cfg.label}</div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={`Título (ex: ${cfg.label} de março)`}
        className={inp}
        autoFocus
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-foreground/40 mb-1">
            <Calendar size={11} /> {cfg.dateLabel}
          </label>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inp} />
        </div>
        {cfg.hasLocation && (
          <div>
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-foreground/40 mb-1">
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
            <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-foreground/40 mb-1">
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
        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-foreground/40 mb-1">
          Status
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatus("PENDENTE")}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              backgroundColor: status === "PENDENTE" ? "color-mix(in srgb, var(--foreground) 12%, transparent)" : "color-mix(in srgb, var(--foreground) 5%, transparent)",
              color: status === "PENDENTE" ? "#FFFFFF" : "color-mix(in srgb, var(--foreground) 50%, transparent)",
            }}
          >
            <Clock size={12} /> Pendente
          </button>
          <button
            type="button"
            onClick={() => setStatus("CONCLUIDO")}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{
              backgroundColor: status === "CONCLUIDO" ? "rgba(var(--lz-brand-light-rgb),0.18)" : "color-mix(in srgb, var(--foreground) 5%, transparent)",
              color: status === "CONCLUIDO" ? "var(--lz-accent-ink)" : "color-mix(in srgb, var(--foreground) 50%, transparent)",
            }}
          >
            <Check size={12} /> Concluído
          </button>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-foreground/40 mb-1">
          <User size={11} /> Responsáveis {assigneeIds.length > 1 && <span className="text-foreground/30 normal-case">(quando mais de uma pessoa participa, a hora de todas conta na margem do cliente)</span>}
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
                  backgroundColor: checked ? "rgba(var(--lz-brand-light-rgb),0.15)" : "color-mix(in srgb, var(--foreground) 5%, transparent)",
                  borderColor: checked ? "rgb(var(--lz-brand-rgb))" : "transparent",
                  color: checked ? "var(--lz-accent-ink)" : "color-mix(in srgb, var(--foreground) 60%, transparent)",
                }}
              >
                {checked ? <Check size={12} /> : <span className="w-3" />} {p.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-foreground/40 mb-1">
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
        <button onClick={onCancel} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2 transition">Cancelar</button>
        <button
          onClick={submit}
          disabled={!title.trim() || loading}
          className="lz-btn-primary text-xs px-4 py-2.5 rounded-md disabled:opacity-40"
        >
          {loading ? "Registrando…" : `Registrar ${cfg.label}`}
        </button>
      </div>
    </div>
  );
}
