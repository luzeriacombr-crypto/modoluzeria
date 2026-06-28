import { useQuery } from "@tanstack/react-query";
import { profilesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { Avatar } from "./Avatar";
import type { Role } from "@/lib/luzeria/types";
import { roleLabel } from "./Sidebar";
import { useUI } from "@/lib/luzeria/ui-store";
import { toast } from "sonner";

export function SettingsPage() {
  const me = useMe().data;
  const { data: profiles = [] } = useQuery(profilesQO());
  const { setUserRole, setUserActive, deleteUser } = useApi();
  const { setView, setViewAs } = useUI();

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
    <div className="p-10 max-w-4xl mx-auto">
      <h1 className="text-[32px] font-bold text-white tracking-tight">Colaboradores</h1>
      <p className="text-sm text-white/50 mt-2 mb-8">Gerencie acessos e funções da equipe.</p>

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
    </div>
  );
}