import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  X, Plus, Trash2, Link as LinkIcon, ExternalLink, Mail, Phone, User,
  Eye, EyeOff, KeyRound, FileText, Clock, CheckCircle2, AlertOctagon, Copy, Check,
  Repeat, ListChecks, Zap, Power, FolderOpen, Loader2, Save, Camera, Instagram,
  MessageCircle, Milestone, Users, Upload, Download, Film, Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { clientFichaQO, clientsQO, clientOnboardingQO, recurringQO, profilesQO, useApi, useMe, clientDeliveriesFolderQO, clientContractQO, clientBrandAssetsQO, driveThumbnailQO, journeyStagesQO, contractRequestsQO } from "@/lib/luzeria/queries";
import { useClientAssetUpload } from "@/lib/luzeria/use-client-asset-upload";
import { useClientContractUpload } from "@/lib/luzeria/use-client-contract-upload";
import { CONTENT_TYPE_LABEL, hasSetorPermission } from "@/lib/luzeria/types";
import { useUI } from "@/lib/luzeria/ui-store";
import { toast } from "sonner";
import { ImageCropModal } from "./ImageCropModal";
import { ClientBlockedItemsModal } from "./ClientBlockedItemsModal";
import { getInstagramConnectionStatus, getInstagramConnectUrl, disconnectInstagram } from "@/lib/luzeria/instagram.functions";

function formatHours(h: number | null) {
  if (h == null) return "—";
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function normUrl(raw: string) {
  const t = raw.trim();
  if (!t) return null;
  try { return new URL(t).href; } catch {
    try { return new URL(`https://${t}`).href; } catch { return null; }
  }
}

export function ClientFichaPanel() {
  const { fichaClientId, openFicha } = useUI();
  const { data: clients = [] } = useQuery(clientsQO());
  const client = clients.find((c) => c.id === fichaClientId);

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!fichaClientId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") openFicha(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fichaClientId, openFicha]);

  if (!fichaClientId || !client) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={() => openFicha(null)} />
      <div
        ref={panelRef}
        className="fixed z-[60] bg-background border-foreground/10 flex flex-col lz-slide-in overflow-y-auto
          inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl border-t
          md:rounded-none md:border-t-0 md:border-l md:right-0 md:top-0 md:bottom-0 md:left-auto md:w-[480px] md:max-h-none"
      >
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-foreground/20" />
        </div>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-foreground/8">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-10 w-10 rounded-md flex items-center justify-center text-sm font-bold shrink-0"
                style={{ backgroundColor: client.color + "33", color: client.color }}
              >
                {client.icon ?? client.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--lz-accent-ink)" }}>
                  Ficha do cliente
                </div>
                <h2 className="text-[20px] font-bold text-foreground truncate">{client.name}</h2>
                <div className="text-[11px] text-foreground/40">{client.category}</div>
              </div>
            </div>
            <button onClick={() => openFicha(null)} className="text-foreground/50 hover:text-foreground p-1 rounded hover:bg-foreground/5 transition">
              <X size={16} />
            </button>
          </div>
        </div>

        <ClientFichaContent clientId={client.id} />
      </div>
    </>
  );
}

/** Reusable Ficha body — used both inside the slide-in panel and inline as a tab. */
export function ClientFichaContent({ clientId }: { clientId: string }) {
  const { data: clients = [] } = useQuery(clientsQO());
  const { data: profiles = [] } = useQuery(profilesQO());
  const client = clients.find((c) => c.id === clientId);
  const { data: ficha } = useQuery(clientFichaQO(clientId));
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const isMaster = me?.role === "master";
  const canManageInstagram = hasSetorPermission(me, "instagram_publish");
  const api = useApi();

  const [description, setDescription] = useState("");
  useEffect(() => { setDescription(ficha?.description ?? ""); }, [ficha?.description]);

  const [groupLink, setGroupLink] = useState("");
  useEffect(() => { setGroupLink(ficha?.whatsappGroupLink ?? ""); }, [ficha?.whatsappGroupLink]);

  const [showBlockedModal, setShowBlockedModal] = useState(false);

  if (!client) return null;
  const metrics = ficha?.metrics;

  return (
    <>
        {/* Metrics */}
        <Section label="Métricas">
          <div className="grid grid-cols-2 gap-2">
            <MetricMini icon={<FileText size={13} />} label="Itens totais" value={metrics?.totalItems ?? 0} />
            <MetricMini icon={<CheckCircle2 size={13} />} label="Prontos" value={metrics?.finalized ?? 0} color="var(--lz-accent-ink)" />
            <MetricMini
              icon={<AlertOctagon size={13} />}
              label="Travados"
              value={metrics?.blocked ?? 0}
              color={(metrics?.blocked ?? 0) > 0 ? "#FF6B6B" : undefined}
              onClick={(metrics?.blocked ?? 0) > 0 ? () => setShowBlockedModal(true) : undefined}
            />
            <MetricMini icon={<Clock size={13} />} label="Lead time médio" value={formatHours(metrics?.avgLeadTimeHours ?? null)} />
          </div>
          {metrics?.lastDeliveryAt && (
            <p className="mt-2 text-[10px] text-foreground/40">
              Última entrega: {new Date(metrics.lastDeliveryAt).toLocaleDateString("pt-BR")}
            </p>
          )}
        </Section>

        {showBlockedModal && <ClientBlockedItemsModal clientId={clientId} onClose={() => setShowBlockedModal(false)} />}

        {/* Journey stage */}
        <Section label="Etapa do projeto">
          <ClientStageSection clientId={clientId} isAdmin={isAdmin} />
        </Section>

        {/* Description */}
        <Section label="Sobre">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              const v = description.trim();
              if (v !== (ficha?.description ?? "")) {
                api.updateClient.mutate(
                  { data: { id: client.id, patch: { description: v } } },
                  {
                    onSuccess: () => {
                      // also revalidate ficha
                      // (queryClient invalidate is already done; nothing extra needed)
                    },
                  },
                );
              }
            }}
            disabled={!isAdmin}
            rows={4}
            placeholder={isAdmin ? "Tom de voz, nicho, observações, instruções do cliente…" : "Sem descrição."}
            className="w-full bg-card border border-foreground/8 rounded-md px-3 py-2.5 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))] placeholder:text-foreground/30 resize-none disabled:opacity-70"
          />
        </Section>

        {/* Configuração do cliente (campos do antigo Perfil) */}
        <Section label="Configuração do cliente">
          <ClientConfigBlock client={client} profiles={profiles} canEdit={isAdmin} isMaster={isMaster} onSave={(patch) => api.updateClient.mutate({ data: { id: client.id, patch } })} />
        </Section>

        {/* Deliveries folder (Drive) */}
        <Section label="Pasta de entregas (Drive)">
          <DeliveriesFolderBlock clientId={client.id} isAdmin={isAdmin} />
        </Section>

        {/* Contract (arquivo pronto, anexado manualmente) */}
        <Section label="Contrato">
          <ContractBlock clientId={client.id} isAdmin={isAdmin} />
        </Section>

        {/* Contract generation + e-signature */}
        {isAdmin && (
          <Section label="Gerar contrato pra assinatura">
            <GenerateContractBlock client={client} />
          </Section>
        )}

        {/* Brand assets */}
        <Section label="Arquivos da marca">
          <BrandAssetsBlock clientId={client.id} isAdmin={isAdmin} />
        </Section>

        {/* Links */}
        <Section label="Links importantes">
          <div className="space-y-2">
            {(ficha?.links ?? []).length === 0 && (
              <p className="text-xs text-foreground/40">Nenhum link cadastrado.</p>
            )}
            {(ficha?.links ?? []).map((l) => {
              const href = normUrl(l.url);
              return (
                <div key={l.id} className="flex items-center gap-2 bg-card border border-foreground/6 rounded-md px-3 py-2">
                  <LinkIcon size={14} style={{ color: "var(--lz-accent-ink)" }} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-foreground truncate">{l.label}</div>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-foreground/50 hover:text-[var(--lz-accent-ink)] truncate inline-flex items-center gap-1">
                        {l.url} <ExternalLink size={10} />
                      </a>
                    ) : (
                      <div className="text-[11px] text-foreground/40 truncate">{l.url}</div>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={async () => {
                        if (await requestConfirm(`Excluir o link "${l.label}"?`, { danger: true }))
                          api.deleteClientLink.mutate({ data: { id: l.id } });
                      }}
                      className="p-1 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5"
                    ><Trash2 size={13} /></button>
                  )}
                </div>
              );
            })}
            {isAdmin && <AddLinkRow clientId={client.id} onSubmit={(d) => api.upsertClientLink.mutate({ data: d })} />}
          </div>
        </Section>

        {/* Contacts */}
        <Section label="Contatos" id="contatos-section">
          <div className="mb-3 pb-3 border-b border-foreground/6">
            <label className="flex items-center gap-1.5 text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">
              <Users size={11} /> Grupo com o cliente (WhatsApp)
            </label>
            <input
              value={groupLink}
              onChange={(e) => setGroupLink(e.target.value)}
              onBlur={() => {
                const v = groupLink.trim();
                if (v !== (ficha?.whatsappGroupLink ?? "")) {
                  api.setWhatsappGroupLink.mutate({ data: { clientId: client.id, link: v || null } });
                }
              }}
              disabled={!isAdmin}
              placeholder={isAdmin ? "Link de convite do grupo (chat.whatsapp.com/…)" : "Nenhum grupo cadastrado."}
              className="w-full bg-card border border-foreground/8 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))] placeholder:text-foreground/30 disabled:opacity-70"
            />
            <p className="mt-1 text-[10px] text-foreground/30">
              Quando preenchido, as mensagens de atualização vão pro grupo em vez do contato individual.
            </p>
          </div>
          <div className="space-y-2">
            {(ficha?.contacts ?? []).length === 0 && (
              <p className="text-xs text-foreground/40">Nenhum contato cadastrado.</p>
            )}
            {(ficha?.contacts ?? []).map((c) => (
              <div key={c.id} className="bg-card border border-foreground/6 rounded-md px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <User size={14} style={{ color: "var(--lz-accent-ink)" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{c.name}</div>
                    {c.role && <div className="text-[11px] text-foreground/50">{c.role}</div>}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={async () => {
                        if (await requestConfirm(`Excluir o contato "${c.name}"?`, { danger: true }))
                          api.deleteClientContact.mutate({ data: { id: c.id } });
                      }}
                      className="p-1 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5"
                    ><Trash2 size={13} /></button>
                  )}
                </div>
                {(c.email || c.phone) && (
                  <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-foreground/70">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-[var(--lz-accent-ink)]">
                        <Mail size={11} /> {c.email}
                      </a>
                    )}
                    {c.phone && (
                      <a href={`tel:${c.phone.replace(/\D/g, "")}`} className="inline-flex items-center gap-1 hover:text-[var(--lz-accent-ink)]">
                        <Phone size={11} /> {c.phone}
                      </a>
                    )}
                  </div>
                )}
                {c.notes && <div className="mt-1.5 text-[11px] text-foreground/50 whitespace-pre-wrap">{c.notes}</div>}
              </div>
            ))}
            {isAdmin && <AddContactRow clientId={client.id} onSubmit={(d) => api.upsertClientContact.mutate({ data: d })} />}
          </div>
        </Section>

        {/* Secrets - admin only */}
        {isAdmin && (
          <Section label="Senhas e acessos" last={!isMaster}>
            <div className="mb-2 text-[10px] text-foreground/40">Visível apenas para administradores.</div>
            <div className="space-y-2">
              {(ficha?.secrets ?? []).length === 0 && (
                <p className="text-xs text-foreground/40">Nenhum acesso cadastrado.</p>
              )}
              {(ficha?.secrets ?? []).map((s) => (
                <SecretRow key={s.id} secret={s} onDelete={() => api.deleteClientSecret.mutate({ data: { id: s.id } })} />
              ))}
              <AddSecretRow clientId={client.id} onSubmit={(d) => api.upsertClientSecret.mutate({ data: d })} />
            </div>
          </Section>
        )}

        {/* Stories (admin) */}
        {isAdmin && (
          <Section label="Stories">
            <label className="flex items-center gap-2 text-sm text-foreground/70">
              <input
                type="checkbox"
                checked={client.notifyStoriesInTasks ?? false}
                onChange={(e) => api.setNotifyStoriesInTasks.mutate({ data: { clientId: client.id, enabled: e.target.checked } })}
              />
              Notificar Stories em Minhas Demandas
            </label>
            <p className="text-[11px] text-foreground/40 mt-1.5">
              Quando ativado, Stories atribuídos deste cliente aparecem na lista de tarefas do responsável — como Posts e Reels.
            </p>
          </Section>
        )}

        {/* Instagram (master, ou setor com a permissão "Publicar no Instagram") */}
        {canManageInstagram && (
          <Section label="Instagram">
            <InstagramSection clientId={client.id} />
          </Section>
        )}

        {/* Onboarding (admin) */}
        {isAdmin && (
          <Section label="Onboarding do cliente">
            <OnboardingBlock clientId={client.id} />
          </Section>
        )}

        {/* Recurring (admin) */}
        {isAdmin && (
          <Section label="Recorrências" last>
            <RecurringBlock clientId={client.id} />
          </Section>
        )}
    </>
  );
}

