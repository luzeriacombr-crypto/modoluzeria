import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { clientsQO, monthKeysQO, monthQO, profilesQO, useApi } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { Avatar } from "./Avatar";
import { ContentRow } from "./ContentRow";
import { formatMonth } from "@/lib/luzeria/utils";
import { useMe } from "@/lib/luzeria/queries";

export function ClientView({ clientId }: { clientId: string }) {
  const { data: clients = [] } = useQuery(clientsQO());
  const client = clients.find((c) => c.id === clientId);
  const { data: profiles = [] } = useQuery(profilesQO());
  const { selectedMonthKey, selectMonth } = useUI();
  const { data: month } = useQuery(monthQO(clientId, selectedMonthKey));
  const { data: monthKeys = [] } = useQuery(monthKeysQO(clientId));
  const [tab, setTab] = useState<"posts" | "reels" | "outros" | "profile">("posts");
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const { duplicateMonth, updateClient, addContentItem, deleteItem } = useApi();

  if (!client) return null;
  const isAvulso = client.category === "Avulsos";
  const tabs = isAvulso
    ? (["posts", "reels", "outros"] as const)
    : (["posts", "reels", "profile"] as const);

  const sortedKeys = [...new Set([...monthKeys, selectedMonthKey])].sort();
  const idx = sortedKeys.indexOf(selectedMonthKey);

  function go(delta: number) {
    const nextIdx = idx + delta;
    if (nextIdx >= 0 && nextIdx < sortedKeys.length) selectMonth(sortedKeys[nextIdx]);
  }

  return (
    <div className="px-10 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Avatar name={client.name} color={client.color} size={40} />
        <div>
          <h1 className="text-[24px] font-bold text-white leading-tight">{client.name}</h1>
          {client.customFields.niche && (
            <div className="text-[13px] font-semibold mt-0.5" style={{ color: "#C8D44E" }}>{client.customFields.niche}</div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!isAvulso && <button onClick={() => go(-1)} disabled={idx <= 0}
            className="h-8 w-8 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 transition">
            <ChevronLeft size={16} />
          </button>}
          {isAvulso ? (
            <span className="rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: "rgba(200,212,78,0.15)", color: "#C8D44E", border: "1px solid rgba(200,212,78,0.3)" }}>
              Avulso
            </span>
          ) : (
            <span className="rounded-md px-3 py-1 text-xs font-bold uppercase" style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}>
              {formatMonth(selectedMonthKey)}
            </span>
          )}
          {!isAvulso && <button onClick={() => go(1)} disabled={idx >= sortedKeys.length - 1}
            className="h-8 w-8 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 transition">
            <ChevronRight size={16} />
          </button>}
          {isAdmin && !isAvulso && (
            <button onClick={() => duplicateMonth.mutate({ data: { clientId, fromKey: selectedMonthKey } })}
              className="inline-flex items-center gap-1.5 ml-2 rounded-md px-3 py-1.5 text-xs font-semibold text-white/80 border border-white/10 hover:border-[#C8D44E] hover:text-[#C8D44E] transition">
              <Copy size={13} /> Duplicar mês
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 mt-8 border-b border-white/[0.06]">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="relative py-3 text-sm font-semibold transition-colors"
            style={{ color: tab === t ? "#FFFFFF" : "rgba(255,255,255,0.5)" }}>
            {t === "posts" ? "Posts" : t === "reels" ? "Reels" : t === "outros" ? "Outros" : "Perfil do Cliente"}
            {tab === t && <span className="absolute left-0 right-0 bottom-[-1px] h-[2px]" style={{ backgroundColor: "#C8D44E" }} />}
          </button>
        ))}
      </div>

      <div className="mt-2">
        {(tab === "posts" || tab === "reels" || tab === "outros") && (
          <>
            {(tab === "posts" ? (month?.posts ?? []) : tab === "reels" ? (month?.reels ?? []) : (month?.outros ?? []))
              .map((item, i) => (
                <div key={item.id} className="group/row relative">
                  <ContentRow item={item} profiles={profiles} idx={i + 1} />
                  {isAdmin && (
                    <button
                      onClick={() => { if (confirm(`Excluir "${item.title}"?`)) deleteItem.mutate({ data: { id: item.id } }); }}
                      title="Excluir item"
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            {isAdmin && (
              <button
                onClick={() => addContentItem.mutate({
                  data: { clientId, key: selectedMonthKey, type: tab === "posts" ? "post" : tab === "reels" ? "reel" : "outros" },
                })}
                className="mt-4 ml-4 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold border border-dashed border-white/15 text-white/60 hover:text-[#C8D44E] hover:border-[#C8D44E] transition">
                <Plus size={13} /> Adicionar {tab === "posts" ? "Post" : tab === "reels" ? "Reel" : "item"}
              </button>
            )}
            {isAvulso && (tab === "posts" ? month?.posts : tab === "reels" ? month?.reels : month?.outros)?.length === 0 && !isAdmin && (
              <div className="px-4 py-10 text-center text-sm text-white/40">Sem itens nesta aba.</div>
            )}
          </>
        )}
        {tab === "profile" && <ProfileTab client={client} profiles={profiles} canEdit={isAdmin}
          onSave={(patch: Record<string, any>) => updateClient.mutate({ data: { id: client.id, patch } })} />}
      </div>
    </div>
  );
}

function ProfileTab({ client, profiles, canEdit, onSave }: any) {
  const [niche, setNiche] = useState(client.customFields.niche);
  const [postsPerWeek, setPostsPerWeek] = useState(client.customFields.postsPerWeek);
  const [reelsPerWeek, setReelsPerWeek] = useState(client.customFields.reelsPerWeek);
  const [responsible, setResponsible] = useState(client.customFields.fixedResponsibleId ?? "");
  const [reviewDay, setReviewDay] = useState(client.customFields.reviewDay);
  const [notes, setNotes] = useState(client.customFields.notes);

  function save() {
    onSave({
      niche, posts_per_week: Number(postsPerWeek) || 0,
      reels_per_week: Number(reelsPerWeek) || 0,
      fixed_responsible_id: responsible || null,
      review_day: reviewDay, notes,
    });
  }

  return (
    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
      <Field label="Nicho"><input value={niche} disabled={!canEdit} onChange={(e) => setNiche(e.target.value)} className={inp} /></Field>
      <Field label="Dia de revisão"><input value={reviewDay} disabled={!canEdit} onChange={(e) => setReviewDay(e.target.value)} className={inp} /></Field>
      <Field label="Posts / semana"><input type="number" value={postsPerWeek} disabled={!canEdit} onChange={(e) => setPostsPerWeek(e.target.value as any)} className={inp} /></Field>
      <Field label="Reels / semana"><input type="number" value={reelsPerWeek} disabled={!canEdit} onChange={(e) => setReelsPerWeek(e.target.value as any)} className={inp} /></Field>
      <Field label="Responsável fixo">
        <select value={responsible} disabled={!canEdit} onChange={(e) => setResponsible(e.target.value)} className={inp}>
          <option value="">—</option>
          {profiles.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Observações">
          <textarea value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} rows={4} className={inp + " resize-none"} />
        </Field>
      </div>
      {canEdit && (
        <div className="md:col-span-2">
          <button onClick={save} className="rounded-md px-4 py-2 text-sm font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}>Salvar</button>
        </div>
      )}
    </div>
  );
}

const inp = "w-full bg-[#1C1C1C] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E] transition-colors disabled:opacity-60";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase font-semibold tracking-wider text-white/40 mb-1.5">{label}</span>
      {children}
    </label>
  );
}