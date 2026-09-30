import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { Client } from "@/lib/luzeria/types";
import { useQuery } from "@tanstack/react-query";
import { profilesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { PRESET_COLORS } from "@/lib/luzeria/utils";
import { toast } from "sonner";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { isHouse, term } from "@/lib/luzeria/house";

export function Modal({ open, onClose, title, children, maxWidthClass = "max-w-md" }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; maxWidthClass?: string }) {
  if (!open) return null;
  // Portal to <body> — some callers (e.g. the header) render this inside an
  // ancestor with backdrop-filter, which creates a new containing block for
  // `fixed` descendants and traps the overlay inside that ancestor's box.
  return createPortal(
    <div className="lz-overlay z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-card rounded-2xl w-full ${maxWidthClass} border border-foreground/10 shadow-2xl lz-modal-in flex flex-col max-h-[85vh]`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/6 shrink-0">
          <h2 className="text-base font-semibold text-foreground tracking-tight">{title}</h2>
          <button onClick={onClose} className="lz-icon-btn h-7 w-7"><X size={16} /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function NewClientModal({ open, onClose, category }: { open: boolean; onClose: () => void; category?: string }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(PRESET_COLORS[0]);
  const [postsPerWeek, setPostsPerWeek] = useState("");
  const [reelsPerWeek, setReelsPerWeek] = useState("");
  const [storiesPerWeek, setStoriesPerWeek] = useState("");
  const { createClient, updateClient } = useApi();
  const me = useMe().data;
  useEffect(() => {
    if (open) {
      setName(""); setColor(PRESET_COLORS[0]);
      setPostsPerWeek(""); setReelsPerWeek(""); setStoriesPerWeek("");
    }
  }, [open]);
  const isAvulso = category === "Avulsos";
  const house = isHouse(me);

  async function handleCreate() {
    // House: marca além da principal entra na assinatura — avisa antes.
    if (house && !(await requestConfirm(`Cada marca além da principal soma R$ 79,90/mês à sua assinatura. Adicionar "${name.trim()}"?`))) return;
    let client: { id: string };
    try {
      client = await createClient.mutateAsync({ data: { name: name.trim(), category, color, icon: null } });
    } catch (e: any) {
      toastFriendlyError(e, `Não consegui criar ${term(me, "oCliente")}. Tenta de novo?`);
      return;
    }
    const patch: Record<string, any> = {};
    if (postsPerWeek.trim() !== "") patch.posts_per_week = Number(postsPerWeek) || 0;
    if (reelsPerWeek.trim() !== "") patch.reels_per_week = Number(reelsPerWeek) || 0;
    if (storiesPerWeek.trim() !== "") patch.stories_per_week = Number(storiesPerWeek) || 0;
    if (Object.keys(patch).length > 0) {
      await updateClient.mutateAsync({ data: { id: client.id, patch } }).catch(() => {});
    }
    if (Number(storiesPerWeek) === 0 && storiesPerWeek.trim() !== "") {
      const hide = await requestConfirm(`"${name.trim()}" não tem Stories. Ocultar a aba Stories pra ess${house ? "a marca" : "e cliente"}?`);
      if (hide) {
        const base = new Set(me?.disabledFeatures ?? []);
        base.add("stories");
        await updateClient.mutateAsync({ data: { id: client.id, patch: { hidden_tabs: [...base] } } }).catch(() => {});
      }
    }
    toast.success(`${term(me, "Cliente")} "${name.trim()}" criad${house ? "a" : "o"}.`);
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={isAvulso ? "Nova demanda avulsa" : term(me, "novoCliente")}>
      <label className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Nome</label>
      <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
        placeholder={isAvulso ? "Ex: João Silva, Empresa XYZ" : ""}
        className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))]" />

      <div className="mt-4">
        <div className="text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Cor</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className="h-6 w-6 rounded-full border-2 transition-transform hover:scale-110"
              style={{ backgroundColor: c, borderColor: color === c ? "rgb(var(--lz-brand-rgb))" : "transparent" }} />
          ))}
        </div>
      </div>

      {!isAvulso && (
        <div className="mt-4">
          <div className="text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Volume mensal (opcional)</div>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" min={0} value={postsPerWeek} onChange={(e) => setPostsPerWeek(e.target.value)} placeholder="Posts"
              className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))]" />
            <input type="number" min={0} value={reelsPerWeek} onChange={(e) => setReelsPerWeek(e.target.value)} placeholder="Reels"
              className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))]" />
            <input type="number" min={0} value={storiesPerWeek} onChange={(e) => setStoriesPerWeek(e.target.value)} placeholder="Stories"
              className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))]" />
          </div>
          <p className="text-[11px] text-foreground/40 mt-1.5">Vai direto pra ficha {term(me, "doCliente")}. Deixa em branco se ainda não sabe.</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-3 py-2 text-sm text-foreground/60 hover:text-foreground">Cancelar</button>
        <button disabled={!name.trim() || createClient.isPending || updateClient.isPending}
          onClick={handleCreate}
          className="px-4 py-2 rounded-md text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          Criar
        </button>
      </div>
    </Modal>
  );
}

