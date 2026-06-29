import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X, Plus, Trash2, Link as LinkIcon, ExternalLink, Mail, Phone, User,
  Eye, EyeOff, KeyRound, FileText, Clock, CheckCircle2, AlertOctagon, Copy, Check,
} from "lucide-react";
import { clientFichaQO, clientsQO, useApi, useMe } from "@/lib/luzeria/queries";
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
  const { data: ficha } = useQuery(clientFichaQO(fichaClientId));
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const isMaster = me?.role === "master";
  const api = useApi();

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!fichaClientId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") openFicha(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fichaClientId, openFicha]);

  const [description, setDescription] = useState("");
  useEffect(() => { setDescription(ficha?.description ?? ""); }, [ficha?.description]);

  if (!fichaClientId || !client) return null;

  const metrics = ficha?.metrics;

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

        {/* Metrics */}
        <Section label="Métricas">
          <div className="grid grid-cols-2 gap-2">
            <MetricMini icon={<FileText size={13} />} label="Itens totais" value={metrics?.totalItems ?? 0} />
            <MetricMini icon={<CheckCircle2 size={13} />} label="Finalizados" value={metrics?.finalized ?? 0} color="#C8D44E" />
            <MetricMini
              icon={<AlertOctagon size={13} />}
              label="Bloqueados"
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
      </div>
    </>
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