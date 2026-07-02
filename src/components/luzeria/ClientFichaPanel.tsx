import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X, Plus, Trash2, Link as LinkIcon, ExternalLink, Mail, Phone, User,
  Eye, EyeOff, KeyRound, FileText, Clock, CheckCircle2, AlertOctagon, Copy, Check,
  Repeat, ListChecks, Zap, Power, FolderOpen, Loader2, Save,
} from "lucide-react";
import { clientFichaQO, clientsQO, clientOnboardingQO, recurringQO, profilesQO, useApi, useMe, clientDeliveriesFolderQO } from "@/lib/luzeria/queries";
import { CONTENT_TYPE_LABEL } from "@/lib/luzeria/types";
import { useUI } from "@/lib/luzeria/ui-store";
import { toast } from "sonner";

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
        className="fixed z-50 bg-[#0D0D0D] border-white/10 flex flex-col lz-slide-in overflow-y-auto
          inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl border-t
          md:rounded-none md:border-t-0 md:border-l md:right-0 md:top-0 md:bottom-0 md:left-auto md:w-[480px] md:max-h-none"
      >
        <div className="md:hidden flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.08]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-10 w-10 rounded-md flex items-center justify-center text-sm font-bold shrink-0"
                style={{ backgroundColor: client.color + "33", color: client.color }}
              >
                {client.icon ?? client.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "#C8D44E" }}>
                  Ficha do cliente
                </div>
                <h2 className="text-[20px] font-bold text-white truncate">{client.name}</h2>
                <div className="text-[11px] text-white/40">{client.category}</div>
              </div>
            </div>
            <button onClick={() => openFicha(null)} className="text-white/50 hover:text-white p-1 rounded hover:bg-white/5 transition">
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
  const api = useApi();

  const [description, setDescription] = useState("");
  useEffect(() => { setDescription(ficha?.description ?? ""); }, [ficha?.description]);

  if (!client) return null;
  const metrics = ficha?.metrics;

  return (
    <>
        {/* Metrics */}
        <Section label="Métricas">
          <div className="grid grid-cols-2 gap-2">
            <MetricMini icon={<FileText size={13} />} label="Itens totais" value={metrics?.totalItems ?? 0} />
            <MetricMini icon={<CheckCircle2 size={13} />} label="Prontos" value={metrics?.finalized ?? 0} color="#C8D44E" />
            <MetricMini
              icon={<AlertOctagon size={13} />}
              label="Travados"
              value={metrics?.blocked ?? 0}
              color={(metrics?.blocked ?? 0) > 0 ? "#FF6B6B" : undefined}
            />
            <MetricMini icon={<Clock size={13} />} label="Lead time médio" value={formatHours(metrics?.avgLeadTimeHours ?? null)} />
          </div>
          {metrics?.lastDeliveryAt && (
            <p className="mt-2 text-[10px] text-white/40">
              Última entrega: {new Date(metrics.lastDeliveryAt).toLocaleDateString("pt-BR")}
            </p>
          )}
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
            className="w-full bg-[#1C1C1C] border border-white/[0.08] rounded-md px-3 py-2.5 text-sm text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E] placeholder:text-white/30 resize-none disabled:opacity-70"
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

        {/* Links */}
        <Section label="Links importantes">
          <div className="space-y-2">
            {(ficha?.links ?? []).length === 0 && (
              <p className="text-xs text-white/40">Nenhum link cadastrado.</p>
            )}
            {(ficha?.links ?? []).map((l) => {
              const href = normUrl(l.url);
              return (
                <div key={l.id} className="flex items-center gap-2 bg-[#1C1C1C] border border-white/[0.06] rounded-md px-3 py-2">
                  <LinkIcon size={14} style={{ color: "#C8D44E" }} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate">{l.label}</div>
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-white/50 hover:text-[#C8D44E] truncate inline-flex items-center gap-1">
                        {l.url} <ExternalLink size={10} />
                      </a>
                    ) : (
                      <div className="text-[11px] text-white/40 truncate">{l.url}</div>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (confirm(`Excluir o link "${l.label}"?`))
                          api.deleteClientLink.mutate({ data: { id: l.id } });
                      }}
                      className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/5"
                    ><Trash2 size={13} /></button>
                  )}
                </div>
              );
            })}
            {isAdmin && <AddLinkRow clientId={client.id} onSubmit={(d) => api.upsertClientLink.mutate({ data: d })} />}
          </div>
        </Section>

        {/* Contacts */}
        <Section label="Contatos">
          <div className="space-y-2">
            {(ficha?.contacts ?? []).length === 0 && (
              <p className="text-xs text-white/40">Nenhum contato cadastrado.</p>
            )}
            {(ficha?.contacts ?? []).map((c) => (
              <div key={c.id} className="bg-[#1C1C1C] border border-white/[0.06] rounded-md px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <User size={14} style={{ color: "#C8D44E" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{c.name}</div>
                    {c.role && <div className="text-[11px] text-white/50">{c.role}</div>}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => {
                        if (confirm(`Excluir o contato "${c.name}"?`))
                          api.deleteClientContact.mutate({ data: { id: c.id } });
                      }}
                      className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/5"
                    ><Trash2 size={13} /></button>
                  )}
                </div>
                {(c.email || c.phone) && (
                  <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-white/70">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:text-[#C8D44E]">
                        <Mail size={11} /> {c.email}
                      </a>
                    )}
                    {c.phone && (
                      <a href={`tel:${c.phone.replace(/\D/g, "")}`} className="inline-flex items-center gap-1 hover:text-[#C8D44E]">
                        <Phone size={11} /> {c.phone}
                      </a>
                    )}
                  </div>
                )}
                {c.notes && <div className="mt-1.5 text-[11px] text-white/50 whitespace-pre-wrap">{c.notes}</div>}
              </div>
            ))}
            {isAdmin && <AddContactRow clientId={client.id} onSubmit={(d) => api.upsertClientContact.mutate({ data: d })} />}
          </div>
        </Section>

        {/* Secrets - admin only */}
        {isAdmin && (
          <Section label="Senhas e acessos" last={!isMaster}>
            <div className="mb-2 text-[10px] text-white/40">Visível apenas para administradores.</div>
            <div className="space-y-2">
              {(ficha?.secrets ?? []).length === 0 && (
                <p className="text-xs text-white/40">Nenhum acesso cadastrado.</p>
              )}
              {(ficha?.secrets ?? []).map((s) => (
                <SecretRow key={s.id} secret={s} onDelete={() => api.deleteClientSecret.mutate({ data: { id: s.id } })} />
              ))}
              <AddSecretRow clientId={client.id} onSubmit={(d) => api.upsertClientSecret.mutate({ data: d })} />
            </div>
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
  const [contractValue, setContractValue] = useState<string>((client as any).contractValue ? String((client as any).contractValue) : "");

  useEffect(() => {
    setNiche(client.customFields.niche ?? "");
    setPostsPerWeek(client.customFields.postsPerWeek ?? 0);
    setReelsPerWeek(client.customFields.reelsPerWeek ?? 0);
    setResponsible(client.customFields.fixedResponsibleId ?? "");
    setReviewDay(client.customFields.reviewDay ?? "");
    setNotes(client.customFields.notes ?? "");
    setContractValue((client as any).contractValue ? String((client as any).contractValue) : "");
  }, [client.id]);

  function save() {
    onSave({
      niche, posts_per_week: Number(postsPerWeek) || 0,
      reels_per_week: Number(reelsPerWeek) || 0,
      fixed_responsible_id: responsible || null,
      review_day: reviewDay, notes,
      contract_value: contractValue ? Number(contractValue.replace(",", ".")) : null,
    });
    toast.success("Configuração salva");
  }

  const inp = "w-full bg-[#1C1C1C] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E] transition-colors disabled:opacity-60";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      {isMaster && (
        <ConfigField label="Valor do contrato (R$)">
          <input
            type="text"
            inputMode="decimal"
            placeholder="Ex: 1500,00"
            value={contractValue}
            onChange={(e) => setContractValue(e.target.value)}
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
            style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}>Salvar configuração</button>
        </div>
      )}
    </div>
  );
}

