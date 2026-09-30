// Painel da Luzeria (Configurações → Plataforma): criar House, gerar link
// de convite pro /house/criar e converter uma agência existente em House.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Home, Link2, X } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import {
  adminCreateHouse, adminCreateHouseInvite, adminListHouseInvites, adminListOrgClients, adminConvertToHouse,
} from "@/lib/luzeria/house.functions";

const HOUSE_PLANS = [
  { id: "house", label: "House — R$ 149,00/mês (sem IA)" },
  { id: "house_ia", label: "House + IA — R$ 249,00/mês" },
] as const;
type HousePlanId = (typeof HOUSE_PLANS)[number]["id"];

const inputCls = "w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";

function ModalShell({ title, icon, onClose, children }: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card border border-foreground/10 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[var(--lz-accent-ink)]">{icon}</span>
            <h3 className="text-lg font-bold text-foreground">{title}</h3>
          </div>
          <button onClick={onClose} className="text-foreground/50 hover:text-foreground p-1 rounded hover:bg-foreground/5 transition">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide text-foreground/40 mb-1">{label}</label>
      {children}
    </div>
  );
}

function PlanSelect({ value, onChange }: { value: HousePlanId; onChange: (v: HousePlanId) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as HousePlanId)} className={inputCls}>
      {HOUSE_PLANS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
  );
}

function PrimaryButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full mt-5 font-bold uppercase text-sm px-5 py-3 rounded-md transition disabled:opacity-40"
      style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
      {children}
    </button>
  );
}

export function CreateHouseModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [planId, setPlanId] = useState<HousePlanId>("house");
  const create = useMutation({
    mutationFn: useServerFn(adminCreateHouse),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgs-billing"] });
      toast.success("House criada! O dono recebeu o e-mail pra criar a senha.");
      onClose();
    },
    onError: (e: any) => toastFriendlyError(e, "Erro ao criar house."),
  });

  function submit() {
    if (!companyName.trim() || !ownerName.trim() || !ownerEmail.trim()) { toast.error("Preencha todos os campos."); return; }
    create.mutate({ data: { companyName: companyName.trim(), ownerName: ownerName.trim(), ownerEmail: ownerEmail.trim(), planId } });
  }

  return (
    <ModalShell title="Criar house" icon={<Home size={18} />} onClose={onClose}>
      <p className="text-xs text-foreground/45 mb-4">
        Cria a conta da empresa (já com ela como marca principal), as metas padrão e manda o convite pro dono definir a senha.
        7 dias de teste, depois começa a cobrança.
      </p>
      <div className="space-y-3">
        <Field label="Nome da empresa">
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="ex: Clínica Sorriso" className={inputCls} />
        </Field>
        <Field label="Nome do dono">
          <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="ex: Maria Silva" className={inputCls} />
        </Field>
        <Field label="E-mail do dono">
          <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="maria@empresa.com" className={inputCls} />
        </Field>
        <Field label="Plano">
          <PlanSelect value={planId} onChange={setPlanId} />
        </Field>
      </div>
      <PrimaryButton onClick={submit} disabled={create.isPending}>{create.isPending ? "Criando..." : "Criar house"}</PrimaryButton>
    </ModalShell>
  );
}

