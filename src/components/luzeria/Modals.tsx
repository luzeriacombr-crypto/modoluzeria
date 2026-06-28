import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLuzeria } from "@/lib/luzeria/store";
import { PRESET_COLORS, PRESET_ICONS } from "@/lib/luzeria/utils";
import { TEAM } from "@/lib/luzeria/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/* New Client */
export function NewClientModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const addClient = useLuzeria((s) => s.addClient);
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) setName("");
  }, [open]);

  function submit() {
    const n = name.trim();
    if (!n) return;
    addClient(n);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo cliente</DialogTitle>
          <DialogDescription>
            O sistema cria automaticamente o mês atual com 6 posts e 6 reels em
            status START.
          </DialogDescription>
        </DialogHeader>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Nome do cliente"
          className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded px-3 py-2 text-xs text-muted-foreground transition hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-30"
          >
            Criar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Rename */
export function RenameModal({
  clientId,
  onClose,
}: {
  clientId: string | null;
  onClose: () => void;
}) {
  const client = useLuzeria((s) =>
    s.clients.find((c) => c.id === clientId) ?? null
  );
  const rename = useLuzeria((s) => s.renameClient);
  const [name, setName] = useState("");

  useEffect(() => {
    if (client) setName(client.name);
  }, [client?.id]);

  if (!clientId) return null;

  return (
    <Dialog open={clientId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renomear cliente</DialogTitle>
        </DialogHeader>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const t = name.trim();
              if (t) rename(clientId, t);
              onClose();
            }
          }}
          className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded px-3 py-2 text-xs text-muted-foreground transition hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              const t = name.trim();
              if (t) rename(clientId, t);
              onClose();
            }}
            className="rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Color + icon */
export function StyleModal({
  clientId,
  onClose,
}: {
  clientId: string | null;
  onClose: () => void;
}) {
  const client = useLuzeria((s) =>
    s.clients.find((c) => c.id === clientId) ?? null
  );
  const setStyle = useLuzeria((s) => s.setClientStyle);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [icon, setIcon] = useState(PRESET_ICONS[0]);

  useEffect(() => {
    if (client) {
      setColor(client.color);
      setIcon(client.icon);
    }
  }, [client?.id]);

  if (!clientId) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cor e ícone</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cor
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-7 w-7 rounded-full transition",
                    color === c && "ring-2 ring-white ring-offset-2 ring-offset-card"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Ícone
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_ICONS.map((i) => (
                <button
                  key={i}
                  onClick={() => setIcon(i)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded text-lg transition hover:bg-white/5",
                    icon === i && "bg-white/10 ring-1 ring-primary"
                  )}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded px-3 py-2 text-xs text-muted-foreground transition hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              setStyle(clientId, color, icon);
              onClose();
            }}
            className="rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Custom fields */
export function CustomFieldsModal({
  clientId,
  onClose,
}: {
  clientId: string | null;
  onClose: () => void;
}) {
  const client = useLuzeria((s) =>
    s.clients.find((c) => c.id === clientId) ?? null
  );
  const setFields = useLuzeria((s) => s.setCustomFields);

  const [niche, setNiche] = useState("");
  const [posts, setPosts] = useState(0);
  const [reels, setReels] = useState(0);
  const [resp, setResp] = useState("");
  const [day, setDay] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (client) {
      setNiche(client.customFields.niche);
      setPosts(client.customFields.postsPerWeek);
      setReels(client.customFields.reelsPerWeek);
      setResp(client.customFields.fixedResponsible);
      setDay(client.customFields.reviewDay);
      setNotes(client.customFields.notes);
    }
  }, [client?.id]);

  if (!clientId) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Campos personalizados</DialogTitle>
          <DialogDescription>
            Aparecem na aba “Perfil” do cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Nicho">
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="Ex: Saúde da mulher"
              className="lz-input"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Posts/semana">
              <input
                type="number"
                min={0}
                value={posts}
                onChange={(e) => setPosts(Number(e.target.value) || 0)}
                className="lz-input"
              />
            </Field>
            <Field label="Reels/semana">
              <input
                type="number"
                min={0}
                value={reels}
                onChange={(e) => setReels(Number(e.target.value) || 0)}
                className="lz-input"
              />
            </Field>
          </div>
          <Field label="Responsável fixo">
            <Select value={resp || "__none"} onValueChange={(v) => setResp(v === "__none" ? "" : v)}>
              <SelectTrigger className="h-9 bg-white/5 border-white/10">
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Nenhum</SelectItem>
                {TEAM.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Dia preferencial de revisão">
            <input
              value={day}
              onChange={(e) => setDay(e.target.value)}
              placeholder="Ex: Toda sexta"
              className="lz-input"
            />
          </Field>
          <Field label="Observações gerais">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="lz-input resize-none"
            />
          </Field>
        </div>
        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded px-3 py-2 text-xs text-muted-foreground transition hover:bg-white/5 hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              setFields(clientId, {
                niche,
                postsPerWeek: posts,
                reelsPerWeek: reels,
                fixedResponsible: resp,
                reviewDay: day,
                notes,
              });
              onClose();
            }}
            className="rounded bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Salvar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}