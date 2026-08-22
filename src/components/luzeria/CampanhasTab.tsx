import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ChevronLeft, Megaphone, Eye, EyeOff, X } from "lucide-react";
import { campaignsQO, campaignItemsQO, useApi } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { CONTENT_TYPE_LABEL, type ContentType } from "@/lib/luzeria/types";
import type { Campaign } from "@/lib/luzeria/campaigns.functions";

const ITEM_TYPES: ContentType[] = ["post", "reel", "story", "outros", "gravacao", "roteiro", "sistema"];
const inp = "w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))]";

export function CampanhasTab({ clientId, monthKey, isAdmin }: { clientId: string; monthKey: string; isAdmin: boolean }) {
  const { data: campaigns = [] } = useQuery(campaignsQO(clientId));
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<{ id: string; name: string; description: string } | null>(null);
  const api = useApi();

  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId) ?? null;

  if (activeCampaign) {
    return (
      <CampaignDetail campaign={activeCampaign} clientId={clientId} monthKey={monthKey} isAdmin={isAdmin}
        onBack={() => setActiveCampaignId(null)} />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs text-white/40">Agrupe posts, reels e materiais numa campanha (ex: "Aniversário da loja").</p>
        {isAdmin && !creating && (
          <button onClick={() => setCreating(true)} className="shrink-0 lz-btn-primary text-xs px-3 py-2 rounded-md inline-flex items-center gap-1.5">
            <Plus size={13} /> Nova campanha
          </button>
        )}
      </div>
      {creating && (
        <div className="mb-4">
          <CampaignForm onCancel={() => setCreating(false)}
            onSave={(vals) => { api.upsertCampaign.mutate({ data: { clientId, ...vals } }); setCreating(false); }} />
        </div>
      )}
      {campaigns.length === 0 && !creating ? (
        <div className="border border-dashed border-white/10 rounded-lg p-10 text-center text-white/30 text-sm">
          Nenhuma campanha criada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {campaigns.map((c) => (
            editingCampaign?.id === c.id ? (
              <CampaignForm key={c.id}
                initial={{ name: editingCampaign.name, description: editingCampaign.description }}
                onCancel={() => setEditingCampaign(null)}
                onSave={(vals) => { api.upsertCampaign.mutate({ data: { id: c.id, clientId, ...vals } }); setEditingCampaign(null); }} />
            ) : (
              <div key={c.id}
                onClick={() => setActiveCampaignId(c.id)}
                className="rounded-lg p-4 text-left cursor-pointer transition-colors hover:border-white/15"
                style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Megaphone size={15} className="text-[rgb(var(--lz-brand-rgb))] shrink-0" />
                    <span className="text-sm font-semibold text-white truncate">{c.name}</span>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span onClick={(e) => { e.stopPropagation(); setEditingCampaign({ id: c.id, name: c.name, description: c.description ?? "" }); }}
                        className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5"><Pencil size={12} /></span>
                      <span
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (await requestConfirm(`Excluir a campanha "${c.name}"? Os itens continuam existindo, só perdem a etiqueta.`, { danger: true })) {
                            api.deleteCampaign.mutate({ data: { id: c.id } });
                          }
                        }}
                        className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/5"
                      ><Trash2 size={12} /></span>
                    </div>
                  )}
                </div>
                {c.description && <p className="text-[11px] text-white/40 mt-1.5 line-clamp-2">{c.description}</p>}
                <div className="text-[10px] text-white/30 mt-2">{c.itemCount} ite{c.itemCount === 1 ? "m" : "ns"}</div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignForm({ initial, onCancel, onSave }: {
  initial?: { name: string; description: string };
  onCancel: () => void;
  onSave: (vals: { name: string; description: string | null }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  return (
    <div className="rounded-lg p-4 space-y-2.5" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" }}>
      <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Nome da campanha (ex: Aniversário da loja)" className={inp} />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Descrição (opcional)" className={inp + " resize-none"} />
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="text-xs text-white/50 hover:text-white px-3 py-2">Cancelar</button>
        <button
          disabled={!name.trim()}
          onClick={() => onSave({ name: name.trim(), description: description.trim() || null })}
          className="lz-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-40"
        >Salvar</button>
      </div>
    </div>
  );
}

function CampaignDetail({ campaign, clientId, monthKey, isAdmin, onBack }: {
  campaign: Campaign; clientId: string; monthKey: string; isAdmin: boolean; onBack: () => void;
}) {
  const { data: items = [] } = useQuery(campaignItemsQO(campaign.id));
  const { selectMonth, openItem } = useUI();
  const { addContentItem, setItemCampaign } = useApi();
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<ContentType>("post");
  const [newTitle, setNewTitle] = useState("");
  const [newInternal, setNewInternal] = useState(false);

  function openCampaignItem(it: { id: string; monthKey: string | null }) {
    if (it.monthKey) selectMonth(it.monthKey);
    openItem(it.id);
  }

  function createItem() {
    addContentItem.mutate({
      data: { clientId, key: monthKey, type: newType, title: newTitle.trim() || undefined, campaignId: campaign.id, campaignInternal: newInternal },
    });
    setNewTitle(""); setNewInternal(false); setAdding(false);
  }

  return (
    <div>
      <button onClick={onBack} className="text-xs text-white/50 hover:text-white inline-flex items-center gap-1 mb-4">
        <ChevronLeft size={13} /> Campanhas
      </button>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white truncate">{campaign.name}</h3>
          {campaign.description && <p className="text-xs text-white/40 mt-0.5">{campaign.description}</p>}
        </div>
        {isAdmin && !adding && (
          <button onClick={() => setAdding(true)} className="shrink-0 lz-btn-primary text-xs px-3 py-2 rounded-md inline-flex items-center gap-1.5">
            <Plus size={13} /> Adicionar item
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-lg p-4 mb-4 space-y-3" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="grid grid-cols-2 gap-3">
            <select value={newType} onChange={(e) => setNewType(e.target.value as ContentType)} className={inp}>
              {ITEM_TYPES.map((t) => <option key={t} value={t}>{CONTENT_TYPE_LABEL[t]}</option>)}
            </select>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Título (opcional)" className={inp} />
          </div>
          <label className="flex items-center gap-2 text-xs text-white/70">
            <input type="checkbox" checked={newInternal} onChange={(e) => setNewInternal(e.target.checked)} />
            Interno — não aparece em Posts/Reels/Preview de Feed, só aqui na campanha
          </label>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-xs text-white/50 hover:text-white px-3 py-2">Cancelar</button>
            <button onClick={createItem} className="lz-btn-primary text-xs px-4 py-2 rounded-md">Adicionar</button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-lg p-8 text-center text-white/30 text-sm">Nenhum item nessa campanha ainda.</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 rounded-md px-3 py-2.5" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.06)" }}>
              <button onClick={() => openCampaignItem(it)} className="flex-1 min-w-0 flex items-center gap-2 text-left hover:opacity-80 transition">
                <span className="text-[10px] font-bold uppercase text-white/40 shrink-0">{CONTENT_TYPE_LABEL[it.type]}</span>
                <span className="text-sm text-white truncate">{it.title}</span>
              </button>
              <span
                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
                style={it.campaignInternal
                  ? { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }
                  : { background: "rgba(91,168,138,0.15)", color: "#5BA88A" }}
              >
                {it.campaignInternal ? "Interno" : "Público"}
              </span>
              {isAdmin && (
                <>
                  <button
                    onClick={() => setItemCampaign.mutate({ data: { itemId: it.id, campaignId: campaign.id, campaignInternal: !it.campaignInternal } })}
                    title={it.campaignInternal ? "Tornar público (aparece em Posts/Reels/Feed)" : "Tornar interno (some de Posts/Reels/Feed)"}
                    className="p-1.5 rounded text-white/40 hover:text-white hover:bg-white/5 shrink-0"
                  >
                    {it.campaignInternal ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button
                    onClick={() => setItemCampaign.mutate({ data: { itemId: it.id, campaignId: null } })}
                    title="Remover da campanha"
                    className="p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-white/5 shrink-0"
                  ><X size={13} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