export function HouseInviteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [planId, setPlanId] = useState<HousePlanId>("house");
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<{ url: string; expiresAt: string } | null>(null);
  const listFn = useServerFn(adminListHouseInvites);
  const { data: invites = [] } = useQuery({ queryKey: ["house-invites"], queryFn: () => listFn() });
  const create = useMutation({
    mutationFn: useServerFn(adminCreateHouseInvite),
    onSuccess: (r: { url: string; expiresAt: string }) => {
      setCreated({ url: r.url, expiresAt: r.expiresAt });
      qc.invalidateQueries({ queryKey: ["house-invites"] });
      copy(r.url);
    },
    onError: (e: any) => toastFriendlyError(e, "Erro ao gerar convite."),
  });

  function copy(url: string) {
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link copiado."),
      () => toast.error("Não consegui copiar — selecione o link e copie à mão."),
    );
  }

  return (
    <ModalShell title="Link de convite" icon={<Link2 size={18} />} onClose={onClose}>
      <p className="text-xs text-foreground/45 mb-4">
        Gera um link de uso único (vale 14 dias) pra própria empresa criar a House em /house/criar.
      </p>
      <div className="space-y-3">
        <Field label="Plano">
          <PlanSelect value={planId} onChange={setPlanId} />
        </Field>
        <Field label="Anotação (opcional, só você vê)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex: Clínica Sorriso, falei com a Maria" className={inputCls} />
        </Field>
      </div>
      <PrimaryButton onClick={() => create.mutate({ data: { planId, note: note.trim() || undefined } })} disabled={create.isPending}>
        {create.isPending ? "Gerando..." : "Gerar link"}
      </PrimaryButton>

      {created && (
        <div className="mt-4 rounded-lg p-3" style={{ background: "rgba(var(--lz-brand-rgb),0.08)", border: "1px solid rgba(var(--lz-brand-rgb),0.25)" }}>
          <div className="text-[11px] text-foreground/50 mb-1">Link copiado · vence em {new Date(created.expiresAt).toLocaleDateString("pt-BR")}</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 text-xs text-foreground break-all">{created.url}</code>
            <button onClick={() => copy(created.url)} className="p-1.5 rounded hover:bg-foreground/5 text-foreground/60 hover:text-foreground"><Copy size={14} /></button>
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <div className="mt-6">
          <div className="text-[10px] uppercase tracking-wide text-foreground/40 mb-2">Convites recentes</div>
          <ul className="space-y-1.5">
            {invites.slice(0, 10).map((inv) => {
              const expired = !inv.usedAt && new Date(inv.expiresAt).getTime() < Date.now();
              const status = inv.usedAt ? `Usado${inv.usedByOrgName ? ` · ${inv.usedByOrgName}` : ""}` : expired ? "Vencido" : "Aberto";
              return (
                <li key={inv.id} className="flex items-center justify-between gap-2 text-xs bg-background rounded-md px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-foreground/80 font-mono">{inv.code}</div>
                    {inv.note && <div className="text-foreground/40 truncate">{inv.note}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={inv.usedAt ? "text-[var(--lz-accent-ink)]" : expired ? "text-foreground/30" : "text-foreground/60"}>{status}</span>
                    {!inv.usedAt && !expired && (
                      <button onClick={() => copy(inv.url)} title="Copiar link" className="p-1 rounded hover:bg-foreground/5 text-foreground/50 hover:text-foreground"><Copy size={12} /></button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </ModalShell>
  );
}

export function ConvertToHouseModal({ org, onClose }: { org: { id: string; name: string }; onClose: () => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListOrgClients);
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["admin-org-clients", org.id],
    queryFn: () => listFn({ data: { orgId: org.id } }),
  });
  const [clientId, setClientId] = useState("");
  const [planId, setPlanId] = useState<HousePlanId>("house");
  const convert = useMutation({
    mutationFn: useServerFn(adminConvertToHouse),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgs-billing"] });
      toast.success(`${org.name} agora é uma House.`);
      onClose();
    },
    onError: (e: any) => toastFriendlyError(e, "Erro ao converter."),
  });
  const extras = Math.max(0, clients.length - 1);

  return (
    <ModalShell title="Converter em house" icon={<Home size={18} />} onClose={onClose}>
      <p className="text-xs text-foreground/45 mb-4">
        <strong className="text-foreground/70">{org.name}</strong> vira House. Nada é apagado: os módulos de agência só somem da tela
        (Vendas, margem, jornada, aprovação por link, fórum…) e a aprovação do cliente vira aprovação do gestor.
      </p>
      <div className="space-y-3">
        <Field label="Marca principal">
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls} disabled={isLoading}>
            <option value="">{isLoading ? "Carregando..." : "Escolha entre os clientes cadastrados"}</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Plano">
          <PlanSelect value={planId} onChange={setPlanId} />
        </Field>
        {extras > 0 && (
          <p className="text-[11px] text-foreground/50">
            Essa conta tem {clients.length} clientes ativos — os {extras} além da marca principal passam a contar como marcas adicionais
            (R$ 79,90/mês cada). Arquive os que não fazem parte da House antes, se for o caso.
          </p>
        )}
      </div>
      <PrimaryButton onClick={() => convert.mutate({ data: { orgId: org.id, clientId, planId } })} disabled={!clientId || convert.isPending}>
        {convert.isPending ? "Convertendo..." : "Converter em house"}
      </PrimaryButton>
    </ModalShell>
  );
}
