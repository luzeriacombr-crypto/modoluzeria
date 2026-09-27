import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ChevronLeft, Megaphone, Eye, EyeOff, X, Share2, Copy, Check, RefreshCw, UserPlus } from "lucide-react";
import { campaignsQO, campaignItemsQO, clientsQO, useApi } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { CONTENT_TYPE_LABEL, type ContentType } from "@/lib/luzeria/types";
import type { Campaign } from "@/lib/luzeria/campaigns.functions";

const PUBLIC_BASE = import.meta.env.VITE_APP_URL ?? "https://www.modocriador.com.br";

const ITEM_TYPES: ContentType[] = ["post", "reel", "story", "outros", "gravacao", "roteiro", "sistema"];
const inp = "w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";
const label = "block text-[10px] font-bold uppercase tracking-wider text-foreground/40 mb-1";

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function CampanhasTab({ clientId, monthKey, isAdmin }: { clientId: string; monthKey: string; isAdmin: boolean }) {
  const { data: campaigns = [] } = useQuery(campaignsQO(clientId));
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<{ id: string; name: string; description: string; briefing: string; materials: string; services: string; valueCents: number | null } | null>(null);
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
        <p className="text-xs text-foreground/40">Agrupe posts, reels e materiais numa campanha (ex: "Aniversário da loja").</p>
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
        <div className="border border-dashed border-foreground/10 rounded-lg p-10 text-center text-foreground/30 text-sm">
          Nenhuma campanha criada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {campaigns.map((c) => (
            editingCampaign?.id === c.id ? (
              <CampaignForm key={c.id}
                initial={editingCampaign}
                onCancel={() => setEditingCampaign(null)}
                onSave={(vals) => { api.upsertCampaign.mutate({ data: { id: c.id, clientId, ...vals } }); setEditingCampaign(null); }} />
            ) : (
              <div key={c.id}
                onClick={() => setActiveCampaignId(c.id)}
                className="rounded-lg p-4 text-left cursor-pointer transition-colors hover:border-foreground/15"
                style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Megaphone size={15} className="text-[var(--lz-accent-ink)] shrink-0" />
                    <span className="text-sm font-semibold text-foreground truncate">{c.name}</span>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span onClick={(e) => { e.stopPropagation(); setEditingCampaign({ id: c.id, name: c.name, description: c.description ?? "", briefing: c.briefing ?? "", materials: c.materials ?? "", services: c.services ?? "", valueCents: c.valueCents }); }}
                        className="p-1 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5"><Pencil size={12} /></span>
                      <span
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (await requestConfirm(`Excluir a campanha "${c.name}"? Os itens continuam existindo, só perdem a etiqueta.`, { danger: true })) {
                            api.deleteCampaign.mutate({ data: { id: c.id } });
                          }
                        }}
                        className="p-1 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5"
                      ><Trash2 size={12} /></span>
                    </div>
                  )}
                </div>
                {c.description && <p className="text-[11px] text-foreground/40 mt-1.5 line-clamp-2">{c.description}</p>}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-foreground/30">{c.itemCount} ite{c.itemCount === 1 ? "m" : "ns"}</span>
                  {c.valueCents != null && (
                    <span className="text-[11px] font-semibold" style={{ color: "var(--lz-accent-ink)" }}>{fmtBRL(c.valueCents)}</span>
                  )}
                </div>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignForm({ initial, onCancel, onSave }: {
  initial?: { name: string; description: string; briefing: string; materials: string; services: string; valueCents: number | null };
  onCancel: () => void;
  onSave: (vals: { name: string; description: string | null; briefing: string | null; materials: string | null; services: string | null; valueCents: number | null }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [briefing, setBriefing] = useState(initial?.briefing ?? "");
  const [materials, setMaterials] = useState(initial?.materials ?? "");
  const [services, setServices] = useState(initial?.services ?? "");
  const [value, setValue] = useState<string | number>(initial?.valueCents != null ? (initial.valueCents / 100).toFixed(2) : "");
  return (
    <div className="rounded-lg p-4 space-y-3" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
      <div>
        <label className={label}>Nome</label>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Ex: Cobertura Bloco Travestido" className={inp} />
      </div>
      <div>
        <label className={label}>Descrição curta (opcional)</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Resumo em 1 linha, aparece no card" className={inp + " resize-none"} />
      </div>
      <div>
        <label className={label}>Briefing completo (opcional)</label>
        <textarea value={briefing} onChange={(e) => setBriefing(e.target.value)} rows={4} placeholder="Contexto do projeto, prazo, referências, tudo que precisa saber" className={inp + " resize-y"} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={label}>Serviços a prestar (opcional)</label>
          <textarea value={services} onChange={(e) => setServices(e.target.value)} rows={3} placeholder="Ex: Cobertura em forma de entrevista" className={inp + " resize-y"} />
        </div>
        <div>
          <label className={label}>Materiais a produzir (opcional)</label>
          <textarea value={materials} onChange={(e) => setMaterials(e.target.value)} rows={3} placeholder="Ex: 3 reels, 5 fotos tratadas" className={inp + " resize-y"} />
        </div>
      </div>
      <div>
        <label className={label}>Valor cobrado (opcional)</label>
        <input type="number" min="0" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Não informado" className={inp + " sm:w-40"} />
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Cancelar</button>
        <button
          disabled={!name.trim()}
          onClick={() => onSave({
            name: name.trim(),
            description: description.trim() || null,
            briefing: briefing.trim() || null,
            materials: materials.trim() || null,
            services: services.trim() || null,
            valueCents: value === "" ? null : Math.round(Number(value) * 100),
          })}
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
  const { addContentItem, setItemCampaign, upsertCampaign } = useApi();
  const [adding, setAdding] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [inviting, setInviting] = useState(false);
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
      <button onClick={onBack} className="text-xs text-foreground/50 hover:text-foreground inline-flex items-center gap-1 mb-4">
        <ChevronLeft size={13} /> Campanhas
      </button>

      {editingProject ? (
        <div className="mb-4">
          <CampaignForm
            initial={{ name: campaign.name, description: campaign.description ?? "", briefing: campaign.briefing ?? "", materials: campaign.materials ?? "", services: campaign.services ?? "", valueCents: campaign.valueCents }}
            onCancel={() => setEditingProject(false)}
            onSave={(vals) => { upsertCampaign.mutate({ data: { id: campaign.id, clientId, ...vals } }); setEditingProject(false); }}
          />
        </div>
      ) : (
        <div className="rounded-lg p-4 mb-4 space-y-3" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-foreground truncate">{campaign.name}</h3>
              {campaign.description && <p className="text-xs text-foreground/40 mt-0.5">{campaign.description}</p>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {campaign.valueCents != null && (
                <span className="text-sm font-bold" style={{ color: "var(--lz-accent-ink)" }}>{fmtBRL(campaign.valueCents)}</span>
              )}
              {isAdmin && (
                <button onClick={() => setEditingProject(true)} title="Editar projeto" className="p-1.5 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5">
                  <Pencil size={13} />
                </button>
              )}
            </div>
          </div>
          {(campaign.briefing || campaign.services || campaign.materials) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {campaign.briefing && (
                <div className="sm:col-span-2">
                  <div className={label}>Briefing</div>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{campaign.briefing}</p>
                </div>
              )}
              {campaign.services && (
                <div>
                  <div className={label}>Serviços a prestar</div>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{campaign.services}</p>
                </div>
              )}
              {campaign.materials && (
                <div>
                  <div className={label}>Materiais a produzir</div>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{campaign.materials}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => { setSharing((v) => !v); setInviting(false); }}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full text-foreground/60 hover:text-foreground border border-foreground/10 hover:border-foreground/25 transition-colors"
          ><Share2 size={12} /> Compartilhar</button>
          <button
            onClick={() => { setInviting((v) => !v); setSharing(false); }}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full text-foreground/60 hover:text-foreground border border-foreground/10 hover:border-foreground/25 transition-colors"
          ><UserPlus size={12} /> Convidar pessoa</button>
        </div>
      )}
      {sharing && (
        <div className="mb-4">
          <CampaignShareBlock campaignId={campaign.id} />
        </div>
      )}
      {inviting && (
        <div className="mb-4">
          <InviteCollaboratorForm clientId={clientId} onDone={() => setInviting(false)} />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mb-4">
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground/40">Itens do projeto ({items.length})</span>
        {isAdmin && !adding && (
          <button onClick={() => setAdding(true)} className="shrink-0 lz-btn-primary text-xs px-3 py-2 rounded-md inline-flex items-center gap-1.5">
            <Plus size={13} /> Adicionar item
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-lg p-4 mb-4 space-y-3" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
          <div className="grid grid-cols-2 gap-3">
            <select value={newType} onChange={(e) => setNewType(e.target.value as ContentType)} className={inp}>
              {ITEM_TYPES.map((t) => <option key={t} value={t}>{CONTENT_TYPE_LABEL[t]}</option>)}
            </select>
            <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Título (opcional)" className={inp} />
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground/70">
            <input type="checkbox" checked={newInternal} onChange={(e) => setNewInternal(e.target.checked)} />
            Interno — não aparece em Posts/Reels/Preview de Feed, só aqui na campanha
          </label>
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Cancelar</button>
            <button onClick={createItem} className="lz-btn-primary text-xs px-4 py-2 rounded-md">Adicionar</button>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="border border-dashed border-foreground/10 rounded-lg p-8 text-center text-foreground/30 text-sm">Nenhum item nessa campanha ainda.</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 rounded-md px-3 py-2.5" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
              <button onClick={() => openCampaignItem(it)} className="flex-1 min-w-0 flex items-center gap-2 text-left hover:opacity-80 transition">
                <span className="text-[10px] font-bold uppercase text-foreground/40 shrink-0">{CONTENT_TYPE_LABEL[it.type]}</span>
                <span className="text-sm text-foreground truncate">{it.title}</span>
              </button>
              <span
                className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
                style={it.campaignInternal
                  ? { background: "color-mix(in srgb, var(--foreground) 8%, transparent)", color: "color-mix(in srgb, var(--foreground) 50%, transparent)" }
                  : { background: "rgba(91,168,138,0.15)", color: "#5BA88A" }}
              >
                {it.campaignInternal ? "Interno" : "Público"}
              </span>
              {isAdmin && (
                <>
                  <button
                    onClick={() => setItemCampaign.mutate({ data: { itemId: it.id, campaignId: campaign.id, campaignInternal: !it.campaignInternal } })}
                    title={it.campaignInternal ? "Tornar público (aparece em Posts/Reels/Feed)" : "Tornar interno (some de Posts/Reels/Feed)"}
                    className="p-1.5 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5 shrink-0"
                  >
                    {it.campaignInternal ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button
                    onClick={() => setItemCampaign.mutate({ data: { itemId: it.id, campaignId: null } })}
                    title="Remover da campanha"
                    className="p-1.5 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5 shrink-0"
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

/** Link público "só pra ver" desse projeto — pra mandar pra quem não faz
 * parte da equipe (ex.: uma influenciadora acompanhando o trabalho), sem
 * precisar de login e sem contar como vaga. Não mostra o valor cobrado. */
function CampaignShareBlock({ campaignId }: { campaignId: string }) {
  const { getOrCreateCampaignShareToken, rotateCampaignShareToken } = useApi();
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function ensureLink() {
    if (url) return url;
    const r = await getOrCreateCampaignShareToken.mutateAsync({ data: { campaignId } });
    const link = `${PUBLIC_BASE}/campanha/${r.token}`;
    setUrl(link);
    return link;
  }

  async function copy() {
    const link = await ensureLink();
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function regenerate() {
    const r = await rotateCampaignShareToken.mutateAsync({ data: { campaignId } });
    setUrl(`${PUBLIC_BASE}/campanha/${r.token}`);
    toast.success("Novo link gerado — o anterior parou de funcionar.");
  }

  return (
    <div className="rounded-lg p-4 space-y-2.5" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
      <p className="text-[11px] text-foreground/40">
        Qualquer pessoa com esse link vê o briefing, serviços, materiais e itens desse projeto — sem login e sem poder editar nada. Não mostra o valor cobrado.
      </p>
      <div className="flex items-center gap-2">
        <input readOnly value={url ?? ""} placeholder="Clique em copiar pra gerar o link" className={inp + " text-foreground/60"} />
        <button
          onClick={copy}
          disabled={getOrCreateCampaignShareToken.isPending}
          className="lz-btn-primary text-xs px-3 py-2 rounded-md inline-flex items-center gap-1.5 shrink-0"
        >{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copiado" : "Copiar"}</button>
        {url && (
          <button
            onClick={regenerate}
            disabled={rotateCampaignShareToken.isPending}
            title="Gerar novo link (o de antes para de funcionar)"
            className="p-2 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5 shrink-0"
          ><RefreshCw size={13} /></button>
        )}
      </div>
    </div>
  );
}

/** Convida um colaborador restrito a UM cliente (todo o cliente, não só
 * essa campanha — restrição por campanha específica ainda não existe).
 * Reaproveita o convite de equipe normal (adminCreateUser) + a restrição
 * de acesso por cliente que já existe (setProfileClientAccess): a pessoa
 * entra como membro de verdade e conta na vaga do plano. */
function InviteCollaboratorForm({ clientId, onDone }: { clientId: string; onDone: () => void }) {
  const { data: clients = [] } = useQuery(clientsQO());
  const clientName = clients.find((c) => c.id === clientId)?.name ?? "esse cliente";
  const { adminCreateUser, setProfileClientAccess } = useApi();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => Math.random().toString(36).slice(-8));
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!name.trim() || !email.trim() || password.length < 6) return;
    setSubmitting(true);
    try {
      const result: any = await adminCreateUser.mutateAsync({ data: { name: name.trim(), email: email.trim(), password, role: "member" } });
      if (result?.id) {
        await setProfileClientAccess.mutateAsync({ data: { profileId: result.id, restricted: true, clientIds: [clientId] } });
      }
      toast.success(`${name.trim()} convidado(a) — recebeu login por e-mail e só vê o cliente ${clientName}.`);
      onDone();
    } catch {
      // erro específico já vira toast dentro de cada mutation
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg p-4 space-y-2.5" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
      <p className="text-[11px] text-foreground/40">
        Essa pessoa entra como colaboradora de verdade — vê e mexe só no cliente <b className="text-foreground/70">{clientName}</b> (não os outros clientes da sua agência), recebe login por e-mail, e conta como 1 vaga da sua equipe.
      </p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className={inp} />
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="E-mail" className={inp} />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha provisória" className={inp} />
      <div className="flex items-center justify-end gap-2">
        <button onClick={onDone} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Cancelar</button>
        <button
          disabled={!name.trim() || !email.trim() || password.length < 6 || submitting}
          onClick={submit}
          className="lz-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-40"
        >{submitting ? "Convidando…" : "Convidar"}</button>
      </div>
    </div>
  );
}
