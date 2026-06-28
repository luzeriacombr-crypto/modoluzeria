import { useQuery } from "@tanstack/react-query";
import { profilesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { Avatar } from "./Avatar";
import type { Role } from "@/lib/luzeria/types";
import { roleLabel } from "./Sidebar";
import { useUI } from "@/lib/luzeria/ui-store";

export function SettingsPage() {
  const me = useMe().data;
  const { data: profiles = [] } = useQuery(profilesQO());
  const { setUserRole, setUserActive } = useApi();
  const { setView, setViewAs } = useUI();

  if (me?.role !== "master") {
    return <div className="p-10 text-white/60 text-sm">Acesso restrito ao Administrador Master.</div>;
  }

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <h1 className="text-[32px] font-bold text-white tracking-tight">Colaboradores</h1>
      <p className="text-sm text-white/50 mt-2 mb-8">Gerencie acessos e funções da equipe.</p>

      <div className="bg-[#1C1C1C] rounded-lg overflow-hidden">
        {profiles.map((p) => (
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
          </div>
        ))}
      </div>

      <p className="text-[11px] text-white/30 mt-4">
        Novos colaboradores entram automaticamente como "Membro" ao criar conta. Os e-mails da equipe inicial recebem a função correta no primeiro login.
      </p>
    </div>
  );
}