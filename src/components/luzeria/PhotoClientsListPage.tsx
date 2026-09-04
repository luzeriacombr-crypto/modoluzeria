import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Images, ImageIcon, Plus, ShieldCheck, Trash2, Type, Upload } from "lucide-react";
import { photoClientsQO, useApi, useMe } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { supabase } from "@/integrations/supabase/client";
import { getWatermarkPreview } from "@/lib/luzeria/photo-selection.functions";
import { Modal } from "./Modals";

const MAX_WATERMARK_BYTES = 3 * 1024 * 1024;
type WatermarkMode = "none" | "text" | "image";
type WatermarkDensity = "baixa" | "media" | "alta";
const DENSITY_LABEL: Record<WatermarkDensity, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };

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
 * seleção, queimada nos pixels no servidor (nunca é só CSS por cima).
 * Duas formas: um padrão de texto gerado na hora (customizável) ou um PNG
 * próprio enviado pela agência. */
function WatermarkSettings() {
  const { data: me } = useMe();
  const { updateMyOrg } = useApi();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mode = (me?.orgPhotoWatermarkMode ?? "none") as WatermarkMode;
  const [text, setText] = useState(me?.orgPhotoWatermarkText || "REPRODUÇÃO PROIBIDA");
  const [opacity, setOpacity] = useState(me?.orgPhotoWatermarkOpacity ?? 35);
  const [density, setDensity] = useState<WatermarkDensity>(me?.orgPhotoWatermarkDensity ?? "media");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!me || dirty) return;
    setText(me.orgPhotoWatermarkText || "REPRODUÇÃO PROIBIDA");
    setOpacity(me.orgPhotoWatermarkOpacity ?? 35);
    setDensity(me.orgPhotoWatermarkDensity ?? "media");
  }, [me, dirty]);

  if (me?.role !== "master") return null;

  function setMode(next: WatermarkMode) {
    updateMyOrg.mutate({ data: { photoWatermarkMode: next } }, {
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
    });
  }

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
      await updateMyOrg.mutateAsync({ data: { photoWatermarkPath: path, photoWatermarkMode: "image" } });
      toast.success("Marca d'água atualizada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar a marca d'água.");
    } finally {
      setUploading(false);
    }
  }

  function saveText() {
    updateMyOrg.mutate({ data: { photoWatermarkText: text.trim(), photoWatermarkOpacity: opacity, photoWatermarkDensity: density } }, {
      onSuccess: () => { setDirty(false); toast.success("Marca d'água atualizada."); },
      onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
    });
  }

  return (
    <div className="rounded-xl p-4 mb-6" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
      <div className="flex items-center gap-3 mb-1">
        <ShieldCheck size={16} className="text-foreground/40 shrink-0" />
        <div className="text-sm font-semibold text-foreground">Marca d'água de proteção</div>
      </div>
      <p className="text-foreground/40 text-xs mb-3">
        Toda foto do link público já passa por aqui — sem marca configurada, ela aparece sem proteção nenhuma.
      </p>

      <div className="flex items-center gap-2 mb-4">
        <ModePill active={mode === "none"} onClick={() => setMode("none")}>Nenhuma</ModePill>
        <ModePill active={mode === "text"} onClick={() => setMode("text")} icon={<Type size={12} />}>Texto</ModePill>
        <ModePill active={mode === "image"} onClick={() => setMode("image")} icon={<ImageIcon size={12} />}>Imagem</ModePill>
      </div>

      {mode === "text" && (
        <TextWatermarkEditor
          text={text} opacity={opacity} density={density}
          onText={(v) => { setText(v); setDirty(true); }}
          onOpacity={(v) => { setOpacity(v); setDirty(true); }}
          onDensity={(v) => { setDensity(v); setDirty(true); }}
          onSave={saveText}
          saving={updateMyOrg.isPending}
          dirty={dirty}
        />
      )}

      {mode === "image" && (
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-lg shrink-0 grid place-items-center overflow-hidden" style={{ background: "color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
            {me?.orgPhotoWatermarkUrl ? (
              <img src={me.orgPhotoWatermarkUrl} alt="Marca d'água" className="max-w-full max-h-full object-contain" />
            ) : (
              <ImageIcon size={20} className="text-foreground/25" />
            )}
          </div>
          <div className="flex-1 min-w-0 text-foreground/40 text-xs">
            PNG com transparência — sai repetido em grade por cima de cada foto.
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
        </div>
      )}
    </div>
  );
}

function ModePill({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full transition-colors"
      style={{
        backgroundColor: active ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 6%, transparent)",
        color: active ? "#0D0D0D" : "color-mix(in srgb, var(--foreground) 60%, transparent)",
      }}
    >
      {icon}{children}
    </button>
  );
}

function TextWatermarkEditor({ text, opacity, density, onText, onOpacity, onDensity, onSave, saving, dirty }: {
  text: string; opacity: number; density: WatermarkDensity;
  onText: (v: string) => void; onOpacity: (v: number) => void; onDensity: (v: WatermarkDensity) => void;
  onSave: () => void; saving: boolean; dirty: boolean;
}) {
  const previewFn = useServerFn(getWatermarkPreview);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingPreview(true);
    const t = setTimeout(() => {
      previewFn({ data: { text: text || "REPRODUÇÃO PROIBIDA", opacity, density } })
        .then((r) => { if (!cancelled) setPreviewUrl(r.dataUrl); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoadingPreview(false); });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [text, opacity, density]);

  return (
    <div>
      <div className="rounded-lg overflow-hidden mb-4 relative" style={{ aspectRatio: "800/450", background: "#1C1C1C" }}>
        {previewUrl && <img src={previewUrl} alt="Pré-visualização" className="w-full h-full object-cover" />}
        {loadingPreview && (
          <div className="absolute inset-0 grid place-items-center text-white/40 text-xs" style={{ background: previewUrl ? "rgba(0,0,0,0.25)" : "transparent" }}>
            Atualizando…
          </div>
        )}
      </div>

      <label className="block text-[11px] font-bold uppercase tracking-wide text-foreground/40 mb-1.5">Texto</label>
      <input
        value={text} onChange={(e) => onText(e.target.value)} maxLength={60}
        placeholder="REPRODUÇÃO PROIBIDA"
        className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] mb-3"
      />

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-foreground/40 mb-1.5">
            Opacidade — {opacity}%
          </label>
          <input
            type="range" min={5} max={90} value={opacity}
            onChange={(e) => onOpacity(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-foreground/40 mb-1.5">Quantidade de texto</label>
          <div className="flex items-center gap-1.5">
            {(["baixa", "media", "alta"] as WatermarkDensity[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onDensity(d)}
                className="flex-1 text-[11px] font-semibold px-2 py-1.5 rounded-md border transition"
                style={{
                  borderColor: density === d ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 12%, transparent)",
                  color: density === d ? "var(--lz-accent-ink)" : "color-mix(in srgb, var(--foreground) 60%, transparent)",
                }}
              >
                {DENSITY_LABEL[d]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onSave}
          disabled={saving || !dirty}
          className="lz-btn-primary text-xs px-5 py-2.5 rounded-md disabled:opacity-50"
        >
          {saving ? "Salvando…" : "Salvar marca d'água"}
        </button>
      </div>
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
