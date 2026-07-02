import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, MapPin, Link as LinkIcon, Calendar } from "lucide-react";
import { useApi } from "@/lib/luzeria/queries";
import { ContentRow } from "./ContentRow";
import type { ContentItem } from "@/lib/luzeria/types";
import type { Profile } from "@/lib/luzeria/types";

type ActivityType = "gravacao" | "roteiro" | "sistema" | "outros";

const ACTIVITY_CONFIG: Record<ActivityType, { label: string; hasLocation: boolean; dateLabel: string }> = {
  gravacao: { label: "Gravação",       hasLocation: true,  dateLabel: "Data para gravação" },
  roteiro:  { label: "Roteiro",        hasLocation: false, dateLabel: "Data de entrega" },
  sistema:  { label: "Sistema",        hasLocation: false, dateLabel: "Data de entrega" },
  outros:   { label: "Outro",          hasLocation: false, dateLabel: "Data de entrega" },
};

const ACTIVITY_ORDER: ActivityType[] = ["gravacao", "roteiro", "sistema", "outros"];

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
  const { addContentItem, deleteItem } = useApi();
  const [openForm, setOpenForm] = useState<ActivityType | null>(null);
  const [collapsed, setCollapsed] = useState<Record<ActivityType, boolean>>({
    gravacao: false, roteiro: false, sistema: false, outros: false,
  });

  const itemsMap: Record<ActivityType, ContentItem[]> = {
    gravacao: gravacoes,
    roteiro: roteiros,
    sistema: sistemas,
    outros,
  };

  const totalItems = gravacoes.length + roteiros.length + sistemas.length + outros.length;

  return (
    <div className="mt-4 space-y-6">
      {totalItems === 0 && !isAdmin && (
        <div className="py-14 text-center text-sm text-white/40">Nenhuma atividade registrada neste mês.</div>
      )}

      {ACTIVITY_ORDER.map((type) => {
        const cfg = ACTIVITY_CONFIG[type];
        const items = itemsMap[type];
        const isCollapsed = collapsed[type];
        const formOpen = openForm === type;

        return (
          <section key={type}>
            {/* Section header */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setCollapsed((p) => ({ ...p, [type]: !p[type] }))}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/50 hover:text-white transition"
              >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                {cfg.label}
                {items.length > 0 && (
                  <span className="ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(200,212,78,0.15)", color: "#C8D44E" }}>
                    {items.length}
                  </span>
                )}
              </button>
              <div className="flex-1 h-px bg-white/[0.06]" />
              {isAdmin && !formOpen && (
                <button
                  onClick={() => setOpenForm(type)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/50 hover:text-[#C8D44E] transition"
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
                onSubmit={async (vals) => {
                  await addContentItem.mutateAsync({ data: { clientId, key: monthKey, type, ...vals } });
                  setOpenForm(null);
                }}
                onCancel={() => setOpenForm(null)}
                loading={addContentItem.isPending}
              />
            )}

            {/* Items list */}
            {!isCollapsed && items.length > 0 && (
              <div className="space-y-0.5">
                {items.map((item, i) => (
                  <div key={item.id} className="group/row relative pr-12">
                    <ContentRow item={item} profiles={profiles} idx={i + 1} />
                    {isAdmin && (
                      <button
                        onClick={() => { if (confirm(`Excluir "${item.title}"?`)) deleteItem.mutate({ data: { id: item.id } }); }}
                        title="Excluir"
                        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!isCollapsed && items.length === 0 && !formOpen && isAdmin && (
              <div className="text-[12px] text-white/30 px-2 py-1">Nenhum(a) {cfg.label.toLowerCase()} registrado(a). Use "+ Registrar" para adicionar.</div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ActivityForm({
  type, cfg, onSubmit, onCancel, loading,
}: {
  type: ActivityType;
  cfg: { label: string; hasLocation: boolean; dateLabel: string };
  clientId: string;
  monthKey: string;
  onSubmit: (vals: { title: string; dueDate?: string; location?: string; notes?: string }) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
}) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const inp = "w-full bg-[#1A1A1A] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#C8D44E] transition-colors placeholder:text-white/30";

  async function submit() {
    if (!title.trim()) return;
    await onSubmit({
      title: title.trim(),
      dueDate: dueDate || undefined,
      location: cfg.hasLocation && location.trim() ? location.trim() : undefined,
      notes: notes.trim() || undefined,
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

      <div className={`grid gap-3 ${cfg.hasLocation ? "grid-cols-2" : "grid-cols-1"}`}>
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
          style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}
        >
          {loading ? "Registrando…" : `Registrar ${cfg.label}`}
        </button>
      </div>
    </div>
  );
}