/* ============== CONFIGURAÇÃO (antigo Perfil) ============== */
function ClientConfigBlock({ client, profiles, canEdit, isMaster, onSave }: {
  client: any; profiles: any[]; canEdit: boolean; isMaster?: boolean; onSave: (patch: Record<string, any>) => void;
}) {
  const [niche, setNiche] = useState<string>(client.customFields.niche ?? "");
  const [postsPerWeek, setPostsPerWeek] = useState<string | number>(client.customFields.postsPerWeek ?? 0);
  const [reelsPerWeek, setReelsPerWeek] = useState<string | number>(client.customFields.reelsPerWeek ?? 0);
  const [responsible, setResponsible] = useState<string>(client.customFields.fixedResponsibleId ?? "");
  const [reviewDay, setReviewDay] = useState<string>(client.customFields.reviewDay ?? "");
  const [notes, setNotes] = useState<string>(client.customFields.notes ?? "");
  const [cnpjCpf, setCnpjCpf] = useState<string>(client.cnpjCpf ?? "");
  const [address, setAddress] = useState<string>(client.address ?? "");
  const [legalResponsibleName, setLegalResponsibleName] = useState<string>(client.legalResponsibleName ?? "");
  const [legalResponsibleCpf, setLegalResponsibleCpf] = useState<string>(client.legalResponsibleCpf ?? "");
  const [contractValue, setContractValue] = useState<string | number>(client.contractValue ?? "");
  const [paymentDueDay, setPaymentDueDay] = useState<string | number>(client.paymentDueDay ?? "");
  const [photoPreview, setPhotoPreview] = useState<string | null>(client.photoUrl ?? null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNiche(client.customFields.niche ?? "");
    setPostsPerWeek(client.customFields.postsPerWeek ?? 0);
    setReelsPerWeek(client.customFields.reelsPerWeek ?? 0);
    setResponsible(client.customFields.fixedResponsibleId ?? "");
    setReviewDay(client.customFields.reviewDay ?? "");
    setNotes(client.customFields.notes ?? "");
    setContractValue(client.contractValue ?? "");
    setPaymentDueDay(client.paymentDueDay ?? "");
    setPhotoPreview(client.photoUrl ?? null);
    setCnpjCpf(client.cnpjCpf ?? "");
    setAddress(client.address ?? "");
    setLegalResponsibleName(client.legalResponsibleName ?? "");
    setLegalResponsibleCpf(client.legalResponsibleCpf ?? "");
  }, [client.id]);

  function pickPhotoFile(file: File) {
    if (file.size > 20 * 1024 * 1024) { toast.error("Imagem maior que 20MB."); return; }
    setCropFile(file);
  }

  async function handleCroppedPhoto(result: { blob: Blob; contentType: string; ext: string }) {
    setCropFile(null);
    const path = `clients/${client.id}/photo-${Date.now()}.${result.ext}`;
    setPhotoUploading(true);
    try {
      const { error } = await supabase.storage.from("avatars").upload(path, result.blob, {
        upsert: true, contentType: result.contentType, cacheControl: "31536000",
      });
      if (error) throw error;
      const preview = URL.createObjectURL(result.blob);
      setPhotoPreview(preview);
      onSave({ photo_url: path });
      toast.success("Foto atualizada");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar foto");
    }
    setPhotoUploading(false);
  }

  async function removePhoto() {
    setPhotoPreview(null);
    onSave({ photo_url: null });
    toast.success("Foto removida");
  }

  function save() {
    onSave({
      niche, posts_per_week: Number(postsPerWeek) || 0,
      reels_per_week: Number(reelsPerWeek) || 0,
      fixed_responsible_id: responsible || null,
      review_day: reviewDay, notes,
      cnpj_cpf: cnpjCpf.trim() || null,
      address: address.trim() || null,
      legal_responsible_name: legalResponsibleName.trim() || null,
      legal_responsible_cpf: legalResponsibleCpf.trim() || null,
      ...(isMaster ? {
        contract_value: contractValue === "" ? null : Number(contractValue),
        payment_due_day: paymentDueDay === "" ? null : Number(paymentDueDay),
      } : {}),
    });
    toast.success("Configuração salva");
  }

  const inp = "w-full bg-card border border-foreground/8 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))] transition-colors disabled:opacity-60";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Photo upload */}
      {canEdit && (
        <div className="sm:col-span-2">
          <ConfigField label="Foto do cliente (aparece no lugar da bolinha)">
            <div className="flex items-center gap-4 mt-1">
              <div className="relative shrink-0">
                {photoPreview ? (
                  <img src={photoPreview} alt="Foto" className="h-16 w-16 rounded-full object-cover" style={{ border: "2px solid rgba(var(--lz-brand-light-rgb),0.4)" }} />
                ) : (
                  <div className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold"
                    style={{ backgroundColor: client.color + "33", color: client.color }}>
                    {client.icon ?? client.name[0]?.toUpperCase()}
                  </div>
                )}
                {photoUploading && (
                  <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                    <Loader2 size={18} className="animate-spin text-foreground" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) pickPhotoFile(f); e.target.value = ""; }}
                />
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-foreground/10 text-foreground/70 hover:text-foreground hover:border-[rgb(var(--lz-brand-rgb))] transition disabled:opacity-50"
                >
                  <Camera size={13} /> {photoPreview ? "Alterar foto" : "Adicionar foto"}
                </button>
                {photoPreview && (
                  <button
                    onClick={removePhoto}
                    className="text-xs text-red-400 hover:text-red-300 transition text-left"
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>
          </ConfigField>
        </div>
      )}
      <ConfigField label="Nicho">
        <input value={niche} disabled={!canEdit} onChange={(e) => setNiche(e.target.value)} className={inp} />
      </ConfigField>
      <ConfigField label="Dia de revisão">
        <input value={reviewDay} disabled={!canEdit} onChange={(e) => setReviewDay(e.target.value)} className={inp} />
      </ConfigField>
      <ConfigField label="Posts / mês">
        <input type="number" value={postsPerWeek} disabled={!canEdit} onChange={(e) => setPostsPerWeek(e.target.value)} className={inp} />
      </ConfigField>
      <ConfigField label="Reels / mês">
        <input type="number" value={reelsPerWeek} disabled={!canEdit} onChange={(e) => setReelsPerWeek(e.target.value)} className={inp} />
      </ConfigField>
      <ConfigField label="Responsável fixo">
        <select value={responsible} disabled={!canEdit} onChange={(e) => setResponsible(e.target.value)} className={inp}>
          <option value="">—</option>
          {profiles.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </ConfigField>
      <ConfigField label="CNPJ ou CPF">
        <input value={cnpjCpf} disabled={!canEdit} onChange={(e) => setCnpjCpf(e.target.value)} placeholder="Pra preencher o contrato" className={inp} />
      </ConfigField>
      <ConfigField label="Responsável legal (pro contrato)">
        <input value={legalResponsibleName} disabled={!canEdit} onChange={(e) => setLegalResponsibleName(e.target.value)} className={inp} />
      </ConfigField>
      <ConfigField label="CPF do responsável">
        <input value={legalResponsibleCpf} disabled={!canEdit} onChange={(e) => setLegalResponsibleCpf(e.target.value)} placeholder="Pra preencher o contrato" className={inp} />
      </ConfigField>
      <div className="sm:col-span-2">
        <ConfigField label="Endereço">
          <input value={address} disabled={!canEdit} onChange={(e) => setAddress(e.target.value)} className={inp} />
        </ConfigField>
      </div>
      {isMaster && (
        <ConfigField label="Valor mensal do contrato (R$)">
          <input
            type="number" min="0" step="0.01"
            value={contractValue} disabled={!canEdit}
            onChange={(e) => setContractValue(e.target.value)}
            placeholder="Não informado"
            className={inp}
          />
        </ConfigField>
      )}
      {isMaster && (
        <ConfigField label="Dia de vencimento do pagamento">
          <input
            type="number" min="1" max="31" step="1"
            value={paymentDueDay} disabled={!canEdit}
            onChange={(e) => setPaymentDueDay(e.target.value)}
            placeholder="Ex: 10"
            className={inp}
          />
        </ConfigField>
      )}
      <div className="sm:col-span-2">
        <ConfigField label="Observações">
          <textarea value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} rows={3} className={inp + " resize-none"} />
        </ConfigField>
      </div>
      {canEdit && (
        <div className="sm:col-span-2">
          <button onClick={save} className="rounded-md px-4 py-2 text-xs font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>Salvar configuração</button>
        </div>
      )}
      {cropFile && (
        <ImageCropModal file={cropFile} onCancel={() => setCropFile(null)} onConfirm={handleCroppedPhoto} />
      )}
    </div>
  );
}

