import { useMemo, useState } from "react";
import {
  Archive,
  Copy,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Search,
  Settings2,
  Star,
  Trash2,
} from "lucide-react";
import { useLuzeria } from "@/lib/luzeria/store";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { Client } from "@/lib/luzeria/types";

interface Props {
  onNewClient: () => void;
  onRename: (id: string) => void;
  onStyle: (id: string) => void;
  onCustomFields: (id: string) => void;
}

export function Sidebar({ onNewClient, onRename, onStyle, onCustomFields }: Props) {
  const clients = useLuzeria((s) => s.clients);
  const selectedClientId = useLuzeria((s) => s.selectedClientId);
  const selectClient = useLuzeria((s) => s.selectClient);
  const toggleFavorite = useLuzeria((s) => s.toggleFavorite);
  const duplicateMonth = useLuzeria((s) => s.duplicateMonth);
  const archiveClient = useLuzeria((s) => s.archiveClient);
  const deleteClient = useLuzeria((s) => s.deleteClient);
  const selectedMonthKey = useLuzeria((s) => s.selectedMonthKey);

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);

  const { actives, archived } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filter = (c: Client) =>
      !q || c.name.toLowerCase().includes(q);
    const actives = clients
      .filter((c) => !c.archived && filter(c))
      .sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    const archived = clients
      .filter((c) => c.archived && filter(c))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { actives, archived };
  }, [clients, query]);

  return (
    <>
      <aside
        className="flex h-screen w-[220px] shrink-0 flex-col"
        style={{ backgroundColor: "var(--sidebar)" }}
      >
        <div className="flex items-center gap-2 px-5 pt-6 pb-5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded text-sm font-bold"
            style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}
          >
            L
          </div>
          <button
            onClick={() => selectClient(null)}
            className="text-sm font-semibold tracking-tight text-white transition-opacity hover:opacity-80"
          >
            Luzeria
          </button>
        </div>

        <div className="flex items-center justify-between px-5 pb-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-white/40">
            Clientes
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="rounded p-1 text-white/50 transition hover:bg-white/5 hover:text-white"
              aria-label="Buscar cliente"
            >
              <Search size={13} />
            </button>
            <button
              onClick={onNewClient}
              className="rounded p-1 text-white/50 transition hover:bg-white/5 hover:text-white"
              aria-label="Novo cliente"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="px-3 pb-2">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-white/30 outline-none focus:bg-white/10"
            />
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          <ul className="space-y-0.5">
            {actives.map((c) => (
              <ClientRow
                key={c.id}
                client={c}
                active={c.id === selectedClientId}
                onSelect={() => selectClient(c.id)}
                onFav={() => toggleFavorite(c.id)}
                onRename={() => onRename(c.id)}
                onStyle={() => onStyle(c.id)}
                onCustom={() => onCustomFields(c.id)}
                onDuplicateMonth={() => {
                  duplicateMonth(c.id, selectedMonthKey);
                  toast.success("Mês duplicado");
                }}
                onArchive={() => {
                  archiveClient(c.id, true);
                  toast("Cliente arquivado");
                }}
                onDelete={() => setPendingDelete(c)}
              />
            ))}
          </ul>

          {archived.length > 0 && (
            <div className="mt-6">
              <div className="px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-white/30">
                Arquivados
              </div>
              <ul className="space-y-0.5">
                {archived.map((c) => (
                  <ClientRow
                    key={c.id}
                    client={c}
                    active={c.id === selectedClientId}
                    muted
                    onSelect={() => selectClient(c.id)}
                    onFav={() => toggleFavorite(c.id)}
                    onRename={() => onRename(c.id)}
                    onStyle={() => onStyle(c.id)}
                    onCustom={() => onCustomFields(c.id)}
                    onDuplicateMonth={() => duplicateMonth(c.id, selectedMonthKey)}
                    onArchive={() => {
                      archiveClient(c.id, false);
                      toast("Cliente restaurado");
                    }}
                    onDelete={() => setPendingDelete(c)}
                    archived
                  />
                ))}
              </ul>
            </div>
          )}
        </nav>
      </aside>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os meses e conteúdos de{" "}
              <span className="text-white">{pendingDelete?.name}</span> serão
              removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  deleteClient(pendingDelete.id);
                  toast.success("Cliente excluído");
                }
                setPendingDelete(null);
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface RowProps {
  client: Client;
  active: boolean;
  muted?: boolean;
  archived?: boolean;
  onSelect: () => void;
  onFav: () => void;
  onRename: () => void;
  onStyle: () => void;
  onCustom: () => void;
  onDuplicateMonth: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

function ClientRow({
  client,
  active,
  muted,
  archived,
  onSelect,
  onFav,
  onRename,
  onStyle,
  onCustom,
  onDuplicateMonth,
  onArchive,
  onDelete,
}: RowProps) {
  return (
    <li
      className={cn(
        "group relative flex items-center gap-2 rounded px-2 py-1.5 transition-colors duration-150",
        active ? "" : "hover:bg-white/5",
        muted && "opacity-50"
      )}
      style={active ? { backgroundColor: "#C8D44E" } : undefined}
    >
      <button
        onClick={onSelect}
        className="flex flex-1 items-center gap-2 overflow-hidden text-left"
      >
        <Avatar
          name={client.name}
          color={active ? "#0D0D0D" : client.color}
          icon={client.icon}
          size={22}
        />
        <span
          className={cn(
            "truncate text-[13px] font-medium",
            active ? "text-[#0D0D0D]" : "text-white"
          )}
        >
          {client.name}
        </span>
      </button>

      <button
        onClick={onFav}
        className={cn(
          "shrink-0 rounded p-0.5 transition",
          client.favorite
            ? active
              ? "text-[#0D0D0D]"
              : "text-[#C8D44E]"
            : active
              ? "text-[#0D0D0D]/40 hover:text-[#0D0D0D]"
              : "text-white/0 group-hover:text-white/40 hover:!text-white"
        )}
        aria-label="Favoritar"
      >
        <Star size={12} fill={client.favorite ? "currentColor" : "none"} />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={cn(
              "shrink-0 rounded p-0.5 transition",
              active
                ? "text-[#0D0D0D]/60 hover:text-[#0D0D0D]"
                : "text-white/0 group-hover:text-white/40 hover:!text-white"
            )}
            aria-label="Mais opções"
          >
            <MoreHorizontal size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onRename}>
            <Pencil size={13} className="mr-2" /> Renomear
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onStyle}>
            <Palette size={13} className="mr-2" /> Cor e ícone
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicateMonth}>
            <Copy size={13} className="mr-2" /> Duplicar mês
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCustom}>
            <Settings2 size={13} className="mr-2" /> Campos personalizados
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onArchive}>
            <Archive size={13} className="mr-2" />
            {archived ? "Restaurar" : "Arquivar"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 size={13} className="mr-2" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}