import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Images, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import { photoClientsQO, useApi, useMe } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { supabase } from "@/integrations/supabase/client";
import { Modal } from "./Modals";

const MAX_WATERMARK_BYTES = 3 * 1024 * 1024;

/** Página inicial da área independente "Seleção de Fotos": lista os
 * clientes de fotografia (entidade própria, sem nada de posts/reels) da
 * agência; clicar num deles vai pra `/selecao-de-fotos/$clientId`, que
 * gerencia as seleções dele via `PhotoSelectionsPanel`. */
export function PhotoClientsListPage() {
  const { data: photoClients = [], isLoading } = useQuery(photoClientsQO());
  const { deletePhotoClient } = useApi();
  const [showNew, setShowNew] = useState(false);

  async function handleDelete(id: string, name: string) {
    if (!(await requestConfirm(`Remover "${name}"? Todas as seleções desse cliente também somem.`, { danger: true }))) return;
    deletePhotoClient.mutate({ data: { id } });
  }

  return (
    <div className="px-5 md:px-10 py-8 max-w-[1100px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <h1 className="text-foreground font-semibold text-lg inline-flex items-center gap-2">
          <Images size={18} className="text-[var(--lz-accent-ink)]" />
          Seleção de Fotos
        </h1>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-2 rounded-md text-black"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
        >
          <Plus size={14} /> Novo cliente
        </button>
      </div>

      <p className="text-foreground/40 text-xs leading-relaxed mb-5 max-w-xl">
        Área independente pra clientes de fotografia escolherem suas fotos
        direto de uma pasta do Google Drive, sem precisar de login. Cadastre
        o cliente, entre nele e crie um link de seleção.
      </p>

      <WatermarkSettings />

      {isLoading ? (
        <div className="text-foreground/40 text-sm py-10 text-center">Carregando…</div>
      ) : photoClients.length === 0 ? (
        <div className="border border-dashed border-foreground/10 rounded-lg p-14 text-center text-foreground/30 text-sm">
          Nenhum cliente de fotografia cadastrado ainda.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {photoClients.map((c) => (
            <div key={c.id} className="relative group">
              <Link
                to="/selecao-de-fotos/$clientId"
                params={{ clientId: c.id }}
                className="rounded-xl bg-card border border-foreground/7 p-5 flex flex-col items-center gap-2 text-center hover:border-[rgb(var(--lz-brand-rgb))]/40 transition w-full"
              >
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: "color-mix(in srgb, var(--foreground) 8%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
                >
                  <Images size={20} />
                </div>
                <div className="text-foreground text-sm font-semibold leading-snug truncate w-full">{c.name}</div>
              </Link>
              <button
                onClick={(e) => { e.preventDefault(); handleDelete(c.id, c.name); }}
                className="absolute top-2 right-2 p-1.5 rounded text-foreground/30 hover:text-red-400 hover:bg-foreground/5 transition opacity-0 group-hover:opacity-100"
                title="Remover cliente"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showNew && <NewPhotoClientModal onClose={() => setShowNew(false)} />}
    </div>
  );
}

/** Marca d'água só do Master (mesma trava de storage do upload de logo da
 * agência) — protege as fotos que aparecem no link público de cada
 * seleção, queimada nos pixels no servidor (nunca é só CSS por cima). */
function WatermarkSettings() {
  const { data: me } = useMe();
  const { updateMyOrg } = useApi();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (me?.role !== "master") return null;

  async function pickWatermark(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "image/png") { toast.error("A marca d'água precisa ser um PNG (com transparência)."); return; }
    if (file.size > MAX_WATERMARK_BYTES) { toast.error("Imagem muito grande (máximo 3 MB)."); return; }
    setUploading(true);
    try {
      const path = `org-logos/${me!.orgId}/watermark-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type, upsert: true,
      });
      if (upErr) throw upErr;
      await updateMyOrg.mutateAsync({ data: { photoWatermarkPath: path } });
      toast.success("Marca d'água atualizada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar a marca d'água.");
    } finally {
      setUploading(false);
    }
  }

  function removeWatermark() {
    updateMyOrg.mutate({ data: { photoWatermarkPath: null } }, {
      onSuccess: () => toast.success("Marca d'água removida — as fotos passam a aparecer sem proteção."),
      onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
    });
  }

  return (
    <div className="rounded-xl p-4 mb-6 flex items-center gap-4" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
      <div className="size-14 rounded-lg shrink-0 grid place-items-center overflow-hidden" style={{ background: "color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
        {me?.orgPhotoWatermarkUrl ? (
          <img src={me.orgPhotoWatermarkUrl} alt="Marca d'água" className="max-w-full max-h-full object-contain" />
        ) : (
          <ShieldCheck size={20} className="text-foreground/25" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground">Marca d'água de proteção</div>
        <div className="text-foreground/40 text-xs mt-0.5">
          {me?.orgPhotoWatermarkUrl
            ? "As fotos do link público já saem com essa marca queimada na imagem."
            : "Sem marca d'água configurada — as fotos aparecem sem proteção nenhuma no link público."}
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/png" className="hidden" onChange={pickWatermark} />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-md border border-foreground/10 text-foreground/70 hover:text-foreground hover:border-foreground/25 transition disabled:opacity-50 shrink-0"
      >
        <Upload size={13} /> {uploading ? "Enviando…" : me?.orgPhotoWatermarkUrl ? "Trocar" : "Enviar PNG"}
      </button>
      {me?.orgPhotoWatermarkUrl && (
        <button
          type="button"
          onClick={removeWatermark}
          className="p-2 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5 transition shrink-0"
          title="Remover marca d'água"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

function NewPhotoClientModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const { createPhotoClient } = useApi();

  function submit() {
    if (!name.trim()) { toast.error("Dá um nome pra esse cliente."); return; }
    createPhotoClient.mutate({ data: { name: name.trim() } }, {
      onSuccess: () => { toast.success(`Cliente "${name.trim()}" criado.`); onClose(); },
      onError: (e: any) => toast.error(e?.message ?? "Não consegui criar o cliente. Tenta de novo?"),
    });
  }

  return (
    <Modal open onClose={onClose} title="Novo cliente de fotografia">
      <label className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">Nome</label>
      <input
        value={name} onChange={(e) => setName(e.target.value)} autoFocus
        placeholder="Ex: Andreia Rodrigues"
        className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))]"
      />
      <div className="flex items-center justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-3 py-2 text-sm text-foreground/60 hover:text-foreground">Cancelar</button>
        <button
          disabled={!name.trim() || createPhotoClient.isPending}
          onClick={submit}
          className="px-4 py-2 rounded-md text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          Criar
        </button>
      </div>
    </Modal>
  );
}