/* ============== ETAPA DO PROJETO ============== */

const TRACK_LABEL: Record<string, string> = { onboarding: "Onboarding (1º mês)", operational: "Operação (ciclo mensal)" };

function ClientStageSection({ clientId, isAdmin }: { clientId: string; isAdmin: boolean }) {
  const { data: ficha } = useQuery(clientFichaQO(clientId));
  const { data: stages = [] } = useQuery(journeyStagesQO());
  const api = useApi();
  const { stageComposerClientId, openStageComposer } = useUI();

  const [composer, setComposer] = useState<{ stageId: string | null; message: string; trigger: "stage_change" | "weekly_nudge" } | null>(null);

  useEffect(() => {
    if (stageComposerClientId !== clientId) return;
    if (!ficha || stages.length === 0) return;
    const current = stages.find((s) => s.id === ficha.currentStageId);
    setComposer({
      stageId: ficha.currentStageId ?? null,
      message: current?.description ?? "Passando pra dar um retorno rápido sobre o andamento do seu projeto.",
      trigger: "weekly_nudge",
    });
    openStageComposer(null);
  }, [stageComposerClientId, clientId, ficha, stages, openStageComposer]);

  if (!isAdmin) {
    const current = stages.find((s) => s.id === ficha?.currentStageId);
    return (
      <p className="text-sm text-foreground/70">{current ? current.name : "Nenhuma etapa definida ainda."}</p>
    );
  }

  const onboardingStages = stages.filter((s) => s.track === "onboarding");
  const operationalStages = stages.filter((s) => s.track === "operational");

  function handleChange(stageId: string) {
    const stage = stages.find((s) => s.id === stageId);
    api.setClientStage.mutate({ data: { clientId, stageId } }, {
      onSuccess: () => setComposer({ stageId, message: stage?.description ?? "", trigger: "stage_change" }),
    });
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Milestone size={14} className="text-foreground/40 shrink-0" />
        <select
          value={ficha?.currentStageId ?? ""}
          onChange={(e) => handleChange(e.target.value)}
          className="flex-1 bg-card border border-foreground/10 rounded-md px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
        >
          <option value="" disabled>Selecionar etapa…</option>
          <optgroup label={TRACK_LABEL.operational}>
            {operationalStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </optgroup>
          <optgroup label={TRACK_LABEL.onboarding}>
            {onboardingStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </optgroup>
        </select>
      </div>

      {composer && (
        <StageUpdateComposer
          composer={composer}
          whatsappPhone={ficha?.whatsappPhone ?? null}
          whatsappGroupLink={ficha?.whatsappGroupLink ?? null}
          onChangeMessage={(msg) => setComposer({ ...composer, message: msg })}
          onClose={() => setComposer(null)}
          onSend={async () => {
            const groupLink = ficha?.whatsappGroupLink?.trim();
            if (groupLink) {
              try { await navigator.clipboard.writeText(composer.message); } catch { /* clipboard unavailable, still open the group */ }
              window.open(groupLink, "_blank");
              toast.success("Mensagem copiada! Cole no grupo que abriu.");
            } else {
              const digits = (ficha?.whatsappPhone ?? "").replace(/\D/g, "");
              if (!digits) return;
              window.open(`https://wa.me/${digits}?text=${encodeURIComponent(composer.message)}`, "_blank");
            }
            api.logClientStageUpdate.mutate({
              data: { clientId, stageId: composer.stageId ?? undefined, message: composer.message, trigger: composer.trigger },
            });
            setComposer(null);
          }}
        />
      )}
    </div>
  );
}

function StageUpdateComposer({ composer, whatsappPhone, whatsappGroupLink, onChangeMessage, onClose, onSend }: {
  composer: { stageId: string | null; message: string; trigger: "stage_change" | "weekly_nudge" };
  whatsappPhone: string | null;
  whatsappGroupLink: string | null;
  onChangeMessage: (msg: string) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  const hasGroup = !!whatsappGroupLink?.trim();
  const hasTarget = hasGroup || !!whatsappPhone;
  return (
    <div className="mt-3 bg-card border border-foreground/8 rounded-md p-3 space-y-2">
      <div className="text-[11px] font-semibold text-foreground/70">
        {composer.trigger === "weekly_nudge" ? "Lembrete: avisar o cliente sobre o andamento" : "Avisar o cliente sobre a nova etapa"}
      </div>
      {hasGroup && (
        <div className="text-[10px] text-foreground/40 inline-flex items-center gap-1">
          <Users size={10} /> Vai pro grupo com o cliente
        </div>
      )}
      <textarea
        value={composer.message}
        onChange={(e) => onChangeMessage(e.target.value)}
        rows={3}
        className="w-full bg-background border border-foreground/10 rounded px-2.5 py-2 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-none"
      />
      <div className="flex items-center justify-between gap-2">
        <button onClick={onClose} className="text-[11px] text-foreground/50 hover:text-foreground px-2 py-1">Fechar</button>
        {hasTarget ? (
          <button
            onClick={onSend}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold bg-[#25D366] text-[#0D0D0D] hover:brightness-95 transition"
          >
            <MessageCircle size={13} /> {hasGroup ? "Copiar e abrir grupo" : "Enviar no WhatsApp"}
          </button>
        ) : (
          <button
            onClick={() => document.getElementById("contatos-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="text-[11px] font-semibold text-amber-400 hover:underline"
          >
            Falta preencher o grupo ou telefone — clique pra ir aos contatos
          </button>
        )}
      </div>
    </div>
  );
}

function ConfigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Section({ label, children, last, id }: { label: string; children: React.ReactNode; last?: boolean; id?: string }) {
  return (
    <div id={id} className={`px-6 py-5 ${last ? "" : "border-b border-foreground/8"}`}>
      <div className="text-[10px] uppercase font-bold tracking-wider mb-3" style={{ color: "var(--lz-accent-ink)" }}>{label}</div>
      {children}
    </div>
  );
}

function InstagramSection({ clientId }: { clientId: string }) {
  const getConnStatus = useServerFn(getInstagramConnectionStatus);
  const getConnectUrl = useServerFn(getInstagramConnectUrl);
  const disconnect = useServerFn(disconnectInstagram);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const status = useQuery({
    queryKey: ["instagram-connection-status", clientId],
    queryFn: () => getConnStatus({ data: { clientId } }),
  });

  async function connect() {
    setConnecting(true);
    try {
      const r: any = await getConnectUrl({ data: { clientId } });
      window.location.href = r.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar conexão com o Instagram");
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!(await requestConfirm("Desconectar o Instagram desse cliente? A publicação automática para de funcionar até reconectar.", { danger: true }))) return;
    setDisconnecting(true);
    try {
      await disconnect({ data: { clientId } });
      toast.success("Instagram desconectado.");
      status.refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao desconectar");
    } finally {
      setDisconnecting(false);
    }
  }

  const data = status.data;

  return (
    <div>
      <p className="text-[11px] text-foreground/40 mb-3">
        Conecte a conta do Instagram (Business ou Criador de Conteúdo) desse cliente pra poder publicar Posts, Carrosséis, Reels e Stories direto pelo Modo Criador.
      </p>
      {status.isLoading ? (
        <div className="text-foreground/40 text-sm">Verificando…</div>
      ) : data?.connected ? (
        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--lz-accent-ink)] font-medium flex items-center gap-1.5">
            <Instagram size={14} /> Conectado{data.igUsername ? ` — @${data.igUsername}` : ""}
          </div>
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="text-[11px] text-foreground/50 hover:text-red-400 transition disabled:opacity-50">
            Desconectar
          </button>
        </div>
      ) : (
        <button onClick={connect} disabled={connecting}
          className="lz-btn-primary text-xs px-4 py-2 rounded-md inline-flex items-center gap-2 disabled:opacity-50">
          {connecting ? <Loader2 size={14} className="animate-spin" /> : <Instagram size={14} />}
          Conectar Instagram
        </button>
      )}
    </div>
  );
}

function DeliveriesFolderBlock({ clientId, isAdmin }: { clientId: string; isAdmin: boolean }) {
  const { data, isLoading } = useQuery(clientDeliveriesFolderQO(clientId));
  const { setClientDeliveriesFolder, clearClientDeliveriesFolder } = useApi();
  const [value, setValue] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValue(data?.webViewUrl ?? "");
    setDirty(false);
  }, [data?.webViewUrl, clientId]);

  function save() {
    const v = value.trim();
    if (!v) return;
    setClientDeliveriesFolder.mutate(
      { data: { clientId, folderIdOrUrl: v } },
      {
        onSuccess: (r: any) => {
          toast.success(`Pasta de entregas salva${r?.name ? `: ${r.name}` : ""}.`);
          setDirty(false);
        },
        onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar pasta."),
      },
    );
  }

  async function clear() {
    if (!(await requestConfirm("Remover pasta de entregas deste cliente?", { danger: true }))) return;
    clearClientDeliveriesFolder.mutate(
      { data: { clientId } },
      {
        onSuccess: () => { toast.success("Pasta removida."); setValue(""); setDirty(false); },
        onError: (e: any) => toast.error(e?.message ?? "Falha ao remover."),
      },
    );
  }

  const openHref = data?.webViewUrl ?? null;
  const busy = setClientDeliveriesFolder.isPending || clearClientDeliveriesFolder.isPending;

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-foreground/50 leading-relaxed">
        Todos os uploads desse cliente vão para esta pasta, em subpasta <span className="text-foreground/80">[Mês Ano]</span>.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <FolderOpen size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            value={value}
            disabled={!isAdmin || isLoading || busy}
            onChange={(e) => { setValue(e.target.value); setDirty(true); }}
            placeholder="https://drive.google.com/drive/folders/…"
            className="w-full pl-8 pr-3 py-2 bg-card border border-foreground/8 rounded-md text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))] placeholder:text-foreground/30 disabled:opacity-60"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!openHref}
            onClick={() => openHref && window.open(openHref, "_blank", "noopener,noreferrer")}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-[11px] font-semibold border border-foreground/15 text-foreground/80 hover:text-foreground hover:border-foreground/30 disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Abrir pasta no Drive"
          >
            Abrir pasta <ExternalLink size={11} />
          </button>
          {isAdmin && (
            <button
              type="button"
              disabled={!dirty || !value.trim() || busy}
              onClick={save}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-[11px] font-bold disabled:opacity-30 transition"
              style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
            >
              {setClientDeliveriesFolder.isPending ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Salvar
            </button>
          )}
        </div>
      </div>
      {isAdmin && data?.folderId && (
        <button
          type="button"
          onClick={clear}
          disabled={busy}
          className="text-[10px] text-foreground/40 hover:text-red-400 inline-flex items-center gap-1 mt-1"
        >
          <Trash2 size={10} /> Remover pasta
        </button>
      )}
      {!isAdmin && !data?.folderId && (
        <p className="text-[10px] text-foreground/40">Nenhuma pasta configurada. Peça a um administrador.</p>
      )}
    </div>
  );
}

function ContractBlock({ clientId, isAdmin }: { clientId: string; isAdmin: boolean }) {
  const { data: contract, isLoading } = useQuery(clientContractQO(clientId));
  const api = useApi();
  const { upload, uploadProgress, busy } = useClientContractUpload(clientId);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pick(file: File) {
    const { error } = await upload(file);
    if (error) toast.error(error);
    else toast.success("Contrato salvo na pasta do cliente no Drive.");
  }

  async function remove() {
    if (!(await requestConfirm("Remover o contrato deste cliente?", { danger: true }))) return;
    api.deleteClientContract.mutate({ data: { clientId } });
  }

  if (isLoading) return <Loader2 size={14} className="animate-spin text-foreground/40" />;

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-foreground/50 leading-relaxed">
        Vai direto pra pasta do cliente no Google Drive, em "Contrato - {"{cliente}"}" (precisa da pasta de
        entregas configurada acima).
      </p>
      {contract ? (
        <a href={contract.webViewUrl ?? undefined} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2.5 bg-card border border-foreground/6 rounded-md px-2.5 py-2 hover:border-foreground/15 transition-colors">
          <BrandAssetThumb driveFileId={contract.driveFileId} mime={contract.mimeType} name={contract.fileName} />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-foreground truncate">{contract.fileName}</div>
            <div className="text-[11px] text-foreground/40">
              Enviado em {new Date(contract.createdAt).toLocaleDateString("pt-BR")}
            </div>
          </div>
          {contract.webViewUrl && <Download size={13} className="text-foreground/30 shrink-0" />}
          {isAdmin && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(); }}
              className="p-1 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5 shrink-0" title="Remover"
            >
              <Trash2 size={13} />
            </button>
          )}
        </a>
      ) : (
        <p className="text-xs text-foreground/40">Nenhum contrato anexado.</p>
      )}
      {isAdmin && (
        <>
          <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
          <button
            type="button" disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-semibold border border-foreground/15 text-foreground/80 hover:text-foreground hover:border-foreground/30 disabled:opacity-50 transition"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {busy ? `Enviando… ${uploadProgress?.pct ?? 0}%` : contract ? "Substituir contrato" : "Anexar contrato"}
          </button>
        </>
      )}
    </div>
  );
}