function ConfigField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase font-semibold tracking-wider text-white/40 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function Section({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`px-6 py-5 ${last ? "" : "border-b border-white/[0.08]"}`}>
      <div className="text-[10px] uppercase font-bold tracking-wider mb-3" style={{ color: "#C8D44E" }}>{label}</div>
      {children}
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

  function clear() {
    if (!confirm("Remover pasta de entregas deste cliente?")) return;
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
      <p className="text-[11px] text-white/50 leading-relaxed">
        Todos os uploads desse cliente vão para esta pasta, em subpasta <span className="text-white/80">[Mês Ano]</span>.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <FolderOpen size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={value}
            disabled={!isAdmin || isLoading || busy}
            onChange={(e) => { setValue(e.target.value); setDirty(true); }}
            placeholder="https://drive.google.com/drive/folders/…"
            className="w-full pl-8 pr-3 py-2 bg-[#1C1C1C] border border-white/[0.08] rounded-md text-xs text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E] placeholder:text-white/30 disabled:opacity-60"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!openHref}
            onClick={() => openHref && window.open(openHref, "_blank", "noopener,noreferrer")}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-[11px] font-semibold border border-white/15 text-white/80 hover:text-white hover:border-white/30 disabled:opacity-30 disabled:cursor-not-allowed transition"
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
              style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}
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
          className="text-[10px] text-white/40 hover:text-red-400 inline-flex items-center gap-1 mt-1"
        >
          <Trash2 size={10} /> Remover pasta
        </button>
      )}
      {!isAdmin && !data?.folderId && (
        <p className="text-[10px] text-white/40">Nenhuma pasta configurada. Peça a um administrador.</p>
      )}
    </div>
  );
}

