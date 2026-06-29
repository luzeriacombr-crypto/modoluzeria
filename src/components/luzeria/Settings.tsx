import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { profilesQO, useApi, useMe, appSettingsQO } from "@/lib/luzeria/queries";
import { Avatar } from "./Avatar";
import type { Role } from "@/lib/luzeria/types";
import { roleLabel } from "./Sidebar";
import { useUI } from "@/lib/luzeria/ui-store";
import { toast } from "sonner";
import { UserPlus, X, Settings as SettingsIcon, Star } from "lucide-react";
import { ReportsTab } from "./ReportsTab";

export function SettingsPage() {
  const me = useMe().data;
  const { data: profiles = [] } = useQuery(profilesQO());
  const { setUserRole, setUserActive, deleteUser, adminCreateUser } = useApi();
  const { setView, setViewAs } = useUI();
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<"team" | "report" | "general">("team");

  if (me?.role !== "master") {
    return <div className="p-10 text-white/60 text-sm">Acesso restrito ao Administrador Master.</div>;
  }

  const pending = profiles.filter((p) => !p.active);
  const active = profiles.filter((p) => p.active);

  const handleRemove = (id: string, name: string) => {
    if (!confirm(`Remover ${name}? Esta ação é permanente.`)) return;
    deleteUser.mutate({ data: { userId: id } }, {
      onSuccess: () => toast.success("Colaborador removido."),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
    });
  };

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[32px] font-bold text-white tracking-tight">Configurações</h1>
          <p className="text-sm text-white/50 mt-2">
            {tab === "team" ? "Gerencie acessos e funções da equipe." : "Relatório consolidado de entregas."}
          </p>
        </div>
        {tab === "team" && (
          <button onClick={() => setAdding(true)}
            className="lz-btn-primary text-xs px-4 py-2.5 rounded-md inline-flex items-center gap-2">
            <UserPlus size={14} /> Adicionar membro
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 border-b border-white/10 mb-8">
        {[
          { id: "team", label: "Equipe" },
          { id: "report", label: "Relatório" },
          { id: "general", label: "Geral" },
        ].map((t) => {
          const active = tab === (t.id as any);
          return (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors -mb-px border-b-2"
              style={{
                color: active ? "#C8D44E" : "rgba(255,255,255,0.5)",
                borderColor: active ? "#C8D44E" : "transparent",
              }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "general" ? <GeneralSettings /> :
       tab === "report" ? <ReportsTab /> : (
        <>
      {pending.length > 0 && (
        <>
          <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3">
            Aguardando aprovação <span className="text-[#C8D44E]">({pending.length})</span>
          </h2>
          <div className="bg-[#1C1C1C] rounded-lg overflow-hidden mb-8">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05] last:border-b-0">
                <Avatar profile={p} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{p.name}</div>
                  <div className="text-[11px] text-white/40 truncate">{p.email}</div>
                </div>
                <button
                  onClick={() => setUserActive.mutate({ data: { userId: p.id, active: true } }, {
                    onSuccess: () => toast.success(`${p.name} aprovado.`),
                  })}
                  className="lz-btn-primary text-xs px-3 py-1.5 rounded-md">
                  Aprovar
                </button>
                <button
                  onClick={() => handleRemove(p.id, p.name)}
                  className="text-xs px-3 py-1.5 rounded-md border border-white/10 text-white/70 hover:text-white hover:border-white/30 transition">
                  Recusar
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3">
        Equipe ativa <span className="text-white/30">({active.length})</span>
      </h2>
      <div className="bg-[#1C1C1C] rounded-lg overflow-hidden">
        {active.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.05] last:border-b-0">
            <Avatar profile={p} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{p.name}</div>
              <div className="text-[11px] text-white/40 truncate">{p.email}</div>
            </div>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded"
              style={{ backgroundColor: "rgba(200,212,78,0.15)", color: "#C8D44E" }}>
              {roleLabel(p.role)}
            </span>
            <select value={p.role} disabled={p.id === me.id}
              onChange={(e) => setUserRole.mutate({ data: { userId: p.id, role: e.target.value as Role } })}
              className="bg-[#0D0D0D] border border-white/10 text-xs text-white rounded-md px-2 py-1 outline-none focus:border-[#C8D44E] disabled:opacity-40">
              <option value="member">Membro</option>
              <option value="setor">Adm Setor</option>
              <option value="master">Adm Master</option>
            </select>
            <label className="flex items-center gap-1.5 text-[11px] text-white/60">
              <input type="checkbox" checked={p.active} disabled={p.id === me.id}
                onChange={(e) => setUserActive.mutate({ data: { userId: p.id, active: e.target.checked } })} />
              Ativo
            </label>
            <button onClick={() => { setViewAs(p.id); setView("my"); }}
              className="text-[11px] text-white/60 hover:text-[#C8D44E] transition">Ver demandas</button>
            <button onClick={() => handleRemove(p.id, p.name)} disabled={p.id === me.id}
              className="text-[11px] text-white/40 hover:text-red-400 transition disabled:opacity-30 disabled:cursor-not-allowed">
              Remover
            </button>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-white/30 mt-4">
        Novos cadastros ficam pendentes até a aprovação de um Administrador Master. E-mails pré-cadastrados na equipe inicial entram já aprovados com a função correta.
      </p>
        </>
      )}

      {adding && (
        <AddMemberModal
          loading={adminCreateUser.isPending}
          onClose={() => setAdding(false)}
          onSubmit={(payload) => {
            adminCreateUser.mutate({ data: payload }, {
              onSuccess: () => { toast.success(`${payload.name} adicionado.`); setAdding(false); },
              onError: (e: any) => toast.error(e?.message ?? "Erro ao adicionar membro"),
            });
          }}
        />
      )}
    </div>
  );
}

function AddMemberModal({ onClose, onSubmit, loading }: {
  onClose: () => void;
  loading: boolean;
  onSubmit: (d: { name: string; email: string; password: string; role: Role }) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("member");
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-[#1A1A1A] rounded-xl p-7"
        style={{ border: "1px solid rgba(200,212,78,0.2)" }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-white font-semibold">Adicionar membro</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition"><X size={18} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ name, email, password, role }); }} className="space-y-3">
          <Field label="Nome">
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80}
              className="lz-input" placeholder="Nome do colaborador" />
          </Field>
          <Field label="Email (login)">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="lz-input" placeholder="email@luzeria.com.br" />
          </Field>
          <Field label="Senha provisória">
            <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="lz-input" placeholder="Mínimo 6 caracteres" />
          </Field>
          <Field label="Função">
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="lz-input">
              <option value="member">Membro</option>
              <option value="setor">Adm Setor</option>
              <option value="master">Adm Master</option>
            </select>
          </Field>
          <button type="submit" disabled={loading}
            className="lz-btn-primary w-full rounded-md py-2.5 mt-2 text-sm disabled:opacity-50">
            {loading ? "Criando…" : "Criar membro"}
          </button>
          <p className="text-[10px] text-white/40 text-center mt-2">
            O membro já entra ativo. Compartilhe email e senha para o primeiro acesso.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase font-bold tracking-wider text-white/50">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}