const money = (v: number | null) =>
  v == null ? "" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function waLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

const DEFAULT_CONTRACT_TEMPLATE_FALLBACK =
`**CONTRATO DE PRESTAÇÃO DE SERVIÇOS**

**CONTRATANTE:** {cliente}, inscrito(a) sob o CNPJ/CPF {cnpj_cpf}, com endereço em {endereco}, neste ato representado(a) por **{responsavel}**, CPF {responsavel_cpf}.

**CONTRATADA:** {agencia}.

### CLÁUSULA PRIMEIRA — DO OBJETO
Prestação de serviços de gestão de redes sociais e produção de conteúdo, sendo **{qtd_posts}** posts e **{qtd_reels}** vídeos/reels por mês, conforme escopo acordado entre as partes.

### CLÁUSULA SEGUNDA — DO VALOR E FORMA DE PAGAMENTO
O valor deste contrato é de **{valor}** mensais, com vigência de **{duracao_meses}** a contar de **{inicio_contrato}**, e vencimento mensal no dia **{vencimento}**.

Este contrato é válido a partir da assinatura eletrônica abaixo, feita pelo(a) responsável indicado(a) acima.`;

type ContractExtraFields = { qtdPosts: string; qtdReels: string; inicioContrato: string; duracaoMeses: string };