function MetricMini({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-[#1C1C1C] rounded-md px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-white/50">
        {icon} {label}
      </div>
      <div className="text-xl font-bold tabular-nums mt-0.5" style={{ color: color ?? "#FFFFFF" }}>{value}</div>
    </div>
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
        className="sm:w-40 bg-[#1C1C1C] border border-white/[0.08] rounded-md px-3 py-2 text-xs text-white outline-none focus:border-[#C8D44E] placeholder:text-white/30"
      />
      <input
        value={url} onChange={(e) => setUrl(e.target.value)}
        placeholder="https://…"
        className="flex-1 bg-[#1C1C1C] border border-white/[0.08] rounded-md px-3 py-2 text-xs text-white outline-none focus:border-[#C8D44E] placeholder:text-white/30"
      />
      <button
        disabled={!label.trim() || !url.trim()}
        onClick={() => {
          onSubmit({ clientId, label: label.trim(), url: url.trim() });
          setLabel(""); setUrl("");
        }}
        className="px-3 rounded-md text-xs font-bold disabled:opacity-30 transition-opacity"
        style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}
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
        className="w-full mt-1 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-white/15 py-2 text-[11px] text-white/50 hover:text-[#C8D44E] hover:border-[#C8D44E]">
        <Plus size={12} /> Novo contato
      </button>
    );
  }
  return (
    <div className="bg-[#1C1C1C] border border-white/[0.08] rounded-md p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8D44E]" />
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Cargo" className="bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8D44E]" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8D44E]" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone" className="bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8D44E]" />
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações" rows={2}
        className="w-full bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8D44E] resize-none" />
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => setOpen(false)} className="text-[11px] text-white/50 hover:text-white px-2 py-1">Cancelar</button>
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
          style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}
        >Salvar</button>
      </div>
    </div>
  );
}

