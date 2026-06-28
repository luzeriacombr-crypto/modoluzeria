import { useMemo, useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search, Star, MoreHorizontal, LayoutDashboard, Archive, ChevronDown,
  Settings, LogOut, Plus,
} from "lucide-react";
import { clientsQO, useApi, useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { Avatar } from "./Avatar";
import { PRESET_COLORS } from "@/lib/luzeria/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Client } from "@/lib/luzeria/types";

export function Sidebar({
  onOpenCustomFields,
  onCreateClient,
}: { onOpenCustomFields: (c: Client) => void; onCreateClient: () => void }) {
  const me = useMe().data;
  const { data: clients = [] } = useQuery(clientsQO());
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const { selectedClientId, view, selectClient, setView } = useUI();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clients.filter((c) =>
      (showArchived ? c.archived : !c.archived) &&
      (!term || c.name.toLowerCase().includes(term))
    );
  }, [clients, search, showArchived]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name)),
    [filtered]
  );

  const archivedCount = clients.filter((c) => c.archived).length;
  const isAdmin = me?.role === "master" || me?.role === "setor";

  return (
    <aside className="sidebar-gradient w-[240px] flex flex-col h-screen text-white shrink-0">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md flex items-center justify-center text-sm font-bold" style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}>L</div>
          <span className="text-base font-bold tracking-tight">Luzeria</span>
        </div>
      </div>
      <div className="mx-5 h-px" style={{ backgroundColor: "rgba(200,212,78,0.2)" }} />

      {/* My tasks + dashboard nav */}
      <div className="px-3 pt-4 pb-2 space-y-0.5">
        <NavButton
          icon={<LayoutDashboard size={15} />}
          label="Minhas demandas"
          active={view === "my"}
          onClick={() => setView("my")}
        />
        <NavButton
          icon={<Search size={15} />}
          label="Visão geral"
          active={view === "dashboard"}
          onClick={() => setView("dashboard")}
        />
      </div>

      {/* Clients */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Clientes</span>
        {isAdmin && (
          <button onClick={onCreateClient} className="text-white/40 hover:text-white transition-colors" title="Novo cliente">
            <Plus size={14} />
          </button>
        )}
      </div>
      <div className="px-3">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/5">
          <Search size={13} className="text-white/40" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="bg-transparent text-xs flex-1 outline-none placeholder:text-white/30 text-white"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-2 pb-3 px-2">
        {sorted.map((c) => (
          <ClientRow key={c.id} client={c} active={selectedClientId === c.id && view === "client"}
            onClick={() => selectClient(c.id)}
            onOpenCustomFields={() => onOpenCustomFields(c)}
            canManage={isAdmin}
          />
        ))}
        {sorted.length === 0 && (
          <div className="text-xs text-white/30 text-center mt-6 px-3">
            {search ? "Nenhum cliente encontrado." : showArchived ? "Sem arquivados." : "Sem clientes ainda."}
          </div>
        )}

        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived((s) => !s)}
            className="mt-3 w-full flex items-center gap-2 px-3 py-2 text-[11px] uppercase tracking-wider text-white/40 hover:text-white/70 transition"
          >
            <Archive size={12} />
            {showArchived ? "Mostrar ativos" : `Arquivados (${archivedCount})`}
          </button>
        )}
      </div>

      {/* Footer user */}
      <UserFooter onSettings={() => setView("settings")} />
    </aside>
  );
}

function NavButton({ icon, label, active, onClick, badge }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center justify-between gap-2 pl-3 pr-2 py-2 rounded-md transition-colors text-sm relative"
      style={{
        backgroundColor: active ? "rgba(200,212,78,0.12)" : "transparent",
        color: active ? "#FFFFFF" : "rgba(255,255,255,0.7)",
      }}>
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r" style={{ backgroundColor: "#C8D44E" }} />}
      <span className="flex items-center gap-2.5">
        <span className={active ? "text-[#C8D44E]" : "text-white/60"}>{icon}</span>
        {label}
      </span>
      {badge !== undefined && badge > 0 && (
        <span className="text-[10px] font-bold px-1.5 rounded" style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}>{badge}</span>
      )}
    </button>
  );
}