function buildContractText(client: any, template: string | null, orgName: string, extra?: ContractExtraFields) {
  const t = template ?? DEFAULT_CONTRACT_TEMPLATE_FALLBACK;
  return t
    .replaceAll("{cliente}", client.name ?? "")
    .replaceAll("{cnpj_cpf}", client.cnpjCpf ?? "não informado")
    .replaceAll("{endereco}", client.address ?? "não informado")
    .replaceAll("{responsavel}", client.legalResponsibleName ?? client.name ?? "")
    .replaceAll("{responsavel_cpf}", client.legalResponsibleCpf ?? "não informado")
    .replaceAll("{agencia}", orgName ?? "")
    .replaceAll("{valor}", client.contractValue != null ? money(client.contractValue) : "a combinar")
    .replaceAll("{vencimento}", client.paymentDueDay ? String(client.paymentDueDay) : "a combinar")
    .replaceAll("{qtd_posts}", extra?.qtdPosts?.trim() || "a combinar")
    .replaceAll("{qtd_reels}", extra?.qtdReels?.trim() || "a combinar")
    .replaceAll("{inicio_contrato}", extra?.inicioContrato?.trim() || "a combinar")
    .replaceAll("{duracao_meses}", extra?.duracaoMeses?.trim() || "a combinar");
}