export function CustomFieldsModal({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const { data: profiles = [] } = useQuery(profilesQO());
  const { updateClient } = useApi();
  const [niche, setNiche] = useState("");
  const [postsPerWeek, setPostsPerWeek] = useState(0);
  const [reelsPerWeek, setReelsPerWeek] = useState(0);
  const [storiesPerWeek, setStoriesPerWeek] = useState(0);
  const [responsible, setResponsible] = useState("");
  const [reviewDay, setReviewDay] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!client) return;
    setNiche(client.customFields.niche);
    setPostsPerWeek(client.customFields.postsPerWeek);
    setReelsPerWeek(client.customFields.reelsPerWeek);
    setStoriesPerWeek(client.customFields.storiesPerWeek);
    setResponsible(client.customFields.fixedResponsibleId ?? "");
    setReviewDay(client.customFields.reviewDay);
    setNotes(client.customFields.notes);
  }, [client]);

  if (!client) return null;

  function save() {
    // Fecha só depois de confirmar que salvou — antes o modal fechava
    // sempre, dando certo ou não, e a pessoa achava que tinha gravado.
    updateClient.mutate({
      data: {
        id: client!.id,
        patch: {
          niche, posts_per_week: Number(postsPerWeek) || 0,
          reels_per_week: Number(reelsPerWeek) || 0,
          stories_per_week: Number(storiesPerWeek) || 0,
          fixed_responsible_id: responsible || null,
          review_day: reviewDay, notes,
        },
      },
    }, {
      // Erro é tratado no useApi().updateClient (queries.ts) — não duplicar aqui.
      onSuccess: () => { toast.success("Campos salvos."); onClose(); },
    });
  }

  return (
    <Modal open={!!client} onClose={onClose} title={`Campos · ${client.name}`}>
      <div className="space-y-3">
        <F label="Nicho"><input value={niche} onChange={(e) => setNiche(e.target.value)} className={inp} /></F>
        <div className="grid grid-cols-3 gap-3">
          <F label="Posts / mês"><input type="number" value={postsPerWeek} onChange={(e) => setPostsPerWeek(+e.target.value)} className={inp} /></F>
          <F label="Reels / mês"><input type="number" value={reelsPerWeek} onChange={(e) => setReelsPerWeek(+e.target.value)} className={inp} /></F>
          <F label="Stories / mês"><input type="number" value={storiesPerWeek} onChange={(e) => setStoriesPerWeek(+e.target.value)} className={inp} /></F>
        </div>
        <F label="Responsável fixo">
          <select value={responsible} onChange={(e) => setResponsible(e.target.value)} className={inp}>
            <option value="">—</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </F>
        <F label="Dia preferencial de revisão"><input value={reviewDay} onChange={(e) => setReviewDay(e.target.value)} className={inp} placeholder="Ex: Toda sexta" /></F>
        <F label="Observações"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inp + " resize-none"} /></F>
      </div>
      <div className="flex items-center justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-3 py-2 text-sm text-foreground/60 hover:text-foreground">Cancelar</button>
        <button onClick={save} disabled={updateClient.isPending}
          className="px-4 py-2 rounded-md text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          {updateClient.isPending ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

const inp = "w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))]";
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label className="block"><span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">{label}</span>{children}</label>);
}