function ClientRow({ client, active, onClick, onOpenCustomFields, canManage }: {
  client: Client; active: boolean; onClick: () => void; onOpenCustomFields: () => void; canManage: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { updateClient, deleteClient, duplicateMonth } = useApi();

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const monthKey = useUI((s) => s.selectedMonthKey);

  return (
    <div ref={ref}
      className="group relative rounded-md transition-colors mx-1"
      style={{ backgroundColor: active ? "rgba(200,212,78,0.12)" : "transparent" }}
      onMouseLeave={() => setMenuOpen(false)}
    >
      {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r" style={{ backgroundColor: "#C8D44E" }} />}
      <button onClick={onClick}
        onMouseEnter={(e) => { if (!active) (e.currentTarget.parentElement as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.05)"; }}
        onMouseLeave={(e) => { if (!active) (e.currentTarget.parentElement as HTMLElement).style.backgroundColor = "transparent"; }}
        className="w-full flex items-center gap-2.5 pl-3 pr-9 py-2 text-left transition-colors"
      >
        <Avatar name={client.name} color={client.color} size={26} />
        <span className="text-sm truncate text-white/90 flex-1">{client.name}</span>
        {client.favorite && <Star size={12} className="text-[#C8D44E] fill-[#C8D44E]" />}
      </button>

      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); updateClient.mutate({ data: { id: client.id, patch: { favorite: !client.favorite } } }); }}
          className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white">
          <Star size={13} className={client.favorite ? "fill-[#C8D44E] text-[#C8D44E]" : ""} />
        </button>
        {canManage && (
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white">
            <MoreHorizontal size={14} />
          </button>
        )}
      </div>

      {menuOpen && (
        <div className="absolute z-50 left-full ml-1 top-0 min-w-[200px] rounded-md bg-[#1C1C1C] border border-white/10 shadow-xl py-1">
          <MenuItem onClick={() => {
            const name = prompt("Novo nome", client.name)?.trim();
            if (name) updateClient.mutate({ data: { id: client.id, patch: { name } } });
            setMenuOpen(false);
          }}>Renomear</MenuItem>
          <div className="px-3 py-2">
            <div className="text-[10px] uppercase text-white/40 mb-1.5">Cor</div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button key={c} onClick={() => updateClient.mutate({ data: { id: client.id, patch: { color: c } } })}
                  className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: client.color === c ? "#C8D44E" : "transparent" }} />
              ))}
            </div>
            <div className="text-[10px] uppercase text-white/40 mt-3 mb-1">Inicial / Emoji</div>
            <input
              defaultValue={client.icon ?? ""}
              placeholder="(automático)"
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== (client.icon ?? null))
                  updateClient.mutate({ data: { id: client.id, patch: { icon: v } } });
              }}
              className="w-full text-xs bg-[#0D0D0D] border border-white/10 rounded px-2 py-1 text-white outline-none focus:border-[#C8D44E]"
              maxLength={2}
            />
          </div>
          <MenuItem onClick={() => {
            duplicateMonth.mutate({ data: { clientId: client.id, fromKey: monthKey } });
            toast.success("Mês duplicado");
            setMenuOpen(false);
          }}>Duplicar mês</MenuItem>
          <MenuItem onClick={() => { onOpenCustomFields(); setMenuOpen(false); }}>Campos personalizados</MenuItem>
          <MenuItem onClick={() => {
            updateClient.mutate({ data: { id: client.id, patch: { archived: !client.archived } } });
            setMenuOpen(false);
          }}>{client.archived ? "Desarquivar" : "Arquivar"}</MenuItem>
          <div className="h-px bg-white/10 my-1" />
          <MenuItem destructive onClick={() => {
            if (confirm(`Excluir "${client.name}" e todo seu histórico?`)) {
              deleteClient.mutate({ data: { id: client.id } });
            }
            setMenuOpen(false);
          }}>Excluir</MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick, destructive }: { children: React.ReactNode; onClick: () => void; destructive?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-3 py-2 text-xs transition-colors ${destructive ? "text-red-400 hover:bg-red-500/10" : "text-white/80 hover:bg-white/5"}`}>
      {children}
    </button>
  );
}

function UserFooter({ onSettings }: { onSettings: () => void }) {
  const me = useMe().data;
  const isMaster = me?.role === "master";
  async function logout() {
    await supabase.auth.signOut();
    location.href = "/auth";
  }
  if (!me) return null;
  return (
    <div className="px-3 py-3 border-t border-white/10">
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <Avatar profile={me} size={30} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold truncate text-white">{me.name}</div>
          <span className="inline-block text-[9px] uppercase font-bold mt-0.5 px-1.5 py-0.5 rounded"
            style={{ backgroundColor: "rgba(200,212,78,0.15)", color: "#C8D44E" }}>
            {roleLabel(me.role)}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {isMaster && (
            <button onClick={onSettings} title="Configurações"
              className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition">
              <Settings size={14} />
            </button>
          )}
          <button onClick={logout} title="Sair"
            className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function roleLabel(r: string) {
  if (r === "master") return "Master";
  if (r === "setor") return "Adm Setor";
  return "Membro";
}