function GenerateContractBlock({ client }: { client: any }) {
  const me = useMe().data;
  const api = useApi();
  const { data: requests = [], isLoading } = useQuery(contractRequestsQO(client.id));
  const [drafting, setDrafting] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [viewingSigned, setViewingSigned] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qtdPosts, setQtdPosts] = useState("");
  const [qtdReels, setQtdReels] = useState("");
  const [inicioContrato, setInicioContrato] = useState(() => new Date().toISOString().slice(0, 10));
  const [duracaoMeses, setDuracaoMeses] = useState("12 meses");

  const current = requests.find((r) => r.status === "aguardando") ?? requests.find((r) => r.status === "assinado") ?? null;

  function startDraft() {
    const inicioFmt = inicioContrato
      ? new Date(inicioContrato + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
      : "";
    setDraftText(buildContractText(client, me?.contractTemplate ?? null, me?.orgName ?? "", {
      qtdPosts, qtdReels, inicioContrato: inicioFmt, duracaoMeses,
    }));
    setDrafting(true);
  }

  function confirmDraft() {
    if (!draftText.trim()) return;
    api.createContractRequest.mutate(
      { data: { clientId: client.id, contractText: draftText.trim() } },
      { onSuccess: () => { setDrafting(false); toast.success("Contrato gerado. Copie o link e mande pro cliente."); } },
    );
  }

  async function cancel(id: string) {
    if (!(await requestConfirm("Cancelar esse contrato? O link deixa de funcionar.", { danger: true }))) return;
    api.cancelContractRequest.mutate({ data: { id } });
  }

  const link = current ? `https://modocriador.com.br/contrato/${current.token}` : null;

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (isLoading) return <Loader2 size={14} className="animate-spin text-foreground/40" />;

  if (drafting) {
    return (
      <div className="space-y-2">
        <p className="text-[11px] text-foreground/50 leading-relaxed">
          Confira o texto antes de gerar o link — dá pra ajustar um detalhe pontual aqui sem mudar o modelo padrão.
        </p>
        <textarea
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          rows={10}
          className="w-full bg-card border border-foreground/8 rounded-md px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))] resize-none"
        />
        <div className="flex items-center justify-end gap-2">
          <button onClick={() => setDrafting(false)} className="text-xs text-foreground/40 hover:text-foreground transition px-3 py-2">
            Cancelar
          </button>
          <button
            onClick={confirmDraft}
            disabled={api.createContractRequest.isPending || !draftText.trim()}
            className="rounded-md px-4 py-2 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
          >
            {api.createContractRequest.isPending ? "Gerando…" : "Gerar contrato e link"}
          </button>
        </div>
      </div>
    );
  }

  if (!current) {
    const miniInp = "w-full bg-card border border-foreground/8 rounded-md px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))]";
    return (
      <div className="space-y-3">
        <p className="text-xs text-foreground/40">Nenhum contrato gerado ainda.</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-foreground/40 block mb-1">Posts/mês</label>
            <input value={qtdPosts} onChange={(e) => setQtdPosts(e.target.value)} placeholder="Ex: 3" className={miniInp} />
          </div>
          <div>
            <label className="text-[10px] text-foreground/40 block mb-1">Reels-vídeos/mês</label>
            <input value={qtdReels} onChange={(e) => setQtdReels(e.target.value)} placeholder="Ex: 3" className={miniInp} />
          </div>
          <div>
            <label className="text-[10px] text-foreground/40 block mb-1">Início do contrato</label>
            <input type="date" value={inicioContrato} onChange={(e) => setInicioContrato(e.target.value)} className={miniInp} />
          </div>
          <div>
            <label className="text-[10px] text-foreground/40 block mb-1">Duração</label>
            <input value={duracaoMeses} onChange={(e) => setDuracaoMeses(e.target.value)} placeholder="Ex: 12 meses" className={miniInp} />
          </div>
        </div>
        <p className="text-[10px] text-foreground/35 -mt-1">
          Valor e dia de pagamento vêm da Configuração do cliente, acima. Esses 4 campos aqui só valem pra esse contrato.
        </p>
        <button
          onClick={startDraft}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-semibold border border-foreground/15 text-foreground/80 hover:text-foreground hover:border-foreground/30 transition"
        >
          <FileText size={12} /> Gerar contrato
        </button>
      </div>
    );
  }

  if (current.status === "aguardando") {
    return (
      <div className="space-y-2">
        <div className="bg-card border border-foreground/6 rounded-md px-3 py-2.5">
          <div className="text-xs font-semibold text-foreground mb-1">Aguardando assinatura</div>
          <div className="text-[11px] text-foreground/50 truncate">{link}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={copyLink} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-semibold border border-foreground/15 text-foreground/80 hover:text-foreground hover:border-foreground/30 transition">
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copiado!" : "Copiar link"}
          </button>
          <a
            href={waLink(`Olá! Segue o link do contrato pra assinar: ${link}`)}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-semibold border border-foreground/15 text-foreground/80 hover:text-foreground hover:border-foreground/30 transition"
          >
            <MessageCircle size={12} /> Mandar no WhatsApp
          </a>
          <button onClick={() => cancel(current.id)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-semibold text-foreground/40 hover:text-red-400 transition">
            <Trash2 size={12} /> Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="bg-card border border-foreground/6 rounded-md px-3 py-2.5 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(34,197,94,0.15)" }}>
          <Check size={14} color="rgb(34,197,94)" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-foreground">Assinado por {current.signerName}</div>
          <div className="text-[11px] text-foreground/40">
            {current.signedAt && new Date(current.signedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => setViewingSigned(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-semibold border border-foreground/15 text-foreground/80 hover:text-foreground hover:border-foreground/30 transition">
          <FileText size={12} /> Ver contrato assinado
        </button>
        <button onClick={startDraft} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-semibold text-foreground/40 hover:text-foreground transition">
          Gerar novo contrato
        </button>
      </div>
      {viewingSigned && <SignedContractModal request={current} clientId={client.id} onClose={() => setViewingSigned(false)} />}
    </div>
  );
}

/** Mesmo markdown bem simples do modelo (`**negrito**`/`### título`),
 * formatado em vez de mostrar os asteriscos/cerquilhas literais. */
function ContractTextView({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((raw, i) => {
        const trimmed = raw.trim();
        if (trimmed === "") return <div key={i} className="h-2" />;
        const heading = trimmed.match(/^#{1,6}\s+(.*)$/);
        const content = heading ? heading[1] : trimmed;
        const parts = content.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        return (
          <p key={i} className={heading ? "font-bold text-foreground mt-2 mb-1" : "mb-1"}>
            {parts.map((p, j) =>
              p.startsWith("**") && p.endsWith("**")
                ? <strong key={j} className="font-bold text-foreground">{p.slice(2, -2)}</strong>
                : <span key={j}>{p}</span>,
            )}
          </p>
        );
      })}
    </>
  );
}

function SignedContractModal({ request, clientId, onClose }: { request: any; clientId: string; onClose: () => void }) {
  const { data: pdf } = useQuery(clientContractQO(clientId));
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-background rounded-xl border border-foreground/10 max-w-lg w-full max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground">Contrato assinado</h3>
          <button onClick={onClose} className="text-foreground/50 hover:text-foreground p-1 rounded hover:bg-foreground/5"><X size={16} /></button>
        </div>
        {pdf?.webViewUrl && (
          <a href={pdf.webViewUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mb-4 px-3 py-2 rounded-md text-[11px] font-semibold border border-foreground/15 text-foreground/80 hover:text-foreground hover:border-foreground/30 transition">
            <Download size={12} /> Baixar PDF assinado
          </a>
        )}
        <div className="text-xs text-foreground/70 leading-relaxed bg-card border border-foreground/6 rounded-md p-3 mb-4">
          <ContractTextView text={request.contractText} />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div>
            <div className="text-[10px] uppercase text-foreground/40 tracking-wider mb-0.5">Assinado por</div>
            <div className="text-foreground font-semibold">{request.signerName}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-foreground/40 tracking-wider mb-0.5">CPF</div>
            <div className="text-foreground font-semibold">{request.signerCpf}</div>
          </div>
        </div>
        {request.signatureDataUrl && (
          <div>
            <div className="text-[10px] uppercase text-foreground/40 tracking-wider mb-1">Assinatura</div>
            <img src={request.signatureDataUrl} alt="Assinatura" className="rounded-md border border-foreground/10 bg-white" />
          </div>
        )}
      </div>
    </div>
  );
}

function BrandAssetMimeIcon({ mime }: { mime?: string | null }) {
  const m = mime ?? "";
  if (m.startsWith("image/")) return <ImageIcon size={16} style={{ color: "var(--lz-accent-ink)" }} />;
  if (m.startsWith("video/")) return <Film size={16} style={{ color: "var(--lz-accent-ink)" }} />;
  return <FileText size={16} style={{ color: "var(--lz-accent-ink)" }} />;
}

function isBrandAssetThumbnailable(mime?: string | null) {
  const m = mime ?? "";
  return m.startsWith("image/") || m.startsWith("video/") || m === "application/pdf";
}

function BrandAssetThumb({ driveFileId, mime, name }: { driveFileId: string; mime?: string | null; name: string }) {
  const enabled = isBrandAssetThumbnailable(mime);
  const { data, isLoading } = useQuery(driveThumbnailQO(driveFileId, enabled));
  const url = data?.dataUrl ?? null;
  return (
    <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-background border border-foreground/8 flex items-center justify-center">
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover" loading="lazy" />
      ) : isLoading && enabled ? (
        <Loader2 size={12} className="animate-spin text-foreground/30" />
      ) : (
        <BrandAssetMimeIcon mime={mime} />
      )}
    </div>
  );
}

function BrandAssetsBlock({ clientId, isAdmin }: { clientId: string; isAdmin: boolean }) {
  const { data: assets = [], isLoading } = useQuery(clientBrandAssetsQO(clientId));
  const api = useApi();
  const { upload, uploadProgress, busy } = useClientAssetUpload(clientId);
  const inputRef = useRef<HTMLInputElement>(null);

  async function pick(files: FileList) {
    const { failed } = await upload(Array.from(files));
    if (failed.length > 0) toast.error(failed.map((f) => `${f.name}: ${f.msg}`).join(" | "));
    else toast.success("Arquivo(s) adicionado(s) na pasta do cliente no Drive.");
  }

  async function remove(id: string, name: string) {
    if (!(await requestConfirm(`Remover "${name}"?`, { danger: true }))) return;
    api.deleteClientBrandAsset.mutate({ data: { id } });
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-foreground/50 leading-relaxed">
        Arquivos fixos que a equipe sempre usa desse cliente (logo, marca d'água, vídeos ou docs padrão…) —
        diferente da Biblioteca de Referências, que é pra inspiração. Vai direto pra pasta do cliente no
        Google Drive, em "Arquivo da Marca - {"{cliente}"}" (precisa da pasta de entregas configurada acima).
      </p>
      {isLoading ? (
        <Loader2 size={14} className="animate-spin text-foreground/40" />
      ) : assets.length === 0 ? (
        <p className="text-xs text-foreground/40">Nenhum arquivo cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {assets.map((a) => (
            <a key={a.id} href={a.webViewUrl ?? undefined} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2.5 bg-card border border-foreground/6 rounded-md px-2.5 py-2 hover:border-foreground/15 transition-colors">
              <BrandAssetThumb driveFileId={a.driveFileId} mime={a.mimeType} name={a.name} />
              <div className="min-w-0 flex-1 text-xs font-semibold text-foreground truncate">{a.name}</div>
              {a.webViewUrl && <Download size={13} className="text-foreground/30 shrink-0" />}
              {isAdmin && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(a.id, a.name); }}
                  className="p-1 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5 shrink-0" title="Remover"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </a>
          ))}
        </div>
      )}
      {isAdmin && (
        <>
          <input ref={inputRef} type="file" multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) pick(e.target.files); e.target.value = ""; }} />
          <button
            type="button" disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-semibold border border-foreground/15 text-foreground/80 hover:text-foreground hover:border-foreground/30 disabled:opacity-50 transition"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploadProgress ? `Enviando… ${uploadProgress.pct}% (${uploadProgress.done + 1}/${uploadProgress.total})` : "Adicionar arquivo"}
          </button>
        </>
      )}
    </div>
  );
}

function MetricMini({ icon, label, value, color, onClick }: { icon: React.ReactNode; label: string; value: number | string; color?: string; onClick?: () => void }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`bg-card rounded-md px-3 py-2.5 text-left w-full ${onClick ? "hover:bg-[#242424] transition cursor-pointer" : ""}`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-foreground/50">
        {icon} {label}
      </div>
      <div className="text-xl font-bold tabular-nums mt-0.5" style={{ color: color ?? "var(--foreground)" }}>{value}</div>
    </Comp>
  );
}

function AddLinkRow({ clientId, onSubmit }: { clientId: string; onSubmit: (d: any) => void }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  return (
    <div className="flex flex-col sm:flex-row gap-2 mt-1">
      <input
        value={label} onChange={(e) => setLabel(e.target.value)}
        placeholder="Rótulo (ex.: Drive principal)"
        className="sm:w-40 bg-card border border-foreground/8 rounded-md px-3 py-2 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] placeholder:text-foreground/30"
      />
      <input
        value={url} onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
        className="flex-1 bg-card border border-foreground/8 rounded-md px-3 py-2 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] placeholder:text-foreground/30"
      />
      <button
        disabled={!label.trim() || !url.trim()}
        onClick={() => {
          onSubmit({ clientId, label: label.trim(), url: url.trim() });
          setLabel(""); setUrl("");
        }}
        className="px-3 rounded-md text-xs font-bold disabled:opacity-30 transition-opacity"
        style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
      ><Plus size={13} /></button>
    </div>
  );
}