/* ============== ONBOARDING ============== */

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

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/60">
          {list.length ? `${done}/${list.length} concluído` : "Nenhuma etapa cadastrada."}
        </span>
        {allDone && (
          <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1"
            style={{ backgroundColor: "rgba(200,212,78,0.18)", color: "#C8D44E" }}>
            <CheckCircle2 size={11} /> Onboarding completo
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {list.map((c) => (
          <div key={c.id} className="flex items-center gap-2 group">
            <button
              onClick={() => save(list.map((x) => x.id === c.id ? { ...x, done: !x.done } : x))}
              className="h-4 w-4 rounded border flex items-center justify-center shrink-0"
              style={{
                borderColor: c.done ? "#C8D44E" : "rgba(255,255,255,0.25)",
                backgroundColor: c.done ? "#C8D44E" : "transparent",
              }}
            >{c.done && <Check size={10} color="#0D0D0D" strokeWidth={3} />}</button>
            <input
              value={c.text}
              onChange={(e) => save(list.map((x) => x.id === c.id ? { ...x, text: e.target.value } : x))}
              className={`flex-1 bg-transparent text-sm outline-none ${c.done ? "line-through text-white/40" : "text-white/90"}`}
            />
            <button
              onClick={() => save(list.filter((x) => x.id !== c.id))}
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/5"
            ><Trash2 size={11} /></button>
          </div>
        ))}
        <div className="flex items-center gap-2 mt-1">
          <ListChecks size={13} className="text-white/30 shrink-0" />
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
            className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/30 border-b border-white/[0.06] focus:border-[#C8D44E] py-1"
          />
        </div>
      </div>
      {onboarding?.completedAt && (
        <p className="text-[10px] text-white/40 mt-3">
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
      <p className="text-[11px] text-white/50 mb-3">
        Tarefas geradas automaticamente. Use "Gerar agora" para criar os itens dos próximos 14 dias.
      </p>
      <div className="space-y-2">
        {templates.length === 0 && !adding && (
          <p className="text-xs text-white/40">Nenhuma recorrência cadastrada.</p>
        )}
        {templates.map((t) => (
          <RecurringRow
            key={t.id}
            tpl={t}
            profiles={profiles}
            onUpdate={(patch) => api.upsertRecurring.mutate({ data: { id: t.id, clientId, type: t.type, title: t.title, cadence: t.cadence, dayOfWeek: t.dayOfWeek, dayOfMonth: t.dayOfMonth, defaultAssignees: t.defaultAssignees, active: t.active, ...patch } })}
            onDelete={() => { if (confirm(`Excluir recorrência "${t.title}"?`)) api.deleteRecurring.mutate({ data: { id: t.id } }); }}
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
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-white/15 py-2 text-[11px] text-white/50 hover:text-[#C8D44E] hover:border-[#C8D44E]">
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
            style={{ backgroundColor: "rgba(200,212,78,0.15)", color: "#C8D44E" }}
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
    <div className="bg-[#1C1C1C] border border-white/[0.06] rounded-md px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Repeat size={13} style={{ color: tpl.active ? "#C8D44E" : "rgba(255,255,255,0.3)" }} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">{tpl.title}</div>
          <div className="text-[10px] text-white/40">{typeLabel} · {when}</div>
        </div>
        <button
          onClick={() => onUpdate({ active: !tpl.active })}
          className="p-1 rounded text-white/40 hover:text-[#C8D44E] hover:bg-white/5"
          title={tpl.active ? "Desativar" : "Ativar"}
        ><Power size={12} /></button>
        <button onClick={onDelete} className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/5">
          <Trash2 size={12} />
        </button>
      </div>
      {tpl.defaultAssignees?.length > 0 && (
        <div className="mt-1.5 flex items-center gap-1 flex-wrap">
          {tpl.defaultAssignees.map((uid: string) => {
            const p = profiles.find((x) => x.id === uid);
            return p ? (
              <span key={uid} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/70">{p.name}</span>
            ) : null;
          })}
        </div>
      )}
      {tpl.lastGeneratedAt && (
        <div className="text-[10px] text-white/30 mt-1">Última geração: {new Date(tpl.lastGeneratedAt).toLocaleDateString("pt-BR")}</div>
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
    <div className="bg-[#1C1C1C] border border-white/[0.08] rounded-md p-3 space-y-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título da tarefa recorrente"
        className="w-full bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8D44E]" />
      <div className="grid grid-cols-3 gap-2">
        <select value={type} onChange={(e) => setType(e.target.value as any)}
          className="bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8D44E]">
          <option value="post">Post</option>
          <option value="reel">Reel</option>
          <option value="outros">Outro</option>
          <option value="gravacao">Gravação</option>
          <option value="roteiro">Roteiro</option>
          <option value="sistema">Sistema</option>
        </select>
        <select value={cadence} onChange={(e) => setCadence(e.target.value as any)}
          className="bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8D44E]">
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensal</option>
        </select>
        {cadence === "weekly" ? (
          <select value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}
            className="bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8D44E]">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d, i) => (
              <option key={i} value={i}>{d}</option>
            ))}
          </select>
        ) : (
          <input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))}
            className="bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8D44E]" />
        )}
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Responsáveis padrão</div>
        <div className="flex flex-wrap gap-1.5">
          {profiles.filter((p) => p.active).map((p) => {
            const sel = assignees.includes(p.id);
            return (
              <button key={p.id}
                onClick={() => setAssignees((a) => sel ? a.filter((x) => x !== p.id) : [...a, p.id])}
                className="px-2 py-1 rounded text-[10px] font-semibold transition-colors"
                style={{ backgroundColor: sel ? "#C8D44E" : "rgba(255,255,255,0.06)", color: sel ? "#0D0D0D" : "#FFFFFF" }}
              >{p.name}</button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="text-[11px] text-white/50 hover:text-white px-2 py-1">Cancelar</button>
        <button disabled={!title.trim()}
          onClick={() => onSubmit({
            clientId, type, title: title.trim(), cadence,
            dayOfWeek: cadence === "weekly" ? dayOfWeek : null,
            dayOfMonth: cadence === "monthly" ? dayOfMonth : null,
            defaultAssignees: assignees, active: true,
          })}
          className="px-3 py-1.5 rounded-md text-[11px] font-bold disabled:opacity-30"
          style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}>Salvar</button>
      </div>
    </div>
  );
}

function SecretRow({ secret, onDelete }: { secret: any; onDelete: () => void }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-[#1C1C1C] border border-white/[0.06] rounded-md px-3 py-2.5">
      <div className="flex items-center gap-2">
        <KeyRound size={14} style={{ color: "#C8D44E" }} />
        <div className="text-sm font-semibold text-white flex-1 truncate">{secret.label}</div>
        <button onClick={() => setShow((s) => !s)} className="p-1 rounded text-white/40 hover:text-white hover:bg-white/5" title={show ? "Ocultar" : "Revelar"}>
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
          className="p-1 rounded text-white/40 hover:text-[#C8D44E] hover:bg-white/5"
          title="Copiar valor"
        >{copied ? <Check size={13} /> : <Copy size={13} />}</button>
        <button onClick={() => { if (confirm(`Excluir "${secret.label}"?`)) onDelete(); }} className="p-1 rounded text-white/40 hover:text-red-400 hover:bg-white/5">
          <Trash2 size={13} />
        </button>
      </div>
      <div className="mt-1 text-[12px] font-mono break-all" style={{ color: show ? "#FFF" : "rgba(255,255,255,0.3)" }}>
        {show ? secret.value : "••••••••••••"}
      </div>
      {secret.notes && <div className="mt-1 text-[11px] text-white/40 whitespace-pre-wrap">{secret.notes}</div>}
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
        className="w-full mt-1 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-white/15 py-2 text-[11px] text-white/50 hover:text-[#C8D44E] hover:border-[#C8D44E]">
        <Plus size={12} /> Novo acesso
      </button>
    );
  }
  return (
    <div className="bg-[#1C1C1C] border border-white/[0.08] rounded-md p-3 space-y-2">
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Rótulo (ex.: Instagram)" className="w-full bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8D44E]" />
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Senha / token / login" className="w-full bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-xs text-white font-mono outline-none focus:border-[#C8D44E]" />
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações (opcional)" className="w-full bg-[#0D0D0D] border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8D44E]" />
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => setOpen(false)} className="text-[11px] text-white/50 hover:text-white px-2 py-1">Cancelar</button>
        <button
          disabled={!label.trim() || !value}
          onClick={() => {
            onSubmit({ clientId, label: label.trim(), value, notes: notes.trim() || null });
            setLabel(""); setValue(""); setNotes(""); setOpen(false);
          }}
          className="px-3 py-1.5 rounded-md text-[11px] font-bold disabled:opacity-30"
          style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}
        >Salvar</button>
      </div>
    </div>
  );
}