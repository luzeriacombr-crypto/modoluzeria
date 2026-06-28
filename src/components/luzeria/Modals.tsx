import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Client } from "@/lib/luzeria/types";
import { useQuery } from "@tanstack/react-query";
import { profilesQO, useApi } from "@/lib/luzeria/queries";

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#1C1C1C] rounded-lg w-full max-w-md border border-white/10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white p-1 rounded hover:bg-white/5"><X size={16} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function NewClientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const { createClient } = useApi();
  useEffect(() => { if (open) setName(""); }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Novo cliente">
      <label className="block text-[10px] uppercase font-semibold tracking-wider text-white/40 mb-1.5">Nome</label>
      <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
        className="w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E]" />
      <div className="flex items-center justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-3 py-2 text-sm text-white/60 hover:text-white">Cancelar</button>
        <button disabled={!name.trim() || createClient.isPending}
          onClick={() => createClient.mutateAsync({ data: { name: name.trim() } }).then(onClose)}
          className="px-4 py-2 rounded-md text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}>
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
  const [responsible, setResponsible] = useState("");
  const [reviewDay, setReviewDay] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!client) return;
    setNiche(client.customFields.niche);
    setPostsPerWeek(client.customFields.postsPerWeek);
    setReelsPerWeek(client.customFields.reelsPerWeek);
    setResponsible(client.customFields.fixedResponsibleId ?? "");
    setReviewDay(client.customFields.reviewDay);
    setNotes(client.customFields.notes);
  }, [client]);

  if (!client) return null;

  function save() {
    updateClient.mutate({
      data: {
        id: client!.id,
        patch: {
          niche, posts_per_week: Number(postsPerWeek) || 0,
          reels_per_week: Number(reelsPerWeek) || 0,
          fixed_responsible_id: responsible || null,
          review_day: reviewDay, notes,
        },
      },
    });
    onClose();
  }

  return (
    <Modal open={!!client} onClose={onClose} title={`Campos · ${client.name}`}>
      <div className="space-y-3">
        <F label="Nicho"><input value={niche} onChange={(e) => setNiche(e.target.value)} className={inp} /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Posts/semana"><input type="number" value={postsPerWeek} onChange={(e) => setPostsPerWeek(+e.target.value)} className={inp} /></F>
          <F label="Reels/semana"><input type="number" value={reelsPerWeek} onChange={(e) => setReelsPerWeek(+e.target.value)} className={inp} /></F>
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
        <button onClick={onClose} className="px-3 py-2 text-sm text-white/60 hover:text-white">Cancelar</button>
        <button onClick={save} className="px-4 py-2 rounded-md text-sm font-bold transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}>Salvar</button>
      </div>
    </Modal>
  );
}

const inp = "w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E]";
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label className="block"><span className="block text-[10px] uppercase font-semibold tracking-wider text-white/40 mb-1.5">{label}</span>{children}</label>);
}