function AddContactRow({ clientId, onSubmit }: { clientId: string; onSubmit: (d: any) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full mt-1 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-foreground/15 py-2 text-[11px] text-foreground/50 hover:text-[var(--lz-accent-ink)] hover:border-[rgb(var(--lz-brand-rgb))]">
        <Plus size={12} /> Novo contato
      </button>
    );
  }
  return (
    <div className="bg-card border border-foreground/8 rounded-md p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="bg-background border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Cargo" className="bg-background border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="bg-background border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone" className="bg-background border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações" rows={2}
        className="w-full bg-background border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-none" />
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => setOpen(false)} className="text-[11px] text-foreground/50 hover:text-foreground px-2 py-1">Cancelar</button>
        <button
          disabled={!name.trim()}
          onClick={() => {
            onSubmit({
              clientId, name: name.trim(),
              role: role.trim() || null, email: email.trim() || null,
              phone: phone.trim() || null, notes: notes.trim() || null,
            });
            setName(""); setRole(""); setEmail(""); setPhone(""); setNotes("");
            setOpen(false);
          }}
          className="px-3 py-1.5 rounded-md text-[11px] font-bold disabled:opacity-30"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >Salvar</button>
      </div>
    </div>
  );
}

/* ============== ONBOARDING ============== */

/** Versão compacta e sempre visível do checklist de onboarding, pro
 * cabeçalho do cliente (fora da Ficha do Cliente) — só admin de setor e
 * admin master enxergam isso, já que quem chama esse componente já filtra
 * por isAdmin antes de renderizar. */
export function OnboardingBanner({ clientId, onOpenFicha }: { clientId: string; onOpenFicha: () => void }) {
  const api = useApi();
  const { data: onboarding } = useQuery(clientOnboardingQO(clientId));
  const list = onboarding?.checklist ?? [];
  if (list.length === 0) return null;
  const done = list.filter((c) => c.done).length;
  const allDone = done === list.length;

  function toggle(id: string) {
    api.updateClientOnboarding.mutate({
      data: { clientId, checklist: list.map((x) => x.id === id ? { ...x, done: !x.done } : x) },
    });
  }

  return (
    <div className="mb-6 rounded-xl border p-3.5"
      style={{
        borderColor: allDone ? "rgba(var(--lz-brand-light-rgb),0.35)" : "color-mix(in srgb, var(--foreground) 10%, transparent)",
        backgroundColor: allDone ? "rgba(var(--lz-brand-light-rgb),0.06)" : "color-mix(in srgb, var(--foreground) 3%, transparent)",
      }}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <ListChecks size={13} className="text-foreground/40" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-foreground/60">Etapas de onboarding</span>
          <span className="text-[11px] text-foreground/40">{done}/{list.length}</span>
          {allDone && (
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1"
              style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.18)", color: "var(--lz-accent-ink)" }}>
              <CheckCircle2 size={11} /> Completo
            </span>
          )}
        </div>
        <button onClick={onOpenFicha} className="shrink-0 text-[11px] font-semibold text-foreground/40 hover:text-foreground transition-colors">
          Editar
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {list.map((c) => (
          <button key={c.id} onClick={() => toggle(c.id)}
            className="inline-flex items-center gap-1.5 rounded-full pl-1.5 pr-2.5 py-1 text-[11px] font-medium transition-colors"
            style={{
              backgroundColor: c.done ? "rgba(var(--lz-brand-light-rgb),0.16)" : "color-mix(in srgb, var(--foreground) 5%, transparent)",
              color: c.done ? "var(--lz-accent-ink)" : "color-mix(in srgb, var(--foreground) 60%, transparent)",
            }}>
            <span className="h-3.5 w-3.5 rounded-full flex items-center justify-center shrink-0"
              style={{
                backgroundColor: c.done ? "rgb(var(--lz-brand-rgb))" : "transparent",
                border: c.done ? "none" : "1px solid color-mix(in srgb, var(--foreground) 30%, transparent)",
              }}>
              {c.done && <Check size={9} color="#0D0D0D" strokeWidth={3} />}
            </span>
            <span className={c.done ? "line-through opacity-70" : ""}>{c.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function OnboardingBlock({ clientId }: { clientId: string }) {
  const api = useApi();
  const { data: onboarding } = useQuery(clientOnboardingQO(clientId));
  const [newItem, setNewItem] = useState("");
  const list = onboarding?.checklist ?? [];
  const done = list.filter((c) => c.done).length;
  const allDone = list.length > 0 && done === list.length;

  function save(next: typeof list) {
    api.updateClientOnboarding.mutate({ data: { clientId, checklist: next } });
  }

  function saveAsDefault() {
    const labels = list.map((c) => c.text.trim()).filter(Boolean);
    if (labels.length === 0) return;
    api.setOnboardingDefaults.mutate({ data: { labels } }, {
      onSuccess: () => toast.success("Checklist salvo como padrão em todos os clientes."),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar como padrão"),
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-xs text-foreground/60">
          {list.length ? `${done}/${list.length} concluído` : "Nenhuma etapa cadastrada."}
        </span>
        <div className="flex items-center gap-2">
          {allDone && (
            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1"
              style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.18)", color: "var(--lz-accent-ink)" }}>
              <CheckCircle2 size={11} /> Onboarding completo
            </span>
          )}
          {list.length > 0 && (
            <button
              onClick={saveAsDefault}
              disabled={api.setOnboardingDefaults.isPending}
              title="Torna este checklist o padrão para todos os clientes (existentes e novos)"
              className="shrink-0 text-[10px] uppercase font-semibold tracking-wide px-2 py-1 rounded text-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40"
            >
              Salvar como padrão
            </button>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        {list.map((c) => (
          <div key={c.id} className="flex items-center gap-2 group">
            <button
              onClick={() => save(list.map((x) => x.id === c.id ? { ...x, done: !x.done } : x))}
              className="h-4 w-4 rounded border flex items-center justify-center shrink-0"
              style={{
                borderColor: c.done ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 25%, transparent)",
                backgroundColor: c.done ? "rgb(var(--lz-brand-rgb))" : "transparent",
              }}
            >{c.done && <Check size={10} color="#0D0D0D" strokeWidth={3} />}</button>
            <input
              value={c.text}
              onChange={(e) => save(list.map((x) => x.id === c.id ? { ...x, text: e.target.value } : x))}
              className={`flex-1 bg-transparent text-sm outline-none ${c.done ? "line-through text-foreground/40" : "text-foreground/90"}`}
            />
            <button
              onClick={() => save(list.filter((x) => x.id !== c.id))}
              className="opacity-40 group-hover:opacity-100 p-1 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5"
            ><Trash2 size={11} /></button>
          </div>
        ))}
        <div className="flex items-center gap-2 mt-1">
          <ListChecks size={13} className="text-foreground/30 shrink-0" />
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newItem.trim()) {
                const id = (typeof crypto !== "undefined" && (crypto as any).randomUUID)
                  ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2);
                save([...list, { id, text: newItem.trim(), done: false }]);
                setNewItem("");
              }
            }}
            placeholder="Ex.: Acesso ao Drive, briefing assinado, identidade visual…"
            className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-foreground/30 border-b border-foreground/6 focus:border-[rgb(var(--lz-brand-rgb))] py-1"
          />
        </div>
      </div>
      {onboarding?.completedAt && (
        <p className="text-[10px] text-foreground/40 mt-3">
          Concluído em {new Date(onboarding.completedAt).toLocaleDateString("pt-BR")}
        </p>
      )}
    </div>
  );
}

/* ============== RECURRING ============== */

function RecurringBlock({ clientId }: { clientId: string }) {
  const api = useApi();
  const { data: templates = [] } = useQuery(recurringQO(clientId));
  const { data: profiles = [] } = useQuery(profilesQO());
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <p className="text-[11px] text-foreground/50 mb-3">
        Tarefas geradas automaticamente. Use "Gerar agora" para criar os itens dos próximos 14 dias.
      </p>
      <div className="space-y-2">
        {templates.length === 0 && !adding && (
          <p className="text-xs text-foreground/40">Nenhuma recorrência cadastrada.</p>
        )}
        {templates.map((t) => (
          <RecurringRow
            key={t.id}
            tpl={t}
            profiles={profiles}
            onUpdate={(patch) => api.upsertRecurring.mutate({ data: { id: t.id, clientId, type: t.type, title: t.title, cadence: t.cadence, dayOfWeek: t.dayOfWeek, dayOfMonth: t.dayOfMonth, defaultAssignees: t.defaultAssignees, active: t.active, ...patch } })}
            onDelete={async () => { if (await requestConfirm(`Excluir recorrência "${t.title}"?`, { danger: true })) api.deleteRecurring.mutate({ data: { id: t.id } }); }}
          />
        ))}
        {adding && (
          <NewRecurringRow
            clientId={clientId}
            profiles={profiles}
            onSubmit={(d) => { api.upsertRecurring.mutate({ data: d }); setAdding(false); }}
            onCancel={() => setAdding(false)}
          />
        )}
      </div>
      <div className="flex items-center gap-2 mt-3">
        {!adding && (
          <button onClick={() => setAdding(true)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-foreground/15 py-2 text-[11px] text-foreground/50 hover:text-[var(--lz-accent-ink)] hover:border-[rgb(var(--lz-brand-rgb))]">
            <Plus size={12} /> Nova recorrência
          </button>
        )}
        {templates.some((t) => t.active) && (
          <button
            onClick={() => api.generateRecurring.mutate({ data: { clientId, days: 14 } }, {
              onSuccess: (r) => toast.success(`${(r as any).generated ?? 0} tarefa(s) geradas`),
            })}
            disabled={api.generateRecurring.isPending}
            className="px-3 py-2 rounded-md text-[11px] font-bold inline-flex items-center gap-1.5 disabled:opacity-40"
            style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}
          ><Zap size={12} /> {api.generateRecurring.isPending ? "Gerando…" : "Gerar agora"}</button>
        )}
      </div>
    </div>
  );
}

function RecurringRow({ tpl, profiles, onUpdate, onDelete }: {
  tpl: any; profiles: any[]; onUpdate: (p: any) => void; onDelete: () => void;
}) {
  const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const when = tpl.cadence === "weekly"
    ? `Toda ${DOW[tpl.dayOfWeek ?? 1]}`
    : `Dia ${tpl.dayOfMonth ?? 1} do mês`;
  const typeLabel = CONTENT_TYPE_LABEL[tpl.type as keyof typeof CONTENT_TYPE_LABEL] ?? "Item";
  return (
    <div className="bg-card border border-foreground/6 rounded-md px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Repeat size={13} style={{ color: tpl.active ? "var(--lz-accent-ink)" : "color-mix(in srgb, var(--foreground) 30%, transparent)" }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{tpl.title}</div>
          <div className="text-[10px] text-foreground/40">{typeLabel} · {when}</div>
        </div>
        <button
          onClick={() => onUpdate({ active: !tpl.active })}
          className="p-1 rounded text-foreground/40 hover:text-[var(--lz-accent-ink)] hover:bg-foreground/5"
          title={tpl.active ? "Desativar" : "Ativar"}
        ><Power size={12} /></button>
        <button onClick={onDelete} className="p-1 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5">
          <Trash2 size={12} />
        </button>
      </div>
      {tpl.defaultAssignees?.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
          {tpl.defaultAssignees.map((uid: string) => {
            const p = profiles.find((x) => x.id === uid);
            return p ? (
              <span key={uid} className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/5 text-foreground/70">{p.name}</span>
            ) : null;
          })}
        </div>
      )}
      {tpl.lastGeneratedAt && (
        <div className="text-[10px] text-foreground/30 mt-1">Última geração: {new Date(tpl.lastGeneratedAt).toLocaleDateString("pt-BR")}</div>
      )}
    </div>
  );
}

function NewRecurringRow({ clientId, profiles, onSubmit, onCancel }: {
  clientId: string; profiles: any[]; onSubmit: (d: any) => void; onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"post" | "reel" | "outros">("post");
  const [cadence, setCadence] = useState<"weekly" | "monthly">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [assignees, setAssignees] = useState<string[]>([]);

  return (
    <div className="bg-card border border-foreground/8 rounded-md p-3 space-y-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título da tarefa recorrente"
        className="w-full bg-background border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
      <div className="grid grid-cols-3 gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as any)}
          className="bg-background border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]">
          <option value="post">Post</option>
          <option value="reel">Reel</option>
          <option value="outros">Outro</option>
          <option value="gravacao">Gravação</option>
          <option value="roteiro">Roteiro</option>
          <option value="sistema">Sistema</option>
        </select>
        <select value={cadence} onChange={(e) => setCadence(e.target.value as any)}
          className="bg-background border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]">
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensal</option>
        </select>
        {cadence === "weekly" ? (
          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}
            className="bg-background border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d, i) => (
              <option key={i} value={i}>{d}</option>
            ))}
          </select>
        ) : (
          <input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))}
            className="bg-background border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
        )}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-foreground/40 mb-1">Responsáveis padrão</div>
        <div className="flex flex-wrap gap-1.5">
          {profiles.filter((p) => p.active).map((p) => {
            const sel = assignees.includes(p.id);
            return (
              <button key={p.id}
                onClick={() => setAssignees((a) => sel ? a.filter((x) => x !== p.id) : [...a, p.id])}
                className="px-2 py-1 rounded text-[10px] font-semibold transition-colors"
                style={{ backgroundColor: sel ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 6%, transparent)", color: sel ? "#0D0D0D" : "#FFFFFF" }}
              >{p.name}</button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="text-[11px] text-foreground/50 hover:text-foreground px-2 py-1">Cancelar</button>
        <button disabled={!title.trim()}
          onClick={() => onSubmit({
            clientId, type, title: title.trim(), cadence,
            dayOfWeek: cadence === "weekly" ? dayOfWeek : null,
            dayOfMonth: cadence === "monthly" ? dayOfMonth : null,
            defaultAssignees: assignees, active: true,
          })}
          className="px-3 py-1.5 rounded-md text-[11px] font-bold disabled:opacity-30"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>Salvar</button>
      </div>
    </div>
  );
}

function SecretRow({ secret, onDelete }: { secret: any; onDelete: () => void }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-card border border-foreground/6 rounded-md px-3 py-2.5">
      <div className="flex items-center gap-2">
        <KeyRound size={14} style={{ color: "var(--lz-accent-ink)" }} />
        <div className="text-sm font-semibold text-foreground flex-1 truncate">{secret.label}</div>
        <button onClick={() => setShow((s) => !s)} className="p-1 rounded text-foreground/40 hover:text-foreground hover:bg-foreground/5" title={show ? "Ocultar" : "Revelar"}>
          {show ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(secret.value);
              setCopied(true);
              toast.success("Copiado");
              window.setTimeout(() => setCopied(false), 1500);
            } catch { toast.error("Não foi possível copiar"); }
          }}
          className="p-1 rounded text-foreground/40 hover:text-[var(--lz-accent-ink)] hover:bg-foreground/5"
          title="Copiar valor"
        >{copied ? <Check size={13} /> : <Copy size={13} />}</button>
        <button onClick={async () => { if (await requestConfirm(`Excluir "${secret.label}"?`, { danger: true })) onDelete(); }} className="p-1 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5">
          <Trash2 size={13} />
        </button>
      </div>
      <div className="mt-1 text-[12px] font-mono break-all" style={{ color: show ? "#FFF" : "color-mix(in srgb, var(--foreground) 30%, transparent)" }}>
        {show ? secret.value : "••••••••••••"}
      </div>
      {secret.notes && <div className="mt-1 text-[11px] text-foreground/40 whitespace-pre-wrap">{secret.notes}</div>}
    </div>
  );
}

function AddSecretRow({ clientId, onSubmit }: { clientId: string; onSubmit: (d: any) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full mt-1 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-foreground/15 py-2 text-[11px] text-foreground/50 hover:text-[var(--lz-accent-ink)] hover:border-[rgb(var(--lz-brand-rgb))]">
        <Plus size={12} /> Novo acesso
      </button>
    );
  }
  return (
    <div className="bg-card border border-foreground/8 rounded-md p-3 space-y-2">
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rótulo (ex.: Instagram)" className="w-full bg-background border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Senha / token / login" className="w-full bg-background border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground font-mono outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações (opcional)" className="w-full bg-background border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]" />
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => setOpen(false)} className="text-[11px] text-foreground/50 hover:text-foreground px-2 py-1">Cancelar</button>
        <button
          disabled={!label.trim() || !value}
          onClick={() => {
            onSubmit({ clientId, label: label.trim(), value, notes: notes.trim() || null });
            setLabel(""); setValue(""); setNotes(""); setOpen(false);
          }}
          className="px-3 py-1.5 rounded-md text-[11px] font-bold disabled:opacity-30"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >Salvar</button>
      </div>
    </div>
  );
}